-- Received nudges are actionable alerts. The sender remains stored for abuse
-- auditing, but clients intentionally never select or display sent_by.
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  to_member_id uuid not null references auth.users(id) on delete cascade,
  chore_id text not null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  seen boolean not null default false
);

alter table public.nudges
  add column if not exists seen boolean not null default false;

-- Older Homie schemas referenced a legacy household_members(id) and UUID chore
-- table. Current shared chores use text IDs and members use auth.users IDs.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select foreign_key.conname as constraint_name
    from pg_constraint foreign_key
    where foreign_key.conrelid = 'public.nudges'::regclass
      and foreign_key.contype = 'f'
      and exists (
        select 1
        from unnest(foreign_key.conkey) as local_key(attnum)
        join pg_attribute local_column
          on local_column.attrelid = foreign_key.conrelid
          and local_column.attnum = local_key.attnum
        where local_column.attname in ('to_member_id', 'chore_id', 'sent_by')
      )
  loop
    execute format('alter table public.nudges drop constraint %I', constraint_row.constraint_name);
  end loop;
end $$;

alter table public.nudges
  alter column chore_id type text using chore_id::text;

-- Legacy rows used obsolete member-record IDs and cannot be delivered to a
-- signed-in auth user. Nudges are ephemeral, so discard undeliverable rows and
-- retain valid rows while normalizing an invalid audit sender to null.
delete from public.nudges nudge
where not exists (
  select 1 from auth.users account where account.id = nudge.to_member_id
);
update public.nudges nudge
set sent_by = null
where sent_by is not null
  and not exists (
    select 1 from auth.users account where account.id = nudge.sent_by
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nudges'::regclass
      and conname = 'nudges_to_member_id_fkey'
  ) then
    alter table public.nudges
      add constraint nudges_to_member_id_fkey
      foreign key (to_member_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nudges'::regclass
      and conname = 'nudges_sent_by_fkey'
  ) then
    alter table public.nudges
      add constraint nudges_sent_by_fkey
      foreign key (sent_by) references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.nudges enable row level security;

drop policy if exists "household members can manage nudges" on public.nudges;
create policy "household members can manage nudges"
  on public.nudges for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nudges'
  ) then
    alter publication supabase_realtime add table public.nudges;
  end if;
end $$;

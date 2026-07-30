-- Sweet Essentials assignments are independent member relationships. Keeping
-- them out of household_states prevents one stale snapshot from replacing
-- another member's assignment.
create table if not exists public.sweet_essential_item_assignments (
  household_id uuid not null references public.households(id) on delete cascade,
  section_key text not null check (length(section_key) between 1 and 120),
  item_id text not null check (length(item_id) between 1 and 180),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, section_key, item_id, user_id)
);

create index if not exists sweet_essential_assignments_item_idx
  on public.sweet_essential_item_assignments(household_id, section_key, item_id);
create index if not exists sweet_essential_assignments_user_idx
  on public.sweet_essential_item_assignments(household_id, user_id);

alter table public.sweet_essential_item_assignments enable row level security;

drop policy if exists "members read Sweet Essential assignments"
  on public.sweet_essential_item_assignments;
create policy "members read Sweet Essential assignments"
  on public.sweet_essential_item_assignments for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members assign themselves to Sweet Essentials"
  on public.sweet_essential_item_assignments;
create policy "members assign themselves to Sweet Essentials"
  on public.sweet_essential_item_assignments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_household_member(household_id)
  );

drop policy if exists "members unassign themselves from Sweet Essentials"
  on public.sweet_essential_item_assignments;
create policy "members unassign themselves from Sweet Essentials"
  on public.sweet_essential_item_assignments for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_household_member(household_id)
  );

-- Idempotently preserve valid legacy single-assignee values stored in the
-- household JSON document. Invalid, missing, cross-household, and non-UUID
-- values are skipped.
insert into public.sweet_essential_item_assignments (
  household_id,
  section_key,
  item_id,
  user_id
)
select
  state_row.household_id,
  section_entry.key,
  item_entry.key,
  member.user_id
from public.household_states state_row
cross join lateral jsonb_each(
  coalesce(state_row.state -> 'essentialsAssignees', '{}'::jsonb)
) section_entry
cross join lateral jsonb_each(section_entry.value) item_entry
join public.household_members member
  on member.household_id = state_row.household_id
 and member.user_id::text = item_entry.value #>> '{}'
 and member.status = 'active'
where jsonb_typeof(item_entry.value) = 'string'
  and (item_entry.value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (household_id, section_key, item_id, user_id) do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sweet_essential_item_assignments'
  ) then
    alter publication supabase_realtime
      add table public.sweet_essential_item_assignments;
  end if;
end $$;

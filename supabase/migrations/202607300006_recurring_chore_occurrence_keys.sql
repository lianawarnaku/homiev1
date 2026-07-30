-- Recurring chore payloads currently live in household_states, but their
-- identity must still be enforced independently of whole-snapshot races.
create table if not exists public.recurring_chore_occurrence_keys (
  household_id uuid not null references public.households(id) on delete cascade,
  recurrence_series_id text not null,
  scheduled_date date not null,
  occurrence_id text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, recurrence_series_id, scheduled_date),
  unique (household_id, occurrence_id)
);

create index if not exists recurring_chore_occurrence_keys_scheduled_idx
  on public.recurring_chore_occurrence_keys (household_id, scheduled_date);

alter table public.recurring_chore_occurrence_keys enable row level security;

drop policy if exists "members read recurring chore occurrence keys"
  on public.recurring_chore_occurrence_keys;
create policy "members read recurring chore occurrence keys"
  on public.recurring_chore_occurrence_keys for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members claim recurring chore occurrence keys"
  on public.recurring_chore_occurrence_keys;
create policy "members claim recurring chore occurrence keys"
  on public.recurring_chore_occurrence_keys for insert
  to authenticated
  with check (public.is_household_member(household_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recurring_chore_occurrence_keys'
  ) then
    alter publication supabase_realtime
      add table public.recurring_chore_occurrence_keys;
  end if;
end
$$;

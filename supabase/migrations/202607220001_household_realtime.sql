-- One realtime document per Roomie household. The mobile client keeps the
-- selected roommate local and syncs only shared household collections.
create table if not exists public.household_states (
  household_key text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.household_states enable row level security;

drop policy if exists "authenticated household state read" on public.household_states;
create policy "authenticated household state read"
  on public.household_states for select
  to authenticated
  using (true);

drop policy if exists "authenticated household state create" on public.household_states;
create policy "authenticated household state create"
  on public.household_states for insert
  to authenticated
  with check (auth.uid() = updated_by);

drop policy if exists "authenticated household state update" on public.household_states;
create policy "authenticated household state update"
  on public.household_states for update
  to authenticated
  using (true)
  with check (auth.uid() = updated_by);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_states'
  ) then
    alter publication supabase_realtime add table public.household_states;
  end if;
end $$;

create index if not exists household_states_updated_at_idx
  on public.household_states (updated_at desc);

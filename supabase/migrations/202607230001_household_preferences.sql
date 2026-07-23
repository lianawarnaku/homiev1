-- Shared, realtime household preferences. AsyncStorage may cache UI state, but
-- this table is the source of truth for settings every roommate must see.
create table if not exists public.household_preferences (
  household_id uuid primary key references public.households(id) on delete cascade,
  color_scheme text not null default 'blue'
    check (color_scheme in ('blue', 'brown', 'pinkWhite', 'blueWhite')),
  points_enabled boolean not null default true,
  plant_enabled boolean not null default true,
  household_complete boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.household_preferences enable row level security;

drop policy if exists "members read household preferences" on public.household_preferences;
create policy "members read household preferences"
  on public.household_preferences for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members create household preferences" on public.household_preferences;
create policy "members create household preferences"
  on public.household_preferences for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and auth.uid() = updated_by
  );

drop policy if exists "members update household preferences" on public.household_preferences;
create policy "members update household preferences"
  on public.household_preferences for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and auth.uid() = updated_by
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'household_preferences'
  ) then
    alter publication supabase_realtime add table public.household_preferences;
  end if;
end $$;

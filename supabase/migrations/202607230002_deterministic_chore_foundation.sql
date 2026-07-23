create table if not exists public.item_difficulty (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null check (category in ('kitchen', 'bathroom', 'living', 'other')),
  item text not null,
  difficulty int not null check (difficulty between 1 and 5),
  unique (household_id, category, item)
);

create table if not exists public.member_task_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value int not null default 50 check (value between 0 and 100),
  unique (household_id, member_id, key)
);

create table if not exists public.proposed_charts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.proposed_chart_approvals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  proposed_chart_id uuid not null references public.proposed_charts(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  approved boolean not null,
  approved_at timestamptz not null default now(),
  unique (proposed_chart_id, member_id)
);

alter table public.item_difficulty enable row level security;
alter table public.member_task_preferences enable row level security;
alter table public.proposed_charts enable row level security;
alter table public.proposed_chart_approvals enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'item_difficulty', 'member_task_preferences', 'proposed_charts', 'proposed_chart_approvals'
  ] loop
    execute format('drop policy if exists "household members select" on public.%I', table_name);
    execute format(
      'create policy "household members select" on public.%I for select to authenticated using (public.is_household_member(household_id))',
      table_name
    );
    execute format('drop policy if exists "household members insert" on public.%I', table_name);
    execute format(
      'create policy "household members insert" on public.%I for insert to authenticated with check (public.is_household_member(household_id))',
      table_name
    );
    execute format('drop policy if exists "household members update" on public.%I', table_name);
    execute format(
      'create policy "household members update" on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',
      table_name
    );
    execute format('drop policy if exists "household members delete" on public.%I', table_name);
    execute format(
      'create policy "household members delete" on public.%I for delete to authenticated using (public.is_household_member(household_id))',
      table_name
    );
  end loop;
end $$;

create or replace function public.seed_item_difficulty(target_household_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_household_member(target_household_id) then
    raise exception 'Household membership required';
  end if;
  insert into public.item_difficulty(household_id, category, item, difficulty)
  values
    (target_household_id, 'kitchen', 'Mini Fridge', 4),
    (target_household_id, 'kitchen', 'Stove', 4),
    (target_household_id, 'kitchen', 'Trash Can', 1),
    (target_household_id, 'kitchen', 'Microwave', 1),
    (target_household_id, 'kitchen', 'Kettle', 3),
    (target_household_id, 'kitchen', 'Floor', 3),
    (target_household_id, 'kitchen', 'Coffee Machine', 3),
    (target_household_id, 'bathroom', 'Bathroom Sink', 2),
    (target_household_id, 'bathroom', 'Mirror', 1),
    (target_household_id, 'bathroom', 'Shower', 4),
    (target_household_id, 'bathroom', 'Toilet', 5),
    (target_household_id, 'bathroom', 'Bath Mat', 1),
    (target_household_id, 'bathroom', 'Floor', 4),
    (target_household_id, 'bathroom', 'Trash Can', 1),
    (target_household_id, 'living', 'Trash Can', 1),
    (target_household_id, 'living', 'Vacuum', 3),
    (target_household_id, 'living', 'Laundry Basket', 2),
    (target_household_id, 'other', 'Trash Can', 3)
  on conflict (household_id, category, item) do nothing;
end;
$$;

grant execute on function public.seed_item_difficulty(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'item_difficulty', 'member_task_preferences', 'proposed_charts', 'proposed_chart_approvals'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

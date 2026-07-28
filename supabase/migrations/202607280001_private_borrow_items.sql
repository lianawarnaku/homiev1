-- Private borrowing entries must never be embedded in household_states because
-- every active household member can read that shared document. Store them in
-- an owner-scoped table and enforce privacy with RLS at the database boundary.
create table if not exists public.private_borrow_items (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.private_borrow_items enable row level security;

create index if not exists private_borrow_items_owner_household_idx
  on public.private_borrow_items(owner_id, household_id, updated_at desc);

drop policy if exists "owners read private borrowing entries"
  on public.private_borrow_items;
create policy "owners read private borrowing entries"
  on public.private_borrow_items for select
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.household_members
      where household_id = private_borrow_items.household_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

drop policy if exists "owners create private borrowing entries"
  on public.private_borrow_items;
create policy "owners create private borrowing entries"
  on public.private_borrow_items for insert
  with check (
    owner_id = auth.uid()
    and entry ->> 'creatorId' = auth.uid()::text
    and entry ->> 'ownerId' = auth.uid()::text
    and entry ->> 'visibility' = 'private'
    and entry ->> 'householdId' = household_id::text
    and exists (
      select 1 from public.household_members
      where household_id = private_borrow_items.household_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

drop policy if exists "owners update private borrowing entries"
  on public.private_borrow_items;
create policy "owners update private borrowing entries"
  on public.private_borrow_items for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and entry ->> 'creatorId' = auth.uid()::text
    and entry ->> 'ownerId' = auth.uid()::text
    and entry ->> 'visibility' = 'private'
    and entry ->> 'householdId' = household_id::text
  );

drop policy if exists "owners delete private borrowing entries"
  on public.private_borrow_items;
create policy "owners delete private borrowing entries"
  on public.private_borrow_items for delete
  using (owner_id = auth.uid());

-- Defense in depth: reject a private record if a client ever attempts to put
-- it back into the household-readable JSON document.
create or replace function public.reject_private_borrows_in_household_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(new.state -> 'borrowItems', '[]'::jsonb)) entry
    where entry ->> 'visibility' = 'private'
  ) then
    raise exception 'Private borrowing entries cannot be stored in shared household state';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_private_borrows_in_household_state
  on public.household_states;
create trigger reject_private_borrows_in_household_state
before insert or update of state on public.household_states
for each row execute function public.reject_private_borrows_in_household_state();

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'private_borrow_items'
  ) then
    alter publication supabase_realtime add table public.private_borrow_items;
  end if;
end $$;

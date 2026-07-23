create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null default '#7B563B',
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

alter table public.household_states
  add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

drop policy if exists "members can read household" on public.households;
create policy "members can read household" on public.households for select
  to authenticated using (public.is_household_member(id));

drop policy if exists "members can read memberships" on public.household_members;
create policy "members can read memberships" on public.household_members for select
  to authenticated using (public.is_household_member(household_id));

drop policy if exists "users can update own membership" on public.household_members;
create policy "users can update own membership" on public.household_members for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "authenticated household state read" on public.household_states;
drop policy if exists "authenticated household state create" on public.household_states;
drop policy if exists "authenticated household state update" on public.household_states;

create unique index if not exists household_states_household_id_key
  on public.household_states(household_id) where household_id is not null;

create policy "members read household state" on public.household_states for select
  to authenticated using (public.is_household_member(household_id));
create policy "members create household state" on public.household_states for insert
  to authenticated with check (
    public.is_household_member(household_id) and auth.uid() = updated_by
  );
create policy "members update household state" on public.household_states for update
  to authenticated using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and auth.uid() = updated_by);

create or replace function public.create_household(
  household_name text,
  member_name text,
  member_color text default '#7B563B'
) returns table(household_id uuid, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into households(name, invite_code, created_by)
    values (trim(household_name), new_code, auth.uid()) returning id into new_id;
  insert into household_members(household_id, user_id, display_name, color, role)
    values (new_id, auth.uid(), trim(member_name), member_color, 'owner');
  return query select new_id, new_code;
end;
$$;

create or replace function public.join_household(
  code text,
  member_name text,
  member_color text default '#7B563B'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  select id into target_id from households where invite_code = upper(trim(code));
  if target_id is null then raise exception 'That invite code is invalid'; end if;
  insert into household_members(household_id, user_id, display_name, color)
    values (target_id, auth.uid(), trim(member_name), member_color);
  return target_id;
end;
$$;

grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;

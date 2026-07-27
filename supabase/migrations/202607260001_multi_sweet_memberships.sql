-- One account may belong to multiple Sweets. The composite primary key already
-- prevents duplicate membership rows; the legacy user-only unique constraint
-- was the remaining one-household restriction.
alter table public.household_members
  drop constraint if exists household_members_user_id_key;

alter table public.household_members
  add column if not exists status text not null default 'active'
    check (status in ('active', 'invited', 'left', 'removed'));

create index if not exists household_members_user_status_idx
  on public.household_members(user_id, status);

revoke update on public.household_members from authenticated;
grant update(display_name, color) on public.household_members to authenticated;

create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.create_household(
  household_name text,
  member_name text,
  member_color text,
  requested_invite_code text
) returns table(household_id uuid, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  new_code := upper(trim(requested_invite_code));
  if new_code !~ '^[A-Z0-9]{8}$' then
    raise exception 'Invite code must be eight letters or numbers';
  end if;
  insert into households(name, invite_code, created_by)
    values (trim(household_name), new_code, auth.uid()) returning id into new_id;
  insert into household_members(
    household_id, user_id, display_name, color, role, status
  ) values (
    new_id, auth.uid(), trim(member_name), member_color, 'owner', 'active'
  );
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
  select id into target_id
  from households
  where invite_code = upper(trim(code));
  if target_id is null then raise exception 'That invite code is invalid'; end if;

  insert into household_members(
    household_id, user_id, display_name, color, role, status
  ) values (
    target_id, auth.uid(), trim(member_name), member_color, 'member', 'active'
  )
  on conflict (household_id, user_id) do update
  set display_name = excluded.display_name,
      color = excluded.color,
      status = 'active',
      joined_at = case
        when household_members.status = 'active' then household_members.joined_at
        else now()
      end;
  return target_id;
end;
$$;

create or replace function public.leave_household(target_household_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  current_role text;
  active_member_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into current_role
  from household_members
  where household_id = target_household_id
    and user_id = auth.uid()
    and status = 'active';
  if current_role is null then raise exception 'Active membership required'; end if;

  select count(*) into active_member_count
  from household_members
  where household_id = target_household_id and status = 'active';
  if current_role = 'owner' and active_member_count > 1 then
    raise exception 'Transfer ownership or remove the other members before leaving';
  end if;

  update household_members
  set status = 'left'
  where household_id = target_household_id and user_id = auth.uid();
end;
$$;

create or replace function public.remove_household_member(
  target_household_id uuid,
  target_user_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_user_id = auth.uid() then raise exception 'Hosts cannot remove themselves'; end if;
  if not exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then raise exception 'Only the Sweet host can remove a member'; end if;

  delete from proposed_chart_approvals
  where household_id = target_household_id and member_id = target_user_id;
  delete from member_task_preferences
  where household_id = target_household_id and member_id = target_user_id;
  update proposed_charts set status = 'cancelled'
  where household_id = target_household_id and status = 'pending';
  update household_members set status = 'removed'
  where household_id = target_household_id
    and user_id = target_user_id
    and status = 'active';
  if not found then raise exception 'That member is no longer active in this Sweet'; end if;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if exists (
    select 1
    from public.household_members mine
    join public.household_members others
      on others.household_id = mine.household_id
     and others.user_id <> current_user_id
     and others.status = 'active'
    where mine.user_id = current_user_id
      and mine.role = 'owner'
      and mine.status = 'active'
  ) then
    raise exception 'Transfer ownership or remove all other members from every hosted Sweet before deleting your account';
  end if;
  delete from auth.users where id = current_user_id;
  if not found then raise exception 'Account no longer exists'; end if;
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.create_household(text, text, text, text) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;

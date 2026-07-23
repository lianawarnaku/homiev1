-- Hosts may remove a roommate's membership, but may never delete that
-- roommate's Supabase identity. Removing a member also invalidates any pending
-- chart because its approval roster is no longer current.
create or replace function public.remove_household_member(
  target_household_id uuid,
  target_user_id uuid
) returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Hosts cannot remove themselves';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the household host can remove a roommate';
  end if;

  delete from public.proposed_chart_approvals
  where household_id = target_household_id and member_id = target_user_id;
  delete from public.member_task_preferences
  where household_id = target_household_id and member_id = target_user_id;
  update public.proposed_charts
  set status = 'cancelled'
  where household_id = target_household_id and status = 'pending';
  delete from public.household_members
  where household_id = target_household_id and user_id = target_user_id;

  if not found then
    raise exception 'That roommate is no longer in this household';
  end if;
end;
$$;

-- Account deletion is strictly self-service. A host with other roommates must
-- remove/transfer them first so deleting an owner cannot unexpectedly destroy
-- a shared household. A sole owner's empty household cascades away normally.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  owned_household_id uuid;
  household_member_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select household_id into owned_household_id
  from public.household_members
  where user_id = current_user_id and role = 'owner'
  limit 1;

  if owned_household_id is not null then
    select count(*) into household_member_count
    from public.household_members
    where household_id = owned_household_id;
    if household_member_count > 1 then
      raise exception 'Remove all other roommates before deleting the host account';
    end if;
  end if;

  delete from auth.users where id = current_user_id;
  if not found then
    raise exception 'Account no longer exists';
  end if;
end;
$$;

revoke all on function public.remove_household_member(uuid, uuid) from public;
revoke all on function public.delete_own_account() from public;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

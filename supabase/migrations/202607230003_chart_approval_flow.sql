create or replace function public.replace_proposed_chart(
  target_household_id uuid,
  chart_payload jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_chart_id uuid;
begin
  if not public.is_household_member(target_household_id) then
    raise exception 'Household membership required';
  end if;

  update public.proposed_charts
    set status = 'cancelled'
    where household_id = target_household_id and status = 'pending';

  insert into public.proposed_charts(household_id, created_by, status, payload)
    values (target_household_id, auth.uid(), 'pending', chart_payload)
    returning id into new_chart_id;

  insert into public.proposed_chart_approvals(
    household_id, proposed_chart_id, member_id, approved
  )
  select target_household_id, new_chart_id, user_id, false
  from public.household_members
  where household_id = target_household_id;

  return new_chart_id;
end;
$$;

create or replace function public.approve_proposed_chart(target_chart_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare target_household_id uuid;
declare next_status text;
begin
  select household_id into target_household_id
  from public.proposed_charts where id = target_chart_id and status = 'pending';
  if target_household_id is null or not public.is_household_member(target_household_id) then
    raise exception 'Pending household proposal not found';
  end if;

  update public.proposed_chart_approvals
    set approved = true, approved_at = now()
    where proposed_chart_id = target_chart_id and member_id = auth.uid();

  if not exists (
    select 1 from public.proposed_chart_approvals
    where proposed_chart_id = target_chart_id and approved = false
  ) then
    update public.proposed_charts set status = 'approved' where id = target_chart_id;
    next_status := 'approved';
  else
    next_status := 'pending';
  end if;
  return next_status;
end;
$$;

create or replace function public.force_approve_proposed_chart(target_chart_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare target_household_id uuid;
begin
  select household_id into target_household_id
  from public.proposed_charts where id = target_chart_id and status = 'pending';
  if not exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the household owner can override approvals';
  end if;
  update public.proposed_chart_approvals
    set approved = true, approved_at = now()
    where proposed_chart_id = target_chart_id;
  update public.proposed_charts set status = 'approved' where id = target_chart_id;
end;
$$;

create or replace function public.cancel_proposed_charts(target_household_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_household_member(target_household_id) then
    raise exception 'Household membership required';
  end if;
  update public.proposed_charts
    set status = 'cancelled'
    where household_id = target_household_id and status = 'pending';
end;
$$;

grant execute on function public.replace_proposed_chart(uuid, jsonb) to authenticated;
grant execute on function public.approve_proposed_chart(uuid) to authenticated;
grant execute on function public.force_approve_proposed_chart(uuid) to authenticated;
grant execute on function public.cancel_proposed_charts(uuid) to authenticated;

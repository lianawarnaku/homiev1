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
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;
  new_code := upper(trim(requested_invite_code));
  if new_code !~ '^[A-F0-9]{8}$' then
    raise exception 'Invite code must be eight letters or numbers';
  end if;
  insert into households(name, invite_code, created_by)
    values (trim(household_name), new_code, auth.uid()) returning id into new_id;
  insert into household_members(household_id, user_id, display_name, color, role)
    values (new_id, auth.uid(), trim(member_name), member_color, 'owner');
  return query select new_id, new_code;
end;
$$;

grant execute on function public.create_household(text, text, text, text) to authenticated;

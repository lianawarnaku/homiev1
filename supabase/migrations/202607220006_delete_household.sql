create or replace function public.delete_household(target_household_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only the household owner can delete this household';
  end if;

  delete from public.households
  where id = target_household_id;
end;
$$;

grant execute on function public.delete_household(uuid) to authenticated;

-- Replace the full-list RPC with an explicit-delta form. A user saving a stale
-- modal may remove only rows that were in their opening baseline, so another
-- roommate's concurrent additions survive.
drop function if exists public.save_sweet_essential_shortlist(uuid, jsonb);

create function public.save_sweet_essential_shortlist(
  target_household_id uuid,
  selected_items jsonb,
  removed_items jsonb
)
returns setof public.sweet_essential_shortlist_items
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_household_member(target_household_id) then
    raise exception 'Only active household members can save this shortlist'
      using errcode = '42501';
  end if;

  if jsonb_typeof(selected_items) <> 'array'
     or jsonb_typeof(removed_items) <> 'array' then
    raise exception 'Shortlist changes must be JSON arrays'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_items || removed_items) entry
    where jsonb_typeof(entry) <> 'object'
       or coalesce(entry ->> 'section_key', '') = ''
       or coalesce(entry ->> 'item_id', '') = ''
       or length(entry ->> 'section_key') > 120
       or length(entry ->> 'item_id') > 180
  ) then
    raise exception 'Every shortlist change requires valid section_key and item_id'
      using errcode = '22023';
  end if;

  delete from public.sweet_essential_shortlist_items existing
  where existing.household_id = target_household_id
    and exists (
      select 1
      from jsonb_array_elements(removed_items) entry
      where entry ->> 'section_key' = existing.section_key
        and entry ->> 'item_id' = existing.item_id
    );

  insert into public.sweet_essential_shortlist_items (
    household_id,
    section_key,
    item_id,
    added_by,
    updated_at
  )
  select distinct
    target_household_id,
    entry ->> 'section_key',
    entry ->> 'item_id',
    auth.uid(),
    now()
  from jsonb_array_elements(selected_items) entry
  on conflict (household_id, section_key, item_id)
  do update set updated_at = excluded.updated_at;

  return query
  select *
  from public.sweet_essential_shortlist_items
  where household_id = target_household_id
  order by section_key, item_id;
end;
$$;

revoke all on function public.save_sweet_essential_shortlist(uuid, jsonb, jsonb)
  from public;
grant execute on function public.save_sweet_essential_shortlist(uuid, jsonb, jsonb)
  to authenticated;

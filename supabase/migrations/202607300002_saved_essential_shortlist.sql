-- The household Sweet Essentials shortlist is its own domain model. It is not
-- a Shopping list and must be saved atomically so retries cannot duplicate or
-- partially replace the household selection.
create table if not exists public.sweet_essential_shortlist_items (
  household_id uuid not null references public.households(id) on delete cascade,
  section_key text not null check (length(section_key) between 1 and 120),
  item_id text not null check (length(item_id) between 1 and 180),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, section_key, item_id)
);

create index if not exists sweet_essential_shortlist_household_updated_idx
  on public.sweet_essential_shortlist_items(household_id, updated_at desc);

alter table public.sweet_essential_shortlist_items enable row level security;

drop policy if exists "members read Sweet Essential shortlist"
  on public.sweet_essential_shortlist_items;
create policy "members read Sweet Essential shortlist"
  on public.sweet_essential_shortlist_items for select
  to authenticated
  using (public.is_household_member(household_id));

create or replace function public.save_sweet_essential_shortlist(
  target_household_id uuid,
  selected_items jsonb
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

  if jsonb_typeof(selected_items) <> 'array' then
    raise exception 'selected_items must be a JSON array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_items) entry
    where jsonb_typeof(entry) <> 'object'
       or coalesce(entry ->> 'section_key', '') = ''
       or coalesce(entry ->> 'item_id', '') = ''
       or length(entry ->> 'section_key') > 120
       or length(entry ->> 'item_id') > 180
  ) then
    raise exception 'Every selected item requires valid section_key and item_id'
      using errcode = '22023';
  end if;

  delete from public.sweet_essential_shortlist_items existing
  where existing.household_id = target_household_id
    and not exists (
      select 1
      from jsonb_array_elements(selected_items) entry
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

revoke all on function public.save_sweet_essential_shortlist(uuid, jsonb)
  from public;
grant execute on function public.save_sweet_essential_shortlist(uuid, jsonb)
  to authenticated;

-- Preserve the former canonical snapshot shortlist without touching any
-- Shopping records. Re-running is safe because the shortlist key is unique.
insert into public.sweet_essential_shortlist_items (
  household_id,
  section_key,
  item_id,
  added_by
)
select
  state_row.household_id,
  section_entry.key,
  item_entry.key,
  state_row.updated_by
from public.household_states state_row
cross join lateral jsonb_each(
  coalesce(state_row.state -> 'essentialShortlist', '{}'::jsonb)
) section_entry
cross join lateral jsonb_each(section_entry.value) item_entry
where item_entry.value = 'true'::jsonb
on conflict (household_id, section_key, item_id) do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sweet_essential_shortlist_items'
  ) then
    alter publication supabase_realtime
      add table public.sweet_essential_shortlist_items;
  end if;
end $$;

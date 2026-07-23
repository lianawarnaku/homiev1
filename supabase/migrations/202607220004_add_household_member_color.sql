alter table public.household_members
  add column if not exists color text;

update public.household_members
set color = coalesce(avatar_color, '#7B563B')
where color is null;

alter table public.household_members
  alter column color set default '#7B563B',
  alter column color set not null;

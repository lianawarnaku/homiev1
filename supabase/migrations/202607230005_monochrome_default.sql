-- Rename the original blue preference to Homie's new monochrome default
-- without leaving existing households on an invalid scheme key.
alter table public.household_preferences
  drop constraint if exists household_preferences_color_scheme_check;

update public.household_preferences
set color_scheme = 'mono'
where color_scheme = 'blue';

alter table public.household_preferences
  alter column color_scheme set default 'mono';

alter table public.household_preferences
  add constraint household_preferences_color_scheme_check
  check (color_scheme in ('mono', 'brown', 'pinkWhite', 'blueWhite'));

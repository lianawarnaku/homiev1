-- Homie's host is the household creator. Only that owner may delete the
-- household; ordinary members must leave rather than destroy shared data.
drop policy if exists "owners can delete their household" on public.households;
create policy "owners can delete their household"
  on public.households for delete
  to authenticated
  using (created_by = auth.uid());

-- Normalize every direct household foreign key to ON DELETE CASCADE. Older
-- installations may have created these tables before cascade behavior was
-- added to the checked-in schema, so inspect and repair them idempotently.
do $$
declare
  target_table text;
  constraint_name text;
  delete_action "char";
begin
  foreach target_table in array array[
    'household_members',
    'household_amenities',
    'household_states',
    'household_preferences',
    'chores',
    'expenses',
    'shopping_lists',
    'shopping_items',
    'borrow_items',
    'nudges',
    'item_difficulty',
    'member_task_preferences',
    'proposed_charts',
    'proposed_chart_approvals'
  ] loop
    if to_regclass('public.' || target_table) is null then
      continue;
    end if;

    select constraint_definition.conname, constraint_definition.confdeltype
      into constraint_name, delete_action
    from pg_constraint constraint_definition
    join pg_attribute local_column
      on local_column.attrelid = constraint_definition.conrelid
      and local_column.attnum = any(constraint_definition.conkey)
    where constraint_definition.contype = 'f'
      and constraint_definition.conrelid = to_regclass('public.' || target_table)
      and constraint_definition.confrelid = 'public.households'::regclass
      and local_column.attname = 'household_id'
    limit 1;

    if constraint_name is null then
      execute format(
        'alter table public.%I add constraint %I foreign key (household_id) references public.households(id) on delete cascade',
        target_table,
        target_table || '_household_id_fkey'
      );
    elsif delete_action <> 'c' then
      execute format(
        'alter table public.%I drop constraint %I',
        target_table,
        constraint_name
      );
      execute format(
        'alter table public.%I add constraint %I foreign key (household_id) references public.households(id) on delete cascade',
        target_table,
        constraint_name
      );
    end if;

    constraint_name := null;
    delete_action := null;
  end loop;
end $$;

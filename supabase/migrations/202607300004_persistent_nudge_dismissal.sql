alter table public.nudges
  add column if not exists seen_at timestamptz,
  add column if not exists dismissed_at timestamptz;

update public.nudges set seen_at = sent_at where seen and seen_at is null;

create index if not exists nudges_active_recipient_idx
  on public.nudges (household_id, to_member_id, sent_at desc)
  where dismissed_at is null;

drop policy if exists "household members can manage nudges" on public.nudges;
drop policy if exists "household members can read nudges" on public.nudges;
drop policy if exists "household members can send nudges" on public.nudges;
drop policy if exists "recipients can update nudges" on public.nudges;
drop policy if exists "senders can retract nudges" on public.nudges;

create policy "household members can read nudges" on public.nudges
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "household members can send nudges" on public.nudges
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and sent_by = auth.uid()
    and exists (
      select 1 from public.household_members member
      where member.household_id = nudges.household_id
        and member.user_id = nudges.to_member_id
        and member.status = 'active'
    )
  );

create policy "recipients can update nudges" on public.nudges
  for update to authenticated
  using (to_member_id = auth.uid())
  with check (to_member_id = auth.uid());

-- Retraction is separate from recipient dismissal and preserves the sender's
-- existing Group-tab "Remove nudge" action.
create policy "senders can retract nudges" on public.nudges
  for delete to authenticated
  using (sent_by = auth.uid());

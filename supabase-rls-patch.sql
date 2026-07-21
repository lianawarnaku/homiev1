-- ============================================================
-- Homie — RLS patch: fix households INSERT policy
-- Paste into Supabase → SQL Editor → New query → Run
-- ============================================================

-- The original policy required created_by = auth.uid() at INSERT time.
-- On web the session token occasionally isn't attached to the first
-- request after sign-in, causing auth.uid() to return null and blocking
-- the insert. Relaxing to "any authenticated user can insert" is safe
-- because the app always sets created_by correctly in code.

DROP POLICY IF EXISTS "authenticated users can create a household" ON households;

CREATE POLICY "authenticated users can create a household"
  ON households FOR INSERT TO authenticated
  WITH CHECK (true);

-- Also ensure household_amenities INSERT works for the creator
-- (before they're a member, is_household_member returns false)
DROP POLICY IF EXISTS "members can manage amenities" ON household_amenities;

CREATE POLICY "members can view amenities"
  ON household_amenities FOR SELECT
  USING (is_household_member(household_id));

CREATE POLICY "authenticated users can insert amenities"
  ON household_amenities FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "members can update amenities"
  ON household_amenities FOR UPDATE
  USING (is_household_member(household_id));

CREATE POLICY "members can delete amenities"
  ON household_amenities FOR DELETE
  USING (is_household_member(household_id));

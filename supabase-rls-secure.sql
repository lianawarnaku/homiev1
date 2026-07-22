-- ============================================================
-- Homie — Secure RLS setup (idempotent — safe to re-run)
-- Fixes: "new row violates row-level security policy for households"
-- Paste into Supabase → SQL Editor → New query → Run
--
-- This is a TIGHTER alternative to supabase-rls-patch.sql. It fixes the
-- create-household error WITHOUT opening the loose `WITH CHECK (true)`
-- holes that the patch introduced. It works because the app inserts the
-- creator's membership row BEFORE inserting amenities, so the creator is
-- already a member by the time amenities are written.
-- ============================================================

-- Helper: is the current user a member of this household?
CREATE OR REPLACE FUNCTION is_household_member(hid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid AND user_id = auth.uid()
  );
$$;

ALTER TABLE households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_amenities ENABLE ROW LEVEL SECURITY;

-- ── households ────────────────────────────────────────────────
-- Drop every existing policy on the table (names observed in the live DB
-- + names from prior migrations/patches) so no loose policy survives.
-- NOTE: Postgres ORs permissive policies together, so a leftover
-- `with_check (true)` policy would silently re-open the hole.
DROP POLICY IF EXISTS "members can view their household"        ON households;
DROP POLICY IF EXISTS "owners can update their household"       ON households;
DROP POLICY IF EXISTS "authenticated users can create a household" ON households;
DROP POLICY IF EXISTS "allow household insert"                  ON households;

CREATE POLICY "members can view their household"
  ON households FOR SELECT USING (is_household_member(id));
CREATE POLICY "authenticated users can create a household"
  ON households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());   -- you may only create households as yourself
CREATE POLICY "owners can update their household"
  ON households FOR UPDATE USING (created_by = auth.uid());

-- ── household_members ─────────────────────────────────────────
DROP POLICY IF EXISTS "members can view household roster"       ON household_members;
DROP POLICY IF EXISTS "users can update their own row"          ON household_members;
DROP POLICY IF EXISTS "users can insert themselves"            ON household_members;
DROP POLICY IF EXISTS "allow member insert"                    ON household_members;

CREATE POLICY "members can view household roster"
  ON household_members FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "users can insert themselves"
  ON household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());      -- you may only add YOURSELF to a household
CREATE POLICY "users can update their own row"
  ON household_members FOR UPDATE USING (user_id = auth.uid());

-- ── household_amenities ───────────────────────────────────────
DROP POLICY IF EXISTS "members can view amenities"              ON household_amenities;
DROP POLICY IF EXISTS "members can manage amenities"            ON household_amenities;
DROP POLICY IF EXISTS "authenticated users can insert amenities" ON household_amenities;
DROP POLICY IF EXISTS "members can update amenities"           ON household_amenities;
DROP POLICY IF EXISTS "members can delete amenities"           ON household_amenities;
DROP POLICY IF EXISTS "allow amenity insert"                   ON household_amenities;

CREATE POLICY "members can view amenities"
  ON household_amenities FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "members can insert amenities"
  ON household_amenities FOR INSERT TO authenticated
  WITH CHECK (is_household_member(household_id));   -- only into households you belong to
CREATE POLICY "members can update amenities"
  ON household_amenities FOR UPDATE USING (is_household_member(household_id));
CREATE POLICY "members can delete amenities"
  ON household_amenities FOR DELETE USING (is_household_member(household_id));

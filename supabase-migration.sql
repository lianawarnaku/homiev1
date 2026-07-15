-- ============================================================
-- Homie — Phase 3: Household schema
-- Paste this entire file into Supabase > SQL Editor > New query
-- ============================================================

-- Households
CREATE TABLE IF NOT EXISTS households (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  invite_code  TEXT        UNIQUE NOT NULL
                           DEFAULT upper(substring(gen_random_uuid()::text, 1, 6)),
  housing_type TEXT        NOT NULL DEFAULT 'traditional',
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Household members
CREATE TABLE IF NOT EXISTS household_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  avatar_color TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

-- Per-household amenities selected during onboarding
CREATE TABLE IF NOT EXISTS household_amenities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category     TEXT        NOT NULL,  -- 'kitchen' | 'bathroom' | 'living'
  name         TEXT        NOT NULL,
  UNIQUE(household_id, category, name)
);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_amenities ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of this household?
CREATE OR REPLACE FUNCTION is_household_member(hid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid AND user_id = auth.uid()
  );
$$;

-- households
CREATE POLICY "members can view their household"
  ON households FOR SELECT USING (is_household_member(id));

CREATE POLICY "authenticated users can create a household"
  ON households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "owners can update their household"
  ON households FOR UPDATE USING (created_by = auth.uid());

-- household_members
CREATE POLICY "members can view household roster"
  ON household_members FOR SELECT
  USING (is_household_member(household_id));

CREATE POLICY "users can insert themselves"
  ON household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update their own row"
  ON household_members FOR UPDATE USING (user_id = auth.uid());

-- household_amenities
CREATE POLICY "members can view amenities"
  ON household_amenities FOR SELECT
  USING (is_household_member(household_id));

CREATE POLICY "members can manage amenities"
  ON household_amenities FOR ALL
  USING (is_household_member(household_id));

-- ── Invite-by-code helper ─────────────────────────────────────
-- Looks up a household by invite code; accessible to all authenticated users
-- (needed so a user can join before they're a member).
CREATE OR REPLACE FUNCTION find_household_by_code(code TEXT)
RETURNS TABLE(id UUID, name TEXT, housing_type TEXT, member_count BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    h.id,
    h.name,
    h.housing_type,
    COUNT(m.id) AS member_count
  FROM households h
  LEFT JOIN household_members m ON m.household_id = h.id
  WHERE upper(h.invite_code) = upper(code)
  GROUP BY h.id, h.name, h.housing_type;
$$;

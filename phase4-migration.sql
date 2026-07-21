-- ============================================================
-- Homie — Phase 4: Entity tables
-- Paste into Supabase > SQL Editor > New query and run
-- ============================================================

-- Add points tracking to household_members
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS points        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_points INT NOT NULL DEFAULT 0;

-- ── Chores ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  assigned_to  UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  due_date     TEXT        NOT NULL,
  completed    BOOLEAN     NOT NULL DEFAULT false,
  completed_at TEXT,
  points       INT         NOT NULL DEFAULT 10,
  category     TEXT        NOT NULL DEFAULT 'other',
  recurring    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Expenses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID         NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  paid_by          UUID         NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  shared_with      UUID[]       NOT NULL DEFAULT '{}',
  splits           JSONB        NOT NULL DEFAULT '{}',
  date             TEXT         NOT NULL,
  category         TEXT         NOT NULL DEFAULT 'other',
  settled          BOOLEAN      NOT NULL DEFAULT false,
  recurring        TEXT,
  recurring_custom TEXT,
  paid_back        JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Shopping lists ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_lists (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Shopping items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  list_id      UUID        NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  quantity     TEXT        NOT NULL DEFAULT '1',
  added_by     UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  completed    BOOLEAN     NOT NULL DEFAULT false,
  assigned_to  UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Borrow items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS borrow_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item          TEXT        NOT NULL,
  borrowed_from UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  borrowed_at   TEXT        NOT NULL,
  due_date      TEXT        NOT NULL,
  returned      BOOLEAN     NOT NULL DEFAULT false,
  returned_at   TEXT,
  notes         TEXT,
  created_by    UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Nudges ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  to_member_id UUID        NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  chore_id     UUID        NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  sent_by      UUID        REFERENCES household_members(id) ON DELETE SET NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────────

ALTER TABLE chores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrow_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudges          ENABLE ROW LEVEL SECURITY;

-- chores
CREATE POLICY "household members can manage chores"
  ON chores FOR ALL USING (is_household_member(household_id));

-- expenses
CREATE POLICY "household members can manage expenses"
  ON expenses FOR ALL USING (is_household_member(household_id));

-- shopping_lists
CREATE POLICY "household members can manage shopping lists"
  ON shopping_lists FOR ALL USING (is_household_member(household_id));

-- shopping_items
CREATE POLICY "household members can manage shopping items"
  ON shopping_items FOR ALL USING (is_household_member(household_id));

-- borrow_items
CREATE POLICY "household members can manage borrow items"
  ON borrow_items FOR ALL USING (is_household_member(household_id));

-- nudges
CREATE POLICY "household members can manage nudges"
  ON nudges FOR ALL USING (is_household_member(household_id));

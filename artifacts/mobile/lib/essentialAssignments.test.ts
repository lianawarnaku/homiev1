import {
  assignmentsFromRows,
  migrateEssentialAssignments,
  normalizeAssignedUserIds,
  setSelfAssignment,
} from "./essentialAssignments.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const migrated = migrateEssentialAssignments({
  kitchen: {
    towels: "user-a",
    soap: ["user-a", "user-b", "user-a", "", null],
    invalid: null,
  },
});
assert(
  migrated.kitchen.towels.join(",") === "user-a",
  "single-assignee records must migrate without losing the user",
);
assert(
  migrated.kitchen.soap.join(",") === "user-a,user-b",
  "multi-assignee migration must normalize duplicate and invalid IDs",
);
assert(
  JSON.stringify(migrateEssentialAssignments(migrated)) === JSON.stringify(migrated),
  "assignment migration must be idempotent",
);

const aAssigned = setSelfAssignment({}, "kitchen", "towels", "user-a", true);
const bAssigned = setSelfAssignment(aAssigned, "kitchen", "towels", "user-b", true);
const duplicateA = setSelfAssignment(bAssigned, "kitchen", "towels", "user-a", true);
assert(
  duplicateA.kitchen.towels.join(",") === "user-a,user-b",
  "self-assignment must preserve other users and prevent duplicates",
);
const aRemoved = setSelfAssignment(duplicateA, "kitchen", "towels", "user-a", false);
assert(
  aRemoved.kitchen.towels.join(",") === "user-b",
  "self-unassignment must remove only the current user",
);
assert(
  normalizeAssignedUserIds(["user-a", "user-a"]).length === 1,
  "rapid retries must remain idempotent",
);

const concurrent = assignmentsFromRows([
  { section_key: "kitchen", item_id: "towels", user_id: "user-a" },
  { section_key: "kitchen", item_id: "towels", user_id: "user-b" },
  { section_key: "kitchen", item_id: "towels", user_id: "user-a" },
]);
assert(
  concurrent.kitchen.towels.join(",") === "user-a,user-b",
  "concurrent assignment rows must merge without last-write-wins loss",
);

const planning = readFileSync(resolve(process.cwd(), "app/planning.tsx"), "utf8");
const home = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/202607300001_multi_user_essential_assignments.sql",
  ),
  "utf8",
);

assert(
  !planning.includes('name="bookmark"') &&
    !planning.includes('name={selectedType === "home-checklist" ? "bookmark"'),
  "Sweet Essentials must not render a bookmark icon or hidden bookmark action",
);
assert(
  planning.includes("assignedUserIds: string[]") &&
    planning.includes("I’ll get this") &&
    planning.includes("I’m getting this"),
  "the item row must expose an accessible current-user multi-assignment control",
);
assert(
  !home.includes("Sweet Essentials To Buy") &&
    !home.includes("setEssentialAssignee(sectionKey, item, null)"),
  "removing the redundant My Sweet display must not couple assignments to Shopping completion",
);
assert(
  migration.includes(
    "primary key (household_id, section_key, item_id, user_id)",
  ) &&
    migration.includes("user_id = auth.uid()") &&
    migration.includes("public.is_household_member(household_id)"),
  "database constraints and RLS must make self-assignment idempotent and household-scoped",
);
assert(
  migration.includes("on conflict (household_id, section_key, item_id, user_id) do nothing"),
  "legacy migration must safely rerun without duplicate assignments",
);

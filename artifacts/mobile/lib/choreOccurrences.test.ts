import type { Chore } from "../context/AppContext";
import {
  choreLocalDateKey,
  choreOccurrenceIdentity,
  isChoreActiveOnDay,
  isChoreCarryoverOnDay,
  materializeRecurringOccurrences,
} from "./choreOccurrences.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const due = new Date(2026, 6, 27, 23, 59).toISOString();
const oneOff: Chore = {
  id: "one",
  householdId: "home-a",
  title: "One off",
  assignedTo: "a",
  dueDate: due,
  completed: false,
  points: 10,
  category: "other",
};

assert(isChoreActiveOnDay(oneOff, new Date(2026, 6, 27, 12)), "one-off must be active on its scheduled day");
assert(isChoreCarryoverOnDay(oneOff, new Date(2026, 6, 28, 0, 0, 0, 1)), "one-off must carry after midnight");
assert(isChoreCarryoverOnDay(oneOff, new Date(2026, 6, 29, 12)), "one-off must continue carrying over");
assert(choreLocalDateKey(oneOff.dueDate) === "2026-07-27", "carryover must preserve the original date");

const completed = {
  ...oneOff,
  completed: true,
  completedAt: new Date(2026, 6, 29, 12).toISOString(),
};
assert(!isChoreActiveOnDay(completed, new Date(2026, 6, 30)), "completed one-off must not carry forward");
assert(choreLocalDateKey(completed.dueDate) === "2026-07-27", "completion must preserve one-off history");

const recurring: Chore = {
  ...oneOff,
  id: "daily-root",
  title: "Daily",
  recurring: "daily",
  recurrenceSeriesId: "daily-root",
  initialDueDate: due,
  occurrenceIndex: 0,
};
let id = 0;
const materialized = materializeRecurringOccurrences(
  [recurring],
  new Date(2026, 6, 29, 12),
  () => `generated-${++id}`,
);
const daily = materialized
  .filter((chore) => chore.recurrenceSeriesId === "daily-root")
  .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
assert(daily.length === 3, "each due recurring occurrence must be materialized independently");
assert(new Set(daily.map(choreOccurrenceIdentity)).size === 3, "recurring occurrence identities must be unique");
assert(daily.every((chore) => !chore.completed), "new recurring occurrences must begin unchecked");
assert(isChoreCarryoverOnDay(daily[0], new Date(2026, 6, 29)), "missed Monday occurrence must coexist as carryover");
assert(isChoreCarryoverOnDay(daily[1], new Date(2026, 6, 29)), "multiple missed occurrences must remain actionable");
assert(isChoreActiveOnDay(daily[2], new Date(2026, 6, 29)), "current occurrence must be independently active");

const mondayDone = daily.map((chore, index) =>
  index === 0 ? { ...chore, completed: true, completedAt: new Date().toISOString() } : chore
);
assert(!isChoreActiveOnDay(mondayDone[0], new Date(2026, 6, 30)), "completing one occurrence must stop only its carryover");
assert(isChoreActiveOnDay(mondayDone[1], new Date(2026, 6, 30)), "another missed occurrence must remain active");
assert(!mondayDone[2].completed, "completion must not leak to a later occurrence");

const rerun = materializeRecurringOccurrences(
  materialized,
  new Date(2026, 6, 29, 12),
  () => `duplicate-${++id}`,
);
assert(rerun === materialized, "reconciliation must be idempotent and create no daily duplicates");

const reassigned = { ...oneOff, assignedTo: "b" };
assert(choreOccurrenceIdentity(reassigned) === choreOccurrenceIdentity(oneOff), "reassignment must preserve occurrence identity");
assert(reassigned.assignedTo === "b" && choreLocalDateKey(reassigned.dueDate) === "2026-07-27", "reassignment must update the same occurrence");

const otherHousehold = { ...recurring, id: "other-root", householdId: "home-b" };
const isolated = materializeRecurringOccurrences(
  [recurring, otherHousehold],
  new Date(2026, 6, 28),
  () => `isolated-${++id}`,
);
assert(
  isolated.filter((chore) => chore.householdId === "home-a").length === 2 &&
    isolated.filter((chore) => chore.householdId === "home-b").length === 2,
  "materialization must isolate households",
);

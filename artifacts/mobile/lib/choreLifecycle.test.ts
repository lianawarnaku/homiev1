import type { Chore } from "../context/AppContext";
import {
  activeChores,
  completedRetentionBoundary,
  isActiveChore,
  isChoreInCurrentWeek,
  isRecentlyCompleted,
  startOfLocalWeek,
} from "./choreLifecycle.ts";
import { isChoreActiveOnDay } from "./choreOccurrences.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 6, 29, 12);
const base: Chore = {
  id: "base",
  householdId: "home-a",
  title: "Chore",
  assignedTo: "member-a",
  dueDate: new Date(2026, 6, 29, 9).toISOString(),
  completed: false,
  points: 10,
  category: "cleaning",
};

assert(isChoreActiveOnDay(base, now), "an incomplete chore due today must appear in Today");
const oldIncomplete = { ...base, id: "old", dueDate: new Date(2026, 5, 29, 9).toISOString() };
assert(isChoreActiveOnDay(oldIncomplete, now), "a 30-day-old incomplete chore must remain in Today");
assert(
  [oldIncomplete].filter((chore) => isChoreActiveOnDay(chore, now)).length === 1,
  "an overdue chore must appear only once in Today",
);

const completedAt = new Date(2026, 6, 22, 12);
const recentDone = { ...base, id: "recent", completed: true, completedAt: completedAt.toISOString() };
const justBeforeBoundary = new Date(2026, 6, 29, 11, 59, 59, 999);
assert(isRecentlyCompleted(recentDone, justBeforeBoundary), "completion must remain active before seven calendar days");
const boundary = completedRetentionBoundary(recentDone)!;
assert(boundary.getTime() === now.getTime(), "retention must add seven local calendar days");
assert(!isRecentlyCompleted(recentDone, boundary), "completion must become historical at the exact boundary");
assert(!isActiveChore(recentDone, boundary), "historical completion must leave active lists");
assert(isActiveChore(oldIncomplete, boundary), "old incomplete chores must never age out");

const legacyDone = { ...base, id: "legacy", completed: true, completedAt: undefined };
assert(isActiveChore(legacyDone, now), "legacy completion without a trustworthy timestamp must not be silently archived");

const sunday = startOfLocalWeek(now);
assert(sunday.getDay() === 0, "the app's local calendar week must begin Sunday");
const thisWeek = { ...base, id: "week", dueDate: new Date(2026, 6, 31, 9).toISOString() };
const nextWeek = { ...base, id: "next-week", dueDate: new Date(2026, 7, 3, 9).toISOString() };
assert(isChoreInCurrentWeek(thisWeek, now), "Week must include a chore due this local week");
assert(!isChoreInCurrentWeek(nextWeek, now), "Week must exclude a future chore outside this local week");
assert(isChoreInCurrentWeek(oldIncomplete, now), "Week must retain actionable overdue chores");

const history = Array.from({ length: 10_000 }, (_, index): Chore => ({
  ...base,
  id: `history-${index}`,
  completed: true,
  completedAt: new Date(2025, 0, 1, 12).toISOString(),
}));
const active = Array.from({ length: 1_000 }, (_, index): Chore => ({
  ...base,
  id: `active-${index}`,
}));
assert(activeChores([...history, ...active], now).length === 1_000, "active screens must exclude 10,000 historical chores");

import type { Chore } from "../context/AppContext";
import {
  deriveCalendarItems,
  localCalendarDate,
  localDateKey,
} from "./calendarItems.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const members = [
  { id: "a", name: "A", color: "#000", points: 0, weeklyPoints: 0 },
  { id: "b", name: "B", color: "#111", points: 0, weeklyPoints: 0 },
];
const oneOff: Chore = {
  id: "one",
  householdId: "home-a",
  title: "One off",
  assignedTo: "a",
  dueDate: new Date(2026, 6, 27, 23, 59).toISOString(),
  completed: true,
  completedAt: new Date(2026, 6, 27, 20).toISOString(),
  points: 10,
  category: "other",
};
const recurring: Chore = {
  id: "monday",
  householdId: "home-a",
  title: "Recurring",
  assignedTo: "a",
  dueDate: new Date(2026, 6, 27, 23, 59).toISOString(),
  initialDueDate: new Date(2026, 6, 27, 23, 59).toISOString(),
  completed: true,
  points: 10,
  category: "cleaning",
  recurring: "weekly",
  recurrenceSeriesId: "weekly-series",
};
const items = deriveCalendarItems(
  {
    chores: [oneOff, recurring],
    shoppingItems: [],
    shoppingLists: [],
    expenses: [],
    roommates: members,
    currentUserId: "a",
    householdId: "home-a",
  },
  new Date(2026, 6, 27),
  new Date(2026, 7, 5),
);
const oneOffItems = items.filter((item) => item.sourceId === "one");
assert(oneOffItems.length === 1 && oneOffItems[0].completed === true, "a completed one-off must remain only on its due date");
const recurringItems = items.filter((item) => item.type === "chore" && item.title === "Recurring");
assert(recurringItems.length === 2, "weekly recurrence must project both visible dates");
assert(recurringItems[0].completed === true, "stored recurring occurrence must retain completion");
assert(recurringItems[1].completed === false, "future projected occurrence must start unchecked");

const otherHousehold = deriveCalendarItems(
  {
    chores: [{ ...oneOff, householdId: "home-b" }],
    shoppingItems: [],
    shoppingLists: [],
    expenses: [],
    roommates: members,
    currentUserId: "a",
    householdId: "home-a",
  },
  new Date(2026, 6, 27),
  new Date(2026, 6, 27),
);
assert(otherHousehold.length === 0, "calendar derivation must isolate households");
assert(localDateKey(localCalendarDate("2028-02-29")!) === "2028-02-29", "date-only leap days must remain stable");

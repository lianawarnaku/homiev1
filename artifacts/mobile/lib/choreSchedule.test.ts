import type { Chore } from "../context/AppContext";
import {
  advanceChoreDueDate,
  resolveRoundRobinParticipants,
} from "./choreSchedule.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const base = new Date(2026, 0, 31, 23, 59).toISOString();
const monthly = new Date(advanceChoreDueDate(base, "monthly"));
assert(monthly.getMonth() === 1 && monthly.getDate() === 28, "monthly recurrence must clamp Jan 31 to Feb 28");

const leapBase = new Date(2028, 0, 31, 23, 59).toISOString();
const leapMonthly = new Date(advanceChoreDueDate(leapBase, "monthly"));
assert(leapMonthly.getMonth() === 1 && leapMonthly.getDate() === 29, "monthly recurrence must clamp to leap day");

const sunday = new Date(2026, 6, 26, 23, 59).toISOString();
const weekly = new Date(advanceChoreDueDate(sunday, "weekly"));
assert(weekly.getDay() === 0 && weekly.getDate() === 2, "weekly recurrence must preserve weekday across month boundaries");

const chore: Chore = {
  id: "series",
  title: "Clean",
  assignedTo: "a",
  dueDate: base,
  completed: false,
  points: 10,
  category: "cleaning",
  assignmentMode: "round-robin",
  roundRobinAllMembers: true,
  roundRobinParticipantIds: ["b", "removed", "a"],
  excludedParticipantIds: ["c"],
};
const participants = resolveRoundRobinParticipants(chore, ["a", "b", "c", "d"]);
assert(participants.join(",") === "b,a,d", "rotation must remove inactive/excluded members and append active members");

const fixed = resolveRoundRobinParticipants(
  { ...chore, roundRobinAllMembers: false },
  ["a", "b", "c", "d"],
);
assert(fixed.join(",") === "b,a", "fixed rotations must not add new household members");

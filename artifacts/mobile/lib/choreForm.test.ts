import { parseDueDate, tomorrowDateInput } from "./choreForm.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(parseDueDate("") === null, "empty dates must be rejected");
assert(parseDueDate("2026-02-30") === null, "impossible dates must be rejected");
assert(parseDueDate("2026/02/28") === null, "non-ISO date input must be rejected");
assert(parseDueDate(" 2028-02-29 ") !== null, "trimmed leap-day input must be accepted");
assert(
  tomorrowDateInput(new Date(2026, 11, 31, 12)) === "2027-01-01",
  "the default date must cross year boundaries",
);
assert(
  tomorrowDateInput(new Date(2028, 1, 28, 12)) === "2028-02-29",
  "the default date must support leap years",
);

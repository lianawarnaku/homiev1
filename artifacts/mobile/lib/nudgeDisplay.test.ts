import assert from "node:assert/strict";
import { shouldDismissNudge, visibleNudges } from "./nudgeDisplay.ts";

const nudges = [
  { id: "new", toRoommateId: "user-b", sentAt: "2028-01-03T00:00:00Z" },
  { id: "other", toRoommateId: "user-c", sentAt: "2028-01-01T00:00:00Z" },
  { id: "dismissed", toRoommateId: "user-b", sentAt: "2028-01-01T00:00:00Z", dismissedAt: "2028-01-02T00:00:00Z" },
  { id: "old", toRoommateId: "user-b", sentAt: "2028-01-02T00:00:00Z" },
];

assert.deepEqual(visibleNudges(nudges, "user-b").map((nudge) => nudge.id), ["old", "new"]);
assert.equal(shouldDismissNudge(40, 100), false);
assert.equal(shouldDismissNudge(90, 100), true);
assert.equal(shouldDismissNudge(20, 800), true);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const toast = readFileSync(
  resolve(process.cwd(), "components/NudgeToast.tsx"),
  "utf8",
);

assert.match(
  toast,
  /<View style=\{styles\.content\} \{\.\.\.panResponder\.panHandlers\}>/,
  "the swipe responder must be isolated from the X button",
);
const toastOpeningTag = toast.slice(
  toast.indexOf("<Animated.View"),
  toast.indexOf("style={[", toast.indexOf("<Animated.View")),
);
assert.doesNotMatch(
  toastOpeningTag,
  /panResponder\.panHandlers/,
  "the parent toast must not intercept the X button's touch stream",
);
assert.match(
  toast,
  /event\.stopPropagation\(\);\s*animateDismissal\(current\.id, 1\)/,
  "the X must stop propagation and dismiss the stable current nudge ID",
);
assert.match(
  toast,
  /width: 44,\s*height: 44,/,
  "the X must keep a 44 by 44 point touch target",
);
assert.match(
  toast,
  /disabled=\{dismissingId === current\.id\}/,
  "the X must disable duplicate dismissal presses",
);

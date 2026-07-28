import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const appRoot = resolve(process.cwd(), "app/(tabs)");
const home = readFileSync(resolve(appRoot, "index.tsx"), "utf8");
const group = readFileSync(resolve(appRoot, "group.tsx"), "utf8");
const borrowing = readFileSync(resolve(appRoot, "borrow.tsx"), "utf8");
const expenses = readFileSync(resolve(appRoot, "expenses.tsx"), "utf8");
const shopping = readFileSync(resolve(appRoot, "shopping.tsx"), "utf8");

assert(
  home.includes('{currentUser?.name ?? "You"}') &&
    !home.includes('{currentUser?.name ?? "You"} 🏠'),
  "My Sweet must render the current user's name without the appended home emoji",
);

assert(
  home.includes('(["today", "done", "week"] as Filter[])'),
  "My Chores filters must render Today, Done, Week",
);
assert(
  home.includes("{chore.points} pts") && home.includes("pointsEnabled ?"),
  "My Home must replace the leading category visual with chore points when enabled",
);
assert(
  !home.includes("Done!") && !group.includes("Done!"),
  "completed chore rows must not render the brown Done tile",
);
assert(
  group.includes("style={styles.moreActionsButton}") &&
    group.includes("event.stopPropagation()"),
  "Group overflow must use a dedicated non-bubbling touch target",
);
assert(
  home.includes("style={styles.progressSection}") &&
    !home.includes("styles.progressCard"),
  "My Progress must render without its former card shell",
);
assert(
  !borrowing.includes("styles.itemIcon") &&
    !borrowing.includes("styles.cardLeft"),
  "borrowing rows must not render or reserve space for the leading status circle",
);
assert(
  home.includes("style={styles.categoryVisual}") &&
    home.includes("style={styles.pointsVisual}") &&
    !home.includes("styles.categoryIcon"),
  "My Chores category and points visuals must render without icon tiles",
);
assert(
  !group.includes("styles.activityHeaderIcon, { backgroundColor:"),
  "Room Health and Roommates heading icons must render without tiles",
);
assert(
  group.includes("const visibleChores = rc.slice(0, visibleLimit)") &&
    group.includes("visibleLimit + 50"),
  "Group Chores must render large sections in bounded batches",
);
assert(
  !expenses.includes("styles.expCatIcon, { backgroundColor:"),
  "IOU category icons must render without tiles",
);
assert(
  shopping.includes("style={[styles.inlineYou, { color: colors.foreground }]}") &&
    !shopping.includes('listAssignee.id === currentUserId ? "You" : listAssignee.name'),
  "the current-user shopping assignment must render as plain inline text",
);

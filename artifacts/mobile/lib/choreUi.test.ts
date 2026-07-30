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
    home.includes(
      "style={[styles.pointsVisual, { backgroundColor: colors.secondary }]}",
    ) &&
    !home.includes("styles.categoryIcon"),
  "My Chores must keep category icons unboxed and render points in their compact badge",
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
assert(
  shopping.includes("const expenseId = addExpense({") &&
    shopping.includes("Save & create IOU") &&
    shopping.includes("linkShoppingItemsToExpense([itemId], expenseId)"),
  "saving an individual shopping item must immediately create and link its IOU",
);
assert(
  !shopping.includes("listDollarBtn") &&
    !shopping.includes("handleListToIou") &&
    !shopping.includes('name={item.convertedExpenseId ? "check" : "arrow-right"}'),
  "shopping must expose expense conversion only through the item-level money control",
);
assert(
  expenses.includes("<ActionMenuModal") &&
    !expenses.includes('<Feather name="edit-2" size={15}') &&
    !expenses.includes('name="trash-2"\n                              size={15}'),
  "expense rows must use the shared long-press menu instead of edit and trash icons",
);
assert(
  home.includes("<ActionMenuModal") &&
    group.includes("<ActionMenuModal") &&
    shopping.includes("<ActionMenuModal"),
  "Shopping, Group, and My Sweet must share the app action-menu presentation",
);
assert(
  home.includes('key: "calendar"') &&
    !home.includes("onAddToCalendar") &&
    group.includes('key: "nudge"') &&
    group.includes('key: "calendar"') &&
    !group.includes("styles.nudgeBtn"),
  "chore row secondary actions must live in the shared action menu",
);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const appRoot = resolve(process.cwd(), "app/(tabs)");
const home = readFileSync(resolve(appRoot, "index.tsx"), "utf8");
const group = readFileSync(resolve(appRoot, "group.tsx"), "utf8");

assert(
  home.includes('(["today", "done", "all"] as Filter[])'),
  "My Chores filters must render Today, Done, All",
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

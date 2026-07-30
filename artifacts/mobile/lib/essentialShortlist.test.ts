import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  personalShortlistedEssentials,
  removedShortlistRows,
  shortlistFromRows,
  shortlistSelectionRows,
} from "./essentialShortlist.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const shortlist = shortlistFromRows([
  { section_key: "kitchen", item_id: "paper-towels" },
  { section_key: "kitchen", item_id: "paper-towels" },
  { section_key: "bath", item_id: "soap" },
]);
assert(
  shortlistSelectionRows(shortlist).length === 2,
  "saved shortlist rows must be unique and idempotent",
);
assert(
  removedShortlistRows(shortlist, { kitchen: { "paper-towels": true } })
    .map((row) => row.item_id)
    .join(",") === "soap",
  "saves must delete only items intentionally removed from the opened baseline",
);
const assignments = {
  kitchen: { "paper-towels": ["user-a", "user-b"] },
  bath: { soap: ["user-b"] },
};
assert(
  personalShortlistedEssentials(shortlist, assignments, "user-a").length === 1,
  "a user must see only saved essentials assigned to them",
);
assert(
  personalShortlistedEssentials(shortlist, assignments, "user-b").length === 2,
  "multiple assignees must independently derive personal To Buy items",
);
assert(
  personalShortlistedEssentials({ bath: { soap: true } }, assignments, "user-a")
    .length === 0,
  "removing a shortlist item must remove it from every derived personal view",
);

const planning = readFileSync(resolve(process.cwd(), "app/planning.tsx"), "utf8");
const home = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
assert(
  planning.includes("addSelectedToShopping") &&
    planning.includes("Add Selected to Shopping") &&
    !planning.includes("useEffect(() => addSelectedToShopping"),
  "Sweet Essentials must expose an explicit transfer without effect-driven Shopping mutation",
);
assert(
  home.includes('title="Sweet Essentials To Buy"'),
  "My Sweet must use the requested personal shortlist heading",
);

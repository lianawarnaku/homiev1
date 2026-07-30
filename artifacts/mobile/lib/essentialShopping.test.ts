import { transferEssentialsToShopping } from "./essentialShopping.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const catalog = [
  {
    id: "kitchen",
    title: "Kitchen",
    icon: "coffee",
    color: "#000",
    items: [
      { id: "kettle", label: "Kettle", subsection: "large" as const },
      { id: "sponges", label: "Sponges", subsection: "small" as const },
    ],
  },
  {
    id: "bathroom",
    title: "Bathroom",
    icon: "droplet",
    color: "#000",
    items: [
      { id: "soap", label: "Soap", subsection: "small" as const },
    ],
  },
];
let id = 0;
const makeId = () => `generated-${++id}`;
const selection = {
  kitchen: { kettle: true, sponges: true },
  bathroom: { soap: true },
};

const first = transferEssentialsToShopping({
  selection,
  catalog,
  lists: [],
  items: [],
  addedBy: "user-a",
  makeId,
});
assert(first.result.listsCreated === 2, "one list must be created per selected category");
assert(first.result.itemsAdded === 3, "all selected items must be transferred");
assert(
  first.lists.map((list) => list.name).join(",") ===
    "Sweet Essentials: Kitchen,Sweet Essentials: Bathroom",
  "generated lists must use exact category display names",
);

first.lists[0].name = "My renamed kitchen list";
const retry = transferEssentialsToShopping({
  selection,
  catalog,
  lists: first.lists,
  items: first.items,
  addedBy: "user-a",
  makeId,
});
assert(retry.result.listsCreated === 0, "source metadata must reuse renamed generated lists");
assert(retry.result.itemsAdded === 0, "retries must not duplicate active source items");
assert(retry.result.itemsAlreadyActive === 3, "retries must report already-active items");

const completedItems = first.items.map((item) =>
  item.sourceEssentialItemId === "kettle" ? { ...item, completed: true } : item,
);
const readded = transferEssentialsToShopping({
  selection: { kitchen: { kettle: true } },
  catalog,
  lists: first.lists,
  items: completedItems,
  addedBy: "user-a",
  makeId,
});
assert(
  readded.result.itemsAdded === 1,
  "completed items may be added again under current Shopping completion rules",
);

const manuallyNamed = transferEssentialsToShopping({
  selection: { kitchen: { kettle: true } },
  catalog,
  lists: [{ id: "manual", name: "Sweet Essentials: Kitchen" }],
  items: [],
  addedBy: "user-a",
  makeId,
});
assert(
  manuallyNamed.result.listsCreated === 1,
  "title matching alone must not absorb a manually created list",
);

const largeCatalog = Array.from({ length: 100 }, (_, categoryIndex) => ({
  id: `category-${categoryIndex}`,
  title: `Category ${categoryIndex}`,
  icon: "box",
  color: "#000",
  items: Array.from({ length: 10 }, (_, itemIndex) => ({
    id: `item-${categoryIndex}-${itemIndex}`,
    label: `Item ${categoryIndex}-${itemIndex}`,
    subsection: "small" as const,
  })),
}));
const largeSelection = Object.fromEntries(
  largeCatalog.map((category) => [
    category.id,
    Object.fromEntries(category.items.map((item) => [item.id, true])),
  ]),
);
const large = transferEssentialsToShopping({
  selection: largeSelection,
  catalog: largeCatalog,
  lists: [],
  items: Array.from({ length: 10_000 }, (_, itemIndex) => ({
    id: `history-${itemIndex}`,
    listId: "history",
    name: "Historical item",
    quantity: "1",
    addedBy: "user-a",
    completed: true,
  })),
  addedBy: "user-a",
  makeId,
});
assert(
  large.result.itemsAdded === 1_000 && large.result.listsCreated === 100,
  "large transfers must group all selected source items in one indexed pass",
);

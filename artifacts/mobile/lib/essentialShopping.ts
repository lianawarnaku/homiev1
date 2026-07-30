import type {
  EssentialCategoryDefinition,
} from "../constants/essentialCatalog";
import type {
  ShoppingItem,
  ShoppingList,
} from "../context/AppContext";
import type { EssentialShortlist } from "./essentialShortlist";

export type EssentialShoppingTransferResult = {
  listsCreated: number;
  itemsAdded: number;
  itemsAlreadyActive: number;
  affectedListIds: string[];
};

export function transferEssentialsToShopping({
  selection,
  catalog,
  lists,
  items,
  addedBy,
  makeId,
}: {
  selection: EssentialShortlist;
  catalog: EssentialCategoryDefinition[];
  lists: ShoppingList[];
  items: ShoppingItem[];
  addedBy: string;
  makeId: () => string;
}): {
  lists: ShoppingList[];
  items: ShoppingItem[];
  createdListIds: string[];
  createdItemIds: string[];
  result: EssentialShoppingTransferResult;
} {
  const generatedListByCategory = new Map(
    lists
      .filter(
        (list) =>
          list.sourceType === "sweet_essentials" &&
          Boolean(list.sourceCategoryId),
      )
      .map((list) => [list.sourceCategoryId!, list]),
  );
  const activeSourceItemsByList = new Map<string, Set<string>>();
  for (const item of items) {
    if (
      item.completed ||
      item.sourceType !== "sweet_essentials" ||
      !item.sourceEssentialItemId
    ) {
      continue;
    }
    const sourceIds =
      activeSourceItemsByList.get(item.listId) ?? new Set<string>();
    sourceIds.add(item.sourceEssentialItemId);
    activeSourceItemsByList.set(item.listId, sourceIds);
  }

  const createdLists: ShoppingList[] = [];
  const createdItems: ShoppingItem[] = [];
  const affectedListIds: string[] = [];
  let itemsAlreadyActive = 0;

  for (const category of catalog) {
    const selectedItems = category.items.filter(
      (item) => selection[category.id]?.[item.id],
    );
    if (!selectedItems.length) continue;

    let list = generatedListByCategory.get(category.id);
    if (!list) {
      list = {
        id: makeId(),
        name: `Sweet Essentials: ${category.title}`,
        sourceType: "sweet_essentials",
        sourceCategoryId: category.id,
        sourceCategoryName: category.title,
      };
      createdLists.push(list);
      generatedListByCategory.set(category.id, list);
    }
    affectedListIds.push(list.id);
    const activeIds =
      activeSourceItemsByList.get(list.id) ?? new Set<string>();
    for (const essential of selectedItems) {
      if (activeIds.has(essential.id)) {
        itemsAlreadyActive += 1;
        continue;
      }
      const nextItem: ShoppingItem = {
        id: makeId(),
        listId: list.id,
        name: essential.label,
        quantity: "1",
        addedBy,
        completed: false,
        sourceType: "sweet_essentials",
        sourceEssentialItemId: essential.id,
        sourceCategoryId: category.id,
      };
      createdItems.push(nextItem);
      activeIds.add(essential.id);
    }
    activeSourceItemsByList.set(list.id, activeIds);
  }

  const pinned = lists.filter((list) => list.pinned);
  const unpinned = lists.filter((list) => !list.pinned);
  return {
    lists: [...pinned, ...createdLists, ...unpinned],
    items: [...items, ...createdItems],
    createdListIds: createdLists.map((list) => list.id),
    createdItemIds: createdItems.map((item) => item.id),
    result: {
      listsCreated: createdLists.length,
      itemsAdded: createdItems.length,
      itemsAlreadyActive,
      affectedListIds,
    },
  };
}

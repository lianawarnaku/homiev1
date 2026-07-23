import { getChoreRule } from "@/constants/choreRules";
import type { ItemCategory } from "@/constants/itemDifficulty";
import type {
  CustomTask,
  GeneratedTask,
  HousingType,
} from "@/context/AppContext";
import { getItemDifficulty } from "@/lib/itemDifficulty";

export interface SelectedAmenity {
  category: ItemCategory;
  item: string;
}

export function parseHouseholdAmenities(items: string[]): SelectedAmenity[] {
  return items.flatMap((value) => {
    const separator = value.indexOf(":");
    if (separator < 1) return [];
    const category = value.slice(0, separator) as ItemCategory;
    if (!["kitchen", "bathroom", "living", "other"].includes(category)) return [];
    return [{ category, item: value.slice(separator + 1) }];
  });
}

export async function generateHouseholdTasks(
  householdId: string,
  amenities: SelectedAmenity[],
  housingType: HousingType,
  customTasks: CustomTask[] = [],
): Promise<GeneratedTask[]> {
  const generated = await Promise.all(
    amenities.flatMap((amenity) => {
      const rule = getChoreRule(amenity.category, amenity.item, housingType);
      if (!rule) return [];
      return rule.tasks.map(async (task): Promise<GeneratedTask> => ({
        ...task,
        id: `${amenity.category}:${amenity.item}:${task.id}`,
        itemCategory: amenity.category,
        item: amenity.item,
        difficulty: await getItemDifficulty(
          householdId,
          amenity.category,
          amenity.item,
        ),
      }));
    }),
  );

  return [
    ...generated,
    ...customTasks.map((task): GeneratedTask => ({
      ...task,
      itemCategory: "other",
      item: task.item,
    })),
  ];
}

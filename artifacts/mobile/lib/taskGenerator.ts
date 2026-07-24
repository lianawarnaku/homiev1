import {
  buildFeatureChorePlan,
  normalizeFeatureId,
  type RuleRecurrence,
} from "@/constants/featureChoreRegistry";
import type { ItemCategory } from "@/constants/itemDifficulty";
import type {
  CustomTask,
  GeneratedTask,
  HousingType,
} from "@/context/AppContext";

export interface SelectedAmenity {
  category: ItemCategory;
  item: string;
  roomInstanceId?: string;
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
  _householdId: string,
  amenities: SelectedAmenity[],
  _housingType: HousingType,
  customTasks: CustomTask[] = [],
): Promise<GeneratedTask[]> {
  const amenityByFeatureId = new Map(
    amenities.map((amenity) => [normalizeFeatureId(amenity.category, amenity.item), amenity]),
  );
  const frequency = (value: RuleRecurrence): GeneratedTask["frequency"] =>
    value === "every_3_days" ? "everyOtherDay" : value;
  const generated: GeneratedTask[] = buildFeatureChorePlan(
    amenities.map((amenity) => ({
      roomInstanceId: amenity.roomInstanceId ?? `${amenity.category}-1`,
      featureId: normalizeFeatureId(amenity.category, amenity.item),
    })),
  ).map((task) => {
    const amenity = amenityByFeatureId.get(task.featureId);
    return {
      id: task.sourceKey,
      itemCategory: amenity?.category ?? "other",
      item: amenity?.item ?? task.featureId,
      title: task.title,
      frequency: frequency(task.recurrence),
      timeOfDay: "any",
      difficulty: (task.points <= 5 ? 1 : task.points <= 10 ? 2 : task.points <= 15 ? 3 : task.points <= 25 ? 4 : 5),
    };
  });

  return [
    ...generated,
    ...customTasks.map((task): GeneratedTask => ({
      ...task,
      itemCategory: "other",
      item: task.item,
    })),
  ];
}

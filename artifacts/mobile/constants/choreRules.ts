import type { HousingType } from "@/context/AppContext";
import type { ItemCategory } from "@/constants/itemDifficulty";

export type ChoreFrequency = "daily" | "everyOtherDay" | "weekly" | "biweekly" | "monthly";
export type ChoreTimeOfDay = "morning" | "night" | "any";

export interface ChoreRuleTask {
  id: string;
  title: string;
  frequency: ChoreFrequency;
  timeOfDay: ChoreTimeOfDay;
  keepTogetherGroup?: string;
}

export interface ItemChoreRule {
  category: ItemCategory;
  item: string;
  housingTypes?: HousingType[];
  tasks: ChoreRuleTask[];
}

export const choreRuleKey = (category: ItemCategory, item: string) =>
  `${category}:${item.trim().toLocaleLowerCase()}`;

export function occurrencesPerWeek(frequency: ChoreFrequency): number {
  return {
    daily: 7,
    everyOtherDay: 3.5,
    weekly: 1,
    biweekly: 0.5,
    monthly: 0.23,
  }[frequency];
}

const STARTER_RULES: ItemChoreRule[] = [
  {
    category: "kitchen",
    item: "Dishwasher",
    housingTypes: ["apartment"],
    tasks: [
      { id: "dishwasher-unload", title: "Unload dishwasher", frequency: "daily", timeOfDay: "morning", keepTogetherGroup: "dishwasher" },
      { id: "dishwasher-load", title: "Load dishwasher", frequency: "daily", timeOfDay: "any", keepTogetherGroup: "dishwasher" },
      { id: "dishwasher-run", title: "Turn on dishwasher", frequency: "daily", timeOfDay: "night", keepTogetherGroup: "dishwasher" },
    ],
  },
  {
    category: "bathroom",
    item: "Toilet",
    tasks: [
      { id: "toilet-clean", title: "Clean toilet", frequency: "weekly", timeOfDay: "any" },
    ],
  },
  {
    category: "living",
    item: "Vacuum",
    tasks: [
      { id: "vacuum-common", title: "Vacuum shared space", frequency: "weekly", timeOfDay: "any" },
    ],
  },
  // TODO: Expand this app-controlled table with the full amenity/task catalogue.
];

export const CHORE_RULES: Readonly<Record<string, ItemChoreRule>> = Object.fromEntries(
  STARTER_RULES.map((rule) => [choreRuleKey(rule.category, rule.item), rule]),
);

export function getChoreRule(
  category: ItemCategory,
  item: string,
  housingType?: HousingType,
): ItemChoreRule | undefined {
  const rule = CHORE_RULES[choreRuleKey(category, item)];
  if (!rule || !rule.housingTypes || !housingType) return rule;
  return rule.housingTypes.includes(housingType) ? rule : undefined;
}

import type { ChoreCategory } from "@/context/AppContext";

export type PersistedRecurrence = "daily" | "weekly" | "monthly";
export type RuleRecurrence = "daily" | "every_3_days" | "weekly" | "biweekly" | "monthly";

export interface ChoreTemplate {
  id: string;
  title: string;
  category: ChoreCategory;
  recurrence: RuleRecurrence;
  points: number;
}

export interface GeneratedChorePlanItem extends ChoreTemplate {
  sourceKey: string;
  featureId: string;
  roomInstanceId: string;
  persistedRecurrence: PersistedRecurrence;
}

// The Chore model currently persists only these three intervals.
export const RECURRENCE_COMPATIBILITY: Record<RuleRecurrence, PersistedRecurrence> = {
  daily: "daily",
  every_3_days: "daily",
  weekly: "weekly",
  biweekly: "weekly",
  monthly: "monthly",
};

export const FEATURE_CHORE_RULES: Readonly<Record<string, readonly ChoreTemplate[]>> = {
  "kitchen:trash_can": [
    { id: "empty-kitchen-trash", title: "Empty kitchen trash", category: "kitchen", recurrence: "every_3_days", points: 10 },
    { id: "outside-bin", title: "Take trash to outside bin", category: "other", recurrence: "weekly", points: 10 },
  ],
  "bathroom:trash_can": [{ id: "empty-bathroom-trash", title: "Empty bathroom trash", category: "bathroom", recurrence: "weekly", points: 10 }],
  "living:trash_can": [{ id: "empty-living-trash", title: "Empty living area trash", category: "cleaning", recurrence: "every_3_days", points: 10 }],
  "other:trash_can": [{ id: "empty-shared-trash", title: "Empty shared trash", category: "other", recurrence: "every_3_days", points: 10 }],
  "bathroom:toilet": [{ id: "clean-toilet", title: "Clean toilet", category: "bathroom", recurrence: "weekly", points: 15 }],
  "bathroom:shower": [
    { id: "clean-shower", title: "Clean shower", category: "bathroom", recurrence: "weekly", points: 15 },
    { id: "deep-clean-shower", title: "Deep clean shower", category: "bathroom", recurrence: "biweekly", points: 25 },
  ],
  "bathroom:bathtub": [{ id: "clean-bathtub", title: "Clean bathtub", category: "bathroom", recurrence: "weekly", points: 15 }],
  "bathroom:bathroom_sink": [{ id: "clean-bathroom-sink", title: "Clean bathroom sink", category: "bathroom", recurrence: "weekly", points: 10 }],
  "bathroom:mirror": [{ id: "clean-bathroom-mirror", title: "Clean bathroom mirror", category: "bathroom", recurrence: "weekly", points: 10 }],
  "bathroom:bath_mat": [{ id: "wash-bath-mat", title: "Wash bath mat", category: "laundry", recurrence: "weekly", points: 10 }],
  "kitchen:dishwasher": [
    { id: "load-unload-dishwasher", title: "Load or unload dishwasher", category: "kitchen", recurrence: "daily", points: 10 },
    { id: "clean-dishwasher-filter", title: "Clean dishwasher filter", category: "kitchen", recurrence: "monthly", points: 25 },
  ],
  "kitchen:refrigerator": [
    { id: "check-expired-food", title: "Check refrigerator for expired food", category: "kitchen", recurrence: "weekly", points: 10 },
    { id: "clean-refrigerator-shelves", title: "Clean refrigerator shelves", category: "kitchen", recurrence: "monthly", points: 25 },
  ],
  "kitchen:microwave": [{ id: "clean-microwave", title: "Clean microwave", category: "kitchen", recurrence: "biweekly", points: 15 }],
  "kitchen:stove": [
    { id: "wipe-stovetop", title: "Wipe stovetop", category: "kitchen", recurrence: "daily", points: 10 },
    { id: "deep-clean-stovetop", title: "Deep clean stovetop", category: "kitchen", recurrence: "monthly", points: 30 },
  ],
  "kitchen:floor": [{ id: "sweep-kitchen-floor", title: "Sweep kitchen floor", category: "kitchen", recurrence: "weekly", points: 15 }],
  "bathroom:floor": [{ id: "mop-bathroom-floor", title: "Mop bathroom floor", category: "bathroom", recurrence: "weekly", points: 15 }],
  "living:floor": [{ id: "vacuum-living-room", title: "Vacuum living room", category: "cleaning", recurrence: "weekly", points: 15 }],
  "living:vacuum": [{ id: "vacuum-living-room", title: "Vacuum living room", category: "cleaning", recurrence: "weekly", points: 15 }],
  "other:floor": [{ id: "clean-shared-floor", title: "Clean shared floor", category: "cleaning", recurrence: "weekly", points: 15 }],
  "bedroom:carpet": [{ id: "vacuum-bedroom", title: "Vacuum bedroom", category: "cleaning", recurrence: "weekly", points: 15 }],
  "bedroom:bed_linens": [{ id: "change-bed-linens", title: "Change bed linens", category: "laundry", recurrence: "biweekly", points: 15 }],
  "laundry:washing_machine": [{ id: "clean-washing-machine", title: "Clean washing machine", category: "laundry", recurrence: "monthly", points: 25 }],
  "laundry:dryer": [
    { id: "empty-lint-trap", title: "Empty dryer lint trap", category: "laundry", recurrence: "daily", points: 5 },
    { id: "clean-dryer-lint-area", title: "Clean dryer lint area", category: "laundry", recurrence: "monthly", points: 25 },
  ],
};

export function normalizeFeatureId(category: string, displayName: string): string {
  const normalized = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const aliases: Record<string, string> = {
    "kitchen:mini_fridge": "kitchen:refrigerator",
    "kitchen:fridge": "kitchen:refrigerator",
    "bathroom:sink": "bathroom:bathroom_sink",
    "living:laundry_basket": "laundry:washing_machine",
    "living:washing_machine": "laundry:washing_machine",
    "living:dryer": "laundry:dryer",
  };
  const key = `${category}:${normalized}`;
  return aliases[key] ?? key;
}

export function buildFeatureChorePlan(
  selections: readonly { roomInstanceId: string; featureId: string }[],
): GeneratedChorePlanItem[] {
  const bySourceKey = new Map<string, GeneratedChorePlanItem>();
  const featureCounts = new Map<string, number>();
  selections.forEach((selection) =>
    featureCounts.set(selection.featureId, (featureCounts.get(selection.featureId) ?? 0) + 1),
  );
  for (const selection of selections) {
    for (const template of FEATURE_CHORE_RULES[selection.featureId] ?? []) {
      const sourceKey = `setup:${selection.roomInstanceId}:${selection.featureId}:${template.id}`;
      const roomSuffix =
        (featureCounts.get(selection.featureId) ?? 0) > 1
          ? ` (${selection.roomInstanceId.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())})`
          : "";
      bySourceKey.set(sourceKey, {
        ...template,
        title: `${template.title}${roomSuffix}`,
        sourceKey,
        featureId: selection.featureId,
        roomInstanceId: selection.roomInstanceId,
        persistedRecurrence: RECURRENCE_COMPATIBILITY[template.recurrence],
      });
    }
  }
  return [...bySourceKey.values()];
}

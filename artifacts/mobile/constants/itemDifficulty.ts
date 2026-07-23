export type ItemCategory = 'kitchen' | 'bathroom' | 'living' | 'other';
export interface ItemDifficultyDefault {
  category: ItemCategory;
  item: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}
export const DEFAULT_ITEM_DIFFICULTY: ItemDifficultyDefault[] = [
  // Kitchen
  { category: 'kitchen',  item: 'Mini Fridge',    difficulty: 4 },
  { category: 'kitchen',  item: 'Stove',          difficulty: 4 },
  { category: 'kitchen',  item: 'Trash Can',      difficulty: 1 },
  { category: 'kitchen',  item: 'Microwave',      difficulty: 1 },
  { category: 'kitchen',  item: 'Kettle',         difficulty: 3 },
  { category: 'kitchen',  item: 'Floor',          difficulty: 3 },
  { category: 'kitchen',  item: 'Coffee Machine', difficulty: 3 },
  // Bathroom
  { category: 'bathroom', item: 'Bathroom Sink',  difficulty: 2 },
  { category: 'bathroom', item: 'Mirror',         difficulty: 1 },
  { category: 'bathroom', item: 'Shower',         difficulty: 4 },
  { category: 'bathroom', item: 'Toilet',         difficulty: 5 },
  { category: 'bathroom', item: 'Bath Mat',       difficulty: 1 },
  { category: 'bathroom', item: 'Floor',          difficulty: 4 },
  { category: 'bathroom', item: 'Trash Can',      difficulty: 1 },
  // Living Space
  { category: 'living',   item: 'Trash Can',      difficulty: 1 },
  { category: 'living',   item: 'Vacuum',         difficulty: 3 },
  { category: 'living',   item: 'Laundry Basket', difficulty: 2 },
  // Other
  { category: 'other',    item: 'Trash Can',      difficulty: 3 },
];
// Fallback for any 'other'/custom item not explicitly listed:
export const OTHER_DEFAULT_DIFFICULTY: 1 | 2 | 3 | 4 | 5 = 3;
// Optional display names for levels 1–5 (leave empty to just show "N/5"):
export const DIFFICULTY_LABELS: Partial<Record<1|2|3|4|5, string>> = { /* TODO optional */ };

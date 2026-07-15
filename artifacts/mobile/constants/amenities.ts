/** Shared amenity/chore constants used in both onboarding and the Planning tab. */

export const KITCHEN_AMENITIES = [
  { key: "kettle", label: "Kettle" },
  { key: "microwave", label: "Microwave" },
  { key: "fridge", label: "Refrigerator" },
  { key: "coffee", label: "Coffee Machine" },
  { key: "ice_maker", label: "Ice Maker" },
  { key: "toaster_oven", label: "Toaster Oven" },
  { key: "dining_table", label: "Dining Table" },
  { key: "stove", label: "Stove / Cooktop" },
  { key: "air_fryer", label: "Air Fryer" },
  { key: "toaster", label: "Toaster" },
  { key: "dishwasher", label: "Dishwasher" },
  { key: "drying_rack", label: "Drying Rack" },
  { key: "oven", label: "Oven" },
];

export const BATHROOM_ITEMS = [
  { key: "trash_can", label: "Trash Can" },
  { key: "sink", label: "Sink" },
  { key: "mirror", label: "Mirror" },
  { key: "cabinet", label: "Cabinet / Shelf" },
  { key: "shower", label: "Shower Area" },
  { key: "toilet", label: "Toilet" },
  { key: "bath_mat", label: "Bath Mat" },
];

export const BATHROOM_CHORES = [
  { key: "clean_floor", label: "Clean bathroom floor", points: 15 },
  { key: "restock", label: "Restock supplies (soap, TP, napkins)", points: 10 },
  { key: "clean_mirror", label: "Clean mirror & fixtures", points: 10 },
];

export const LIVING_ITEMS = [{ key: "couches", label: "Couches / Sofa" }];

export const LIVING_CHORES = [
  { key: "vacuum", label: "Vacuum floors & rugs", points: 20 },
  { key: "counters", label: "Wipe countertops & surfaces", points: 15 },
  { key: "wash_linens", label: "Wash kitchen towels & blankets", points: 15 },
  { key: "trash", label: "Take out trash & recycling", points: 10 },
  { key: "mop", label: "Mop hard floors", points: 20 },
  { key: "dishes", label: "Do the dishes", points: 15 },
  { key: "wipe_appliances", label: "Wipe down appliances", points: 10 },
];

export type HousingType = "traditional" | "suite" | "apartment";

export const HOUSING_TYPES: { key: HousingType; label: string; description: string; icon: string }[] = [
  {
    key: "traditional",
    label: "Traditional Dorm",
    description: "Shared hallway bathrooms, communal kitchen",
    icon: "🏫",
  },
  {
    key: "suite",
    label: "Suite-Style",
    description: "Private bathroom shared within the suite",
    icon: "🏠",
  },
  {
    key: "apartment",
    label: "Apartment / House",
    description: "Full kitchen, private bathrooms, living room",
    icon: "🏢",
  },
];

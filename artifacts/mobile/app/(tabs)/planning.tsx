import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppContext, type ChoreCategory, type Roommate } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type PlanType = "chore-chart" | "home-checklist" | null;
type HousingType = "traditional" | "suite" | "apartment" | null;

type ChoreAssignment = {
  bathroom_heavy?: string;
  bathroom_light?: string;
  kitchen_heavy?: string;
  kitchen_light?: string;
  vacuum_mop?: string;
  ad_hoc?: string;
};
type WeekEntry = { week: number; assignments: ChoreAssignment };
type ChoreChartData = { weeks: WeekEntry[]; fairness_note?: string };

const CHORE_SLOTS: { key: keyof ChoreAssignment; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "bathroom_heavy", label: "Bathroom Heavy", icon: "droplet", color: "#5B7FF2" },
  { key: "bathroom_light", label: "Bathroom Light", icon: "wind", color: "#60A5FA" },
  { key: "kitchen_heavy",  label: "Kitchen Heavy",  icon: "zap",     color: "#F97316" },
  { key: "kitchen_light",  label: "Kitchen Light",  icon: "coffee",  color: "#FBBF24" },
  { key: "vacuum_mop",     label: "Vacuum & Mop",   icon: "layers",  color: "#22C55E" },
  { key: "ad_hoc",         label: "Ad Hoc",         icon: "help-circle", color: "#8B5CF6" },
];

// ── Kitchen amenities (all housing types) ──────────────────────────────────
const KITCHEN_AMENITIES = [
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

// ── Bathroom fixtures (suite + apartment) ──────────────────────────────────
const BATHROOM_ITEMS = [
  { key: "trash_can", label: "Trash Can" },
  { key: "sink", label: "Sink" },
  { key: "mirror", label: "Mirror" },
  { key: "cabinet", label: "Cabinet / Shelf" },
  { key: "shower", label: "Shower Area" },
  { key: "toilet", label: "Toilet" },
  { key: "bath_mat", label: "Bath Mat" },
];

// ── Bathroom chores (suite + apartment) ────────────────────────────────────
const BATHROOM_CHORES = [
  { key: "clean_floor", label: "Clean bathroom floor", points: 15 },
  { key: "restock", label: "Restock supplies (soap, TP, napkins)", points: 10 },
  { key: "clean_mirror", label: "Clean mirror & fixtures", points: 10 },
];

// ── Living area fixtures (apartment only) ──────────────────────────────────
const LIVING_ITEMS = [
  { key: "couches", label: "Couches / Sofa" },
];

// ── Living area chores (apartment only) ────────────────────────────────────
const LIVING_CHORES = [
  { key: "vacuum", label: "Vacuum floors & rugs", points: 20 },
  { key: "counters", label: "Wipe countertops & surfaces", points: 15 },
  { key: "wash_linens", label: "Wash kitchen towels & blankets", points: 15 },
  { key: "trash", label: "Take out trash & recycling", points: 10 },
  { key: "mop", label: "Mop hard floors", points: 20 },
  { key: "dishes", label: "Do the dishes", points: 15 },
  { key: "wipe_appliances", label: "Wipe down appliances", points: 10 },
];

// ── Kitchen chore map ──────────────────────────────────────────────────────
const KITCHEN_CHORE_MAP: Record<string, { title: string; points: number }> = {
  kettle: { title: "Descale kettle", points: 10 },
  microwave: { title: "Clean microwave (inside & out)", points: 10 },
  fridge: { title: "Wipe fridge shelves & door", points: 20 },
  coffee: { title: "Descale & clean coffee machine", points: 15 },
  ice_maker: { title: "Clean ice maker", points: 15 },
  toaster_oven: { title: "Clean toaster oven tray", points: 10 },
  dining_table: { title: "Wipe & disinfect dining table", points: 10 },
  stove: { title: "Clean stovetop & burners", points: 20 },
  air_fryer: { title: "Clean air fryer basket", points: 10 },
  toaster: { title: "Empty & wipe toaster", points: 5 },
  dishwasher: { title: "Run/empty dishwasher & wipe door", points: 10 },
  drying_rack: { title: "Put away dishes from drying rack", points: 10 },
  oven: { title: "Deep clean oven", points: 30 },
};

// ── Living item chore map ──────────────────────────────────────────────────
const LIVING_ITEM_CHORE_MAP: Record<string, { title: string; points: number }> = {
  couches: { title: "Vacuum & lint-roll couches", points: 15 },
};

// ── Home Essentials sections (from dorm essentials reference list) ─────────
const HOME_ESSENTIALS_SECTIONS = [
  {
    key: "room",
    title: "Room & Bedroom",
    icon: "home",
    color: "#8B5CF6",
    items: [
      "Shower Caddy", "Standing Fan / Box Fan", "Room Decor (string lights, posters, pictures)",
      "Small Rug", "Mirror", "Towel Hook (Command Strip)", "Hangers",
      "Plastic Storage Bins (under bed / wardrobe)", "Lamp", "Alarm Clock", "Whiteboard for Door",
    ],
  },
  {
    key: "kitchen",
    title: "Kitchen",
    icon: "coffee",
    color: "#F97316",
    items: [
      "Mini-fridge", "Microwave", "Trash Can",
      "Water Filter / Brita", "Hot Water Kettle", "Reusable Utensil Kit", "Tupperware",
      "Microwave-safe Bowls", "Coffee Maker", "Chip Clips", "Paper Towels", "Dish Towel",
      "Sponge", "Dish Soap", "Trash Bags", "Plastic Bags", "Reusable Water Bottle",
      "Tumbler", "Mug", "Bottle Brush", "Saran Wrap / Cling Film", "Parchment Paper",
      "Aluminium Foil", "Dishwasher Pods", "Air Fryer", "Blender", "Pans", "Pots",
      "Cutting Board", "Silverware / Cutlery", "Silverware Organizer", "Oven / Baking Tray",
      "Rice Cooker", "Plates", "Bowls", "Toaster", "Strainer / Colander", "Whisk",
      "Measuring Cups", "Knives", "Dish Drying Mat", "Dish Drying Rack", "Spatulas",
      "Mixing Spoons", "Can Opener", "Bottle Opener", "Tongs", "Food Storage Containers",
      "Peeler", "Kitchen Scissors", "Oil Dispenser",
    ],
  },
  {
    key: "cleaning",
    title: "Cleaning Supplies",
    icon: "wind",
    color: "#22C55E",
    items: [
      "Laundry Detergent", "Laundry Basket", "All-purpose Cleaner", "Mini Vacuum",
      "Clorox / Disinfectant Wipes", "Windex / Glass Cleaner", "Swiffer / Mop",
      "Toilet Cleaner", "Mirror Cleaner", "Cleaning Rags", "Febreze / Air Freshener",
    ],
  },
  {
    key: "bedding",
    title: "Bedding & Linens",
    icon: "moon",
    color: "#EC4899",
    items: [
      "Bath Towels", "Hand Towels", "Sheets", "Pillowcases", "Pillows",
      "Mattress Pad / Topper", "Duvet / Comforter", "Throw Blanket", "Lint Roller", "Steamer / Iron",
    ],
  },
  {
    key: "bathroom",
    title: "Bathroom",
    icon: "droplet",
    color: "#5B7FF2",
    items: [
      "Toilet Paper", "Hand Soap", "Hand Soap Refills", "Shower Toiletries Holder / Caddy",
      "Toilet Cleaner", "Mirror Cleaner", "Febreze", "Hand Towels", "Trashcan",
    ],
  },
  {
    key: "utility",
    title: "Utility & Misc",
    icon: "tool",
    color: "#F59E0B",
    items: [
      "Batteries", "Duct Tape", "Painters Tape", "Extension Cord", "Power Strip",
      "Lock or Lockbox", "Lint Roller", "Tissues", "Lighter", "Scissors",
      "Calendar", "Desk Drawer Organizers", "Rag", "Steamer / Iron",
    ],
  },
  {
    key: "food",
    title: "Food Staples",
    icon: "shopping-bag",
    color: "#EF4444",
    items: [
      "Ramen", "Instant Oatmeal", "Chips / Crackers / Cookies", "Granola Bars",
      "Microwave Popcorn", "Tea", "Hot Chocolate", "Coffee Pods", "Soup (canned)",
      "Rice", "Pasta", "Tomato Sauce", "Bread", "Butter", "Milk", "Eggs",
      "Sugar", "Salt", "Pepper", "Oil", "Cinnamon", "Garlic", "Ginger",
      "Garlic Powder", "Chilli Flakes", "Soy Sauce", "Hot Sauce", "Ketchup",
      "Honey", "Nutella", "Peanut Butter", "Jam", "Cereal", "Yogurt",
      "Frozen Veggies", "Tofu", "Dahl",
    ],
  },
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

// ── Reusable checkbox row ──────────────────────────────────────────────────
function CheckRow({
  label,
  checked,
  onToggle,
  accentColor,
  textColor,
  mutedColor,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  accentColor: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7}>
      <View
        style={[
          styles.checkBox,
          {
            borderColor: checked ? accentColor : mutedColor + "66",
            backgroundColor: checked ? accentColor + "20" : "transparent",
          },
        ]}
      >
        {checked ? <Feather name="check" size={11} color={accentColor} /> : null}
      </View>
      <Text style={[styles.checkLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Reusable chip toggle ───────────────────────────────────────────────────
function ChipToggle({
  label,
  selected,
  onToggle,
  accentColor,
  borderColor,
  textColor,
  mutedColor,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  accentColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accentColor + "18" : "transparent",
          borderColor: selected ? accentColor : borderColor,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {selected ? (
        <Feather name="check-circle" size={12} color={accentColor} />
      ) : (
        <Feather name="circle" size={12} color={mutedColor} />
      )}
      <Text
        style={[
          styles.chipText,
          { color: selected ? accentColor : mutedColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Custom chore inline adder ──────────────────────────────────────────────
function CustomChoreInput({
  chores,
  onAdd,
  onRemove,
  accentColor,
  textColor,
  mutedColor,
  borderColor,
  cardBg,
  triggerLabel,
}: {
  chores: string[];
  onAdd: (chore: string) => void;
  onRemove: (index: number) => void;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  cardBg: string;
  triggerLabel?: string;
}) {
  const [inputVisible, setInputVisible] = useState(false);
  const [text, setText] = useState("");

  const confirm = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onAdd(trimmed);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setText("");
    setInputVisible(false);
  };

  return (
    <View style={customStyles.wrapper}>
      {/* Existing custom chores */}
      {chores.map((chore, i) => (
        <View
          key={i}
          style={[
            customStyles.customRow,
            { backgroundColor: accentColor + "10", borderColor: accentColor + "30" },
          ]}
        >
          <Feather name="edit-3" size={12} color={accentColor} />
          <Text style={[customStyles.customText, { color: textColor }]} numberOfLines={1}>
            {chore}
          </Text>
          <TouchableOpacity
            onPress={() => onRemove(i)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="x" size={14} color={mutedColor} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Input row or trigger button */}
      {inputVisible ? (
        <View
          style={[
            customStyles.inputRow,
            { backgroundColor: cardBg, borderColor: accentColor + "55" },
          ]}
        >
          <TextInput
            style={[customStyles.inlineInput, { color: textColor }]}
            placeholder="Type a chore name..."
            placeholderTextColor={mutedColor}
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <TouchableOpacity onPress={confirm} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Feather name="check" size={18} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setInputVisible(false); setText(""); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather name="x" size={16} color={mutedColor} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[customStyles.trigger, { borderColor: accentColor + "50" }]}
          onPress={() => setInputVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[customStyles.triggerIcon, { backgroundColor: accentColor + "18" }]}>
            <Feather name="plus" size={13} color={accentColor} />
          </View>
          <Text style={[customStyles.triggerText, { color: accentColor }]}>
            {triggerLabel ?? "Add a custom chore"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const customStyles = StyleSheet.create({
  wrapper: { marginTop: 14, gap: 6 },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  customText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingVertical: 4,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingLeft: 10,
  },
  triggerIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});

// ── Essential item row with optional roommate assignment ───────────────────
function EssentialItemRow({
  item,
  checked,
  onToggle,
  assigneeId,
  onAssign,
  accentColor,
  textColor,
  mutedColor,
  roommates,
}: {
  item: string;
  checked: boolean;
  onToggle: () => void;
  assigneeId: string | null;
  onAssign: (id: string | null) => void;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  roommates: Roommate[];
}) {
  return (
    <View>
      <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7}>
        <View
          style={[
            styles.checkBox,
            {
              borderColor: checked ? accentColor : mutedColor + "66",
              backgroundColor: checked ? accentColor + "20" : "transparent",
            },
          ]}
        >
          {checked ? <Feather name="check" size={11} color={accentColor} /> : null}
        </View>
        <Text style={[styles.checkLabel, { color: textColor, flex: 1 }]}>{item}</Text>
        {checked && assigneeId && (() => {
          const r = roommates.find((x) => x.id === assigneeId);
          return r ? (
            <View style={[essentialRowStyles.assignedPill, { backgroundColor: r.color + "22", borderColor: r.color + "55" }]}>
              <View style={[essentialRowStyles.pillDot, { backgroundColor: r.color }]} />
              <Text style={[essentialRowStyles.pillText, { color: r.color }]}>{r.name}</Text>
            </View>
          ) : null;
        })()}
      </TouchableOpacity>
      {checked && (
        <View style={essentialRowStyles.assignRow}>
          <Text style={[essentialRowStyles.assignLabel, { color: mutedColor }]}>Who's getting it?</Text>
          <View style={essentialRowStyles.avatarRow}>
            {roommates.map((r) => {
              const selected = assigneeId === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => onAssign(selected ? null : r.id)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  style={[
                    essentialRowStyles.avatar,
                    {
                      backgroundColor: selected ? r.color : r.color + "22",
                      borderColor: selected ? r.color : r.color + "44",
                    },
                  ]}
                >
                  <Text style={[essentialRowStyles.avatarText, { color: selected ? "#fff" : r.color }]}>
                    {r.name[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const essentialRowStyles = StyleSheet.create({
  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 30,
    paddingBottom: 8,
    gap: 10,
    flexWrap: "wrap",
  },
  assignLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  avatarRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  assignedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

// ── Section card wrapper ───────────────────────────────────────────────────
function SectionCard({
  title,
  icon,
  children,
  cardBg,
  cardBorder,
  titleColor,
  iconBg,
  accentColor,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  iconBg: string;
  accentColor: string;
}) {
  return (
    <View
      style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
    >
      <View style={styles.sectionCardHeader}>
        <View style={[styles.sectionCardIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={16} color={accentColor} />
        </View>
        <Text style={[styles.sectionCardTitle, { color: titleColor }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function PlanningScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates, addChore, essentialsAssignees, setEssentialAssignee } = useAppContext();

  const [selectedType, setSelectedType] = useState<PlanType>(null);
  const [housingType, setHousingType] = useState<HousingType>(null);
  const [kitchenAmenities, setKitchenAmenities] = useState<Set<string>>(new Set());
  const [bathroomItems, setBathroomItems] = useState<Set<string>>(new Set());
  const [bathroomChores, setBathroomChores] = useState<Set<string>>(new Set());
  const [livingItems, setLivingItems] = useState<Set<string>>(new Set());
  const [livingChores, setLivingChores] = useState<Set<string>>(new Set());
  const [customKitchenChores, setCustomKitchenChores] = useState<string[]>([]);
  const [customBathroomChores, setCustomBathroomChores] = useState<string[]>([]);
  const [customLivingChores, setCustomLivingChores] = useState<string[]>([]);
  const [checkedEssentials, setCheckedEssentials] = useState<Record<string, Set<string>>>({});
  const [customEssentials, setCustomEssentials] = useState<Record<string, string[]>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [choreChartData, setChoreChartData] = useState<ChoreChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choresAdded, setChoresAdded] = useState(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  function toggleSet(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function toggleEssential(sectionKey: string, item: string) {
    setCheckedEssentials((prev) => {
      const cur = new Set(prev[sectionKey] ?? []);
      if (cur.has(item)) cur.delete(item);
      else cur.add(item);
      return { ...prev, [sectionKey]: cur };
    });
  }

  function addCustomEssential(sectionKey: string, item: string) {
    setCustomEssentials((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] ?? []), item],
    }));
  }

  function removeCustomEssential(sectionKey: string, idx: number) {
    setCustomEssentials((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).filter((_, i) => i !== idx),
    }));
  }

  function toggleExpandSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Build + create chores (grouped by fairness tiers) ───────────────────
  function createChores(): number {
    if (!housingType) return 0;
    const n = roommates.length;
    let count = 0;

    // ── Derive group titles from user selections ──
    const bathHeavy =
      housingType === "traditional"
        ? "Communal bathroom deep clean — toilet, shower & floor"
        : housingType === "suite"
        ? "En-suite bathroom deep clean — toilet, shower & floor"
        : "Apartment bathroom deep clean — toilet, shower & floor";

    const bathLight = "Bathroom maintenance — sink, mirror, restock supplies & empty trash";

    const kitHeavyItems = ["stove", "microwave", "air_fryer", "oven"]
      .filter((k) => kitchenAmenities.has(k))
      .map((k) => KITCHEN_AMENITIES.find((a) => a.key === k)?.label ?? k);
    const kitHeavy =
      kitHeavyItems.length > 0
        ? `Kitchen deep clean — ${kitHeavyItems.join(", ")}, wipe appliances`
        : "Kitchen deep clean — stove, microwave & appliances";

    const kitLightItems = ["dishwasher", "drying_rack", "fridge", "dining_table"]
      .filter((k) => kitchenAmenities.has(k))
      .map((k) => KITCHEN_AMENITIES.find((a) => a.key === k)?.label ?? k);
    const kitLight =
      kitLightItems.length > 0
        ? `Kitchen upkeep — countertops, ${kitLightItems.join(", ")}`
        : "Kitchen upkeep — countertops, dishes & fridge check";

    const vacMop = "Vacuum & mop — common areas, hallway & living room";
    const adHoc = "Ad hoc helper — check in & assist where needed";

    // ── Ordered chore groups: one per person, most important first ──
    // Fold user's appliance/bathroom selections into the group descriptions
    const groups: [string, ChoreCategory, number][] = [
      [bathHeavy, "bathroom", 35],
      [kitHeavy, "kitchen", 30],
      [bathLight, "bathroom", 20],
      [kitLight, "kitchen", 20],
      [vacMop, "cleaning", 20],
    ];

    // Assign exactly ONE chore group per person
    for (let i = 0; i < n; i++) {
      const [title, cat, pts] =
        i < groups.length ? groups[i] : [adHoc, "other" as ChoreCategory, 10];
      count++;
      addChore({
        title,
        assignedTo: roommates[i].id,
        dueDate: daysFromNow(7),
        completed: false,
        points: pts,
        category: cat,
      });
    }

    // ── Custom chores (user-defined additions) — rotate through roommates ──
    const allCustom: [string, ChoreCategory, number][] = [
      ...customKitchenChores.map((t): [string, ChoreCategory, number] => [t, "kitchen", 15]),
      ...customBathroomChores.map((t): [string, ChoreCategory, number] => [t, "bathroom", 15]),
      ...customLivingChores.map((t): [string, ChoreCategory, number] => [t, "cleaning", 15]),
    ];
    allCustom.forEach(([title, cat, pts], idx) => {
      count++;
      addChore({ title, assignedTo: roommates[idx % n].id, dueDate: daysFromNow(7), completed: false, points: pts, category: cat });
    });

    return count;
  }

  // ── Build AI context string ──────────────────────────────────────────────
  function buildContext(): string {
    const parts: string[] = [];
    if (housingType) {
      const typeLabel =
        housingType === "traditional"
          ? "traditional-style (shared room, communal bathroom)"
          : housingType === "suite"
          ? "suite-style (private bedroom, en-suite bathroom)"
          : "apartment-style (full kitchen, private bathroom, living area)";
      parts.push(`Housing: ${typeLabel}`);
    }
    if (kitchenAmenities.size > 0) {
      parts.push(`Kitchen amenities: ${[...kitchenAmenities].map((k) => KITCHEN_AMENITIES.find((a) => a.key === k)?.label).filter(Boolean).join(", ")}`);
    }
    if (housingType !== "traditional") {
      if (bathroomItems.size > 0)
        parts.push(`Bathroom fixtures: ${[...bathroomItems].map((k) => BATHROOM_ITEMS.find((a) => a.key === k)?.label).filter(Boolean).join(", ")}`);
      if (bathroomChores.size > 0)
        parts.push(`Bathroom tasks: ${[...bathroomChores].map((k) => BATHROOM_CHORES.find((a) => a.key === k)?.label).filter(Boolean).join(", ")}`);
    }
    if (housingType === "apartment") {
      if (livingItems.size > 0)
        parts.push(`Living area items: ${[...livingItems].map((k) => LIVING_ITEMS.find((a) => a.key === k)?.label).filter(Boolean).join(", ")}`);
      if (livingChores.size > 0)
        parts.push(`Living area tasks: ${[...livingChores].map((k) => LIVING_CHORES.find((a) => a.key === k)?.label).filter(Boolean).join(", ")}`);
    }
    // ── Home essentials selections ──
    if (selectedType === "home-checklist") {
      HOME_ESSENTIALS_SECTIONS.forEach((section) => {
        const checked = checkedEssentials[section.key];
        const custom = customEssentials[section.key] ?? [];
        const items = [...(checked ? [...checked] : []), ...custom];
        if (items.length > 0) {
          const assignments = essentialsAssignees[section.key] ?? {};
          const itemsWithAssignment = items.map((item) => {
            const rid = assignments[item];
            const rname = rid ? roommates.find((r) => r.id === rid)?.name : null;
            return rname ? `${item} (${rname})` : item;
          });
          parts.push(`${section.title} (selected): ${itemsWithAssignment.join(", ")}`);
        }
      });
    }

    if (preferences.trim()) parts.push(preferences.trim());
    return parts.join(". ");
  }

  const generate = async () => {
    if (!selectedType) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setChoreChartData(null);
    setChoresAdded(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let added = 0;
    if (selectedType === "chore-chart" && housingType) {
      added = createChores();
    }

    try {
      const res = await fetch(`${baseUrl}/api/planning/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          preferences: buildContext() || undefined,
          roommates: roommates.map((r) => r.name),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { suggestion: string };

      if (selectedType === "chore-chart") {
        try {
          const parsed = JSON.parse(data.suggestion) as ChoreChartData;
          setChoreChartData(parsed);
        } catch {
          // Fallback: show raw text if JSON parse fails
          setResult(data.suggestion);
        }
      } else {
        setResult(data.suggestion);
      }

      setChoresAdded(added);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Unable to generate suggestion. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const isChoreChart = selectedType === "chore-chart";
  const canGenerate =
    selectedType !== null &&
    (selectedType === "home-checklist" || (isChoreChart && housingType !== null));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 90 + botPad }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Planning Helper
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          AI-powered suggestions for your home
        </Text>
      </View>

      {/* ── Plan type selector ── */}
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
        What do you need?
      </Text>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[
            styles.typeCard,
            {
              backgroundColor: isChoreChart ? colors.primary + "12" : colors.card,
              borderColor: isChoreChart ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            setSelectedType("chore-chart");
            setResult(null);
            setChoresAdded(0);
          }}
        >
          <View
            style={[
              styles.typeIcon,
              { backgroundColor: isChoreChart ? colors.primary + "20" : colors.secondary },
            ]}
          >
            <Feather
              name="calendar"
              size={24}
              color={isChoreChart ? colors.primary : colors.mutedForeground}
            />
          </View>
          <Text
            style={[
              styles.typeTitle,
              { color: isChoreChart ? colors.primary : colors.foreground },
            ]}
          >
            Chore Chart
          </Text>
          <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
            Fair weekly schedule for all roommates
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeCard,
            {
              backgroundColor:
                selectedType === "home-checklist" ? colors.accent + "12" : colors.card,
              borderColor:
                selectedType === "home-checklist" ? colors.accent : colors.border,
            },
          ]}
          onPress={() => {
            setSelectedType("home-checklist");
            setResult(null);
            setChoresAdded(0);
          }}
        >
          <View
            style={[
              styles.typeIcon,
              {
                backgroundColor:
                  selectedType === "home-checklist"
                    ? colors.accent + "20"
                    : colors.secondary,
              },
            ]}
          >
            <Feather
              name="home"
              size={24}
              color={
                selectedType === "home-checklist"
                  ? colors.accent
                  : colors.mutedForeground
              }
            />
          </View>
          <Text
            style={[
              styles.typeTitle,
              {
                color:
                  selectedType === "home-checklist"
                    ? colors.accent
                    : colors.foreground,
              },
            ]}
          >
            Home Essentials
          </Text>
          <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
            What to buy for a new home
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Housing type (only for chore chart) ── */}
      {isChoreChart && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
            Your housing type
          </Text>

          <View style={styles.housingRow}>
            {[
              {
                key: "traditional",
                label: "Traditional",
                desc: "Shared room\nCommunal bathroom",
                icon: "users",
              },
              {
                key: "suite",
                label: "Suite-Style",
                desc: "Private bedroom\nEn-suite bathroom",
                icon: "home",
              },
              {
                key: "apartment",
                label: "Apartment",
                desc: "Full kitchen\nIn-unit bathroom",
                icon: "box",
              },
            ].map((h) => {
              const active = housingType === h.key;
              return (
                <TouchableOpacity
                  key={h.key}
                  style={[
                    styles.housingCard,
                    {
                      backgroundColor: active ? colors.primary + "12" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setHousingType(h.key as HousingType);
                    setResult(null);
                    setChoresAdded(0);
                  }}
                >
                  <View
                    style={[
                      styles.housingIcon,
                      {
                        backgroundColor: active
                          ? colors.primary + "20"
                          : colors.secondary,
                      },
                    ]}
                  >
                    <Feather
                      name={h.icon as any}
                      size={20}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <Text
                    style={[
                      styles.housingLabel,
                      { color: active ? colors.primary : colors.foreground },
                    ]}
                  >
                    {h.label}
                  </Text>
                  <Text
                    style={[styles.housingDesc, { color: colors.mutedForeground }]}
                  >
                    {h.desc}
                  </Text>
                  {active && (
                    <View
                      style={[styles.housingDot, { backgroundColor: colors.primary }]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* ── Amenity sections ── */}
      {isChoreChart && housingType && (
        <View style={styles.amenityArea}>

          {/* Kitchen Setup */}
          <SectionCard
            title="Kitchen Setup"
            icon="coffee"
            cardBg={colors.card}
            cardBorder={colors.border}
            titleColor={colors.foreground}
            iconBg={colors.primary + "18"}
            accentColor={colors.primary}
          >
            <Text style={[styles.amenityHint, { color: colors.mutedForeground }]}>
              Which kitchen appliances do you share?
            </Text>
            <View style={styles.chipWrap}>
              {KITCHEN_AMENITIES.map((a) => (
                <ChipToggle
                  key={a.key}
                  label={a.label}
                  selected={kitchenAmenities.has(a.key)}
                  onToggle={() =>
                    setKitchenAmenities(toggleSet(kitchenAmenities, a.key))
                  }
                  accentColor={colors.primary}
                  borderColor={colors.border}
                  textColor={colors.foreground}
                  mutedColor={colors.mutedForeground}
                />
              ))}
            </View>
            <CustomChoreInput
              chores={customKitchenChores}
              onAdd={(c) => setCustomKitchenChores((prev) => [...prev, c])}
              onRemove={(i) => setCustomKitchenChores((prev) => prev.filter((_, idx) => idx !== i))}
              accentColor={colors.primary}
              textColor={colors.foreground}
              mutedColor={colors.mutedForeground}
              borderColor={colors.border}
              cardBg={colors.card}
            />
          </SectionCard>

          {/* Bathroom Setup (suite + apartment) */}
          {(housingType === "suite" || housingType === "apartment") && (
            <SectionCard
              title="Bathroom Setup"
              icon="droplet"
              cardBg={colors.card}
              cardBorder={colors.border}
              titleColor={colors.foreground}
              iconBg={colors.success + "18"}
              accentColor={colors.success}
            >
              <Text style={[styles.amenityHint, { color: colors.mutedForeground }]}>
                What's in your bathroom?
              </Text>
              <View style={styles.chipWrap}>
                {BATHROOM_ITEMS.map((a) => (
                  <ChipToggle
                    key={a.key}
                    label={a.label}
                    selected={bathroomItems.has(a.key)}
                    onToggle={() =>
                      setBathroomItems(toggleSet(bathroomItems, a.key))
                    }
                    accentColor={colors.success}
                    borderColor={colors.border}
                    textColor={colors.foreground}
                    mutedColor={colors.mutedForeground}
                  />
                ))}
              </View>

              <Text
                style={[
                  styles.amenityHint,
                  { color: colors.mutedForeground, marginTop: 14 },
                ]}
              >
                Chores to add to your chart:
              </Text>
              {BATHROOM_CHORES.map((c) => (
                <CheckRow
                  key={c.key}
                  label={`${c.label} (+${c.points} pts)`}
                  checked={bathroomChores.has(c.key)}
                  onToggle={() =>
                    setBathroomChores(toggleSet(bathroomChores, c.key))
                  }
                  accentColor={colors.success}
                  textColor={colors.foreground}
                  mutedColor={colors.mutedForeground}
                />
              ))}
              <CustomChoreInput
                chores={customBathroomChores}
                onAdd={(c) => setCustomBathroomChores((prev) => [...prev, c])}
                onRemove={(i) => setCustomBathroomChores((prev) => prev.filter((_, idx) => idx !== i))}
                accentColor={colors.success}
                textColor={colors.foreground}
                mutedColor={colors.mutedForeground}
                borderColor={colors.border}
                cardBg={colors.card}
              />
            </SectionCard>
          )}

          {/* Living Area (apartment only) */}
          {housingType === "apartment" && (
            <SectionCard
              title="Living Area"
              icon="tv"
              cardBg={colors.card}
              cardBorder={colors.border}
              titleColor={colors.foreground}
              iconBg={colors.warning + "18"}
              accentColor={colors.warning}
            >
              <Text style={[styles.amenityHint, { color: colors.mutedForeground }]}>
                What's in your living area?
              </Text>
              <View style={styles.chipWrap}>
                {LIVING_ITEMS.map((a) => (
                  <ChipToggle
                    key={a.key}
                    label={a.label}
                    selected={livingItems.has(a.key)}
                    onToggle={() =>
                      setLivingItems(toggleSet(livingItems, a.key))
                    }
                    accentColor={colors.warning}
                    borderColor={colors.border}
                    textColor={colors.foreground}
                    mutedColor={colors.mutedForeground}
                  />
                ))}
              </View>

              <Text
                style={[
                  styles.amenityHint,
                  { color: colors.mutedForeground, marginTop: 14 },
                ]}
              >
                Chores to add to your chart:
              </Text>
              {LIVING_CHORES.map((c) => (
                <CheckRow
                  key={c.key}
                  label={`${c.label} (+${c.points} pts)`}
                  checked={livingChores.has(c.key)}
                  onToggle={() =>
                    setLivingChores(toggleSet(livingChores, c.key))
                  }
                  accentColor={colors.warning}
                  textColor={colors.foreground}
                  mutedColor={colors.mutedForeground}
                />
              ))}
              <CustomChoreInput
                chores={customLivingChores}
                onAdd={(c) => setCustomLivingChores((prev) => [...prev, c])}
                onRemove={(i) => setCustomLivingChores((prev) => prev.filter((_, idx) => idx !== i))}
                accentColor={colors.warning}
                textColor={colors.foreground}
                mutedColor={colors.mutedForeground}
                borderColor={colors.border}
                cardBg={colors.card}
              />
            </SectionCard>
          )}
        </View>
      )}

      {/* ── Home Essentials checklist ── */}
      {selectedType === "home-checklist" && (
        <View style={[styles.amenityArea, { marginTop: 4 }]}>
          {HOME_ESSENTIALS_SECTIONS.map((section) => {
            const sectionChecked = checkedEssentials[section.key] ?? new Set<string>();
            const sectionCustom = customEssentials[section.key] ?? [];
            const checkedCount = sectionChecked.size + sectionCustom.length;
            const isExpanded = expandedSections.has(section.key);
            return (
              <View
                key={section.key}
                style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <TouchableOpacity
                  style={styles.sectionCardHeader}
                  onPress={() => toggleExpandSection(section.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.sectionCardIcon, { backgroundColor: section.color + "18" }]}>
                    <Feather name={section.icon as any} size={16} color={section.color} />
                  </View>
                  <Text style={[styles.sectionCardTitle, { color: colors.foreground, flex: 1 }]}>
                    {section.title}
                  </Text>
                  {checkedCount > 0 && (
                    <View style={[styles.checkedBadge, { backgroundColor: section.color + "20" }]}>
                      <Text style={[styles.checkedBadgeText, { color: section.color }]}>
                        {checkedCount}
                      </Text>
                    </View>
                  )}
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: 4 }}>
                    {section.items.map((item) => (
                      <EssentialItemRow
                        key={item}
                        item={item}
                        checked={sectionChecked.has(item)}
                        onToggle={() => toggleEssential(section.key, item)}
                        assigneeId={essentialsAssignees[section.key]?.[item] ?? null}
                        onAssign={(id) => setEssentialAssignee(section.key, item, id)}
                        accentColor={section.color}
                        textColor={colors.foreground}
                        mutedColor={colors.mutedForeground}
                        roommates={roommates}
                      />
                    ))}
                    <CustomChoreInput
                      chores={sectionCustom}
                      onAdd={(item) => addCustomEssential(section.key, item)}
                      onRemove={(i) => removeCustomEssential(section.key, i)}
                      accentColor={section.color}
                      textColor={colors.foreground}
                      mutedColor={colors.mutedForeground}
                      borderColor={colors.border}
                      cardBg={colors.card}
                      triggerLabel="Add a custom item"
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Preferences ── */}
      <Text
        style={[
          styles.sectionLabel,
          { color: colors.foreground, marginTop: isChoreChart && housingType ? 4 : 0 },
        ]}
      >
        Additional notes (optional)
      </Text>

      <TextInput
        style={[
          styles.textarea,
          {
            backgroundColor: colors.card,
            color: colors.foreground,
            borderColor: colors.border,
          },
        ]}
        placeholder="Describe your schedules, pets, special preferences..."
        placeholderTextColor={colors.mutedForeground}
        value={preferences}
        onChangeText={setPreferences}
        multiline
        numberOfLines={3}
      />

      {/* ── Generate button ── */}
      <Pressable
        style={[
          styles.generateBtn,
          {
            backgroundColor:
              canGenerate && !loading ? colors.primary : colors.muted,
          },
        ]}
        disabled={!canGenerate || loading}
        onPress={generate}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.generateText}>
              {isChoreChart && housingType
                ? "Build Chore Chart & Add Tasks"
                : selectedType === "home-checklist"
                ? "Generate Suggestions"
                : "Generate"}
            </Text>
          </>
        )}
      </Pressable>

      {/* ── Chores added banner ── */}
      {choresAdded > 0 && (
        <View
          style={[
            styles.successBanner,
            {
              backgroundColor: colors.success + "14",
              borderColor: colors.success + "44",
            },
          ]}
        >
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={[styles.successText, { color: colors.success }]}>
            {choresAdded} chore{choresAdded !== 1 ? "s" : ""} added to My Home!
          </Text>
        </View>
      )}

      {/* ── Error ── */}
      {error ? (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: colors.destructive + "12",
              borderColor: colors.destructive + "33",
            },
          ]}
        >
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* ── Chore chart structured result ── */}
      {choreChartData ? (
        <View style={{ marginHorizontal: 16, marginTop: 12, gap: 10 }}>
          {/* Header */}
          <View style={[styles.resultHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.resultHeaderIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="calendar" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>12-Week Chore Chart</Text>
            <TouchableOpacity
              onPress={() => { setChoreChartData(null); setChoresAdded(0); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Week cards */}
          {choreChartData.weeks.map((entry) => (
            <View
              key={entry.week}
              style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Week badge */}
              <View style={[styles.weekBadge, { backgroundColor: colors.primary + "14" }]}>
                <Text style={[styles.weekBadgeText, { color: colors.primary }]}>
                  Week {entry.week}
                </Text>
              </View>

              {/* Assignment rows */}
              {CHORE_SLOTS.map((slot) => {
                const personName = entry.assignments[slot.key];
                if (!personName) return null;
                const roommate = roommates.find((r) => r.name === personName);
                const chipColor = roommate?.color ?? slot.color;
                return (
                  <View key={slot.key} style={styles.weekRow}>
                    <View style={[styles.weekRowIcon, { backgroundColor: slot.color + "18" }]}>
                      <Feather name={slot.icon} size={12} color={slot.color} />
                    </View>
                    <Text style={[styles.weekRowLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {slot.label}
                    </Text>
                    <View style={[styles.weekPersonChip, { backgroundColor: chipColor + "20", borderColor: chipColor + "55" }]}>
                      <Text style={[styles.weekPersonName, { color: chipColor }]} numberOfLines={1}>
                        {personName}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Fairness note */}
          {choreChartData.fairness_note ? (
            <View style={[styles.fairnessNote, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}>
              <Feather name="shield" size={13} color={colors.success} />
              <Text style={[styles.fairnessNoteText, { color: colors.mutedForeground }]}>
                {choreChartData.fairness_note}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Home checklist / fallback text result ── */}
      {result ? (
        <View
          style={[
            styles.resultCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.resultHeaderRow}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              Your{" "}
              {selectedType === "chore-chart" ? "Chore Chart" : "Home Checklist"}
            </Text>
            <TouchableOpacity
              onPress={() => { setResult(null); setChoresAdded(0); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.resultText, { color: colors.foreground }]}>
            {result}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 4 },

  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 8,
  },

  // ── Type cards ──
  typeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: { fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "center" },
  typeDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },

  // ── Housing cards ──
  housingRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  housingCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  housingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  housingLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textAlign: "center",
  },
  housingDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    textAlign: "center",
    lineHeight: 13,
  },
  housingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },

  // ── Amenity sections ──
  amenityArea: { paddingHorizontal: 16, gap: 12, marginBottom: 4 },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  amenityHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 12 },

  // ── Checkboxes ──
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },

  // ── Inputs ──
  textarea: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 12,
  },

  // ── Generate button ──
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  generateText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },

  // ── Banners ──
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  successText: { fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 },
  checkedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  checkedBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  errorText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },

  // ── Result card (home checklist / fallback) ──
  resultCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  resultHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 },
  resultText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Chore chart structured output ──
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  resultHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  weekBadge: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  weekBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  weekRowIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRowLabel: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  weekPersonChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  weekPersonName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  fairnessNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  fairnessNoteText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
});

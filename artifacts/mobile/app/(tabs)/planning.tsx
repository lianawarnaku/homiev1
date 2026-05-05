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

import { useAppContext, type ChoreCategory } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type PlanType = "chore-chart" | "home-checklist" | null;
type HousingType = "traditional" | "suite" | "apartment" | null;

// ── Kitchen amenities (all housing types) ──────────────────────────────────
const KITCHEN_AMENITIES = [
  { key: "microwave", label: "Microwave" },
  { key: "fridge", label: "Refrigerator" },
  { key: "coffee", label: "Coffee Machine" },
  { key: "ice_maker", label: "Ice Maker" },
  { key: "kettle", label: "Kettle" },
  { key: "toaster_oven", label: "Toaster Oven" },
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
  { key: "scrub_toilet", label: "Scrub & sanitize toilet", points: 20 },
  { key: "clean_mirror", label: "Clean mirror & fixtures", points: 10 },
  { key: "wipe_sink", label: "Wipe & disinfect sink", points: 10 },
];

// ── Living area fixtures (apartment only) ──────────────────────────────────
const LIVING_ITEMS = [
  { key: "couches", label: "Couches / Sofa" },
  { key: "dining_table", label: "Dining Table" },
  { key: "stove", label: "Stove / Cooktop" },
  { key: "air_fryer", label: "Air Fryer" },
  { key: "toaster", label: "Toaster" },
  { key: "dishwasher", label: "Dishwasher" },
  { key: "drying_rack", label: "Drying Rack" },
  { key: "oven", label: "Oven" },
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
  microwave: { title: "Clean microwave (inside & out)", points: 10 },
  fridge: { title: "Wipe fridge shelves & door", points: 20 },
  coffee: { title: "Descale & clean coffee machine", points: 15 },
  ice_maker: { title: "Clean ice maker", points: 15 },
  kettle: { title: "Descale kettle", points: 10 },
  toaster_oven: { title: "Clean toaster oven tray", points: 10 },
};

// ── Living item chore map ──────────────────────────────────────────────────
const LIVING_ITEM_CHORE_MAP: Record<string, { title: string; points: number }> = {
  couches: { title: "Vacuum & lint-roll couches", points: 15 },
  dining_table: { title: "Wipe & disinfect dining table", points: 10 },
  stove: { title: "Clean stovetop & burners", points: 20 },
  air_fryer: { title: "Clean air fryer basket", points: 10 },
  toaster: { title: "Empty & wipe toaster", points: 5 },
  dishwasher: { title: "Run/empty dishwasher & wipe door", points: 10 },
  drying_rack: { title: "Put away dishes from drying rack", points: 10 },
  oven: { title: "Deep clean oven", points: 30 },
};

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
  const { roommates, addChore } = useAppContext();

  const [selectedType, setSelectedType] = useState<PlanType>(null);
  const [housingType, setHousingType] = useState<HousingType>(null);
  const [kitchenAmenities, setKitchenAmenities] = useState<Set<string>>(new Set());
  const [bathroomItems, setBathroomItems] = useState<Set<string>>(new Set());
  const [bathroomChores, setBathroomChores] = useState<Set<string>>(new Set());
  const [livingItems, setLivingItems] = useState<Set<string>>(new Set());
  const [livingChores, setLivingChores] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState("");
  const [result, setResult] = useState<string | null>(null);
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

  // ── Build + create chores ────────────────────────────────────────────────
  function createChores(): number {
    if (!housingType) return 0;

    const roommateIds = roommates.map((r) => r.id);
    let choreIdx = 0;
    let count = 0;

    function assign(
      title: string,
      category: ChoreCategory,
      points: number,
      daysOut = 7
    ) {
      const assignedTo = roommateIds[choreIdx % roommateIds.length];
      choreIdx++;
      count++;
      addChore({
        title,
        assignedTo,
        dueDate: daysFromNow(daysOut),
        completed: false,
        points,
        category,
      });
    }

    // ── Auto-chores by housing type ──
    if (housingType === "traditional") {
      assign("Clean communal bathroom", "bathroom", 25, 7);
    }
    if (housingType === "suite") {
      assign("Clean bedroom", "cleaning", 20, 7);
      assign("Clean en-suite bathroom", "bathroom", 25, 7);
    }
    if (housingType === "apartment") {
      assign("Clean bedroom", "cleaning", 20, 7);
      assign("Deep clean kitchen", "kitchen", 30, 7);
      assign("Clean apartment bathroom", "bathroom", 25, 7);
    }

    // ── Kitchen amenity chores ──
    kitchenAmenities.forEach((key) => {
      const c = KITCHEN_CHORE_MAP[key];
      if (c) assign(c.title, "kitchen", c.points, 7);
    });
    // Always add general kitchen chore if any amenity selected
    if (kitchenAmenities.size > 0) {
      assign("Wipe down kitchen counters", "kitchen", 10, 3);
    }

    // ── Bathroom chores ──
    if (housingType === "suite" || housingType === "apartment") {
      bathroomChores.forEach((key) => {
        const c = BATHROOM_CHORES.find((b) => b.key === key);
        if (c) assign(c.label, "bathroom", c.points, 7);
      });
      // If shower or toilet selected as items, auto-add cleaning chore
      if (bathroomItems.has("shower"))
        assign("Scrub shower & clean grout", "bathroom", 25, 7);
      if (bathroomItems.has("toilet") && !bathroomChores.has("scrub_toilet"))
        assign("Scrub & sanitize toilet", "bathroom", 20, 7);
    }

    // ── Living area item chores ──
    if (housingType === "apartment") {
      livingItems.forEach((key) => {
        const c = LIVING_ITEM_CHORE_MAP[key];
        if (c) assign(c.title, key === "stove" || key === "oven" ? "kitchen" : "cleaning", c.points, 7);
      });
      livingChores.forEach((key) => {
        const c = LIVING_CHORES.find((l) => l.key === key);
        if (c) assign(c.label, "cleaning", c.points, 7);
      });
    }

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
    if (preferences.trim()) parts.push(preferences.trim());
    return parts.join(". ");
  }

  const generate = async () => {
    if (!selectedType) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setChoresAdded(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Create chores from selections
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
      setResult(data.suggestion);
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
            </SectionCard>
          )}
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

      {/* ── AI result ── */}
      {result ? (
        <View
          style={[
            styles.resultCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.resultHeader}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              Your{" "}
              {selectedType === "chore-chart" ? "Chore Chart" : "Home Checklist"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setResult(null);
                setChoresAdded(0);
              }}
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

  // ── Result card ──
  resultCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  resultHeader: {
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
});

import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { HOUSING_TYPES, HousingType } from "@/constants/amenities";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";

const TOTAL_STEPS = 4;
const ITEM_SECTIONS = [
  {
    key: "kitchen",
    title: "Kitchen",
    items: [
      { key: "mini_fridge", label: "Mini fridge" },
      { key: "trash_can", label: "Trash can" },
      { key: "microwave", label: "Microwave" },
      { key: "kettle", label: "Kettle" },
      { key: "floor", label: "Floor" },
      { key: "coffee_machine", label: "Coffee machine" },
    ],
  },
  {
    key: "bathroom",
    title: "Bathroom",
    items: [
      { key: "bathroom_sink", label: "Bathroom sink" },
      { key: "mirror", label: "Mirror" },
      { key: "shower", label: "Shower" },
      { key: "toilet", label: "Toilet" },
      { key: "bath_mat", label: "Bath mat" },
      { key: "floor", label: "Floor" },
      { key: "trash_can", label: "Trash can" },
    ],
  },
  {
    key: "living_space",
    title: "Living Space",
    items: [
      { key: "trash_can", label: "Trash can" },
      { key: "vacuum", label: "Vacuum" },
      { key: "laundry_basket", label: "Laundry basket" },
    ],
  },
  {
    key: "other",
    title: "Other",
    items: [
      { key: "floor", label: "Floor" },
      { key: "trash_can", label: "Trash can" },
    ],
  },
] as const;
const SUGGESTED_CHORES = [
  { key: "take_out_trash", label: "Take out trash" },
  { key: "vacuum_floors", label: "Vacuum floors" },
  { key: "clean_microwave", label: "Clean microwave" },
  { key: "do_laundry", label: "Do laundry" },
  { key: "clean_bathroom", label: "Clean bathroom" },
  { key: "mop_floors", label: "Mop floors" },
  { key: "do_dishes", label: "Do the dishes" },
  { key: "tidy_living_space", label: "Tidy living space" },
];

export default function CreateHousehold() {
  const { user } = useAuth();
  const { refresh } = useHousehold();

  // Step state
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name ?? ""
  );
  const [householdName, setHouseholdName] = useState("");
  const [housingType, setHousingType] = useState<HousingType>("traditional");
  const [itemSel, setItemSel] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<Record<string, string[]>>({});
  const [customItemDrafts, setCustomItemDrafts] = useState<Record<string, string>>({});
  const [choreSel, setChoreSel] = useState<Set<string>>(new Set());
  const [customChores, setCustomChores] = useState<string[]>([]);
  const [customChoreDraft, setCustomChoreDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Navigation helpers ──────────────────────────────────────────────────
  function goNext() {
    animateTo(step + 1);
  }

  function goBack() {
    if (step === 0) { router.back(); return; }
    animateTo(step - 1);
  }

  function animateTo(next: number) {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      slideAnim.setValue(0);
    });
  }

  // ── Chip helpers ──────────────────────────────────────────────────────
  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }

  function itemSelectionKey(section: string, item: string) {
    return `${section}:${item}`;
  }

  function addCustomItem(section: string) {
    const name = (customItemDrafts[section] ?? "").trim();
    if (!name || (customItems[section] ?? []).includes(name)) return;
    setCustomItems((current) => ({ ...current, [section]: [...(current[section] ?? []), name] }));
    setCustomItemDrafts((current) => ({ ...current, [section]: "" }));
    setItemSel((current) => new Set(current).add(itemSelectionKey(section, name)));
  }

  function addCustomChore() {
    const name = customChoreDraft.trim();
    if (!name || customChores.includes(name)) return;
    setCustomChores((current) => [...current, name]);
    setCustomChoreDraft("");
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!householdName.trim() || !displayName.trim()) {
      Alert.alert("Missing info", "Please fill in your name and household name.");
      return;
    }
    setSaving(true);
    try {
      // refreshSession() forces a network round-trip to get a guaranteed-fresh
      // access_token. Unlike getSession() (reads stale storage) or getUser()
      // (validates but doesn't return the token), this gives us the token we
      // actually need for the direct fetch calls below.
      const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !session?.access_token) {
        Alert.alert("Session expired", "Please sign in again.");
        router.replace("/(auth)/login");
        return;
      }
      const uid = session.user.id;

      // 1. Create the household via raw fetch — the Supabase JS client on React
      //    Native intermittently fails to attach the Authorization header to
      //    PostgREST requests, causing a 42501 RLS rejection even with a valid
      //    JWT. Using fetch directly with the token explicitly set is bulletproof.
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/households`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          name: householdName.trim(),
          housing_type: housingType,
          created_by: uid,
        }),
      });
      if (!insertRes.ok) {
        const body = await insertRes.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${insertRes.status}: Failed to create household`);
      }
      const rows = await insertRes.json();
      const h = Array.isArray(rows) ? rows[0] : rows;
      if (!h?.id) throw new Error("Failed to create household — no data returned");

      // 2. Add the creator as owner (direct fetch — same JWT issue as above)
      const memberRes = await fetch(`${supabaseUrl}/rest/v1/household_members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          household_id: h.id,
          user_id: uid,
          display_name: displayName.trim(),
          role: "owner",
        }),
      });
      if (!memberRes.ok) {
        const body = await memberRes.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${memberRes.status}: Failed to add member`);
      }

      // 3. Insert selected amenities (direct fetch)
      const amenities = [
        ...[...itemSel].map((selection) => {
          const separator = selection.indexOf(":");
          return {
            household_id: h.id,
            category: selection.slice(0, separator),
            name: selection.slice(separator + 1),
          };
        }),
        ...[...choreSel].map((name) => ({ household_id: h.id, category: "chore", name })),
        ...customChores.map((name) => ({ household_id: h.id, category: "chore", name })),
      ];
      if (amenities.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/household_amenities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(amenities),
        });
      }

      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Step canAdvance ─────────────────────────────────────────────────────
  const canAdvance =
    step === 0 ? displayName.trim().length > 0 && householdName.trim().length > 0
    : step === 1 ? !!housingType
    : true;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={goBack}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.stepCount}>
            Step {step + 1} of {TOTAL_STEPS}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 0: Names ── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Let's set up your household</Text>
              <Text style={styles.stepSub}>What should we call you and your place?</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex"
                  placeholderTextColor="#B0A090"
                  autoCapitalize="words"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Household name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4B Squad, The Loft, Casa Chaos"
                  placeholderTextColor="#B0A090"
                  value={householdName}
                  onChangeText={setHouseholdName}
                  returnKeyType="done"
                  onSubmitEditing={() => canAdvance && goNext()}
                />
              </View>
            </View>
          )}

          {/* ── Step 1: Housing type ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What kind of place is it?</Text>
              <Text style={styles.stepSub}>This helps generate the right chore rotations.</Text>

              {HOUSING_TYPES.map((ht) => (
                <Pressable
                  key={ht.key}
                  style={[
                    styles.typeCard,
                    housingType === ht.key && styles.typeCardSelected,
                  ]}
                  onPress={() => setHousingType(ht.key)}
                >
                  <Text style={styles.typeEmoji}>{ht.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.typeLabel,
                      housingType === ht.key && styles.typeLabelSelected,
                    ]}>
                      {ht.label}
                    </Text>
                    <Text style={styles.typeDesc}>{ht.description}</Text>
                  </View>
                  <View style={[
                    styles.radio,
                    housingType === ht.key && styles.radioSelected,
                  ]} />
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Step 2: Shared-space items ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What's in your shared space?</Text>
              <Text style={styles.stepSub}>
                Select everything you have, or add an item to any section.
              </Text>
              {ITEM_SECTIONS.map((section) => (
                <View key={section.key} style={styles.itemSection}>
                  <Text style={styles.sectionLabel}>{section.title}</Text>
                  <View style={styles.chips}>
                    {[...section.items, ...(customItems[section.key] ?? []).map((name) => ({ key: name, label: name }))].map((item) => {
                      const selectionKey = itemSelectionKey(section.key, item.key);
                      const selected = itemSel.has(selectionKey);
                      return (
                        <Pressable
                          key={selectionKey}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => setItemSel(toggle(itemSel, selectionKey))}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.addRow}>
                    <TextInput
                      style={styles.addInput}
                      placeholder={`Add an item to ${section.title}`}
                      placeholderTextColor="#B0A090"
                      value={customItemDrafts[section.key] ?? ""}
                      onChangeText={(value) => setCustomItemDrafts((current) => ({ ...current, [section.key]: value }))}
                      onSubmitEditing={() => addCustomItem(section.key)}
                      returnKeyType="done"
                    />
                    <Pressable style={styles.addButton} onPress={() => addCustomItem(section.key)}>
                      <Text style={styles.addButtonText}>＋</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Step 3: Additional chores ── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Which chores should we add?</Text>
              <Text style={styles.stepSub}>Choose common chores and add anything unique to your household.</Text>
              <View style={styles.chips}>
                {SUGGESTED_CHORES.map((chore) => (
                  <Pressable
                    key={chore.key}
                    style={[styles.chip, choreSel.has(chore.key) && styles.chipSelected]}
                    onPress={() => setChoreSel(toggle(choreSel, chore.key))}
                  >
                    <Text style={[styles.chipText, choreSel.has(chore.key) && styles.chipTextSelected]}>
                      {chore.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Add a custom chore</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g. Water the plants"
                  placeholderTextColor="#B0A090"
                  value={customChoreDraft}
                  onChangeText={setCustomChoreDraft}
                  onSubmitEditing={addCustomChore}
                  returnKeyType="done"
                />
                <Pressable style={styles.addButton} onPress={addCustomChore}>
                  <Text style={styles.addButtonText}>＋</Text>
                </Pressable>
              </View>
              {customChores.map((chore) => (
                <Pressable
                  key={chore}
                  style={styles.customItem}
                  onPress={() => setCustomChores((current) => current.filter((item) => item !== chore))}
                >
                  <Text style={styles.customItemText}>✓ {chore}</Text>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom button */}
        <View style={styles.footer}>
          {step < TOTAL_STEPS - 1 ? (
            <Pressable
              style={[styles.btn, !canAdvance && styles.btnDisabled]}
              onPress={goNext}
              disabled={!canAdvance}
            >
              <Text style={styles.btnText}>Continue</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>Create Household</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFAF6" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#8D5524" },
  stepCount: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#B0A090" },
  progressTrack: {
    height: 4,
    backgroundColor: "#E2D5C8",
    marginHorizontal: 24,
    borderRadius: 2,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#8D5524",
    borderRadius: 2,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  stepContent: { gap: 16 },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#1A120B",
    letterSpacing: -0.3,
  },
  stepSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#7A6652",
    lineHeight: 21,
  },
  fieldGroup: { gap: 6 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#4A3728" },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#1A120B",
    backgroundColor: "#FFF",
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    backgroundColor: "#FFF",
  },
  typeCardSelected: { borderColor: "#8D5524", backgroundColor: "#FDF5ED" },
  typeEmoji: { fontSize: 28 },
  typeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#1A120B",
  },
  typeLabelSelected: { color: "#8D5524" },
  typeDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#7A6652",
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D0C4B8",
  },
  radioSelected: { borderColor: "#8D5524", backgroundColor: "#8D5524" },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#4A3728",
  },
  itemSection: {
    gap: 10,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EADFD4",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    backgroundColor: "#FFF",
  },
  chipSelected: { borderColor: "#8D5524", backgroundColor: "#8D5524" },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#4A3728",
  },
  chipTextSelected: { color: "#FFF" },
  addRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#E2D5C8",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#1A120B",
    backgroundColor: "#FFF",
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8D5524",
  },
  addButtonText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 22 },
  customItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  customItemText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#4A3728" },
  removeText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#A45B45" },
  footer: { padding: 24, paddingBottom: 36 },
  btn: {
    height: 52,
    backgroundColor: "#8D5524",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFF",
    letterSpacing: 0.2,
  },
});

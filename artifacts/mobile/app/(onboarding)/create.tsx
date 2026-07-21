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

import { BATHROOM_CHORES, BATHROOM_ITEMS, HOUSING_TYPES, KITCHEN_AMENITIES, HousingType } from "@/constants/amenities";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";

const TOTAL_STEPS = 4;

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
  const [kitchenSel, setKitchenSel] = useState<Set<string>>(new Set());
  const [bathroomItemSel, setBathroomItemSel] = useState<Set<string>>(new Set());
  const [bathroomChoreSel, setBathroomChoreSel] = useState<Set<string>>(new Set());
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

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!householdName.trim() || !displayName.trim()) {
      Alert.alert("Missing info", "Please fill in your name and household name.");
      return;
    }
    setSaving(true);
    try {
      // 1. Create the household
      const { data: h, error: hErr } = await supabase
        .from("households")
        .insert({ name: householdName.trim(), housing_type: housingType, created_by: user!.id })
        .select()
        .single();
      if (hErr || !h) throw hErr ?? new Error("Failed to create household");

      // 2. Add the creator as owner
      const { error: mErr } = await supabase.from("household_members").insert({
        household_id: h.id,
        user_id: user!.id,
        display_name: displayName.trim(),
        role: "owner",
      });
      if (mErr) throw mErr;

      // 3. Insert selected amenities
      const amenities = [
        ...[...kitchenSel].map((k) => ({ household_id: h.id, category: "kitchen", name: k })),
        ...[...bathroomItemSel].map((k) => ({ household_id: h.id, category: "bathroom_item", name: k })),
        ...[...bathroomChoreSel].map((k) => ({ household_id: h.id, category: "bathroom_chore", name: k })),
      ];
      if (amenities.length > 0) {
        await supabase.from("household_amenities").insert(amenities);
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

          {/* ── Step 2: Kitchen amenities ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What's in your kitchen?</Text>
              <Text style={styles.stepSub}>
                Select everything you share. This builds your chore list.
              </Text>
              <View style={styles.chips}>
                {KITCHEN_AMENITIES.map((a) => (
                  <Pressable
                    key={a.key}
                    style={[styles.chip, kitchenSel.has(a.key) && styles.chipSelected]}
                    onPress={() => setKitchenSel(toggle(kitchenSel, a.key))}
                  >
                    <Text style={[styles.chipText, kitchenSel.has(a.key) && styles.chipTextSelected]}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 3: Bathroom (suite/apartment only) ── */}
          {step === 3 && housingType !== "traditional" && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Tell us about your bathroom</Text>
              <Text style={styles.stepSub}>What fixtures do you have, and what needs cleaning?</Text>

              <Text style={styles.sectionLabel}>Fixtures</Text>
              <View style={styles.chips}>
                {BATHROOM_ITEMS.map((a) => (
                  <Pressable
                    key={a.key}
                    style={[styles.chip, bathroomItemSel.has(a.key) && styles.chipSelected]}
                    onPress={() => setBathroomItemSel(toggle(bathroomItemSel, a.key))}
                  >
                    <Text style={[styles.chipText, bathroomItemSel.has(a.key) && styles.chipTextSelected]}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Regular chores</Text>
              <View style={styles.chips}>
                {BATHROOM_CHORES.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[styles.chip, bathroomChoreSel.has(c.key) && styles.chipSelected]}
                    onPress={() => setBathroomChoreSel(toggle(bathroomChoreSel, c.key))}
                  >
                    <Text style={[styles.chipText, bathroomChoreSel.has(c.key) && styles.chipTextSelected]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Final step placeholder for traditional (no bathroom step) */}
          {step === 3 && housingType === "traditional" && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>You're all set!</Text>
              <Text style={styles.stepSub}>
                Your household is ready. Tap "Create" to get started — share the invite code with your roommates so they can join.
              </Text>
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

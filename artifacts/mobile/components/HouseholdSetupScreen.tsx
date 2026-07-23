import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/BrandMark";
import { type HousingType, useAppContext } from "@/context/AppContext";
import { useTheme } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { reportSupabaseError, reportRuntimeError } from "@/lib/runtimeDiagnostics";
import { error as hapticError } from "@/lib/haptics";

const COLORS = ["#7B563B", "#A66A3F", "#C58B57", "#7D8B6A", "#B36A6A", "#8C6D80"];
const makeInviteCode = () => Crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
const HOUSING: { key: HousingType; label: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "traditional", label: "Regular dorm", description: "Shared room and communal bathroom", icon: "users" },
  { key: "suite", label: "Suite-style", description: "Private rooms with an en-suite bathroom", icon: "home" },
  { key: "apartment", label: "Apartment", description: "Full kitchen, bathroom, and living area", icon: "grid" },
];
const ITEM_SECTIONS = [
  { key: "kitchen", title: "Kitchen", icon: "coffee", items: ["Mini fridge", "Trash can", "Microwave", "Kettle", "Floor", "Coffee machine"] },
  { key: "bathroom", title: "Bathroom", icon: "droplet", items: ["Bathroom sink", "Mirror", "Shower", "Toilet", "Bath mat", "Floor", "Trash can"] },
  { key: "living", title: "Living Space", icon: "home", items: ["Trash can", "Vacuum", "Laundry basket"] },
  { key: "other", title: "Other", icon: "more-horizontal", items: ["Floor", "Trash can"] },
] as const;
const SUGGESTED_CHORES = ["Take out trash", "Vacuum floors", "Clean microwave", "Do laundry"];
const SUITE_CHORES = ["Clean bathroom", "Restock bathroom supplies"];
const APARTMENT_CHORES = ["Do the dishes", "Clean kitchen", "Mop floors", "Tidy living room"];

export function HouseholdSetupScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { createHousehold, joinHousehold, setHomeProfile } = useAppContext();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createInviteCode] = useState(makeInviteCode);
  const [color, setColor] = useState(COLORS[0]);
  const [housingType, setHousingType] = useState<HousingType | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<Record<string, string[]>>({});
  const [customItemDrafts, setCustomItemDrafts] = useState<Record<string, string>>({});
  const [chores, setChores] = useState<string[]>([]);
  const [customChore, setCustomChore] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedChores = useMemo(
    () => [...SUGGESTED_CHORES, ...(housingType === "suite" || housingType === "apartment" ? SUITE_CHORES : []), ...(housingType === "apartment" ? APARTMENT_CHORES : [])],
    [housingType]
  );

  const changeMode = (next: "create" | "join") => {
    setMode(next);
    setStep(1);
    setError(null);
  };
  const toggle = (value: string, values: string[], setter: (next: string[]) => void) =>
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const next = () => {
    setError(null);
    if (step === 1 && !displayName.trim()) return setError("Enter the name your roommates will see.");
    if (step === 1 && !householdName.trim()) return setError("Give your household a name.");
    if (step === 2 && !housingType) return setError("Choose the type of home you live in.");
    setStep((current) => Math.min(4, current + 1));
  };

  const submitJoin = async () => {
    setError(null);
    if (!displayName.trim()) return setError("Enter the name your roommates will see.");
    if (inviteCode.trim().length < 6) return setError("Enter the invite code from your roommate.");
    setLoading(true);
    try {
      await joinHousehold(inviteCode, displayName, color);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      reportRuntimeError("join household", e);
      hapticError();
      setError(e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : "We couldn't connect you to that household.");
    } finally { setLoading(false); }
  };

  const submitCreate = async () => {
    if (!housingType) return;
    setLoading(true);
    setError(null);
    try {
      setHomeProfile({ housingType, items, additionalChores: chores });
      await createHousehold(householdName, displayName, color, createInviteCode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      reportRuntimeError("create household", e);
      hapticError();
      setError(e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : "We couldn't create your household.");
    } finally { setLoading(false); }
  };

  const addCustomChore = () => {
    const value = customChore.trim();
    if (!value || chores.includes(value)) return;
    setChores([...chores, value]);
    setCustomChore("");
  };

  const itemKey = (section: string, item: string) => `${section}:${item}`;
  const addCustomItem = (section: string) => {
    const value = (customItemDrafts[section] ?? "").trim();
    if (!value || (customItems[section] ?? []).includes(value)) return;
    setCustomItems((current) => ({ ...current, [section]: [...(current[section] ?? []), value] }));
    setCustomItemDrafts((current) => ({ ...current, [section]: "" }));
    setItems((current) => [...current, itemKey(section, value)]);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
        {mode === "create" && <Progress step={step} colors={colors} />}
        <View style={styles.brand}><BrandMark size={58} color={colors.primary} /></View>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{mode === "create" ? `CREATE YOUR HOME · STEP ${step} OF 4` : "JOIN YOUR HOME"}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {mode === "join" ? "Join your roommates" : step === 1 ? "Start your household" : step === 2 ? "What kind of home is it?" : step === 3 ? "What's in your space?" : "Which chores should we add?"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {mode === "join" ? "Enter the invite code a roommate shared with you." : step === 1 ? "Set up your private household and invite your roommates." : step === 2 ? "This helps Roomie suggest chores that fit your actual space." : step === 3 ? "Select everything your household shares. You can change this later." : "Pick suggested chores or add your own. This step is optional."}
        </Text>

        {step === 1 && (
          <View style={[styles.segment, { backgroundColor: colors.muted }]}>
            {(["create", "join"] as const).map((item) => (
              <Pressable key={item} onPress={() => changeMode(item)} style={[styles.segmentButton, mode === item && { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name={item === "create" ? "home" : "user-plus"} size={16} color={mode === item ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.segmentText, { color: mode === item ? colors.foreground : colors.mutedForeground }]}>{item === "create" ? "Create home" : "Join home"}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mode === "join" ? (
            <>
              <Field label="YOUR DISPLAY NAME" icon="user" value={displayName} onChangeText={setDisplayName} placeholder="e.g. Liana" colors={colors} />
              <Field label="INVITE CODE" icon="key" value={inviteCode} onChangeText={(v: string) => setInviteCode(v.toUpperCase())} placeholder="8-character code" autoCapitalize="characters" colors={colors} />
              <Text style={[styles.label, { color: colors.mutedForeground }]}>PROFILE COLOR</Text>
              <ColorPicker value={color} onChange={setColor} colors={colors} />
            </>
          ) : step === 1 ? (
            <>
              <Field label="YOUR DISPLAY NAME" icon="user" value={displayName} onChangeText={setDisplayName} placeholder="e.g. Liana" colors={colors} />
              <Field label="HOUSEHOLD NAME" icon="home" value={householdName} onChangeText={setHouseholdName} placeholder="e.g. The Maple House" colors={colors} />
              <View>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>YOUR INVITE CODE</Text>
                <Pressable onPress={() => Clipboard.setStringAsync(createInviteCode)} style={[styles.codeRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.codeText, { color: colors.foreground }]}>{createInviteCode}</Text>
                  <View style={[styles.copyButton, { backgroundColor: colors.primary }]}><Feather name="copy" size={16} color="#fff" /></View>
                </Pressable>
                <Text style={[styles.codeHint, { color: colors.mutedForeground }]}>Copy and share this after creating your household.</Text>
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>PROFILE COLOR</Text>
              <ColorPicker value={color} onChange={setColor} colors={colors} />
            </>
          ) : step === 2 ? (
            <View style={styles.optionList}>{HOUSING.map((option) => <SelectionCard key={option.key} title={option.label} subtitle={option.description} icon={option.icon} selected={housingType === option.key} onPress={() => setHousingType(option.key)} colors={colors} />)}</View>
          ) : step === 3 ? (
            <View style={styles.itemSections}>
              {ITEM_SECTIONS.map((section) => (
                <View key={section.key} style={[styles.itemSection, { borderColor: colors.border }]}>
                  <View style={styles.itemSectionHeader}>
                    <View style={[styles.itemSectionIcon, { backgroundColor: colors.primary + "14" }]}>
                      <Feather name={section.icon} size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.itemSectionTitle, { color: colors.foreground }]}>{section.title}</Text>
                  </View>
                  <View style={styles.chips}>
                    {[...section.items, ...(customItems[section.key] ?? [])].map((item) => {
                      const key = itemKey(section.key, item);
                      return <Chip key={key} label={item} selected={items.includes(key)} onPress={() => toggle(key, items, setItems)} colors={colors} />;
                    })}
                  </View>
                  <View style={[styles.customRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <TextInput
                      value={customItemDrafts[section.key] ?? ""}
                      onChangeText={(value) => setCustomItemDrafts((current) => ({ ...current, [section.key]: value }))}
                      onSubmitEditing={() => addCustomItem(section.key)}
                      placeholder={`Add an item to ${section.title}`}
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.input, { color: colors.foreground }]}
                    />
                    <Pressable onPress={() => addCustomItem(section.key)} style={[styles.addButton, { backgroundColor: colors.primary }]}>
                      <Feather name="plus" color="#fff" size={18} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <>
              <View style={styles.chips}>{suggestedChores.map((chore) => <Chip key={chore} label={chore} selected={chores.includes(chore)} onPress={() => toggle(chore, chores, setChores)} colors={colors} />)}</View>
              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 4 }]}>ADD A CUSTOM CHORE</Text>
              <View style={[styles.customRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <TextInput value={customChore} onChangeText={setCustomChore} onSubmitEditing={addCustomChore} placeholder="e.g. Water the plants" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
                <Pressable onPress={addCustomChore} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" color="#fff" size={18} /></Pressable>
              </View>
              {chores.filter((chore) => !suggestedChores.includes(chore)).map((chore) => (
                <Pressable key={chore} onPress={() => setChores(chores.filter((item) => item !== chore))} style={styles.customChore}>
                  <Feather name="check-circle" size={16} color={colors.primary} /><Text style={[styles.customChoreText, { color: colors.foreground }]}>{chore}</Text><Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </>
          )}

          {error && <View style={[styles.error, { backgroundColor: colors.destructive + "12" }]}><Feather name="alert-circle" size={15} color={colors.destructive} /><Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text></View>}
          <View style={styles.actions}>
            {mode === "create" && step > 1 && <Pressable onPress={() => { setStep(step - 1); setError(null); }} style={[styles.back, { borderColor: colors.border }]}><Feather name="arrow-left" size={18} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Back</Text></Pressable>}
            <Pressable disabled={loading} onPress={mode === "join" ? submitJoin : step === 4 ? submitCreate : next} style={[styles.primary, { backgroundColor: colors.primary, opacity: loading ? .65 : 1 }]}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryText}>{mode === "join" ? "Join household" : step === 4 ? "Create household" : "Continue"}</Text><Feather name="arrow-right" size={17} color="#fff" /></>}
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={async () => {
            try {
              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) {
                reportSupabaseError("sign out from household setup", signOutError);
                setError(signOutError.message);
              }
            } catch (signOutError) {
              reportRuntimeError("sign out from household setup", signOutError);
              setError("We couldn't sign you out. Please try again.");
            }
          }}
          style={styles.signOut}
        ><Text style={[styles.signOutText, { color: colors.mutedForeground }]}>Signed in with the wrong account? Sign out</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Progress({ step, colors }: any) {
  return <View style={styles.progressWrap}><View style={styles.progressLabels}><Text style={[styles.progressText, { color: colors.foreground }]}>Household setup</Text><Text style={[styles.progressCount, { color: colors.mutedForeground }]}>{step}/4</Text></View><View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${step * 25}%` }]} /></View><View style={styles.progressDots}>{["Details", "Home", "Items", "Chores"].map((label, index) => <Text key={label} style={[styles.progressDotLabel, { color: index + 1 <= step ? colors.primary : colors.mutedForeground }]}>{label}</Text>)}</View></View>;
}
function Field({ label, icon, colors, ...props }: any) { return <View><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}><Feather name={icon} size={16} color={colors.mutedForeground} /><TextInput {...props} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} /></View></View>; }
function ColorPicker({ value, onChange, colors }: any) { return <View style={styles.swatches}>{COLORS.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.swatch, { backgroundColor: item }, value === item && { borderColor: colors.foreground, borderWidth: 3 }]}>{value === item && <Feather name="check" size={16} color="#fff" />}</Pressable>)}</View>; }
function SelectionCard({ title, subtitle, icon, selected, onPress, colors }: any) { return <Pressable onPress={onPress} style={[styles.selectionCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "10" : colors.card }]}><View style={[styles.selectionIcon, { backgroundColor: selected ? colors.primary : colors.muted }]}><Feather name={icon} size={20} color={selected ? "#fff" : colors.mutedForeground} /></View><View style={{ flex: 1 }}><Text style={[styles.selectionTitle, { color: selected ? colors.primary : colors.foreground }]}>{title}</Text><Text style={[styles.selectionSub, { color: colors.mutedForeground }]}>{subtitle}</Text></View><Feather name={selected ? "check-circle" : "circle"} size={21} color={selected ? colors.primary : colors.border} /></Pressable>; }
function Chip({ label, selected, onPress, colors }: any) { return <Pressable onPress={onPress} style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "12" : colors.muted }]}><Feather name={selected ? "check" : "plus"} size={14} color={selected ? colors.primary : colors.mutedForeground} /><Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1 }, scroll: { paddingHorizontal: 22 }, brand: { alignItems: "center", marginBottom: 12 }, eyebrow: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.5, textAlign: "center" }, title: { fontFamily: "Inter_700Bold", fontSize: 32, lineHeight: 36, textAlign: "center", marginTop: 5 }, subtitle: { fontFamily: "Inter_400Regular", fontSize: 16, lineHeight: 21, textAlign: "center", marginTop: 8, marginBottom: 20 },
  progressWrap: { marginBottom: 16 }, progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }, progressText: { fontFamily: "Inter_700Bold", fontSize: 14 }, progressCount: { fontFamily: "Inter_600SemiBold", fontSize: 13 }, progressTrack: { height: 7, borderRadius: 4, overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 4 }, progressDots: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 }, progressDotLabel: { width: "25%", textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  segment: { borderRadius: 16, padding: 4, flexDirection: "row", marginBottom: 14 }, segmentButton: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, segmentText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 16 }, label: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1, marginBottom: 7 }, inputWrap: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }, input: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 16 },
  codeRow: { height: 56, borderWidth: 1, borderRadius: 14, paddingLeft: 15, paddingRight: 7, flexDirection: "row", alignItems: "center" }, codeText: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 21, letterSpacing: 3 }, copyButton: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" }, codeHint: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6 },
  swatches: { flexDirection: "row", justifyContent: "space-between" }, swatch: { width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", borderColor: "transparent" }, optionList: { gap: 10 }, selectionCard: { borderWidth: 1.5, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, selectionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, selectionTitle: { fontFamily: "Inter_700Bold", fontSize: 18 }, selectionSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 18, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, chip: { minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 }, chipText: { fontFamily: "Inter_600SemiBold", fontSize: 14 }, customRow: { height: 52, borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 6, flexDirection: "row", alignItems: "center" }, addButton: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" }, customChore: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 5 }, customChoreText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  itemSections: { gap: 14 }, itemSection: { borderBottomWidth: 1, paddingBottom: 14, gap: 12 }, itemSectionHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, itemSectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }, itemSectionTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  error: { padding: 12, borderRadius: 12, flexDirection: "row", gap: 8 }, errorText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14 }, actions: { flexDirection: "row", gap: 10 }, back: { height: 54, borderRadius: 15, borderWidth: 1, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }, backText: { fontFamily: "Inter_700Bold", fontSize: 16 }, primary: { flex: 1, height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }, primaryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 17 }, signOut: { padding: 18, alignItems: "center" }, signOutText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});

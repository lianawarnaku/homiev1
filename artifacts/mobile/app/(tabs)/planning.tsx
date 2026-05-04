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

import { useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type PlanType = "chore-chart" | "home-checklist" | null;

const QUICK_PROMPTS = [
  "We have 4 roommates with different schedules",
  "We have pets and need extra cleaning",
  "We prefer weekly rotations",
  "We just moved into a new apartment",
];

export default function PlanningScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates } = useAppContext();

  const [selectedType, setSelectedType] = useState<PlanType>(null);
  const [preferences, setPreferences] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const generate = async () => {
    if (!selectedType) return;
    setLoading(true);
    setError(null);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${baseUrl}/api/planning/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          preferences: preferences.trim() || undefined,
          roommates: roommates.map((r) => r.name),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { suggestion: string };
      setResult(data.suggestion);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Unable to generate suggestion. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

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

      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
        What do you need?
      </Text>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[
            styles.typeCard,
            {
              backgroundColor:
                selectedType === "chore-chart"
                  ? colors.primary + "12"
                  : colors.card,
              borderColor:
                selectedType === "chore-chart"
                  ? colors.primary
                  : colors.border,
            },
          ]}
          onPress={() => {
            setSelectedType("chore-chart");
            setResult(null);
          }}
        >
          <View
            style={[
              styles.typeIcon,
              {
                backgroundColor:
                  selectedType === "chore-chart"
                    ? colors.primary + "20"
                    : colors.secondary,
              },
            ]}
          >
            <Feather
              name="calendar"
              size={24}
              color={
                selectedType === "chore-chart"
                  ? colors.primary
                  : colors.mutedForeground
              }
            />
          </View>
          <Text
            style={[
              styles.typeTitle,
              {
                color:
                  selectedType === "chore-chart"
                    ? colors.primary
                    : colors.foreground,
              },
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
                selectedType === "home-checklist"
                  ? colors.accent + "12"
                  : colors.card,
              borderColor:
                selectedType === "home-checklist"
                  ? colors.accent
                  : colors.border,
            },
          ]}
          onPress={() => {
            setSelectedType("home-checklist");
            setResult(null);
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

      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
        Preferences (optional)
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
        placeholder="Describe your situation, schedule, or special needs..."
        placeholderTextColor={colors.mutedForeground}
        value={preferences}
        onChangeText={setPreferences}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Quick add
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}
      >
        {QUICK_PROMPTS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.quickChip,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
            onPress={() =>
              setPreferences((prev) =>
                prev ? `${prev}. ${p}` : p
              )
            }
          >
            <Text style={[styles.quickText, { color: colors.mutedForeground }]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Pressable
        style={[
          styles.generateBtn,
          {
            backgroundColor:
              selectedType && !loading ? colors.primary : colors.muted,
          },
        ]}
        disabled={!selectedType || loading}
        onPress={generate}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="zap" size={18} color="#fff" />
            <Text style={styles.generateText}>Generate</Text>
          </>
        )}
      </Pressable>

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
              Your {selectedType === "chore-chart" ? "Chore Chart" : "Home Checklist"}
            </Text>
            <TouchableOpacity
              onPress={() => setResult(null)}
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
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 4 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
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
  textarea: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  quickRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
  },
  generateText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
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

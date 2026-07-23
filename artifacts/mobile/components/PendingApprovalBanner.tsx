import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/constants/colors";
import { useAppContext } from "@/context/AppContext";

function namesList(names: string[]) {
  if (names.length < 2) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function PendingApprovalBanner() {
  const colors = useTheme();
  const { currentProposedChart, chartApprovals, roommates } = useAppContext();
  if (currentProposedChart?.status !== "pending") return null;
  const waiting = chartApprovals
    .filter((approval) => !approval.approved)
    .map((approval) => roommates.find((member) => member.id === approval.memberId)?.name)
    .filter((name): name is string => !!name);

  return (
    <TouchableOpacity
      onPress={() => router.push("/alerts")}
      activeOpacity={0.78}
      style={[styles.banner, { backgroundColor: colors.muted, borderColor: colors.border }]}
    >
      <Feather name="bell" size={15} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {waiting.length
          ? `Waiting on ${namesList(waiting)} to approve the chart.`
          : "Waiting for household approvals to update."}
      </Text>
      <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.78 },
  text: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
});

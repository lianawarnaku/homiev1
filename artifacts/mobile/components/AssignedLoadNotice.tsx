import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/constants/colors";
import { useAppContextSelector } from "@/context/AppContext";
import { findAssignedLoadDeviations } from "@/lib/chartLoadBalance";

export function AssignedLoadNotice() {
  const colors = useTheme();
  const { currentProposedChart, roommates } = useAppContextSelector(
    (context) => ({
      currentProposedChart: context.currentProposedChart,
      roommates: context.roommates,
    }),
  );
  const approvedChart =
    currentProposedChart?.status === "approved" ? currentProposedChart : null;
  const deviations = useMemo(
    () =>
      approvedChart
        ? findAssignedLoadDeviations(
            approvedChart.payload.assignments,
            approvedChart.payload.generatedTasks ?? [],
          )
        : [],
    [approvedChart],
  );

  if (!deviations.length) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        { backgroundColor: colors.warning + "14", borderColor: colors.warning + "55" },
      ]}
    >
      <Feather name="alert-triangle" size={15} color={colors.warning} />
      <View style={styles.copy}>
        {deviations.map((deviation) => {
          const member = roommates.find(
            (roommate) => roommate.id === deviation.memberId,
          );
          return (
            <Text
              key={deviation.memberId}
              style={[styles.text, { color: colors.mutedForeground }]}
            >
              Heads up: {member?.name ?? "A roommate"}’s assigned load is well{" "}
              {deviation.direction} the household average (
              {deviation.load.toFixed(1)} vs. {deviation.average.toFixed(1)}).
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  copy: { flex: 1, gap: 4 },
  text: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18 },
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { RoommateAvatar } from "@/components/RoommateAvatar";
import { useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date();
}

function formatDueDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff}d left`;
}

export default function GroupChoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates, chores, sendNudge, nudges } = useAppContext();

  const [nudgedChores, setNudgedChores] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalChores = chores.length;
  const completedChores = chores.filter((c) => c.completed).length;
  const healthPct = totalChores > 0 ? completedChores / totalChores : 0;

  const healthLabel =
    healthPct >= 0.8
      ? "Great shape"
      : healthPct >= 0.5
      ? "Getting there"
      : healthPct >= 0.25
      ? "Needs work"
      : "Falling behind";

  const healthColor =
    healthPct >= 0.8
      ? colors.success
      : healthPct >= 0.5
      ? colors.primary
      : healthPct >= 0.25
      ? colors.warning
      : colors.destructive;

  const roommatesWithChores = roommates.map((r) => ({
    roommate: r,
    chores: chores.filter((c) => c.assignedTo === r.id),
  }));

  const handleNudge = (roommateId: string, choreId: string, choreName: string) => {
    const key = `${roommateId}-${choreId}`;
    if (nudgedChores.has(key)) return;
    const roommate = roommates.find((r) => r.id === roommateId);
    Alert.alert(
      "Send Anonymous Nudge",
      `Send an anonymous reminder about "${choreName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Nudge",
          onPress: () => {
            sendNudge(roommateId, choreId);
            setNudgedChores((prev) => new Set([...prev, key]));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              "Nudge Sent",
              `Your roommate has been anonymously reminded about this task.`,
              [{ text: "Got it" }]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Group Chores
        </Text>
        <View
          style={[
            styles.nudgeInfo,
            { backgroundColor: colors.secondary },
          ]}
        >
          <Feather name="bell" size={12} color={colors.mutedForeground} />
          <Text style={[styles.nudgeInfoText, { color: colors.mutedForeground }]}>
            Nudges are anonymous
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.healthCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.healthHeader}>
          <View>
            <Text style={[styles.healthTitle, { color: colors.foreground }]}>
              Room Health
            </Text>
            <Text style={[styles.healthLabel, { color: healthColor }]}>
              {healthLabel}
            </Text>
          </View>
          <View
            style={[
              styles.healthPct,
              { backgroundColor: healthColor + "18" },
            ]}
          >
            <Text style={[styles.healthPctText, { color: healthColor }]}>
              {Math.round(healthPct * 100)}%
            </Text>
          </View>
        </View>
        <View style={[styles.healthTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.healthFill,
              {
                backgroundColor: healthColor,
                width: `${healthPct * 100}%` as `${number}%`,
              },
            ]}
          />
        </View>
        <View style={styles.healthStats}>
          <Text style={[styles.healthStat, { color: colors.mutedForeground }]}>
            {completedChores} completed
          </Text>
          <Text style={[styles.healthStat, { color: colors.mutedForeground }]}>
            {totalChores - completedChores} remaining
          </Text>
        </View>
      </View>

      <FlatList
        data={roommatesWithChores}
        keyExtractor={(item) => item.roommate.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 90 + botPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="users" title="No roommates yet" subtitle="Add roommates to see group chores" />
        }
        renderItem={({ item }) => {
          const pending = item.chores.filter((c) => !c.completed);
          const done = item.chores.filter((c) => c.completed);
          return (
            <View
              style={[
                styles.roommateSection,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.roommateHeader}>
                <RoommateAvatar
                  name={item.roommate.name}
                  color={item.roommate.color}
                  size={38}
                />
                <View style={styles.roommateInfo}>
                  <Text
                    style={[styles.roommateName, { color: colors.foreground }]}
                  >
                    {item.roommate.name}
                  </Text>
                  <Text
                    style={[
                      styles.roommateStats,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {done.length}/{item.chores.length} done
                  </Text>
                </View>
                <View
                  style={[
                    styles.roommatePoints,
                    { backgroundColor: item.roommate.color + "18" },
                  ]}
                >
                  <Text
                    style={[
                      styles.roommatePointsText,
                      { color: item.roommate.color },
                    ]}
                  >
                    {item.roommate.weeklyPoints} pts
                  </Text>
                </View>
              </View>

              {item.chores.length === 0 ? (
                <Text
                  style={[styles.noChores, { color: colors.mutedForeground }]}
                >
                  No chores assigned
                </Text>
              ) : (
                item.chores.map((chore) => {
                  const overdue = !chore.completed && isOverdue(chore.dueDate);
                  const key = `${item.roommate.id}-${chore.id}`;
                  const nudged = nudgedChores.has(key);
                  return (
                    <View
                      key={chore.id}
                      style={[
                        styles.choreItem,
                        {
                          borderTopColor: colors.border,
                          backgroundColor: overdue
                            ? colors.warning + "0a"
                            : "transparent",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.choreStatus,
                          {
                            backgroundColor: chore.completed
                              ? colors.success + "22"
                              : overdue
                              ? colors.warning + "22"
                              : colors.muted,
                          },
                        ]}
                      >
                        <Feather
                          name={
                            chore.completed
                              ? "check"
                              : overdue
                              ? "alert-circle"
                              : "clock"
                          }
                          size={11}
                          color={
                            chore.completed
                              ? colors.success
                              : overdue
                              ? colors.warning
                              : colors.mutedForeground
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.choreItemTitle,
                            {
                              color: chore.completed
                                ? colors.mutedForeground
                                : colors.foreground,
                              textDecorationLine: chore.completed
                                ? "line-through"
                                : "none",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {chore.title}
                        </Text>
                        <Text
                          style={[
                            styles.choreItemDate,
                            {
                              color: overdue
                                ? colors.warning
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {formatDueDate(chore.dueDate)}
                        </Text>
                      </View>
                      {!chore.completed && (
                        <TouchableOpacity
                          style={[
                            styles.nudgeBtn,
                            {
                              backgroundColor: nudged
                                ? colors.muted
                                : colors.warning + "18",
                              borderColor: nudged
                                ? colors.border
                                : colors.warning + "55",
                            },
                          ]}
                          onPress={() =>
                            handleNudge(
                              item.roommate.id,
                              chore.id,
                              chore.title
                            )
                          }
                          disabled={nudged}
                        >
                          <Feather
                            name="bell"
                            size={12}
                            color={nudged ? colors.mutedForeground : colors.warning}
                          />
                          <Text
                            style={[
                              styles.nudgeBtnText,
                              {
                                color: nudged
                                  ? colors.mutedForeground
                                  : colors.warning,
                              },
                            ]}
                          >
                            {nudged ? "Nudged" : "Nudge"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  nudgeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  nudgeInfoText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  healthCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  healthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  healthTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  healthLabel: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 },
  healthPct: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  healthPctText: { fontFamily: "Inter_700Bold", fontSize: 22 },
  healthTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  healthFill: { height: 8, borderRadius: 4 },
  healthStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  healthStat: { fontFamily: "Inter_400Regular", fontSize: 12 },
  list: { paddingHorizontal: 16, gap: 12 },
  roommateSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  roommateHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  roommateInfo: { flex: 1 },
  roommateName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  roommateStats: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  roommatePoints: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roommatePointsText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  noChores: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  choreItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  choreStatus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  choreItemTitle: { fontFamily: "Inter_500Medium", fontSize: 14 },
  choreItemDate: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  nudgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  nudgeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

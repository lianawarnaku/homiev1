import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { HomePlant } from "@/components/HomePlant";
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

const HEALTH_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  blooming: {
    title: "In full bloom! 🌸",
    subtitle: "look! your home looks beautiful",
  },
  thriving: {
    title: "Thriving! 🌿",
    subtitle: "Your home is in great shape",
  },
  healthy: {
    title: "Looking good",
    subtitle: "Keep the momentum going",
  },
  struggling: {
    title: "Needs attention",
    subtitle: "A few chores are overdue",
  },
  dying: {
    title: "SOS! 🚨",
    subtitle: "Your home needs help now",
  },
};

export default function GroupChoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates, chores, currentUserId, completeChore, pickUpChore, sendNudge, removeNudge, nudges } = useAppContext();

  const [nudgedChores, setNudgedChores] = useState<Set<string>>(new Set());
  const [pickedUpChores, setPickedUpChores] = useState<Set<string>>(new Set());

  const handleChorePress = (choreId: string, assignedTo: string, choreName: string, chorePoints: number) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore || chore.completed) return;

    if (assignedTo === currentUserId) {
      Alert.alert("Complete chore?", `Mark "${choreName}" as done?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Done ✓",
          onPress: () => {
            completeChore(choreId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } else {
      Alert.alert(
        "Pick up this chore? 🙌",
        `Complete "${choreName}" for them and earn ${chorePoints + 25} pts (${chorePoints} + 25 bonus)!`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pick it up!",
            onPress: () => {
              pickUpChore(choreId, currentUserId);
              setPickedUpChores((prev) => new Set([...prev, choreId]));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Nice one! 🌟",
                `You earned ${chorePoints + 25} pts — ${chorePoints} for the chore + 25 bonus!`,
                [{ text: "🎉" }]
              );
            },
          },
        ]
      );
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalChores = chores.length;
  const completedChores = chores.filter((c) => c.completed).length;
  const healthPct = totalChores > 0 ? completedChores / totalChores : 0;

  const stage =
    healthPct >= 1
      ? "blooming"
      : healthPct >= 0.75
      ? "thriving"
      : healthPct >= 0.5
      ? "healthy"
      : healthPct >= 0.25
      ? "struggling"
      : "dying";

  const healthColor =
    healthPct >= 1
      ? "#E879A0"
      : healthPct >= 0.75
      ? colors.success
      : healthPct >= 0.5
      ? colors.primary
      : healthPct >= 0.25
      ? colors.warning
      : colors.destructive;

  const msg = HEALTH_MESSAGES[stage];

  const roommatesWithChores = roommates.map((r) => ({
    roommate: r,
    chores: chores.filter((c) => c.assignedTo === r.id),
  }));

  const handleNudge = (
    roommateId: string,
    choreId: string,
    choreName: string
  ) => {
    const key = `${roommateId}-${choreId}`;
    if (nudgedChores.has(key)) {
      removeNudge(roommateId, choreId);
      setNudgedChores((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    Alert.alert("Send Anonymous Nudge", `Remind about "${choreName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Nudge 👋",
        onPress: () => {
          sendNudge(roommateId, choreId);
          setNudgedChores((prev) => new Set([...prev, key]));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Alert.alert(
            "Nudge sent!",
            "Your roommate got an anonymous reminder.",
            [{ text: "Got it" }]
          );
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Your household
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Group Chores
          </Text>
        </View>
        <View
          style={[
            styles.anonBadge,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="eye-off" size={11} color={colors.mutedForeground} />
          <Text style={[styles.anonText, { color: colors.mutedForeground }]}>
            Nudges are anonymous
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 + botPad }}
      >
        {/* ── Plant Health Card ──────────────────────────── */}
        <View
          style={[
            styles.plantCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: healthColor,
            },
          ]}
        >
          {/* Ambient glow strip at top */}
          <View
            style={[
              styles.glowStrip,
              { backgroundColor: healthColor + "28" },
            ]}
          />

          <View style={styles.plantCardInner}>
            {/* Left: Animated plant */}
            <View style={styles.plantContainer}>
              <HomePlant health={healthPct} size={130} />
            </View>

            {/* Right: Health info */}
            <View style={styles.healthInfo}>
              <Text
                style={[
                  styles.healthRoom,
                  { color: colors.mutedForeground },
                ]}
              >
                Room Health
              </Text>

              <Text
                style={[styles.healthTitle, { color: healthColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {msg.title}
              </Text>

              <Text
                style={[
                  styles.healthSubtitle,
                  { color: colors.mutedForeground },
                ]}
                numberOfLines={2}
              >
                {msg.subtitle}
              </Text>

              {/* Percentage badge */}
              <View
                style={[
                  styles.pctBadge,
                  { backgroundColor: healthColor + "18" },
                ]}
              >
                <Text style={[styles.pctText, { color: healthColor }]}>
                  {Math.round(healthPct * 100)}%
                </Text>
              </View>

              {/* Progress bar */}
              <View
                style={[styles.track, { backgroundColor: colors.muted }]}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: healthColor,
                      width: `${healthPct * 100}%` as `${number}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.statsRow}>
                <Text style={[styles.stat, { color: colors.mutedForeground }]}>
                  ✓ {completedChores} done
                </Text>
                <Text style={[styles.stat, { color: colors.mutedForeground }]}>
                  {totalChores - completedChores} left
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Roommate chore sections ───────────────────── */}
        <View style={styles.listPad}>
          {roommatesWithChores.length === 0 ? (
            <EmptyState
              icon="users"
              title="No roommates yet"
              subtitle="Add roommates to see group chores"
            />
          ) : (
            roommatesWithChores.map(({ roommate, chores: rc }) => {
              const pending = rc.filter((c) => !c.completed);
              const done = rc.filter((c) => c.completed);
              return (
                <View
                  key={roommate.id}
                  style={[
                    styles.section,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Roommate header */}
                  <View style={styles.sectionHeader}>
                    <RoommateAvatar
                      name={roommate.name}
                      color={roommate.color}
                      size={38}
                    />
                    <View style={styles.sectionInfo}>
                      <Text
                        style={[
                          styles.roommateName,
                          { color: colors.foreground },
                        ]}
                      >
                        {roommate.name}
                      </Text>
                      <Text
                        style={[
                          styles.roommateStats,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {done.length}/{rc.length} done
                      </Text>
                    </View>
                    {/* Mini health bar for this roommate */}
                    <View style={styles.miniBarContainer}>
                      <View
                        style={[
                          styles.miniTrack,
                          { backgroundColor: colors.muted },
                        ]}
                      >
                        <View
                          style={[
                            styles.miniFill,
                            {
                              backgroundColor: roommate.color,
                              width: `${
                                rc.length > 0
                                  ? (done.length / rc.length) * 100
                                  : 0
                              }%` as `${number}%`,
                            },
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.ptsBadge,
                          { backgroundColor: roommate.color + "18" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ptsText,
                            { color: roommate.color },
                          ]}
                        >
                          {roommate.weeklyPoints} pts
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chore rows */}
                  {rc.length === 0 ? (
                    <Text
                      style={[
                        styles.noChores,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      No chores assigned
                    </Text>
                  ) : (
                    rc.map((chore) => {
                      const overdue =
                        !chore.completed && isOverdue(chore.dueDate);
                      const key = `${roommate.id}-${chore.id}`;
                      const nudged = nudgedChores.has(key);
                      const isPickedUp = pickedUpChores.has(chore.id);
                      const isSomeoneElse = chore.assignedTo !== currentUserId;

                      return (
                        <TouchableOpacity
                          key={chore.id}
                          activeOpacity={chore.completed ? 1 : 0.7}
                          onPress={() =>
                            handleChorePress(chore.id, chore.assignedTo, chore.title, chore.points)
                          }
                          style={[
                            styles.choreRow,
                            {
                              borderTopColor: colors.border,
                              backgroundColor: isPickedUp
                                ? colors.success + "10"
                                : overdue
                                ? colors.warning + "08"
                                : "transparent",
                            },
                          ]}
                        >
                          {/* Status icon */}
                          <View
                            style={[
                              styles.statusDot,
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
                                styles.choreTitle,
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
                                styles.choreDate,
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
                                    ? colors.success + "18"
                                    : colors.warning + "18",
                                  borderColor: nudged
                                    ? colors.success + "55"
                                    : colors.warning + "55",
                                },
                              ]}
                              onPress={() =>
                                handleNudge(roommate.id, chore.id, chore.title)
                              }
                            >
                              <Feather
                                name={nudged ? "bell-off" : "bell"}
                                size={11}
                                color={nudged ? colors.success : colors.warning}
                              />
                              <Text
                                style={[
                                  styles.nudgeTxt,
                                  {
                                    color: nudged ? colors.success : colors.warning,
                                  },
                                ]}
                              >
                                {nudged ? "Nudged" : "Nudge"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 2 },
  anonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  anonText: { fontFamily: "Inter_400Regular", fontSize: 11 },

  // Plant card
  plantCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  glowStrip: { height: 4, width: "100%" },
  plantCardInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 8,
  },
  plantContainer: {
    width: 134,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  healthInfo: {
    flex: 1,
    paddingTop: 8,
    gap: 4,
  },
  healthRoom: { fontFamily: "Inter_400Regular", fontSize: 12 },
  healthTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    lineHeight: 24,
  },
  healthSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  pctBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 6,
  },
  pctText: { fontFamily: "Inter_700Bold", fontSize: 18 },
  track: { height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  fill: { height: 7, borderRadius: 4 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: { fontFamily: "Inter_400Regular", fontSize: 11 },

  // Roommate list
  listPad: { paddingHorizontal: 16, gap: 10 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  sectionInfo: { flex: 1 },
  roommateName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  roommateStats: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  miniBarContainer: { alignItems: "flex-end", gap: 4 },
  miniTrack: {
    width: 64,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  miniFill: { height: 5, borderRadius: 3 },
  ptsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ptsText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  noChores: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  choreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  statusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  choreTitle: { fontFamily: "Inter_500Medium", fontSize: 14 },
  choreDate: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  nudgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  nudgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

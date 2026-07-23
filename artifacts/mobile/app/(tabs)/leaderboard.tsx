import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoommateAvatar } from "@/components/RoommateAvatar";
import { HeaderActions } from "@/components/HeaderActions";
import { useAppContext } from "@/context/AppContext";
import { useTheme } from "@/constants/colors";

type Period = "weekly" | "alltime";

const MEDALS = ["#FFD700", "#C0C0C0", "#CD7F32"] as const;
const MEDAL_LABELS = ["1st", "2nd", "3rd"] as const;

const HOME_ICONS: (keyof typeof Feather.glyphMap)[] = [
  "home",       // 1st
  "coffee",     // 2nd
  "tool",       // 3rd
  "wind",       // 4th
  "droplet",    // 5th
  "sun",        // 6th
  "package",    // 7th+
];

export default function LeaderboardScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { roommates, chores, currentUserId, pointsEnabled } = useAppContext();

  const [period, setPeriod] = useState<Period>("weekly");

  if (!pointsEnabled) return <Redirect href="/(tabs)" />;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const sorted = [...roommates].sort((a, b) =>
    period === "weekly"
      ? b.weeklyPoints - a.weeklyPoints
      : b.points - a.points
  );

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const completedByUser = (id: string) =>
    chores.filter((c) => c.completed && c.assignedTo === id).length;

  const extraCompletedByUser = (id: string) =>
    chores.filter(
      (c) => c.completed && c.assignedTo !== id && (c as { completedByExtra?: string }).completedByExtra === id
    ).length;

  const totalCompleted = chores.filter((c) => c.completed).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 90 + botPad }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Leaderboard</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Household progress and points</Text>
          </View>
          <HeaderActions />
        </View>
        <View style={styles.periodToggle}>
          {(["weekly", "alltime"] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodBtn,
                {
                  backgroundColor:
                    period === p ? colors.primary : "transparent",
                },
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodText,
                  {
                    color: period === p ? "#fff" : colors.mutedForeground,
                    fontFamily:
                      period === p ? "Inter_700Bold" : "Inter_400Regular",
                  },
                ]}
              >
                {p === "weekly" ? "This Week" : "All Time"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.statRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.primary }]}>
            {totalCompleted}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Chores Done
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.success }]}>
            {roommates.reduce((s, r) => s + r.points, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Total Points
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.accent }]}>
            {roommates.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Roommates
          </Text>
        </View>
      </View>

      {top3.length > 0 ? (
        <View style={styles.podiumSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Top Performers
          </Text>
          <View style={styles.podium}>
            {top3.length > 1 ? (
              <View style={[styles.podiumSlot, styles.podiumSecond]}>
                <View
                  style={[
                    styles.crownWrapper,
                    { backgroundColor: MEDALS[1] + "22" },
                  ]}
                >
                  <Text style={styles.utensilIcon}>🧹</Text>
                </View>
                <RoommateAvatar
                  name={top3[1].name}
                  color={top3[1].color}
                  size={52}
                  imageUri={top3[1].avatarUri}
                />
                <View
                  style={[
                    styles.medalBadge,
                    { backgroundColor: MEDALS[1] + "22", borderColor: MEDALS[1] },
                  ]}
                >
                  <Text style={[styles.medalLabel, { color: MEDALS[1] }]}>
                    {MEDAL_LABELS[1]}
                  </Text>
                </View>
                <Text
                  style={[styles.podiumName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {top3[1].name}
                </Text>
                <Text style={[styles.podiumPoints, { color: colors.mutedForeground }]}>
                  {period === "weekly" ? top3[1].weeklyPoints : top3[1].points} pts
                </Text>
                <View
                  style={[
                    styles.podiumBar,
                    {
                      backgroundColor: MEDALS[1],
                      height: 60,
                    },
                  ]}
                />
              </View>
            ) : null}

            <View style={[styles.podiumSlot, styles.podiumFirst]}>
              <View
                style={[
                  styles.crownWrapper,
                  { backgroundColor: MEDALS[0] + "22" },
                ]}
              >
                <Text style={styles.utensilIcon}>🍴</Text>
              </View>
              <RoommateAvatar
                name={top3[0].name}
                color={top3[0].color}
                size={62}
                imageUri={top3[0].avatarUri}
              />
              <View
                style={[
                  styles.medalBadge,
                  { backgroundColor: MEDALS[0] + "22", borderColor: MEDALS[0] },
                ]}
              >
                <Text style={[styles.medalLabel, { color: MEDALS[0] }]}>
                  {MEDAL_LABELS[0]}
                </Text>
              </View>
              <Text
                style={[styles.podiumName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {top3[0].name}{" "}
                {top3[0].id === currentUserId ? "(You)" : ""}
              </Text>
              <Text
                style={[styles.podiumPoints, { color: colors.mutedForeground }]}
              >
                {period === "weekly" ? top3[0].weeklyPoints : top3[0].points} pts
              </Text>
              <View
                style={[
                  styles.podiumBar,
                  { backgroundColor: MEDALS[0], height: 80 },
                ]}
              />
            </View>

            {top3.length > 2 ? (
              <View style={[styles.podiumSlot, styles.podiumThird]}>
                <View
                  style={[
                    styles.crownWrapper,
                    { backgroundColor: MEDALS[2] + "22" },
                  ]}
                >
                  <Text style={styles.utensilIcon}>☕</Text>
                </View>
                <RoommateAvatar
                  name={top3[2].name}
                  color={top3[2].color}
                  size={44}
                  imageUri={top3[2].avatarUri}
                />
                <View
                  style={[
                    styles.medalBadge,
                    { backgroundColor: MEDALS[2] + "22", borderColor: MEDALS[2] },
                  ]}
                >
                  <Text style={[styles.medalLabel, { color: MEDALS[2] }]}>
                    {MEDAL_LABELS[2]}
                  </Text>
                </View>
                <Text
                  style={[styles.podiumName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {top3[2].name}
                </Text>
                <Text
                  style={[
                    styles.podiumPoints,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {period === "weekly" ? top3[2].weeklyPoints : top3[2].points} pts
                </Text>
                <View
                  style={[
                    styles.podiumBar,
                    { backgroundColor: MEDALS[2], height: 44 },
                  ]}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 20 }]}>
        Full Rankings
      </Text>

      {sorted.map((r, idx) => {
        const isMe = r.id === currentUserId;
        const completed = completedByUser(r.id);
        const pts = period === "weekly" ? r.weeklyPoints : r.points;
        const maxPts = period === "weekly"
          ? sorted[0].weeklyPoints
          : sorted[0].points;
        const pct = maxPts > 0 ? pts / maxPts : 0;

        return (
          <View
            key={r.id}
            style={[
              styles.rankRow,
              {
                backgroundColor: isMe
                  ? colors.primary + "0d"
                  : colors.card,
                borderColor: isMe ? colors.primary + "44" : colors.border,
              },
            ]}
          >
            <View style={styles.rankIconCol}>
              <Text style={[styles.rank, { color: colors.mutedForeground }]}>
                {idx + 1}
              </Text>
              <Feather
                name={HOME_ICONS[Math.min(idx, HOME_ICONS.length - 1)]}
                size={11}
                color={colors.mutedForeground}
              />
            </View>
            <RoommateAvatar name={r.name} color={r.color} size={40} imageUri={r.avatarUri} />
            <View style={styles.rankInfo}>
              <View style={styles.rankNameRow}>
                <Text style={[styles.rankName, { color: colors.foreground }]}>
                  {r.name} {isMe ? "(You)" : ""}
                </Text>
                {completed >= 5 ? (
                  <View
                    style={[
                      styles.fairyBadge,
                      { backgroundColor: colors.accent + "18" },
                    ]}
                  >
                    <Feather name="star" size={10} color={colors.accent} />
                    <Text
                      style={[styles.fairyText, { color: colors.accent }]}
                    >
                      Fairy
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.rankMeta}>
                <Text style={[styles.rankCompleted, { color: colors.mutedForeground }]}>
                  {completed} chores
                </Text>
                <View style={[styles.miniBar, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.miniBarFill,
                      {
                        backgroundColor: r.color,
                        width: `${pct * 100}%` as `${number}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
            <View
              style={[
                styles.rankPoints,
                { backgroundColor: r.color + "18" },
              ]}
            >
              <Text style={[styles.rankPtsNum, { color: r.color }]}>
                {pts}
              </Text>
              <Text style={[styles.rankPtsLabel, { color: r.color }]}>
                pts
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 36 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  periodToggle: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: 22,
    backgroundColor: "rgba(123, 86, 59, 0.10)",
    padding: 3,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  periodText: { fontSize: 13 },
  statRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 24 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },
  podiumSection: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  podiumSlot: { alignItems: "center", gap: 6, flex: 1 },
  podiumFirst: {},
  podiumSecond: {},
  podiumThird: {},
  crownWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  utensilIcon: { fontSize: 18 },
  rankIconCol: {
    width: 24,
    alignItems: "center",
    gap: 2,
  },
  medalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  medalLabel: { fontFamily: "Inter_700Bold", fontSize: 11 },
  podiumName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  podiumPoints: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" },
  podiumBar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  rankInfo: { flex: 1, gap: 4 },
  rankNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rankName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  fairyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  fairyText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  rankMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankCompleted: { fontFamily: "Inter_400Regular", fontSize: 12 },
  miniBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  miniBarFill: { height: 4, borderRadius: 2 },
  rankPoints: {
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    minWidth: 52,
  },
  rankPtsNum: { fontFamily: "Inter_700Bold", fontSize: 18 },
  rankPtsLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
});

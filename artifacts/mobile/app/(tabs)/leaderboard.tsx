import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoommateAvatar } from "@/components/RoommateAvatar";
import { useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Period = "weekly" | "alltime";

const MEDALS = ["#F59E0B", "#94A3B8", "#D97706"] as const;
const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"] as const;

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates, chores, currentUserId } = useAppContext();

  const [period, setPeriod] = useState<Period>("weekly");

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

  const totalCompleted = chores.filter((c) => c.completed).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 90 + botPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            This household
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Leaderboard
          </Text>
        </View>
        <View style={[styles.periodToggle, { backgroundColor: colors.muted }]}>
          {(["weekly", "alltime"] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: period === p ? colors.primary : "transparent",
                  shadowColor: period === p ? colors.primary : "transparent",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: period === p ? 0.3 : 0,
                  shadowRadius: 6,
                },
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodText,
                  {
                    color: period === p ? "#fff" : colors.mutedForeground,
                    fontFamily: period === p ? "Inter_700Bold" : "Inter_500Medium",
                  },
                ]}
              >
                {p === "weekly" ? "This Week" : "All Time"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats strip */}
      <View
        style={[
          styles.statRow,
          {
            backgroundColor: colors.card,
            shadowColor: "#1A1140",
          },
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

      {/* Podium */}
      {top3.length > 0 && (
        <View style={styles.podiumSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Top Performers
          </Text>
          <View style={[styles.podiumCard, { backgroundColor: colors.card, shadowColor: "#1A1140" }]}>
            <View style={styles.podium}>
              {/* 2nd place */}
              {top3.length > 1 && (
                <View style={[styles.podiumSlot, { marginTop: 24 }]}>
                  <Text style={styles.medalEmoji}>{MEDAL_EMOJIS[1]}</Text>
                  <RoommateAvatar
                    name={top3[1].name}
                    color={top3[1].color}
                    size={52}
                  />
                  <Text style={[styles.podiumName, { color: colors.foreground }]} numberOfLines={1}>
                    {top3[1].name}
                  </Text>
                  <Text style={[styles.podiumPoints, { color: colors.mutedForeground }]}>
                    {period === "weekly" ? top3[1].weeklyPoints : top3[1].points} pts
                  </Text>
                  <View
                    style={[
                      styles.podiumBar,
                      { backgroundColor: MEDALS[1] + "30", height: 60 },
                    ]}
                  >
                    <View style={[styles.podiumBarAccent, { backgroundColor: MEDALS[1], height: 3 }]} />
                  </View>
                </View>
              )}

              {/* 1st place */}
              <View style={styles.podiumSlot}>
                <Text style={[styles.medalEmoji, { fontSize: 28 }]}>{MEDAL_EMOJIS[0]}</Text>
                <View style={[styles.firstRing, { borderColor: MEDALS[0] + "55" }]}>
                  <RoommateAvatar
                    name={top3[0].name}
                    color={top3[0].color}
                    size={64}
                  />
                </View>
                <Text style={[styles.podiumName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                  {top3[0].name}{top3[0].id === currentUserId ? " (You)" : ""}
                </Text>
                <Text style={[styles.podiumPoints, { color: MEDALS[0], fontFamily: "Inter_600SemiBold" }]}>
                  {period === "weekly" ? top3[0].weeklyPoints : top3[0].points} pts
                </Text>
                <View
                  style={[
                    styles.podiumBar,
                    { backgroundColor: MEDALS[0] + "25", height: 80 },
                  ]}
                >
                  <View style={[styles.podiumBarAccent, { backgroundColor: MEDALS[0], height: 3 }]} />
                </View>
              </View>

              {/* 3rd place */}
              {top3.length > 2 && (
                <View style={[styles.podiumSlot, { marginTop: 36 }]}>
                  <Text style={styles.medalEmoji}>{MEDAL_EMOJIS[2]}</Text>
                  <RoommateAvatar
                    name={top3[2].name}
                    color={top3[2].color}
                    size={44}
                  />
                  <Text style={[styles.podiumName, { color: colors.foreground }]} numberOfLines={1}>
                    {top3[2].name}
                  </Text>
                  <Text style={[styles.podiumPoints, { color: colors.mutedForeground }]}>
                    {period === "weekly" ? top3[2].weeklyPoints : top3[2].points} pts
                  </Text>
                  <View
                    style={[
                      styles.podiumBar,
                      { backgroundColor: MEDALS[2] + "25", height: 44 },
                    ]}
                  >
                    <View style={[styles.podiumBarAccent, { backgroundColor: MEDALS[2], height: 3 }]} />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Full rankings */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 20 }]}>
        Full Rankings
      </Text>

      <View style={{ paddingHorizontal: 16, gap: 10 }}>
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
                  backgroundColor: isMe ? colors.primary + "0d" : colors.card,
                  borderWidth: isMe ? 1.5 : 0,
                  borderColor: isMe ? colors.primary + "44" : "transparent",
                  shadowColor: "#1A1140",
                },
              ]}
            >
              <View style={[styles.rankNumBadge, { backgroundColor: idx < 3 ? MEDALS[idx] + "20" : colors.muted }]}>
                <Text style={[styles.rank, { color: idx < 3 ? MEDALS[idx] : colors.mutedForeground }]}>
                  {idx + 1}
                </Text>
              </View>
              <RoommateAvatar name={r.name} color={r.color} size={42} />
              <View style={styles.rankInfo}>
                <View style={styles.rankNameRow}>
                  <Text style={[styles.rankName, { color: colors.foreground }]}>
                    {r.name} {isMe ? "(You)" : ""}
                  </Text>
                  {completed >= 5 && (
                    <View style={[styles.starBadge, { backgroundColor: colors.warning + "20" }]}>
                      <Feather name="star" size={10} color={colors.warning} />
                      <Text style={[styles.starText, { color: colors.warning }]}>Star</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rankMeta}>
                  <Text style={[styles.rankCompleted, { color: colors.mutedForeground }]}>
                    {completed} done
                  </Text>
                  <View style={[styles.miniBar, { backgroundColor: colors.muted, flex: 1 }]}>
                    <View
                      style={[
                        styles.miniBarFill,
                        {
                          backgroundColor: r.color,
                          width: `${Math.max(pct * 100, 4)}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={[styles.rankPoints, { backgroundColor: r.color + "18" }]}>
                <Text style={[styles.rankPtsNum, { color: r.color }]}>{pts}</Text>
                <Text style={[styles.rankPtsLabel, { color: r.color + "BB" }]}>pts</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  periodToggle: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 3,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  periodText: { fontSize: 12 },
  statRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },
  podiumSection: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  podiumCard: {
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  podiumSlot: { alignItems: "center", gap: 6, flex: 1 },
  medalEmoji: { fontSize: 22 },
  firstRing: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
  },
  podiumName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  podiumPoints: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" },
  podiumBar: {
    width: "100%",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  podiumBarAccent: { width: "100%" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  rankNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    textAlign: "center",
  },
  rankInfo: { flex: 1, gap: 5 },
  rankNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rankName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  starBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  starText: { fontFamily: "Inter_700Bold", fontSize: 10 },
  rankMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankCompleted: { fontFamily: "Inter_400Regular", fontSize: 12 },
  miniBar: { height: 5, borderRadius: 3, overflow: "hidden" },
  miniBarFill: { height: 5, borderRadius: 3 },
  rankPoints: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 54,
  },
  rankPtsNum: { fontFamily: "Inter_700Bold", fontSize: 18 },
  rankPtsLabel: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 1 },
});

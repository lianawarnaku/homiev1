import { LinearGradient } from "expo-linear-gradient";
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
const YOU_HERE = "#F59E0B"; // warm orange for the "You're here" pill

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
      <View style={[styles.statRow, { backgroundColor: colors.card, shadowColor: "#1A1140" }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{totalCompleted}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Chores Done</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.success }]}>
            {roommates.reduce((s, r) => s + r.points, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Points</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: colors.accent }]}>{roommates.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Roommates</Text>
        </View>
      </View>

      {/* Standings — gradient tiles, one per roommate */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 20 }]}>
        Standings
      </Text>

      <View style={[styles.tileCard, { backgroundColor: colors.card, shadowColor: "#1A1140" }]}>
        {sorted.map((r, idx) => {
          const isMe = r.id === currentUserId;
          const pts = period === "weekly" ? r.weeklyPoints : r.points;
          const completed = completedByUser(r.id);
          const isLast = idx === sorted.length - 1;
          const medal = idx < 3 ? MEDAL_EMOJIS[idx] : null;

          const gradient: [string, string, string] = [
            `${r.color}3D`,
            `${r.color}12`,
            "rgba(255,255,255,0)",
          ];

          return (
            <LinearGradient
              key={r.id}
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.tile,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {/* Left: avatar + rank chip + name */}
              <View style={styles.tileLeft}>
                <View style={[styles.avatarRing, { borderColor: `${r.color}55` }]}>
                  <RoommateAvatar name={r.name} color={r.color} size={46} />
                  <View
                    style={[
                      styles.rankChip,
                      {
                        backgroundColor: idx < 3 ? MEDALS[idx] : colors.mutedForeground,
                        borderColor: colors.card,
                      },
                    ]}
                  >
                    <Text style={styles.rankChipText}>{idx + 1}</Text>
                  </View>
                </View>
                <Text style={[styles.tileName, { color: colors.foreground }]} numberOfLines={1}>
                  {r.name}
                </Text>
              </View>

              {/* Center: points + context */}
              <View style={styles.tileCenter}>
                <Text style={[styles.tilePts, { color: colors.foreground }]}>
                  {pts.toLocaleString()}
                </Text>
                <Text style={[styles.tilePtsLabel, { color: colors.mutedForeground }]}>
                  {medal ? `${medal} ` : ""}
                  {completed} done
                </Text>
              </View>

              {/* Right: "You're here" on the current user */}
              {isMe && (
                <View style={[styles.youHere, { backgroundColor: YOU_HERE }]}>
                  <Text style={styles.youHereText}>You're here</Text>
                </View>
              )}
            </LinearGradient>
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
  periodToggle: { flexDirection: "row", borderRadius: 24, padding: 3, gap: 2 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
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
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  tileCard: {
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 82,
    gap: 8,
  },
  tileLeft: { width: 62, alignItems: "center", gap: 6 },
  avatarRing: {
    padding: 2,
    borderRadius: 40,
    borderWidth: 2,
  },
  rankChip: {
    position: "absolute",
    bottom: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  rankChipText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff" },
  tileName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 62,
  },
  tileCenter: { flex: 1, alignItems: "center", gap: 2 },
  tilePts: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.5 },
  tilePtsLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  youHere: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: "center",
  },
  youHereText: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
});

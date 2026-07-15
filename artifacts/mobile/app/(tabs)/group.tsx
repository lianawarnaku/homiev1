import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useConfirm } from "@/hooks/useConfirm";

// ── Location helpers ───────────────────────────────────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_CONFIG = {
  home:    { icon: "home"      as const, label: "Home",    color: "#22C55E" },
  away:    { icon: "map-pin"   as const, label: "Away",    color: "#F59E0B" },
  asleep:  { icon: "moon"      as const, label: "Asleep",  color: "#8B5CF6" },
  unknown: { icon: "help-circle" as const, label: "Unknown", color: "#94A3B8" },
};

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

// ── Calendar helpers ──────────────────────────────────────────────────────
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDays(offset: number): Date[] {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(days: Date[]) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(days[0])} – ${fmt(days[6])}`;
}

export default function GroupChoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { roommates, chores, currentUserId, completeChore, pickUpChore, sendNudge, removeNudge, nudges, roommateStatuses, setRoommateStatus, homeLocation, setHomeLocation } = useAppContext();

  const { confirm, info } = useConfirm();
  const [nudgedChores, setNudgedChores] = useState<Set<string>>(new Set());
  const [pickedUpChores, setPickedUpChores] = useState<Set<string>>(new Set());
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Location / Activity ───────────────────────────────────────────────────
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "unknown">("unknown");
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [distanceFromHome, setDistanceFromHome] = useState<number | null>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);

  // Start location watching when permission granted (native only)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (locationPermission !== "granted") return;

    let active = true;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
      (loc) => {
        if (!active) return;
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrentPosition(pos);
        if (homeLocation) {
          const dist = haversineMeters(pos.latitude, pos.longitude, homeLocation.latitude, homeLocation.longitude);
          setDistanceFromHome(Math.round(dist));
          const currentStatus = roommateStatuses[currentUserId] ?? "unknown";
          if (dist <= homeLocation.radius && currentStatus !== "asleep") {
            setRoommateStatus(currentUserId, "home");
          } else if (dist > homeLocation.radius && currentStatus !== "away") {
            setRoommateStatus(currentUserId, "away");
          }
        }
      }
    ).then((sub) => { if (active) watchSubRef.current = sub; });

    return () => {
      active = false;
      watchSubRef.current?.remove();
      watchSubRef.current = null;
    };
  }, [locationPermission, homeLocation]);

  const requestLocation = async () => {
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        // Web geolocation fallback
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setCurrentPosition(p);
            setLocationPermission("granted");
            setLocationLoading(false);
          },
          () => { setLocationPermission("denied"); setLocationLoading(false); }
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted" ? "granted" : "denied");
    } catch {
      setLocationPermission("denied");
    } finally {
      if (Platform.OS !== "web") setLocationLoading(false);
    }
  };

  const captureHomeLocation = async () => {
    setLocationLoading(true);
    const capture = (lat: number, lon: number) => {
      setHomeLocation({ latitude: lat, longitude: lon, radius: 100 });
      setRoommateStatus(currentUserId, "home");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocationLoading(false);
    };
    try {
      if (Platform.OS === "web") {
        navigator.geolocation.getCurrentPosition(
          (pos) => capture(pos.coords.latitude, pos.coords.longitude),
          () => setLocationLoading(false)
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      capture(loc.coords.latitude, loc.coords.longitude);
    } catch {
      setLocationLoading(false);
    }
  };

  // ── Availability ──────────────────────────────────────────────────────────
  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [myBusyDays, setMyBusyDays] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const fetchAvailability = async (offset: number) => {
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const days = getWeekDays(offset);
      const weekStart = toDateKey(days[0]);
      const res = await fetch(`${baseUrl}/api/calendar/availability?weekStart=${weekStart}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { busyDays: string[]; connected: boolean };
      setMyBusyDays(new Set(data.busyDays));
    } catch {
      setAvailabilityError("Could not load calendar data");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const toggleAvailability = () => {
    const next = !availabilityMode;
    setAvailabilityMode(next);
    if (next) fetchAvailability(weekOffset);
  };

  const handleChorePress = (choreId: string, assignedTo: string, choreName: string, chorePoints: number) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore || chore.completed) return;

    if (assignedTo === currentUserId) {
      confirm(
        "complete_chore",
        "Complete chore?",
        `Mark "${choreName}" as done?`,
        () => {
          completeChore(choreId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        { confirmText: "Done ✓" }
      );
    } else {
      confirm(
        "pickup_chore",
        "Pick up this chore? 🙌",
        `Complete "${choreName}" for them and earn ${chorePoints + 25} pts (${chorePoints} + 25 bonus)!`,
        () => {
          pickUpChore(choreId, currentUserId);
          setPickedUpChores((prev) => new Set([...prev, choreId]));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          info(
            "pickup_success",
            "Nice one! 🌟",
            `You earned ${chorePoints + 25} pts — ${chorePoints} for the chore + 25 bonus!`
          );
        },
        { confirmText: "Pick it up!" }
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
    confirm(
      "send_nudge",
      "Send Anonymous Nudge",
      `Remind about "${choreName}"?`,
      () => {
        sendNudge(roommateId, choreId);
        setNudgedChores((prev) => new Set([...prev, key]));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        info("nudge_sent", "Nudge sent!", "Your roommate got an anonymous reminder.");
      },
      { confirmText: "Nudge 👋" }
    );
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

        {/* ── Weekly Schedule Calendar ─────────────────── */}
        {(() => {
          const weekDays = getWeekDays(weekOffset);
          const todayKey = toDateKey(new Date());
          const weekRange = formatWeekRange(weekDays);
          const isCurrentWeek = weekOffset === 0;

          // ── Availability state for this render ──────────────────────────
          const currentUser = roommates.find((r) => r.id === currentUserId);

          return (
            <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Card header row 1: icon + title + availability toggle */}
              <View style={styles.calHeader}>
                <View style={[styles.calHeaderIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.calTitle, { color: colors.foreground }]}>Weekly Schedule</Text>
                  <Text style={[styles.calRange, { color: colors.mutedForeground }]}>{weekRange}</Text>
                </View>

                {/* Availability toggle */}
                <TouchableOpacity
                  style={[
                    styles.availBtn,
                    {
                      backgroundColor: availabilityMode ? colors.success + "18" : colors.secondary,
                      borderColor: availabilityMode ? colors.success + "55" : colors.border,
                    },
                  ]}
                  onPress={toggleAvailability}
                >
                  {availabilityLoading ? (
                    <ActivityIndicator size="small" color={colors.success} style={{ width: 12, height: 12 }} />
                  ) : (
                    <Feather
                      name="radio"
                      size={12}
                      color={availabilityMode ? colors.success : colors.mutedForeground}
                    />
                  )}
                  <Text style={[styles.availBtnText, { color: availabilityMode ? colors.success : colors.mutedForeground }]}>
                    Availability
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Week navigation row */}
              <View style={styles.calNavRow}>
                <TouchableOpacity
                  style={[styles.calNavBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => {
                    const next = weekOffset - 1;
                    setWeekOffset(next);
                    if (availabilityMode) fetchAvailability(next);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="chevron-left" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                {!isCurrentWeek && (
                  <TouchableOpacity
                    style={[styles.calNavBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
                    onPress={() => {
                      setWeekOffset(0);
                      if (availabilityMode) fetchAvailability(0);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={[styles.calNavToday, { color: colors.primary }]}>Today</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.calNavBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => {
                    const next = weekOffset + 1;
                    setWeekOffset(next);
                    if (availabilityMode) fetchAvailability(next);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Availability error */}
              {availabilityError ? (
                <View style={[styles.availErrorRow, { backgroundColor: colors.destructive + "10" }]}>
                  <Feather name="alert-circle" size={12} color={colors.destructive} />
                  <Text style={[styles.availErrorText, { color: colors.destructive }]}>{availabilityError}</Text>
                </View>
              ) : null}

              {/* Day columns */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.calDaysRow}
              >
                {weekDays.map((day, idx) => {
                  const key = toDateKey(day);
                  const isToday = key === todayKey;
                  const dayChores = chores.filter((c) => c.dueDate.slice(0, 10) === key);
                  const isWeekend = idx >= 5;
                  const isMeBusy = availabilityMode && myBusyDays.has(key);

                  return (
                    <View
                      key={key}
                      style={[
                        styles.calDayCol,
                        {
                          backgroundColor: isMeBusy
                            ? colors.warning + "0D"
                            : isToday
                            ? colors.primary + "0D"
                            : isWeekend
                            ? colors.secondary + "88"
                            : "transparent",
                          borderColor: isMeBusy
                            ? colors.warning + "55"
                            : isToday
                            ? colors.primary + "44"
                            : colors.border,
                        },
                      ]}
                    >
                      {/* Day name */}
                      <Text style={[styles.calDayName, { color: isToday ? colors.primary : colors.mutedForeground }]}>
                        {DAY_NAMES[idx]}
                      </Text>
                      {/* Day number */}
                      <View style={[styles.calDayNum, isToday && { backgroundColor: colors.primary }]}>
                        <Text style={[styles.calDayNumText, { color: isToday ? "#fff" : colors.foreground }]}>
                          {day.getDate()}
                        </Text>
                      </View>

                      {/* Busy badge */}
                      {isMeBusy && (
                        <View style={[styles.busyBadge, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "44" }]}>
                          <Text style={[styles.busyBadgeText, { color: colors.warning }]}>busy</Text>
                        </View>
                      )}

                      {/* Chore pills */}
                      <View style={styles.calChores}>
                        {dayChores.length === 0 ? (
                          <View style={[styles.calEmpty, { backgroundColor: colors.muted + "60" }]} />
                        ) : (
                          dayChores.map((chore) => {
                            const rm = roommates.find((r) => r.id === chore.assignedTo);
                            const color = rm?.color ?? colors.primary;
                            return (
                              <View
                                key={chore.id}
                                style={[
                                  styles.calPill,
                                  {
                                    backgroundColor: color + "18",
                                    borderColor: color + "44",
                                    opacity: chore.completed ? 0.5 : 1,
                                  },
                                ]}
                              >
                                <View style={[styles.calPillDot, { backgroundColor: color }]} />
                                <Text style={[styles.calPillName, { color: color }]} numberOfLines={1}>
                                  {rm?.name?.split(" ")[0] ?? "?"}
                                </Text>
                              </View>
                            );
                          })
                        )}
                      </View>

                      {/* Availability dots (one per roommate) */}
                      {availabilityMode && (
                        <View style={styles.availDotRow}>
                          {roommates.map((rm) => {
                            const isMe = rm.id === currentUserId;
                            const isBusy = isMe && myBusyDays.has(key);
                            const dotColor = isMe
                              ? isBusy ? colors.warning : colors.success
                              : colors.muted;
                            return (
                              <View
                                key={rm.id}
                                style={[
                                  styles.availDot,
                                  {
                                    backgroundColor: isMe ? dotColor : "transparent",
                                    borderColor: isMe ? dotColor : colors.border,
                                    borderWidth: isMe ? 0 : 1,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Legend */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calLegend}>
                {roommates.map((rm) => (
                  <View key={rm.id} style={styles.calLegendItem}>
                    <View style={[styles.calLegendDot, { backgroundColor: rm.color }]} />
                    <Text style={[styles.calLegendName, { color: colors.mutedForeground }]}>
                      {rm.name.split(" ")[0]}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Availability connections panel */}
              {availabilityMode && (
                <View style={[styles.availPanel, { borderTopColor: colors.border }]}>
                  <Text style={[styles.availPanelTitle, { color: colors.foreground }]}>Calendar Connections</Text>

                  {/* Current user — connected */}
                  <View style={[styles.availRoommateRow, { backgroundColor: colors.success + "0C", borderColor: colors.success + "33" }]}>
                    <View style={[styles.availRoommateDot, { backgroundColor: currentUser?.color ?? colors.primary }]}>
                      <Text style={styles.availRoommateInitial}>
                        {currentUser?.name?.charAt(0) ?? "?"}
                      </Text>
                    </View>
                    <Text style={[styles.availRoommateName, { color: colors.foreground }]}>
                      {currentUser?.name ?? "You"} <Text style={{ color: colors.mutedForeground }}>(you)</Text>
                    </Text>
                    <View style={[styles.availConnectedBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "44" }]}>
                      <Feather name="check-circle" size={10} color={colors.success} />
                      <Text style={[styles.availConnectedText, { color: colors.success }]}>Connected</Text>
                    </View>
                  </View>

                  {/* Other roommates — not connected */}
                  {roommates.filter((r) => r.id !== currentUserId).map((rm) => (
                    <View key={rm.id} style={[styles.availRoommateRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <View style={[styles.availRoommateDot, { backgroundColor: rm.color + "44" }]}>
                        <Text style={[styles.availRoommateInitial, { color: rm.color }]}>
                          {rm.name.charAt(0)}
                        </Text>
                      </View>
                      <Text style={[styles.availRoommateName, { color: colors.mutedForeground }]}>{rm.name}</Text>
                      <View style={[styles.availInviteBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" }]}>
                        <Feather name="send" size={9} color={colors.primary} />
                        <Text style={[styles.availInviteText, { color: colors.primary }]}>Invite</Text>
                      </View>
                    </View>
                  ))}

                  {/* Availability legend */}
                  <View style={styles.availLegendRow}>
                    <View style={styles.availLegendItem}>
                      <View style={[styles.availDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.availLegendLabel, { color: colors.mutedForeground }]}>Free</Text>
                    </View>
                    <View style={styles.availLegendItem}>
                      <View style={[styles.availDot, { backgroundColor: colors.warning }]} />
                      <Text style={[styles.availLegendLabel, { color: colors.mutedForeground }]}>Busy</Text>
                    </View>
                    <View style={styles.availLegendItem}>
                      <View style={[styles.availDot, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]} />
                      <Text style={[styles.availLegendLabel, { color: colors.mutedForeground }]}>Not connected</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Roommate Activity ────────────────────────── */}
        {(() => {
          const myStatus = roommateStatuses[currentUserId] ?? "unknown";
          const myStatusCfg = STATUS_CONFIG[myStatus];
          const isHome = myStatus === "home" || myStatus === "asleep";

          return (
            <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.activityHeader}>
                <View style={[styles.activityHeaderIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="users" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.activityTitle, { color: colors.foreground }]}>Roommate Activity</Text>
                {homeLocation && locationPermission === "granted" && distanceFromHome !== null && (
                  <View style={[styles.distBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Feather name="navigation" size={9} color={colors.mutedForeground} />
                    <Text style={[styles.distText, { color: colors.mutedForeground }]}>{distanceFromHome}m</Text>
                  </View>
                )}
              </View>

              {/* Current user row */}
              <View style={[styles.activitySection, { borderColor: colors.border }]}>
                <Text style={[styles.activitySectionLabel, { color: colors.mutedForeground }]}>Your status</Text>

                {/* Status indicator */}
                <View style={styles.myStatusRow}>
                  {/* Avatar with status dot */}
                  <View>
                    <RoommateAvatar
                      name={roommates.find((r) => r.id === currentUserId)?.name ?? "Me"}
                      color={roommates.find((r) => r.id === currentUserId)?.color ?? colors.primary}
                      size={42}
                    />
                    <View style={[styles.statusDotBig, { backgroundColor: myStatusCfg.color, borderColor: colors.card }]}>
                      <Feather name={myStatusCfg.icon} size={8} color="#fff" />
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    {/* Current status display */}
                    <View style={[styles.myStatusBadge, { backgroundColor: myStatusCfg.color + "18", borderColor: myStatusCfg.color + "44" }]}>
                      <Feather name={myStatusCfg.icon} size={13} color={myStatusCfg.color} />
                      <Text style={[styles.myStatusLabel, { color: myStatusCfg.color }]}>{myStatusCfg.label}</Text>
                      {locationPermission === "granted" && homeLocation && (
                        <Text style={[styles.myStatusSub, { color: myStatusCfg.color + "99" }]}>• auto-tracked</Text>
                      )}
                    </View>

                    {/* Manual status buttons */}
                    <View style={styles.statusBtnRow}>
                      {locationPermission !== "granted" ? (
                        <TouchableOpacity
                          style={[styles.statusBtn, { backgroundColor: colors.primary, flex: 1 }]}
                          onPress={requestLocation}
                        >
                          {locationLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather name="map-pin" size={12} color="#fff" />
                              <Text style={[styles.statusBtnText, { color: "#fff" }]}>Enable Location</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: isHome ? colors.muted : colors.success + "18", borderColor: isHome ? colors.border : colors.success + "44", borderWidth: 1 }]}
                            onPress={() => { setRoommateStatus(currentUserId, "home"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          >
                            <Feather name="home" size={12} color={isHome && myStatus === "home" ? colors.success : colors.mutedForeground} />
                            <Text style={[styles.statusBtnText, { color: myStatus === "home" ? colors.success : colors.mutedForeground }]}>Home</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: myStatus === "asleep" ? colors.secondary : "transparent", borderColor: myStatus === "asleep" ? "#8B5CF6" + "55" : colors.border, borderWidth: 1, opacity: isHome ? 1 : 0.4 }]}
                            disabled={!isHome}
                            onPress={() => { setRoommateStatus(currentUserId, myStatus === "asleep" ? "home" : "asleep"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          >
                            <Feather name="moon" size={12} color={myStatus === "asleep" ? "#8B5CF6" : colors.mutedForeground} />
                            <Text style={[styles.statusBtnText, { color: myStatus === "asleep" ? "#8B5CF6" : colors.mutedForeground }]}>Asleep</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: myStatus === "away" ? colors.warning + "18" : "transparent", borderColor: myStatus === "away" ? colors.warning + "55" : colors.border, borderWidth: 1 }]}
                            onPress={() => { setRoommateStatus(currentUserId, "away"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          >
                            <Feather name="map-pin" size={12} color={myStatus === "away" ? colors.warning : colors.mutedForeground} />
                            <Text style={[styles.statusBtnText, { color: myStatus === "away" ? colors.warning : colors.mutedForeground }]}>Away</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>

                {/* Home location control */}
                {locationPermission === "granted" && (
                  <TouchableOpacity
                    style={[styles.homeLocBtn, { backgroundColor: homeLocation ? colors.success + "0C" : colors.primary + "10", borderColor: homeLocation ? colors.success + "33" : colors.primary + "33" }]}
                    onPress={captureHomeLocation}
                  >
                    {locationLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Feather name="crosshair" size={13} color={homeLocation ? colors.success : colors.primary} />
                        <Text style={[styles.homeLocText, { color: homeLocation ? colors.success : colors.primary }]}>
                          {homeLocation ? `Home set · ${homeLocation.radius}m radius` : "Set Home Location"}
                        </Text>
                        {!homeLocation && (
                          <Text style={[styles.homeLocHint, { color: colors.mutedForeground }]}>tap to use current location</Text>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Other roommates */}
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                <Text style={[styles.activitySectionLabel, { color: colors.mutedForeground }]}>Household</Text>
                <View style={styles.activityGrid}>
                  {roommates.filter((r) => r.id !== currentUserId).map((rm) => {
                    const st = roommateStatuses[rm.id] ?? "unknown";
                    const cfg = STATUS_CONFIG[st];
                    return (
                      <View key={rm.id} style={[styles.activityRmCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={{ position: "relative" }}>
                          <RoommateAvatar name={rm.name} color={rm.color} size={34} />
                          <View style={[styles.statusDotSm, { backgroundColor: cfg.color, borderColor: colors.card }]}>
                            <Feather name={cfg.icon} size={6} color="#fff" />
                          </View>
                        </View>
                        <Text style={[styles.activityRmName, { color: colors.foreground }]} numberOfLines={1}>
                          {rm.name.split(" ")[0]}
                        </Text>
                        <View style={[styles.activityRmBadge, { backgroundColor: cfg.color + "18" }]}>
                          <Text style={[styles.activityRmStatus, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.activityHint, { color: colors.mutedForeground }]}>
                  Roommates update their own status when they join Homie
                </Text>
              </View>
            </View>
          );
        })()}

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
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 0, letterSpacing: -0.5 },
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
    borderRadius: 22,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 4,
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
  listPad: { paddingHorizontal: 16, gap: 12 },
  section: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#1A1140",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
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

  // ── Calendar ──
  calCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#1A1140",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  calHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  calTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  calRange: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  calNav: { flexDirection: "row", alignItems: "center", gap: 4 },
  calNavBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  calNavToday: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  calDaysRow: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  calDayCol: {
    width: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 4,
  },
  calDayName: { fontFamily: "Inter_500Medium", fontSize: 10 },
  calDayNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayNumText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  calChores: { width: "100%", gap: 3, marginTop: 2 },
  calEmpty: {
    height: 4,
    borderRadius: 2,
    width: "60%",
    alignSelf: "center",
    marginTop: 4,
  },
  calPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  calPillDot: { width: 5, height: 5, borderRadius: 3 },
  calPillName: { fontFamily: "Inter_600SemiBold", fontSize: 10, flex: 1 },
  calLegend: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 12,
  },
  calLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendName: { fontFamily: "Inter_400Regular", fontSize: 11 },

  // ── Roommate Activity ──
  activityCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#1A1140",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  activityHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  distText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  activitySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  activitySectionLabel: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  myStatusRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  statusDotBig: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotSm: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  myStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  myStatusLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  myStatusSub: { fontFamily: "Inter_400Regular", fontSize: 11 },
  statusBtnRow: { flexDirection: "row", gap: 6 },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  homeLocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  homeLocText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  homeLocHint: { fontFamily: "Inter_400Regular", fontSize: 11, marginLeft: "auto" as unknown as number },
  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activityRmCard: {
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 72,
  },
  activityRmName: { fontFamily: "Inter_500Medium", fontSize: 11 },
  activityRmBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activityRmStatus: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  activityHint: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 2 },

  // ── Calendar nav row ──
  calNavRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 6,
    justifyContent: "flex-end",
  },

  // ── Busy badge ──
  busyBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    alignSelf: "center",
  },
  busyBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8 },

  // ── Availability toggle button ──
  availBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  availBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  // ── Availability dot row inside each day column ──
  availDotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  availDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // ── Availability panel ──
  availPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  availPanelTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 2 },
  availRoommateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  availRoommateDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  availRoommateInitial: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  availRoommateName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  availConnectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  availConnectedText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  availInviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  availInviteText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  // ── Availability error ──
  availErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  availErrorText: { fontFamily: "Inter_400Regular", fontSize: 11 },

  // ── Availability legend ──
  availLegendRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  availLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  availLegendLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
});

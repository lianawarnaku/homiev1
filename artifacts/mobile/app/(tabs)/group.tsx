import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;

// Lighter tan brown revealed behind a chore row as it slides out on complete.
const COMPLETE_REVEAL_BROWN = "#A87C50";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { HeaderActions } from "@/components/HeaderActions";
import { HomePlant } from "@/components/HomePlant";
import { RoommateAvatar } from "@/components/RoommateAvatar";
import {
  useAppContextSelector,
  type ChoreAssignment,
  type ChoreCategory,
} from "@/context/AppContext";
import { useTheme } from "@/constants/colors";
import { error as hapticError, success as hapticSuccess } from "@/lib/haptics";
import { useConfirm } from "@/hooks/useConfirm";
import { useDraggableSheet } from "@/hooks/useDraggableSheet";

// ── Add-chore modal constants (same as My Home) ────────────────────────────
const CATEGORIES: { key: ChoreCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "cleaning", label: "Cleaning", icon: "wind" },
  { key: "kitchen", label: "Kitchen", icon: "coffee" },
  { key: "bathroom", label: "Bathroom", icon: "droplet" },
  { key: "laundry", label: "Laundry", icon: "refresh-cw" },
  { key: "outdoor", label: "Outdoor", icon: "sun" },
  { key: "other", label: "Other", icon: "package" },
];

const POINTS_OPTIONS = ["5", "10", "15", "20", "25", "30"];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

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

// ── Calendar / chore-chart helpers ────────────────────────────────────────
const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SLOT_VISUAL_DEFAULT = { icon: "check-square" as keyof typeof Feather.glyphMap, color: "#8A7462" };
const SLOT_VISUAL_BY_KEY: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  bathroom_heavy: { icon: "droplet", color: "#72503A" },
  bathroom_light: { icon: "wind", color: "#A88C76" },
  bathroom: { icon: "droplet", color: "#87644B" },
  kitchen_heavy: { icon: "zap", color: "#9B623B" },
  kitchen_light: { icon: "coffee", color: "#C39870" },
  kitchen: { icon: "coffee", color: "#A7744D" },
  vacuum_mop: { icon: "layers", color: "#806B58" },
  vacuum: { icon: "layers", color: "#917661" },
  mop: { icon: "layers", color: "#A1866F" },
  laundry: { icon: "refresh-cw", color: "#B09177" },
  trash: { icon: "trash-2", color: "#65483A" },
  dishes: { icon: "circle", color: "#B98255" },
  outdoor: { icon: "sun", color: "#C19362" },
  ad_hoc: { icon: "help-circle", color: "#7B6252" },
};

function slotVisualFor(key: string) {
  return SLOT_VISUAL_BY_KEY[key] ?? SLOT_VISUAL_DEFAULT;
}

function humanizeSlotKey(k: string): string {
  return k.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function startOfWeekMonday(d: Date): Date {
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function chartWeekFor(date: Date, startedAtIso: string | null): number | null {
  if (!startedAtIso) return null;
  const start = startOfWeekMonday(new Date(startedAtIso));
  const targetMon = startOfWeekMonday(date);
  const diffDays = Math.round((targetMon.getTime() - start.getTime()) / 86400000);
  const weekIdx = Math.floor(diffDays / 7);
  if (weekIdx < 0 || weekIdx >= 12) return null;
  return weekIdx + 1;
}

function buildMonthGrid(monthAnchor: Date): { date: Date; inMonth: boolean }[][] {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeekMonday(firstOfMonth);
  const rows: { date: Date; inMonth: boolean }[][] = [];
  for (let row = 0; row < 6; row++) {
    const week: { date: Date; inMonth: boolean }[] = [];
    for (let col = 0; col < 7; col++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + row * 7 + col);
      week.push({ date: d, inMonth: d.getMonth() === month });
    }
    rows.push(week);
  }
  return rows;
}

const HEALTH_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  blooming: {
    title: "In full bloom! 🌸",
    subtitle: "Look! Your home looks beautiful!",
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
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { roommates, chores, currentUserId, completeChore, pickUpChore, sendNudge, removeNudge, nudges, roommateStatuses, setRoommateStatus, choreChart, choreChartStartedAt, addChore, pointsEnabled, plantEnabled } =
    useAppContextSelector((context) => ({
      roommates: context.roommates,
      chores: context.chores,
      currentUserId: context.currentUserId,
      completeChore: context.completeChore,
      pickUpChore: context.pickUpChore,
      sendNudge: context.sendNudge,
      removeNudge: context.removeNudge,
      nudges: context.nudges,
      roommateStatuses: context.roommateStatuses,
      setRoommateStatus: context.setRoommateStatus,
      choreChart: context.choreChart,
      choreChartStartedAt: context.choreChartStartedAt,
      addChore: context.addChore,
      pointsEnabled: context.pointsEnabled,
      plantEnabled: context.plantEnabled,
    }));

  const { confirm, info } = useConfirm();
  const [nudgedChores, setNudgedChores] = useState<Set<string>>(new Set());
  const [pickedUpChores, setPickedUpChores] = useState<Set<string>>(new Set());
  const [viewMode] = useState<"activity" | "calendar">("activity");
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setNudgedChores(new Set(
      nudges
        .filter((nudge) => !nudge.seen)
        .map((nudge) => `${nudge.toRoommateId}-${nudge.choreId}`)
    ));
  }, [nudges]);

  // ── Add-chore-to-any-roommate modal state ──
  const [showAddChoreModal, setShowAddChoreModal] = useState(false);

  // Full-screen slide-up animation for the Add Chore modal (matches New IOU).
  const addChoreTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  useEffect(() => {
    if (showAddChoreModal) {
      addChoreTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(addChoreTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
        mass: 0.8,
      }).start();
    }
  }, [showAddChoreModal, addChoreTranslateY]);
  const closeAddChoreSheet = () => {
    Animated.timing(addChoreTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowAddChoreModal(false);
        setAddChoreTargetId(null);
      }
    });
  };
  const addChoreDragHandlers = useDraggableSheet(addChoreTranslateY, () => {
    setShowAddChoreModal(false);
    setAddChoreTargetId(null);
  });
  const [addChoreTargetId, setAddChoreTargetId] = useState<string | null>(null);
  const [newChoreTitle, setNewChoreTitle] = useState("");
  const [newChoreCategory, setNewChoreCategory] = useState<ChoreCategory>("cleaning");
  const [newChorePoints, setNewChorePoints] = useState("20");

  // Which roommates' chore sections are expanded. By default, only the current
  // user is open — everyone else's section is collapsed and shows only the
  // header (name, progress, points). Tapping the chevron on the right expands
  // that section.
  const [expandedChoreSections, setExpandedChoreSections] = useState<Set<string>>(
    () => new Set([currentUserId])
  );
  const toggleChoreSection = (roommateId: string) => {
    setExpandedChoreSections((prev) => {
      const next = new Set(prev);
      if (next.has(roommateId)) next.delete(roommateId);
      else next.add(roommateId);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openAddChoreFor = (roommateId: string) => {
    setAddChoreTargetId(roommateId);
    setNewChoreTitle("");
    setNewChoreCategory("cleaning");
    setNewChorePoints("20");
    setShowAddChoreModal(true);
  };

  const submitAddChore = () => {
    if (!addChoreTargetId || !newChoreTitle.trim()) return;
    addChore({
      title: newChoreTitle.trim(),
      assignedTo: addChoreTargetId,
      dueDate: daysFromNow(1),
      completed: false,
      points: parseInt(newChorePoints, 10),
      category: newChoreCategory,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeAddChoreSheet();
  };

  // Cycle a roommate's mood: home (😊) → asleep (😴) → away (🤫) → home
  const cycleRoommateMood = (roommateId: string) => {
    const current = roommateStatuses[roommateId] ?? "home";
    const next =
      current === "home" ? "asleep" : current === "asleep" ? "away" : "home";
    setRoommateStatus(roommateId, next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleChorePress = (choreId: string, assignedTo: string, choreName: string, chorePoints: number) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore) return;

    // If already completed, only allow the ORIGINAL ASSIGNEE (or the current
    // user if it's their own chore) to un-complete it. Picked-up chores are
    // left alone — undoing a pickup would need to track who picked it up to
    // correctly refund the bonus points, which we don't store.
    if (chore.completed) {
      if (assignedTo === currentUserId) {
        confirm(
          "uncomplete_chore",
          "Uncomplete chore?",
          `Mark "${choreName}" as not done?`,
          () => {
            completeChore(choreId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
          { confirmText: "Uncomplete" }
        );
      }
      return;
    }

    if (assignedTo === currentUserId) {
      confirm(
        "complete_chore",
        "Complete chore?",
        `Mark "${choreName}" as done?`,
        async () => {
          hapticSuccess();
          // Slide right, then apply the completion (which triggers the sort
          // that moves the row to the bottom of the section).
          await runSlideRight(choreId);
          completeChore(choreId);
        },
        { confirmText: "Done ✓" }
      );
    } else {
      confirm(
        "pickup_chore",
        "Pick up this chore? 🙌",
        pointsEnabled
          ? `Complete "${choreName}" for them and earn ${chorePoints + 25} pts (${chorePoints} + 25 bonus)!`
          : `Complete "${choreName}" for them?`,
        async () => {
          hapticSuccess();
          await runSlideRight(choreId);
          pickUpChore(choreId, currentUserId);
          setPickedUpChores((prev) => new Set([...prev, choreId]));
          info(
            "pickup_success",
            "Nice one! 🌟",
            pointsEnabled
              ? `You earned ${chorePoints + 25} pts — ${chorePoints} for the chore + 25 bonus!`
              : `You completed "${choreName}" for them.`
          );
        },
        { confirmText: "Pick it up!" }
      );
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const totalChores = chores.length;
  const completedChores = useMemo(
    () => chores.filter((chore) => chore.completed).length,
    [chores],
  );
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

  const roommatesWithChores = useMemo(() => {
    const choresByRoommate = new Map<string, typeof chores>();
    chores.forEach((chore) => {
      const current = choresByRoommate.get(chore.assignedTo);
      if (current) current.push(chore);
      else choresByRoommate.set(chore.assignedTo, [chore]);
    });
    return roommates.map((roommate) => ({
      roommate,
      // Completed chores automatically move to the bottom of each section.
      chores: (choresByRoommate.get(roommate.id) ?? []).sort((a, b) =>
        a.completed === b.completed ? 0 : a.completed ? 1 : -1,
      ),
    }));
  }, [chores, roommates]);

  // Per-chore Animated values for the slide-out animation on completion.
  // Keyed by chore id so the animation applies to the right row even when the
  // list re-renders. `x` slides the row right (clipped by the outer wrapper's
  // overflow: hidden, so it stays within the row's own bounds), `dark` is a
  // fast-fading black overlay so the row darkens the instant it's checked. The
  // brown reveal panel + "Done!" label is only mounted for ids currently in
  // `animatingChores` — already-completed rows never show brown behind them at
  // rest, since chore rows have transparent backgrounds.
  const slideAnimRefs = useRef<
    Map<string, { x: Animated.Value; dark: Animated.Value }>
  >(new Map());
  const getSlideAnim = (id: string) => {
    let entry = slideAnimRefs.current.get(id);
    if (!entry) {
      entry = {
        x: new Animated.Value(0),
        dark: new Animated.Value(0),
      };
      slideAnimRefs.current.set(id, entry);
    }
    return entry;
  };
  const [animatingChores, setAnimatingChores] = useState<Set<string>>(new Set());
  const runSlideRight = (id: string): Promise<void> => {
    const { x, dark } = getSlideAnim(id);
    setAnimatingChores((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return new Promise((resolve) => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dark, { toValue: 0.55, duration: 90, useNativeDriver: true }),
          Animated.timing(x, { toValue: SCREEN_WIDTH, duration: 320, useNativeDriver: true }),
        ]),
        Animated.delay(160),
      ]).start(() => {
        // Reset atomically so the row appears at its new (bottom) position in
        // its normal state on the next render.
        x.setValue(0);
        dark.setValue(0);
        setAnimatingChores((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        resolve();
      });
    });
  };

  const handleNudge = (
    roommateId: string,
    choreId: string,
    choreName: string
  ) => {
    const key = `${roommateId}-${choreId}`;
    if (nudgedChores.has(key)) {
      void removeNudge(roommateId, choreId)
        .then(() => {
          setNudgedChores((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        })
        .catch(() => {
          hapticError();
          Alert.alert("Couldn’t remove nudge", "Please check your connection and try again.");
        });
      return;
    }
    confirm(
      "send_nudge",
      "Send Anonymous Nudge",
      `Remind about "${choreName}"?`,
      () => {
        void sendNudge(roommateId, choreId)
          .then(() => {
            setNudgedChores((prev) => new Set([...prev, key]));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            info("nudge_sent", "Nudge sent!", "Your roommate got an anonymous reminder.");
          })
          .catch(() => {
            hapticError();
            Alert.alert("Couldn’t send nudge", "Please check your connection and try again.");
          });
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
        <HeaderActions />
      </View>


      {viewMode === "calendar" ? (
        (() => {
          const today = new Date();
          const monthAnchor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
          const grid = buildMonthGrid(monthAnchor);
          const monthLabel = `${MONTHS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;
          const todayKey = today.toDateString();
          // Weeks (Mondays) in this month, dedup, with chart-week mapping
          const monthWeeks = grid
            .map((row) => row[0].date)
            .filter((d, i, arr) => i === 0 || d.getTime() !== arr[i - 1].getTime());
          const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 90 + botPad, paddingHorizontal: 16 }}
            >
              {/* Month header */}
              <View style={[styles.monthHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => setMonthOffset(monthOffset - 1)}
                  style={[styles.monthNavBtn, { backgroundColor: colors.muted }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="chevron-left" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
                <TouchableOpacity
                  onPress={() => setMonthOffset(monthOffset + 1)}
                  style={[styles.monthNavBtn, { backgroundColor: colors.muted }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="chevron-right" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              {/* DOW row */}
              <View style={styles.dowRow}>
                {DOW_LABELS.map((d, i) => (
                  <Text key={i} style={[styles.dowText, { color: colors.mutedForeground }]}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Day grid */}
              <View style={[styles.daysGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {grid.map((row, ri) => (
                  <View key={ri} style={styles.weekRow}>
                    {row.map(({ date, inMonth }, ci) => {
                      const isToday = date.toDateString() === todayKey;
                      const cw = chartWeekFor(date, choreChartStartedAt);
                      return (
                        <View
                          key={ci}
                          style={[
                            styles.dayCell,
                            {
                              backgroundColor: isToday
                                ? colors.primary + "18"
                                : "transparent",
                              borderColor: isToday ? colors.primary + "55" : "transparent",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNum,
                              {
                                color: !inMonth
                                  ? colors.border
                                  : isToday
                                  ? colors.primary
                                  : colors.foreground,
                                fontFamily: isToday ? "Inter_700Bold" : "Inter_500Medium",
                              },
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                          {cw !== null && inMonth && (
                            <View style={[styles.chartWeekDot, { backgroundColor: colors.primary }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Per-week breakdown */}
              {!choreChart || !choreChartStartedAt ? (
                <View style={[styles.calEmptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="calendar" size={22} color={colors.mutedForeground} />
                  <Text style={[styles.calEmptyTitle, { color: colors.foreground }]}>No chart yet</Text>
                  <Text style={[styles.calEmptySub, { color: colors.mutedForeground }]}>
                    Generate a chore chart in Settings → Planning to see week-by-week assignments here.
                  </Text>
                </View>
              ) : (
                monthWeeks.map((mon) => {
                  const cw = chartWeekFor(mon, choreChartStartedAt);
                  const sun = new Date(mon);
                  sun.setDate(mon.getDate() + 6);
                  const weekRange = `${fmt(mon)} – ${fmt(sun)}`;
                  if (cw === null) {
                    return (
                      <View
                        key={mon.toISOString()}
                        style={[styles.weekOutCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      >
                        <Text style={[styles.weekOutText, { color: colors.mutedForeground }]}>
                          {weekRange} · outside chart
                        </Text>
                      </View>
                    );
                  }
                  const week = choreChart.weeks.find((w) => w.week === cw);
                  if (!week) return null;
                  // Derive slots from the chart: prefer chart.slots, else infer from assignment keys
                  const slots =
                    choreChart.slots && choreChart.slots.length > 0
                      ? choreChart.slots
                      : Object.keys(week.assignments).map((k) => ({ key: k, label: humanizeSlotKey(k) }));
                  return (
                    <View
                      key={mon.toISOString()}
                      style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.weekCardHeader}>
                        <View style={[styles.weekChip, { backgroundColor: colors.primary + "18" }]}>
                          <Text style={[styles.weekChipText, { color: colors.primary }]}>Week {cw}</Text>
                        </View>
                        <Text style={[styles.weekRangeText, { color: colors.mutedForeground }]}>
                          {weekRange}
                        </Text>
                      </View>
                      {slots.map((slot) => {
                        const name = week.assignments[slot.key];
                        if (!name) return null;
                        const rm = roommates.find((r) => r.name === name);
                        const visual = slotVisualFor(slot.key);
                        const dotColor = rm?.color ?? visual.color;
                        return (
                          <View key={slot.key} style={[styles.assignRow, { borderTopColor: colors.border }]}>
                            <View style={[styles.slotIconWrap, { backgroundColor: visual.color + "18" }]}>
                              <Feather name={visual.icon} size={13} color={visual.color} />
                            </View>
                            <Text style={[styles.slotLabelText, { color: colors.foreground }]}>
                              {slot.label}
                            </Text>
                            <View style={[styles.assigneeTag, { backgroundColor: dotColor + "22", borderColor: dotColor + "55" }]}>
                              <View style={[styles.assigneeDot, { backgroundColor: dotColor }]} />
                              <Text style={[styles.assigneeName, { color: dotColor }]}>
                                {rm?.id === currentUserId ? "You" : name}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>
          );
        })()
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 + botPad }}
      >
        {/* ── Plant Health Card ──────────────────────────── */}
        {plantEnabled && <View
          style={[
            styles.plantCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: healthColor,
            },
          ]}
        >
          {/* Preserve the card's established vertical spacing without the
              tinted strip that created a discoloration above the plant. */}
          <View style={styles.plantTopSpacer} />

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
        </View>}

        {/* ── Roommates ──────────────────────────────────
            Tap a roommate's emoji to cycle through their vibe:
              😊 (chill / around)  →  😴 (sleeping)  →  🤫 (do not disturb)  →  😊
            Sleeping still auto-reverts after 9 hours via AppContext. */}
        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.activityHeader}>
            <View style={[styles.activityHeaderIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="users" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.activityTitle, { color: colors.foreground }]}>Roommates</Text>
          </View>
          <View style={styles.roommatesGrid}>
            {roommates.map((rm) => {
              const status = roommateStatuses[rm.id] ?? "home";
              const emoji =
                status === "asleep" ? "😴" : status === "away" ? "🤫" : "😊";
              return (
                <View
                  key={rm.id}
                  style={[
                    styles.roommateTile,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <RoommateAvatar
                    name={rm.name}
                    color={rm.color}
                    size={44}
                    imageUri={rm.avatarUri}
                  />
                  <Text style={[styles.roommateTileName, { color: colors.foreground }]} numberOfLines={1}>
                    {rm.id === currentUserId ? "You" : rm.name.split(" ")[0]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => cycleRoommateMood(rm.id)}
                    activeOpacity={0.6}
                    style={[
                      styles.roommateEmojiBtn,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.roommateEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
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
              const isExpanded = expandedChoreSections.has(roommate.id);
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
                  {/* Roommate header — tap anywhere to expand/collapse */}
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleChoreSection(roommate.id)}
                    activeOpacity={0.7}
                  >
                    <RoommateAvatar
                      name={roommate.name}
                      color={roommate.color}
                      size={38}
                      imageUri={roommate.avatarUri}
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
                    {/* + Add a chore to this roommate's list */}
                    <TouchableOpacity
                      onPress={() => openAddChoreFor(roommate.id)}
                      style={[
                        styles.sectionAddBtn,
                        { backgroundColor: roommate.color + "18", borderColor: roommate.color + "44" },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="plus" size={15} color={roommate.color} />
                    </TouchableOpacity>
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
                      {pointsEnabled && <View
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
                      </View>}
                    </View>
                    {/* Chevron — visual affordance for expand/collapse */}
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>

                  {/* Chore rows (only when this section is expanded) */}
                  {isExpanded && (rc.length === 0 ? (
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
                      const slideAnim = getSlideAnim(chore.id);

                      return (
                        <View
                          key={chore.id}
                          style={{ overflow: "hidden", position: "relative" }}
                        >
                        {/* Brown reveal panel behind the row — only mounted
                            while the row is animating, so already-completed
                            rows never show brown behind their transparent bg. */}
                        {animatingChores.has(chore.id) && (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: COMPLETE_REVEAL_BROWN,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 8,
                            }}
                          >
                            <Feather name="check" size={14} color="#FFFFFF" />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 13,
                                letterSpacing: 0.2,
                              }}
                            >
                              Done!
                            </Text>
                          </View>
                        )}
                        <Animated.View
                          style={{
                            transform: [{ translateX: slideAnim.x }],
                          }}
                        >
                        <TouchableOpacity
                          activeOpacity={0.7}
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
                        {/* Darkening overlay — fades in fast on top of the row
                            so it darkens the instant it's checked. */}
                        <Animated.View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "#000",
                            opacity: slideAnim.dark,
                          }}
                        />
                        </Animated.View>
                        </View>
                      );
                    })
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      )}

      {/* ── Add Chore Modal (full-screen, matches New IOU) ── */}
      <Modal visible={showAddChoreModal} transparent animationType="none" onRequestClose={closeAddChoreSheet}>
        <Animated.View
          style={[
            styles.addChoreContainer,
            { backgroundColor: colors.background, transform: [{ translateY: addChoreTranslateY }] },
          ]}
        >
          {/* Header: title + X close button */}
          <View
            style={[
              styles.addChoreHeaderRow,
              { paddingTop: insets.top + 10, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border, top: insets.top + 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.addChoreHeaderTitle, { color: colors.foreground }]}>Add Chore</Text>
              <Text style={[styles.addChoreHeaderSub, { color: colors.mutedForeground }]}>
                Assign to any roommate — including yourself
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeAddChoreSheet}
              style={[styles.addChoreCloseBtn, { backgroundColor: colors.muted }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.addChoreBody}
            >
              {/* Assign to — pre-selected to whoever's + button was tapped */}
              <Text style={[styles.addChoreLabel, { color: colors.mutedForeground }]}>Assign to</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                style={{ marginBottom: 6 }}
              >
                {roommates.map((r) => {
                  const selected = addChoreTargetId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.addChoreRoommateChip,
                        {
                          backgroundColor: selected ? r.color + "22" : colors.muted,
                          borderColor: selected ? r.color : colors.border,
                        },
                      ]}
                      onPress={() => setAddChoreTargetId(r.id)}
                    >
                      <RoommateAvatar name={r.name} color={r.color} size={22} imageUri={r.avatarUri} />
                      <Text
                        style={{
                          color: selected ? r.color : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                          marginLeft: 6,
                        }}
                      >
                        {r.id === currentUserId ? "You" : r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.addChoreLabel, { color: colors.mutedForeground }]}>Task Name</Text>
              <TextInput
                style={[styles.addChoreInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                placeholder="e.g. Clean bathroom"
                placeholderTextColor={colors.mutedForeground}
                value={newChoreTitle}
                onChangeText={setNewChoreTitle}
                autoFocus
              />

              <Text style={[styles.addChoreLabel, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: 6 }}>
                {CATEGORIES.map((cat) => {
                  const selected = newChoreCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.addChoreCatChip,
                        {
                          backgroundColor: selected ? colors.primary + "22" : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setNewChoreCategory(cat.key)}
                    >
                      <Feather name={cat.icon} size={14} color={selected ? colors.primary : colors.mutedForeground} />
                      <Text
                        style={{
                          color: selected ? colors.primary : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                          marginLeft: 4,
                        }}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {pointsEnabled && <><Text style={[styles.addChoreLabel, { color: colors.mutedForeground }]}>Points ({newChorePoints})</Text>
              <View style={styles.addChorePointsRow}>
                {POINTS_OPTIONS.map((p) => {
                  const selected = newChorePoints === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.addChorePointsChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setNewChorePoints(p)}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                        }}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View></>}
            </ScrollView>

            {/* Sticky footer — primary action */}
            <View
              style={[
                styles.addChoreFooter,
                {
                  backgroundColor: colors.background,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 12) + 4,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.addChoreSubmit,
                  {
                    backgroundColor: newChoreTitle.trim() && addChoreTargetId ? colors.primary : colors.muted,
                  },
                ]}
                disabled={!newChoreTitle.trim() || !addChoreTargetId}
                onPress={submitAddChore}
              >
                <Text style={[styles.addChoreSubmitText, { color: newChoreTitle.trim() && addChoreTargetId ? "#fff" : colors.mutedForeground }]}>
                  Add Chore
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 36, marginTop: 2 },
  // Plant card
  plantCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  plantTopSpacer: { height: 4, width: "100%" },
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
    borderRadius: 22,
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

  // ── Roommate Activity ──
  activityCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
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
    borderRadius: 18,
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

  // ── Roommates ──
  roommatesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  roommateTile: {
    flexBasis: "30%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  roommateTileName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    maxWidth: "100%",
  },
  roommateEmojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  roommateEmoji: {
    fontSize: 22,
    // Ensures the emoji centers visually in the button
    textAlign: "center",
    lineHeight: 28,
  },

  // ── Tab switch ──
  tabSwitch: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  tabSwitchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabSwitchText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  // ── Calendar ──
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  monthLabel: { fontFamily: "Inter_700Bold", fontSize: 16 },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dowRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  dowText: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  daysGrid: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 13 },
  chartWeekDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  weekCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  weekCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weekChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekChipText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  weekRangeText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slotIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  slotLabelText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  assigneeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  assigneeDot: { width: 6, height: 6, borderRadius: 3 },
  assigneeName: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  weekOutCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: "center",
  },
  weekOutText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  calEmptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  calEmptyTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  calEmptySub: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" },

  // ── Section-header + button ──
  sectionAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  // ── Full-screen Add Chore modal (matches New IOU) ──
  addChoreContainer: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  addChoreHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  addChoreHeaderTitle: { fontFamily: "Inter_700Bold", fontSize: 26 },
  addChoreHeaderSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  addChoreCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHandle: {
    position: "absolute",
    left: "50%",
    marginLeft: -20,
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  addChoreBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 4,
  },
  addChoreFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addChoreLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 4,
    marginTop: 6,
  },
  addChoreInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    marginBottom: 4,
  },
  addChoreRoommateChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addChoreCatChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addChorePointsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  addChorePointsChip: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: "center",
  },
  addChoreSubmit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  addChoreSubmitText: { fontFamily: "Inter_700Bold", fontSize: 16 },
});

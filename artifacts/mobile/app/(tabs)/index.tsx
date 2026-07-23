import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { type ChoreCategory, useAppContext } from "@/context/AppContext";
import { useTheme } from "@/constants/colors";
import { success as hapticSuccess } from "@/lib/haptics";
import { useConfirm } from "@/hooks/useConfirm";
import { useDraggableSheet } from "@/hooks/useDraggableSheet";

const CATEGORIES: { key: ChoreCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "cleaning", label: "Cleaning", icon: "wind" },
  { key: "kitchen", label: "Kitchen", icon: "coffee" },
  { key: "bathroom", label: "Bathroom", icon: "droplet" },
  { key: "laundry", label: "Laundry", icon: "refresh-cw" },
  { key: "outdoor", label: "Outdoor", icon: "sun" },
  { key: "other", label: "Other", icon: "package" },
];

type Filter = "all" | "today" | "done" | "day";

// Dark birchwood brown used for the bordered section-title chips on My Home.
const SECTION_TITLE_BROWN = "#6B4226";
// Lighter tan brown revealed behind a chore row while it slides out on complete.
const COMPLETE_REVEAL_BROWN = "#A87C50";

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isSameDay(left: Date | string, right: Date | string) {
  const a = new Date(left);
  const b = new Date(right);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isOverdue(dateStr: string, completed: boolean) {
  if (completed) return false;
  return new Date(dateStr) < new Date();
}

function formatDueDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "Yesterday";
  if (isToday(dateStr)) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff}d left`;
}

interface ChoreRowProps {
  chore: {
    id: string;
    title: string;
    dueDate: string;
    completed: boolean;
    points: number;
    category: ChoreCategory;
  };
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToCalendar: () => Promise<void>;
}

function ChoreRow({ chore, onComplete, onDelete, onAddToCalendar }: ChoreRowProps) {
  const colors = useTheme();
  const { pointsEnabled } = useAppContext();
  const { confirm } = useConfirm();
  const cat = CATEGORIES.find((c) => c.key === chore.category) ?? CATEGORIES[5];
  const overdue = isOverdue(chore.dueDate, chore.completed);
  const [calState, setCalState] = useState<"idle" | "loading" | "done" | "error">("idle");

  // Slide-out animation on completion — the row slides right within its own
  // bounds (clipped by the outer wrapper) revealing a brown "Done!" panel
  // behind it. The panel is only mounted while `isAnimating` is true so already-
  // completed rows never show brown behind them at rest. A dark overlay fades
  // in fast so the row darkens the instant it's checked.
  const slideX = useRef(new Animated.Value(0)).current;
  const darkenOpacity = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const handleCheckPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (chore.completed) {
      // Un-complete: no animation, just flip
      onComplete(chore.id);
      return;
    }
    setIsAnimating(true);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(darkenOpacity, {
          toValue: 0.55,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: SCREEN_WIDTH,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(160),
    ]).start(({ finished }) => {
      if (!finished) return;
      slideX.setValue(0);
      darkenOpacity.setValue(0);
      setIsAnimating(false);
      onComplete(chore.id);
      hapticSuccess();
    });
  };

  const dueDateColor = chore.completed
    ? colors.mutedForeground
    : overdue
    ? colors.warning
    : isToday(chore.dueDate)
    ? colors.primary
    : colors.mutedForeground;

  const handleCalendar = async () => {
    if (calState === "loading" || calState === "done") return;
    setCalState("loading");
    try {
      await onAddToCalendar();
      setCalState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setCalState("error");
      Alert.alert("Couldn't add to calendar", "Please try again.");
      setTimeout(() => setCalState("idle"), 2000);
    }
  };

  const calColor =
    calState === "done"
      ? colors.success
      : calState === "error"
      ? colors.destructive
      : calState === "loading"
      ? colors.mutedForeground
      : colors.primary;

  return (
    <View style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
      {/* Brown reveal panel — only mounted while the slide-out is running so
          completed rows never show brown behind them at rest. */}
      {isAnimating && (
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
          <Feather name="check" size={16} color="#FFFFFF" />
          <Text
            style={{
              color: "#FFFFFF",
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              letterSpacing: 0.2,
            }}
          >
            Done!
          </Text>
        </View>
      )}
      <Animated.View
        style={[
          styles.choreRow,
          {
            backgroundColor: colors.card,
            borderColor: overdue ? colors.warning + "44" : colors.border,
            transform: [{ translateX: slideX }],
            overflow: "hidden",
          },
        ]}
      >
      <TouchableOpacity
        style={[
          styles.checkBox,
          {
            borderColor: chore.completed ? colors.success : overdue ? colors.warning : colors.border,
            backgroundColor: chore.completed ? colors.success + "22" : "transparent",
          },
        ]}
        onPress={handleCheckPress}
      >
        {chore.completed ? (
          <Feather name="check" size={14} color={colors.success} />
        ) : null}
      </TouchableOpacity>

      <View
        style={[styles.categoryIcon, { backgroundColor: colors.secondary }]}
      >
        <Feather name={cat.icon} size={14} color={colors.primary} />
      </View>

      <View style={styles.choreInfo}>
        <Text
          style={[
            styles.choreTitle,
            {
              color: chore.completed ? colors.mutedForeground : colors.foreground,
              textDecorationLine: chore.completed ? "line-through" : "none",
            },
          ]}
          numberOfLines={1}
        >
          {chore.title}
        </Text>
        <View style={styles.choreMeta}>
          <Text style={[styles.dueDateText, { color: dueDateColor }]}>
            {formatDueDate(chore.dueDate)}
          </Text>
        </View>
      </View>

      {pointsEnabled && <View style={[styles.pointsBadge, { backgroundColor: colors.primary + "18" }]}>
        <Text style={[styles.pointsText, { color: colors.primary }]}>
          +{chore.points}
        </Text>
      </View>}

      {/* Add to Google Calendar */}
      <TouchableOpacity
        onPress={handleCalendar}
        disabled={calState === "loading" || calState === "done"}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          styles.calBtn,
          {
            backgroundColor:
              calState === "done"
                ? colors.success + "18"
                : calState === "loading"
                ? colors.muted
                : colors.primary + "14",
            borderColor:
              calState === "done"
                ? colors.success + "55"
                : colors.primary + "30",
          },
        ]}
      >
        <Feather
          name={calState === "done" ? "check" : "calendar"}
          size={13}
          color={calColor}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          confirm("delete_chore", "Delete Chore", "Are you sure?", () => onDelete(chore.id), { confirmText: "Delete", destructive: true })
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {/* Darkening overlay — fades in fast on top of the row so it darkens
          the instant the checkbox is tapped. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: darkenOpacity,
        }}
      />
      </Animated.View>
    </View>
  );
}

export default function MyChoresScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUserId, chores, roommates, completeChore, deleteChore, addChore, essentialsAssignees, setEssentialAssignee, shoppingLists, shoppingItems, toggleShoppingItem, pointsEnabled } =
    useAppContext();

  const currentUser = roommates.find((r) => r.id === currentUserId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Full-screen slide-up animation for the Add Chore modal (matches New IOU).
  const addChoreTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  useEffect(() => {
    if (showModal) {
      addChoreTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(addChoreTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
        mass: 0.8,
      }).start();
    }
  }, [showModal, addChoreTranslateY]);
  const closeAddChore = () => {
    Animated.timing(addChoreTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowModal(false);
    });
  };
  const addChoreDragHandlers = useDraggableSheet(addChoreTranslateY, () => {
    setShowModal(false);
  });
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ChoreCategory>("cleaning");
  const [newPoints, setNewPoints] = useState("20");

  const SECTION_NAMES: Record<string, string> = {
    room: "Room & Bedroom",
    kitchen: "Kitchen",
    cleaning: "Cleaning",
    bedding: "Bedding",
    bathroom: "Bathroom",
    utility: "Utility",
    food: "Food",
  };

  const myToBuyItems = Object.entries(essentialsAssignees).flatMap(
    ([sectionKey, items]) =>
      Object.entries(items)
        .filter(([, roommateId]) => roommateId === currentUserId)
        .map(([item]) => ({ sectionKey, item }))
  );

  const myShoppingItems = shoppingItems
    .filter((item) => {
      if (item.completed) return false;
      const list = shoppingLists.find((l) => l.id === item.listId);
      const itemAssignees = Array.isArray(item.assignedTo)
        ? item.assignedTo
        : item.assignedTo
          ? [item.assignedTo]
          : [];
      return (
        itemAssignees.includes(currentUserId) ||
        item.addedBy === currentUserId ||
        list?.assignedTo === currentUserId
      );
    })
    .map((item) => ({
      ...item,
      listName: shoppingLists.find((l) => l.id === item.listId)?.name ?? "",
    }));

  const myChores = chores.filter((c) => c.assignedTo === currentUserId);
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [weekOffset]);
  const selectedOpenCount = myChores.filter(
    (chore) => !chore.completed && isSameDay(chore.dueDate, selectedDate)
  ).length;
  const selectedHouseholdChores = chores.filter((chore) =>
    isSameDay(chore.dueDate, selectedDate)
  );
  const selectedHouseholdOpenCount = selectedHouseholdChores.filter(
    (chore) => !chore.completed
  ).length;
  const monthDays = useMemo(() => {
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [selectedDate]);
  const filtered = myChores
    .filter((c) => {
      if (filter === "today") return isToday(c.dueDate) && !c.completed;
      if (filter === "done") return c.completed;
      if (filter === "day") return isSameDay(c.dueDate, selectedDate);
      return true;
    })
    // Completed chores auto-move to the bottom of the visible list.
    .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));

  const completedCount = myChores.filter((c) => c.completed).length;
  const totalCount = myChores.length;
  const healthPct = totalCount > 0 ? completedCount / totalCount : 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 100 + botPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.header,
                { paddingTop: topPad + 16, backgroundColor: colors.background },
              ]}
            >
              <View style={styles.headerTopRow}>
                <TouchableOpacity
                  onPress={() => router.push("/settings")}
                  style={[styles.settingsBtn, { backgroundColor: colors.muted }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="settings" size={20} color={colors.foreground} />
                </TouchableOpacity>
                {pointsEnabled && <View
                  style={[
                    styles.totalPoints,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Feather name="star" size={14} color={colors.primary} />
                  <Text style={[styles.totalPointsText, { color: colors.primary }]}>
                    {currentUser?.points ?? 0} pts
                  </Text>
                </View>}
              </View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                Welcome home,
              </Text>
              <Text style={[styles.username, { color: colors.foreground }]}>
                {currentUser?.name ?? "You"} 🏠
              </Text>
            </View>

            <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.calendarTopRow}>
                <TouchableOpacity
                  style={[styles.calendarNavButton, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    if (calendarExpanded) {
                      setSelectedDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1, 12));
                    } else {
                      setWeekOffset((value) => value - 1);
                    }
                  }}
                  accessibilityLabel="Previous week"
                >
                  <Feather name="chevron-left" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarMonthButton}
                  onPress={() => {
                    setCalendarExpanded((value) => !value);
                  }}
                >
                  <Text style={[styles.calendarMonth, { color: colors.foreground }]}>
                    {(calendarExpanded ? selectedDate : weekDays[3]).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </Text>
                  <View style={styles.calendarExpandHint}>
                    <Text style={[styles.calendarTodayHint, { color: colors.mutedForeground }]}>
                      {calendarExpanded ? "Tap for week" : "Tap for month"}
                    </Text>
                    <Feather name={calendarExpanded ? "chevron-up" : "chevron-down"} size={11} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
                <View style={[styles.todoBadge, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}>
                  <Feather name="check-circle" size={16} color={colors.primary} />
                  <Text style={[styles.todoBadgeText, { color: colors.primary }]}>
                    {calendarExpanded ? selectedHouseholdOpenCount : selectedOpenCount} to-do
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.calendarNavButton, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    if (calendarExpanded) {
                      setSelectedDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1, 12));
                    } else {
                      setWeekOffset((value) => value + 1);
                    }
                  }}
                  accessibilityLabel="Next week"
                >
                  <Feather name="chevron-right" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              {!calendarExpanded ? (
                <View style={styles.calendarDays}>
                  {weekDays.map((date) => {
                  const selected = isSameDay(date, selectedDate);
                  const today = isSameDay(date, new Date());
                  const dayChores = myChores.filter((chore) => isSameDay(chore.dueDate, date));
                  const hasOpen = dayChores.some((chore) => !chore.completed);
                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={[
                        styles.calendarDay,
                        selected && { backgroundColor: colors.primary },
                        !selected && today && { backgroundColor: colors.secondary },
                      ]}
                      onPress={() => {
                        setSelectedDate(date);
                        setFilter("day");
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={[styles.calendarWeekday, { color: selected ? "#fff" : colors.mutedForeground }]}>
                        {date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
                      </Text>
                      <Text style={[styles.calendarDate, { color: selected ? "#fff" : colors.foreground }]}>{date.getDate()}</Text>
                      <View style={[styles.calendarDot, { backgroundColor: hasOpen ? (selected ? "#fff" : colors.warning) : "transparent" }]} />
                    </TouchableOpacity>
                  );
                  })}
                </View>
              ) : (
                <View style={styles.monthView}>
                  <View style={styles.monthWeekdays}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                      <Text key={`${day}-${index}`} style={[styles.monthWeekday, { color: colors.mutedForeground }]}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.monthGrid}>
                    {monthDays.map((date) => {
                      const selected = isSameDay(date, selectedDate);
                      const inMonth = date.getMonth() === selectedDate.getMonth();
                      const dayChores = chores.filter((chore) => isSameDay(chore.dueDate, date));
                      return (
                        <TouchableOpacity
                          key={date.toISOString()}
                          style={[styles.monthDay, selected && { backgroundColor: colors.primary }]}
                          onPress={() => {
                            setSelectedDate(date);
                            setFilter("day");
                            Haptics.selectionAsync();
                          }}
                        >
                          <Text style={{
                            color: selected ? "#fff" : inMonth ? colors.foreground : colors.mutedForeground,
                            opacity: inMonth || selected ? 1 : 0.45,
                            fontFamily: selected ? "Inter_700Bold" : "Inter_500Medium",
                            fontSize: 13,
                          }}>
                            {date.getDate()}
                          </Text>
                          <View style={styles.monthDots}>
                            {dayChores.slice(0, 3).map((chore) => {
                              const owner = roommates.find((roommate) => roommate.id === chore.assignedTo);
                              return <View key={chore.id} style={[styles.monthDot, { backgroundColor: owner?.color ?? colors.primary }]} />;
                            })}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.householdPreview, { borderTopColor: colors.border }]}>
                    <Text style={[styles.previewTitle, { color: colors.foreground }]}>Household chores</Text>
                    {selectedHouseholdChores.length === 0 ? (
                      <Text style={[styles.previewEmpty, { color: colors.mutedForeground }]}>Nothing assigned for this day</Text>
                    ) : (
                      selectedHouseholdChores.slice(0, 5).map((chore) => {
                        const owner = roommates.find((roommate) => roommate.id === chore.assignedTo);
                        return (
                          <View key={chore.id} style={styles.previewRow}>
                            <View style={[styles.previewOwnerDot, { backgroundColor: owner?.color ?? colors.primary }]} />
                            <Text style={[styles.previewChore, { color: colors.foreground }]} numberOfLines={1}>{chore.title}</Text>
                            <Text style={[styles.previewOwner, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {owner?.id === currentUserId ? "You" : owner?.name ?? "Unassigned"}
                            </Text>
                            <Feather name={chore.completed ? "check-circle" : "circle"} size={14} color={chore.completed ? colors.success : colors.mutedForeground} />
                          </View>
                        );
                      })
                    )}
                    {selectedHouseholdChores.length > 5 && (
                      <Text style={[styles.previewMore, { color: colors.primary }]}>+{selectedHouseholdChores.length - 5} more</Text>
                    )}
                  </View>
                </View>
              )}

              <Text style={[styles.selectedDateLabel, { color: colors.foreground }]}>
                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </Text>
            </View>

            <View
              style={[
                styles.progressCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.foreground }]}>
                  My Progress
                </Text>
                <Text style={[styles.progressCount, { color: colors.mutedForeground }]}>
                  {completedCount}/{totalCount} done
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.success,
                      width: `${healthPct * 100}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Section title — My Chores (dark brown bordered chip) */}
            <View style={styles.sectionTitleChip}>
              <Feather name="check-square" size={14} color={SECTION_TITLE_BROWN} />
              <Text style={styles.sectionTitleText}>My Chores</Text>
              <Text style={styles.sectionTitleCount}>
                · {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </Text>
            </View>

            <View style={styles.filterRow}>
              {(["all", "today", "done"] as Filter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterBtn,
                    {
                      backgroundColor:
                        filter === f ? colors.primary : colors.secondary,
                    },
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: filter === f ? "#fff" : colors.mutedForeground,
                      },
                    ]}
                  >
                    {f === "all" ? "All" : f === "today" ? "Today" : "Done"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="check-circle"
            title={filter === "done" ? "No completed chores yet" : "No chores here"}
            subtitle={
              filter === "done"
                ? "Complete some chores to see them here"
                : "Tap + to add your first chore"
            }
          />
        }
        renderItem={({ item }) => (
          <ChoreRow
            chore={item}
            onComplete={completeChore}
            onDelete={deleteChore}
            onAddToCalendar={async () => {
              // Open Google Calendar's quick-add URL with the event pre-filled.
              // User taps Save once in Google Calendar; works without OAuth or backend.
              const due = new Date(item.dueDate);
              const pad = (n: number) => String(n).padStart(2, "0");
              const dateStr = `${due.getFullYear()}${pad(due.getMonth() + 1)}${pad(due.getDate())}`;
              const next = new Date(due);
              next.setDate(due.getDate() + 1);
              const nextStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
              const details = [
                "Homie chore reminder",
                item.category ? `Category: ${item.category}` : null,
                pointsEnabled && item.points ? `Points: +${item.points}` : null,
              ]
                .filter(Boolean)
                .join("\n");
              const params = new URLSearchParams({
                action: "TEMPLATE",
                text: `🏠 ${item.title}`,
                dates: `${dateStr}/${nextStr}`,
                details,
              });
              const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
              const ok = await Linking.canOpenURL(url);
              if (!ok) throw new Error("Cannot open URL");
              await Linking.openURL(url);
            }}
          />
        )}
        ListFooterComponent={
          <>
            {myToBuyItems.length > 0 && (
              <>
                {/* Section title — To Buy (dark brown bordered chip) */}
                <View style={styles.sectionTitleChip}>
                  <Feather name="shopping-bag" size={14} color={SECTION_TITLE_BROWN} />
                  <Text style={styles.sectionTitleText}>To Buy</Text>
                  <Text style={styles.sectionTitleCount}>
                    · {myToBuyItems.length} item{myToBuyItems.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toBuyCard,
                    { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 },
                  ]}
                >
                  {myToBuyItems.map(({ sectionKey, item }, idx) => (
                    <TouchableOpacity
                      key={`${sectionKey}:${item}`}
                      style={[
                        styles.toBuyRow,
                        idx > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEssentialAssignee(sectionKey, item, null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.toBuyCheck, { borderColor: colors.border }]} />
                      <Text style={[styles.toBuyItem, { color: colors.foreground }]} numberOfLines={1}>
                        {item}
                      </Text>
                      <Text style={[styles.toBuySection, { color: colors.mutedForeground }]}>
                        {SECTION_NAMES[sectionKey] ?? sectionKey}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {myShoppingItems.length > 0 && (
              <>
                {/* Section title — Shopping (dark brown bordered chip) */}
                <View style={styles.sectionTitleChip}>
                  <Feather name="shopping-cart" size={14} color={SECTION_TITLE_BROWN} />
                  <Text style={styles.sectionTitleText}>Shopping</Text>
                  <Text style={styles.sectionTitleCount}>
                    · {myShoppingItems.length} item{myShoppingItems.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toBuyCard,
                    { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 },
                  ]}
                >
                  {myShoppingItems.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.toBuyRow,
                        idx > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleShoppingItem(item.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.toBuyCheck, { borderColor: colors.border }]} />
                      <Text style={[styles.toBuyItem, { color: colors.foreground }]} numberOfLines={1}>
                        {item.name}
                        {item.quantity ? (
                          <Text style={{ color: colors.mutedForeground }}> · {item.quantity}</Text>
                        ) : null}
                      </Text>
                      <Text style={[styles.toBuySection, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.listName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: 90 + botPad }]}
        onPress={() => setShowModal(true)}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="none" onRequestClose={closeAddChore}>
        <Animated.View
          style={[
            styles.addChoreContainer,
            { backgroundColor: colors.background, transform: [{ translateY: addChoreTranslateY }] },
          ]}
        >
          {/* Header: title + X close button */}
          <View
            {...addChoreDragHandlers}
            style={[
              styles.addChoreHeader,
              { paddingTop: insets.top + 10, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border, top: insets.top + 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.addChoreHeaderTitle, { color: colors.foreground }]}>Add Chore</Text>
              <Text style={[styles.addChoreHeaderSub, { color: colors.mutedForeground }]}>
                Log something for yourself
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeAddChore}
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
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Task Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
                ]}
                placeholder="e.g. Clean bathroom"
                placeholderTextColor={colors.mutedForeground}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => {
                  const selected = newCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: selected ? colors.primary + "22" : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setNewCategory(cat.key)}
                    >
                      <Feather
                        name={cat.icon}
                        size={14}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          { color: selected ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {pointsEnabled && <><Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Points ({newPoints})
              </Text>
              <View style={styles.pointsRow}>
                {["5", "10", "15", "20", "25", "30"].map((p) => {
                  const selected = newPoints === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.pointsChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.secondary,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setNewPoints(p)}
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
                  { backgroundColor: newTitle.trim() ? colors.primary : colors.muted },
                ]}
                disabled={!newTitle.trim()}
                onPress={() => {
                  addChore({
                    title: newTitle.trim(),
                    assignedTo: currentUserId,
                    dueDate: daysFromNow(1),
                    completed: false,
                    points: parseInt(newPoints, 10),
                    category: newCategory,
                  });
                  setNewTitle("");
                  setNewCategory("cleaning");
                  setNewPoints("20");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  closeAddChore();
                }}
              >
                <Text style={[styles.addChoreSubmitText, { color: newTitle.trim() ? "#fff" : colors.mutedForeground }]}>
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

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  username: { fontSize: 30, lineHeight: 36, fontFamily: "Inter_700Bold", marginTop: 2 },
  totalPoints: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalPointsText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  progressCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#4A3426",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  calendarCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  calendarTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarMonthButton: { flex: 1 },
  calendarMonth: { fontFamily: "Inter_700Bold", fontSize: 16 },
  calendarExpandHint: { flexDirection: "row", alignItems: "center", gap: 2 },
  calendarTodayHint: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 1 },
  todoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  todoBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  calendarDays: { flexDirection: "row", gap: 4, marginTop: 12 },
  calendarDay: {
    flex: 1,
    minHeight: 62,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  calendarWeekday: { fontFamily: "Inter_500Medium", fontSize: 10, textTransform: "uppercase" },
  calendarDate: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 },
  calendarDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  selectedDateLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 11 },
  monthView: { marginTop: 10 },
  monthWeekdays: { flexDirection: "row" },
  monthWeekday: { width: "14.2857%", textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  monthDay: { width: "14.2857%", height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monthDots: { height: 5, flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3 },
  monthDot: { width: 4, height: 4, borderRadius: 2 },
  householdPreview: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10, gap: 7 },
  previewTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  previewEmpty: { fontFamily: "Inter_400Regular", fontSize: 12, paddingVertical: 4 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  previewOwnerDot: { width: 8, height: 8, borderRadius: 4 },
  previewChore: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 12 },
  previewOwner: { maxWidth: 72, fontFamily: "Inter_400Regular", fontSize: 11 },
  previewMore: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 16 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  progressLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, flexShrink: 1, paddingRight: 4 },
  progressCount: { fontFamily: "Inter_400Regular", fontSize: 13, flexShrink: 0 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3 },
  sectionTitleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: SECTION_TITLE_BROWN,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: SECTION_TITLE_BROWN,
    flexShrink: 0,
    paddingRight: 4,
  },
  sectionTitleCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: SECTION_TITLE_BROWN,
    opacity: 0.7,
    marginLeft: "auto",
    textAlign: "right",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  choreRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  choreInfo: { flex: 1 },
  choreTitle: { fontFamily: "Inter_500Medium", fontSize: 15 },
  choreMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dueDateText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pointsText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  // ── Full-screen Add Chore modal (matches New IOU) ──
  addChoreContainer: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  addChoreHeader: {
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
  addChoreSubmit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 22,
  },
  addChoreSubmitText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  categoryScroll: { marginBottom: 4 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  pointsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  pointsChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  addBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  calBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  toBuyCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#4A3426",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  toBuyHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  toBuyIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toBuyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  toBuyCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  toBuyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  toBuyCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  toBuyItem: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  toBuySection: { fontFamily: "Inter_400Regular", fontSize: 11 },
});

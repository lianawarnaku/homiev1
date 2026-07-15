import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { type ChoreCategory, useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useConfirm } from "@/hooks/useConfirm";

const CATEGORIES: { key: ChoreCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "cleaning", label: "Cleaning", icon: "wind" },
  { key: "kitchen", label: "Kitchen", icon: "coffee" },
  { key: "bathroom", label: "Bathroom", icon: "droplet" },
  { key: "laundry", label: "Laundry", icon: "refresh-cw" },
  { key: "outdoor", label: "Outdoor", icon: "sun" },
  { key: "other", label: "Other", icon: "package" },
];

type Filter = "all" | "today" | "done";

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
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
  const colors = useColors();
  const { confirm } = useConfirm();
  const cat = CATEGORIES.find((c) => c.key === chore.category) ?? CATEGORIES[5];
  const overdue = isOverdue(chore.dueDate, chore.completed);
  const [calState, setCalState] = useState<"idle" | "loading" | "done" | "error">("idle");

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
    <View
      style={[
        styles.choreRow,
        {
          backgroundColor: colors.card,
          shadowColor: overdue ? colors.warning : "#1A1140",
          borderLeftWidth: 3,
          borderLeftColor: chore.completed
            ? colors.success
            : overdue
            ? colors.warning
            : isToday(chore.dueDate)
            ? colors.primary
            : "transparent",
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.checkBox,
          {
            borderColor: chore.completed ? colors.success : overdue ? colors.warning : colors.border,
            backgroundColor: chore.completed ? colors.success : "transparent",
          },
        ]}
        onPress={() => {
          if (!chore.completed) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onComplete(chore.id);
          }
        }}
        disabled={chore.completed}
      >
        {chore.completed ? (
          <Feather name="check" size={12} color="#fff" />
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

      <View style={[styles.pointsBadge, { backgroundColor: colors.primary + "15" }]}>
        <Text style={[styles.pointsText, { color: colors.primary }]}>
          +{chore.points}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleCalendar}
        disabled={calState === "loading" || calState === "done"}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          styles.calBtn,
          {
            backgroundColor: calState === "done" ? colors.success + "15" : colors.secondary,
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
    </View>
  );
}

export default function MyChoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUserId, chores, roommates, completeChore, deleteChore, addChore, essentialsAssignees, setEssentialAssignee } =
    useAppContext();

  const currentUser = roommates.find((r) => r.id === currentUserId);
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);
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

  const myChores = chores.filter((c) => c.assignedTo === currentUserId);
  const filtered = myChores.filter((c) => {
    if (filter === "today") return isToday(c.dueDate) && !c.completed;
    if (filter === "done") return c.completed;
    return true;
  });

  const completedCount = myChores.filter((c) => c.completed).length;
  const totalCount = myChores.length;
  const healthPct = totalCount > 0 ? completedCount / totalCount : 0;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 20, backgroundColor: colors.background },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Welcome back
          </Text>
          <Text style={[styles.username, { color: colors.foreground }]}>
            {currentUser?.name ?? "You"} 🏠
          </Text>
        </View>
        <View
          style={[
            styles.totalPoints,
            { backgroundColor: colors.primary },
          ]}
        >
          <Feather name="star" size={13} color="#fff" />
          <Text style={styles.totalPointsText}>
            {currentUser?.points ?? 0}
          </Text>
        </View>
      </View>

      {/* Progress card */}
      <View
        style={[
          styles.progressCard,
          {
            backgroundColor: colors.card,
            shadowColor: "#1A1140",
            marginHorizontal: 16,
          },
        ]}
      >
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressLabel, { color: colors.foreground }]}>
              My Progress
            </Text>
            <Text style={[styles.progressSub, { color: colors.mutedForeground }]}>
              {completedCount} of {totalCount} chores done
            </Text>
          </View>
          <View style={[styles.pctBadge, { backgroundColor: healthPct >= 1 ? colors.success + "20" : colors.primary + "15" }]}>
            <Text style={[styles.pctText, { color: healthPct >= 1 ? colors.success : colors.primary }]}>
              {Math.round(healthPct * 100)}%
            </Text>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: healthPct >= 1 ? colors.success : colors.primary,
                width: `${Math.max(healthPct * 100, 2)}%` as `${number}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* To Buy card */}
      {myToBuyItems.length > 0 && (
        <View
          style={[
            styles.toBuyCard,
            { backgroundColor: colors.card, shadowColor: "#1A1140", marginHorizontal: 16, marginBottom: 12 },
          ]}
        >
          <View style={styles.toBuyHeader}>
            <View style={[styles.toBuyIconWrap, { backgroundColor: colors.accent + "18" }]}>
              <Feather name="shopping-bag" size={14} color={colors.accent} />
            </View>
            <Text style={[styles.toBuyTitle, { color: colors.foreground }]}>To Buy</Text>
            <View style={[styles.toBuyCountBadge, { backgroundColor: colors.accent + "15" }]}>
              <Text style={[styles.toBuyCount, { color: colors.accent }]}>
                {myToBuyItems.length}
              </Text>
            </View>
          </View>
          {myToBuyItems.map(({ sectionKey, item }) => (
            <TouchableOpacity
              key={`${sectionKey}:${item}`}
              style={[styles.toBuyRow, { borderTopColor: colors.border }]}
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
      )}

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(["all", "today", "done"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filter === f ? colors.primary : colors.card,
                shadowColor: filter === f ? colors.primary : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: filter === f ? 0.25 : 0,
                shadowRadius: 6,
                elevation: filter === f ? 3 : 0,
              },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: filter === f ? "#fff" : colors.mutedForeground,
                  fontFamily: filter === f ? "Inter_700Bold" : "Inter_500Medium",
                },
              ]}
            >
              {f === "all" ? "All" : f === "today" ? "Today" : "Done"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 100 + botPad },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
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
              const domain = process.env.EXPO_PUBLIC_DOMAIN;
              const baseUrl = domain ? `https://${domain}` : "";
              const res = await fetch(`${baseUrl}/api/calendar/add-chore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: item.title,
                  dueDate: item.dueDate,
                  category: item.category,
                  points: item.points,
                }),
              });
              if (!res.ok) throw new Error("Calendar API error");
            }}
          />
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: 90 + botPad }]}
        onPress={() => setShowModal(true)}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}
        />
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View
            style={[styles.modalHandle, { backgroundColor: colors.muted }]}
          />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Add Chore
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Task Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder="e.g. Clean bathroom"
            placeholderTextColor={colors.mutedForeground}
            value={newTitle}
            onChangeText={setNewTitle}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Category
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.catChip,
                  {
                    backgroundColor:
                      newCategory === cat.key ? colors.primary : colors.muted,
                    borderColor:
                      newCategory === cat.key ? colors.primary : "transparent",
                  },
                ]}
                onPress={() => setNewCategory(cat.key)}
              >
                <Feather
                  name={cat.icon}
                  size={14}
                  color={newCategory === cat.key ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color:
                        newCategory === cat.key ? "#fff" : colors.mutedForeground,
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Points ({newPoints})
          </Text>
          <View style={styles.pointsRow}>
            {["5", "10", "15", "20", "25", "30"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.pointsChip,
                  {
                    backgroundColor:
                      newPoints === p ? colors.primary : colors.muted,
                    borderColor:
                      newPoints === p ? colors.primary : "transparent",
                  },
                ]}
                onPress={() => setNewPoints(p)}
              >
                <Text
                  style={{
                    color: newPoints === p ? "#fff" : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: newTitle.trim()
                  ? colors.primary
                  : colors.muted,
              },
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
              setShowModal(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Text style={styles.addBtnText}>Add Chore</Text>
          </TouchableOpacity>
        </View>
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  username: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  totalPoints: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
  },
  totalPointsText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  progressCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  progressLabel: { fontFamily: "Inter_700Bold", fontSize: 15 },
  progressSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  pctBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pctText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4 },
  toBuyCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  toBuyHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  toBuyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  toBuyTitle: { fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 },
  toBuyCountBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  toBuyCount: { fontFamily: "Inter_700Bold", fontSize: 12 },
  toBuyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 22,
  },
  filterText: { fontSize: 13 },
  listContent: { paddingHorizontal: 16, gap: 10 },
  choreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingRight: 14,
    paddingLeft: 11,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#1A1140",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
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
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  choreInfo: { flex: 1 },
  choreTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  choreMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dueDateText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  pointsBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  calBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(26,17,64,0.45)" },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 10,
    gap: 4,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  categoryScroll: { marginBottom: 4 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    marginRight: 8,
  },
  catChipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  pointsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  pointsChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  addBtn: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  addBtnText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});

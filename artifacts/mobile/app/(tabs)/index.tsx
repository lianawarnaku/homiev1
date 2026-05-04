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
}

function ChoreRow({ chore, onComplete, onDelete }: ChoreRowProps) {
  const colors = useColors();
  const cat = CATEGORIES.find((c) => c.key === chore.category) ?? CATEGORIES[5];
  const overdue = isOverdue(chore.dueDate, chore.completed);

  const dueDateColor = chore.completed
    ? colors.mutedForeground
    : overdue
    ? colors.warning
    : isToday(chore.dueDate)
    ? colors.primary
    : colors.mutedForeground;

  return (
    <View
      style={[
        styles.choreRow,
        {
          backgroundColor: colors.card,
          borderColor: overdue ? colors.warning + "44" : colors.border,
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
        onPress={() => {
          if (!chore.completed) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onComplete(chore.id);
          }
        }}
        disabled={chore.completed}
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

      <View style={[styles.pointsBadge, { backgroundColor: colors.primary + "18" }]}>
        <Text style={[styles.pointsText, { color: colors.primary }]}>
          +{chore.points}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() =>
          Alert.alert("Delete Chore", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(chore.id) },
          ])
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
  const { currentUserId, chores, roommates, completeChore, deleteChore, addChore } =
    useAppContext();

  const currentUser = roommates.find((r) => r.id === currentUserId);
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ChoreCategory>("cleaning");
  const [newPoints, setNewPoints] = useState("20");

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
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.background },
        ]}
      >
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Welcome home,
          </Text>
          <Text style={[styles.username, { color: colors.foreground }]}>
            {currentUser?.name ?? "You"} 🏠
          </Text>
        </View>
        <View
          style={[
            styles.totalPoints,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name="star" size={14} color={colors.primary} />
          <Text style={[styles.totalPointsText, { color: colors.primary }]}>
            {currentUser?.points ?? 0} pts
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.progressCard,
          { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16 },
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
            style={[styles.modalHandle, { backgroundColor: colors.border }]}
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
                backgroundColor: colors.secondary,
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
                      newCategory === cat.key
                        ? colors.primary
                        : colors.secondary,
                    borderColor:
                      newCategory === cat.key
                        ? colors.primary
                        : colors.border,
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
                      newPoints === p ? colors.primary : colors.secondary,
                    borderColor:
                      newPoints === p ? colors.primary : colors.border,
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
    paddingBottom: 16,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  username: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 2 },
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
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  progressCount: { fontFamily: "Inter_400Regular", fontSize: 13 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3 },
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
  listContent: { paddingHorizontal: 16, gap: 8 },
  choreRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
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
    borderRadius: 8,
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    gap: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 12,
  },
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
});

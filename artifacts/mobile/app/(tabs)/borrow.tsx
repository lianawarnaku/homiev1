import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
import { RoommateAvatar } from "@/components/RoommateAvatar";
import { useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useConfirm } from "@/hooks/useConfirm";

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function formatDue(dueDate: string) {
  const now = new Date().toISOString();
  const diff = daysBetween(now, dueDate);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "Due yesterday";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export default function BorrowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    borrowItems,
    roommates,
    currentUserId,
    addBorrowItem,
    returnBorrowItem,
    deleteBorrowItem,
  } = useAppContext();

  const { confirm } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [item, setItem] = useState("");
  const [borrowedFrom, setBorrowedFrom] = useState(
    roommates.find((r) => r.id !== currentUserId)?.id ?? ""
  );
  const [dueDays, setDueDays] = useState("7");
  const [notes, setNotes] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const activeBorrows = borrowItems.filter((b) => !b.returned);
  const returnedBorrows = borrowItems.filter((b) => b.returned);
  const overdue = activeBorrows.filter(
    (b) => new Date(b.dueDate) < new Date()
  );

  const handleAdd = () => {
    if (!item.trim() || !borrowedFrom) return;
    const due = new Date();
    due.setDate(due.getDate() + parseInt(dueDays, 10));
    addBorrowItem({
      item: item.trim(),
      borrowedFrom,
      borrowedAt: new Date().toISOString(),
      dueDate: due.toISOString(),
      returned: false,
      notes: notes.trim() || undefined,
    });
    setItem("");
    setNotes("");
    setDueDays("7");
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleReturn = (id: string) => {
    returnBorrowItem(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Keep track of
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Borrowing
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Overdue alert banner */}
      {overdue.length > 0 && (
        <View
          style={[
            styles.overdueAlert,
            { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" },
          ]}
        >
          <View style={[styles.overdueIconWrap, { backgroundColor: colors.warning + "22" }]}>
            <Feather name="alert-circle" size={16} color={colors.warning} />
          </View>
          <Text style={[styles.overdueText, { color: colors.warning }]}>
            {overdue.length} item{overdue.length > 1 ? "s" : ""} overdue — time to return!
          </Text>
        </View>
      )}

      <FlatList
        data={[...activeBorrows, ...returnedBorrows]}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 90 + botPad },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="repeat"
            title="Nothing borrowed"
            subtitle="Track items you borrow from roommates"
          />
        }
        ListHeaderComponent={
          activeBorrows.length > 0 ? (
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
              Active ({activeBorrows.length})
            </Text>
          ) : null
        }
        renderItem={({ item: borrow, index }) => {
          const showReturnedHeader =
            returnedBorrows.length > 0 &&
            index === activeBorrows.length;
          const owner = roommates.find((r) => r.id === borrow.borrowedFrom);
          const isOverdueItem = !borrow.returned && new Date(borrow.dueDate) < new Date();
          const dueText = borrow.returned
            ? `Returned ${new Date(borrow.returnedAt ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : formatDue(borrow.dueDate);

          const accentColor = borrow.returned
            ? colors.mutedForeground
            : isOverdueItem
            ? colors.warning
            : colors.primary;

          return (
            <>
              {showReturnedHeader ? (
                <Text
                  style={[styles.sectionHeader, { color: colors.mutedForeground, marginTop: 16 }]}
                >
                  Returned ({returnedBorrows.length})
                </Text>
              ) : null}
              <View
                style={[
                  styles.borrowCard,
                  {
                    backgroundColor: colors.card,
                    shadowColor: isOverdueItem ? colors.warning : "#1A1140",
                    opacity: borrow.returned ? 0.7 : 1,
                    borderLeftWidth: 3,
                    borderLeftColor: accentColor,
                  },
                ]}
              >
                {/* Icon */}
                <View
                  style={[
                    styles.itemIcon,
                    { backgroundColor: accentColor + "15" },
                  ]}
                >
                  <Feather
                    name={borrow.returned ? "check-circle" : isOverdueItem ? "alert-circle" : "repeat"}
                    size={20}
                    color={accentColor}
                  />
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text
                    style={[
                      styles.borrowItemName,
                      {
                        color: borrow.returned ? colors.mutedForeground : colors.foreground,
                        textDecorationLine: borrow.returned ? "line-through" : "none",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {borrow.item}
                  </Text>
                  {owner ? (
                    <View style={styles.ownerRow}>
                      <RoommateAvatar name={owner.name} color={owner.color} size={18} />
                      <Text style={[styles.ownerText, { color: colors.mutedForeground }]}>
                        From {owner.name}
                      </Text>
                    </View>
                  ) : null}
                  {borrow.notes ? (
                    <Text style={[styles.notesText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {borrow.notes}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.dueText,
                      {
                        color: borrow.returned ? colors.success : isOverdueItem ? colors.warning : colors.mutedForeground,
                        fontFamily: isOverdueItem ? "Inter_700Bold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {dueText}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {!borrow.returned ? (
                    <TouchableOpacity
                      style={[
                        styles.returnBtn,
                        { backgroundColor: colors.success + "15", borderColor: colors.success + "40" },
                      ]}
                      onPress={() => handleReturn(borrow.id)}
                    >
                      <Feather name="check" size={13} color={colors.success} />
                      <Text style={[styles.returnBtnText, { color: colors.success }]}>
                        Return
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() =>
                      confirm("delete_borrow", "Delete", "Remove this item?", () => deleteBorrowItem(borrow.id), { confirmText: "Delete", destructive: true })
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          );
        }}
      />

      {/* Add Item Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Log Borrowed Item
          </Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            What did you borrow?
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="e.g. Phone charger"
            placeholderTextColor={colors.mutedForeground}
            value={item}
            onChangeText={setItem}
          />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Borrowed from
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {roommates
              .filter((r) => r.id !== currentUserId)
              .map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.roommateChip,
                    {
                      backgroundColor: borrowedFrom === r.id ? r.color + "20" : colors.muted,
                      borderColor: borrowedFrom === r.id ? r.color : "transparent",
                      borderWidth: borrowedFrom === r.id ? 2 : 0,
                    },
                  ]}
                  onPress={() => setBorrowedFrom(r.id)}
                >
                  <RoommateAvatar name={r.name} color={r.color} size={24} />
                  <Text
                    style={{
                      color: borrowedFrom === r.id ? r.color : colors.mutedForeground,
                      fontFamily: borrowedFrom === r.id ? "Inter_700Bold" : "Inter_500Medium",
                      fontSize: 13,
                    }}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Return in
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["1", "3", "7", "14", "30"].map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dueChip,
                  {
                    backgroundColor: dueDays === d ? colors.primary : colors.muted,
                  },
                ]}
                onPress={() => setDueDays(d)}
              >
                <Text
                  style={{
                    color: dueDays === d ? "#fff" : colors.mutedForeground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 13,
                  }}
                >
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Notes (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="Any details..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: item.trim() && borrowedFrom ? colors.primary : colors.muted },
            ]}
            disabled={!item.trim() || !borrowedFrom}
            onPress={handleAdd}
          >
            <Text style={styles.saveBtnText}>Log Item</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
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
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  overdueAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  overdueIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  overdueText: { fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 },
  list: { paddingHorizontal: 16, gap: 12 },
  sectionHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  borrowCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingRight: 14,
    paddingLeft: 11,
    borderRadius: 18,
    gap: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  borrowItemName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ownerText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  notesText: { fontFamily: "Inter_400Regular", fontSize: 12, fontStyle: "italic" },
  dueText: { fontSize: 12, marginTop: 2 },
  cardActions: { alignItems: "flex-end", gap: 10, paddingTop: 2 },
  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  returnBtnText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  overlay: { flex: 1, backgroundColor: "rgba(26,17,64,0.45)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 22, marginBottom: 4, letterSpacing: -0.4 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  roommateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
  },
  dueChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});

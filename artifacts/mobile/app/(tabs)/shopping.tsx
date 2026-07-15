import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
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

export default function ShoppingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    roommates,
    shoppingLists,
    shoppingItems,
    addShoppingList,
    deleteShoppingList,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    assignShoppingItem,
    currentUserId,
  } = useAppContext();

  const { confirm } = useConfirm();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const [shopName, setShopName] = useState("");
  const [shopQty, setShopQty] = useState("1");
  const [targetListId, setTargetListId] = useState<string | null>(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const [assignPickerItemId, setAssignPickerItemId] = useState<string | null>(null);

  const toggleListCollapse = (id: string) => {
    setCollapsedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddShopItem = () => {
    if (!shopName.trim() || !targetListId) return;
    addShoppingItem({
      name: shopName.trim(),
      quantity: shopQty.trim() || "1",
      addedBy: currentUserId,
      completed: false,
      listId: targetListId,
    });
    setShopName("");
    setShopQty("1");
    setShowShoppingModal(false);
    setTargetListId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddList = () => {
    if (!newListName.trim()) return;
    addShoppingList(newListName.trim());
    setNewListName("");
    setShowNewListModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickerItem = assignPickerItemId
    ? shoppingItems.find((s) => s.id === assignPickerItemId)
    : null;

  const totalRemaining = shoppingItems.filter((i) => !i.completed).length;

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
            Shared lists
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Shopping</Text>
        </View>
        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewListModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      {shoppingLists.length > 0 && (
        <View style={[styles.summaryRow, { paddingHorizontal: 16, marginBottom: 12 }]}>
          <View style={[styles.summaryChip, { backgroundColor: colors.card, shadowColor: "#1A1140" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="shopping-cart" size={13} color={colors.primary} />
            </View>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>
              <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{totalRemaining}</Text>
              {" "}items left across{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{shoppingLists.length}</Text>
              {" "}{shoppingLists.length === 1 ? "list" : "lists"}
            </Text>
          </View>
        </View>
      )}

      {/* Shopping lists */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 90 + botPad },
        ]}
      >
        {shoppingLists.length === 0 ? (
          <EmptyState
            icon="shopping-cart"
            title="No lists yet"
            subtitle="Tap + to create your first shopping list"
          />
        ) : (
          shoppingLists.map((list) => {
            const items = shoppingItems.filter((s) => s.listId === list.id);
            const collapsed = collapsedLists.has(list.id);
            const doneCount = items.filter((i) => i.completed).length;
            const pct = items.length > 0 ? doneCount / items.length : 0;
            return (
              <View
                key={list.id}
                style={[
                  styles.listSection,
                  { backgroundColor: colors.card, shadowColor: "#1A1140" },
                ]}
              >
                {/* Section header */}
                <TouchableOpacity
                  style={styles.listHeader}
                  onPress={() => toggleListCollapse(list.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listHeaderLeft}>
                    <View style={[styles.listIconWrap, { backgroundColor: colors.primary + "15" }]}>
                      <Feather name="list" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listName, { color: colors.foreground }]}>
                        {list.name}
                      </Text>
                      <Text style={[styles.listCount, { color: colors.mutedForeground }]}>
                        {items.length - doneCount} of {items.length} remaining
                      </Text>
                    </View>
                  </View>
                  <View style={styles.listHeaderActions}>
                    <TouchableOpacity
                      style={[styles.listAddBtn, { backgroundColor: colors.primary + "15" }]}
                      onPress={() => {
                        setTargetListId(list.id);
                        setShowShoppingModal(true);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="plus" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        confirm("delete_shopping_list", "Delete List", `Delete "${list.name}" and all its items?`, () => deleteShoppingList(list.id), { confirmText: "Delete", destructive: true })
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <Feather
                      name={collapsed ? "chevron-right" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>

                {/* Progress bar */}
                {items.length > 0 && (
                  <View style={[styles.listProgressTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.listProgressFill,
                        {
                          backgroundColor: pct >= 1 ? colors.success : colors.primary,
                          width: `${Math.max(pct * 100, 2)}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                )}

                {/* Items */}
                {!collapsed && (
                  <View style={styles.listItems}>
                    {items.length === 0 ? (
                      <Text style={[styles.listEmpty, { color: colors.mutedForeground }]}>
                        No items yet — tap + to add
                      </Text>
                    ) : (
                      items.map((item) => {
                        const assignee = item.assignedTo
                          ? roommates.find((r) => r.id === item.assignedTo)
                          : null;
                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.shopItem,
                              {
                                borderTopColor: colors.border,
                                opacity: item.completed ? 0.5 : 1,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={[
                                styles.shopCheck,
                                {
                                  borderColor: item.completed ? colors.success : colors.border,
                                  backgroundColor: item.completed ? colors.success : "transparent",
                                },
                              ]}
                              onPress={() => {
                                toggleShoppingItem(item.id);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                            >
                              {item.completed ? (
                                <Feather name="check" size={11} color="#fff" />
                              ) : null}
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.shopName,
                                  {
                                    color: colors.foreground,
                                    textDecorationLine: item.completed ? "line-through" : "none",
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {item.name}
                              </Text>
                              <Text style={[styles.shopMeta, { color: colors.mutedForeground }]}>
                                {item.quantity}
                                {assignee ? ` · for ${assignee.id === currentUserId ? "you" : assignee.name}` : ""}
                              </Text>
                            </View>

                            {/* Assignee avatar / assign button */}
                            <TouchableOpacity
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              onPress={() => {
                                if (!item.completed) setAssignPickerItemId(item.id);
                              }}
                              style={styles.assignBtn}
                            >
                              {assignee ? (
                                <View style={[styles.assignedPill, { backgroundColor: assignee.color + "20", borderColor: assignee.color + "55" }]}>
                                  <View style={[styles.pillDot, { backgroundColor: assignee.color }]} />
                                  <Text style={[styles.pillText, { color: assignee.color }]}>
                                    {assignee.id === currentUserId ? "You" : assignee.name}
                                  </Text>
                                </View>
                              ) : (
                                !item.completed && (
                                  <View style={[styles.assignGhost, { borderColor: colors.border }]}>
                                    <Feather name="user-plus" size={12} color={colors.mutedForeground} />
                                  </View>
                                )
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => deleteShoppingItem(item.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="x" size={15} color={colors.mutedForeground} />
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Assignee Picker Modal ── */}
      <Modal
        visible={!!assignPickerItemId}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignPickerItemId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setAssignPickerItemId(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Assign to</Text>
          {pickerItem && (
            <Text style={[styles.assignPickerItemName, { color: colors.mutedForeground }]}>
              {pickerItem.name}
            </Text>
          )}
          <View style={styles.assignAvatarGrid}>
            {roommates.map((r) => {
              const selected = pickerItem?.assignedTo === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.assignAvatarCell,
                    {
                      backgroundColor: selected ? r.color + "18" : colors.muted,
                      borderColor: selected ? r.color : "transparent",
                      borderWidth: selected ? 2 : 0,
                    },
                  ]}
                  onPress={() => {
                    assignShoppingItem(
                      assignPickerItemId!,
                      selected ? null : r.id
                    );
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAssignPickerItemId(null);
                  }}
                >
                  <RoommateAvatar name={r.name} color={r.color} size={42} />
                  <Text
                    style={[
                      styles.assignAvatarName,
                      { color: selected ? r.color : colors.foreground, fontFamily: selected ? "Inter_700Bold" : "Inter_400Regular" },
                    ]}
                    numberOfLines={1}
                  >
                    {r.id === currentUserId ? "You" : r.name}
                  </Text>
                  {selected && (
                    <View style={[styles.assignSelectedCheck, { backgroundColor: r.color }]}>
                      <Feather name="check" size={9} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {pickerItem?.assignedTo && (
            <TouchableOpacity
              style={[styles.clearAssignBtn, { borderColor: colors.border }]}
              onPress={() => {
                assignShoppingItem(assignPickerItemId!, null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAssignPickerItemId(null);
              }}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
              <Text style={[styles.clearAssignText, { color: colors.mutedForeground }]}>Clear assignment</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* ── Add Item Modal ── */}
      <Modal visible={showShoppingModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => { setShowShoppingModal(false); setTargetListId(null); }}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Add Item
            {targetListId ? (
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                {" "}· {shoppingLists.find((l) => l.id === targetListId)?.name}
              </Text>
            ) : null}
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Item name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Dish soap"
            placeholderTextColor={colors.mutedForeground}
            value={shopName}
            onChangeText={setShopName}
            autoFocus
          />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Quantity</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. 2 or 1 bag"
            placeholderTextColor={colors.mutedForeground}
            value={shopQty}
            onChangeText={setShopQty}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: shopName.trim() ? colors.primary : colors.border, marginTop: 8 }]}
            disabled={!shopName.trim()}
            onPress={handleAddShopItem}
          >
            <Text style={[styles.addBtnText, { color: shopName.trim() ? "#fff" : colors.mutedForeground }]}>
              Add to List
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── New List Modal ── */}
      <Modal visible={showNewListModal} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowNewListModal(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New List</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>List name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Farmers Market"
            placeholderTextColor={colors.mutedForeground}
            value={newListName}
            onChangeText={setNewListName}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: newListName.trim() ? colors.primary : colors.border, marginTop: 8 }]}
            disabled={!newListName.trim()}
            onPress={handleAddList}
          >
            <Text style={[styles.addBtnText, { color: newListName.trim() ? "#fff" : colors.mutedForeground }]}>
              Create List
            </Text>
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
    paddingBottom: 16,
  },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: { flexDirection: "row" },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    flex: 1,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 2, gap: 12 },
  listSection: {
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    justifyContent: "space-between",
  },
  listHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  listIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listName: { fontFamily: "Inter_700Bold", fontSize: 15 },
  listCount: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  listHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  listProgressTrack: {
    height: 3,
    marginHorizontal: 16,
    marginBottom: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  listProgressFill: { height: 3, borderRadius: 2 },
  listItems: { paddingBottom: 6 },
  listEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  shopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  shopCheck: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  assignBtn: { alignItems: "center", justifyContent: "center" },
  assignedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  assignGhost: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(26,17,64,0.45)",
  },
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
  sheetSubtitle: { fontFamily: "Inter_400Regular", fontSize: 16 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  assignPickerItemName: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: -4,
    marginBottom: 8,
  },
  assignAvatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  assignAvatarCell: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
    position: "relative",
  },
  assignAvatarName: {
    fontSize: 12,
    textAlign: "center",
  },
  assignSelectedCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  clearAssignBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  clearAssignText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});

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
import { useAppContext } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

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
    currentUserId,
  } = useAppContext();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const [shopName, setShopName] = useState("");
  const [shopQty, setShopQty] = useState("1");
  const [targetListId, setTargetListId] = useState<string | null>(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Shopping</Text>
        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewListModal(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary chip */}
      {shoppingLists.length > 0 && (
        <View style={[styles.summaryRow, { paddingHorizontal: 16, marginBottom: 8 }]}>
          <View style={[styles.summaryChip, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Feather name="shopping-cart" size={12} color={colors.primary} />
            <Text style={[styles.summaryText, { color: colors.primary }]}>
              {shoppingItems.filter((i) => !i.completed).length} items left across {shoppingLists.length} {shoppingLists.length === 1 ? "list" : "lists"}
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
            return (
              <View
                key={list.id}
                style={[
                  styles.listSection,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {/* Section header */}
                <TouchableOpacity
                  style={styles.listHeader}
                  onPress={() => toggleListCollapse(list.id)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={collapsed ? "chevron-right" : "chevron-down"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.listName, { color: colors.foreground }]}>
                    {list.name}
                  </Text>
                  <Text style={[styles.listCount, { color: colors.mutedForeground }]}>
                    {items.length - doneCount}/{items.length}
                  </Text>
                  <TouchableOpacity
                    style={[styles.listAddBtn, { backgroundColor: colors.primary + "18" }]}
                    onPress={() => {
                      setTargetListId(list.id);
                      setShowShoppingModal(true);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="plus" size={15} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        "Delete List",
                        `Delete "${list.name}" and all its items?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteShoppingList(list.id),
                          },
                        ]
                      )
                    }
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Items */}
                {!collapsed && (
                  <View style={styles.listItems}>
                    {items.length === 0 ? (
                      <Text style={[styles.listEmpty, { color: colors.mutedForeground }]}>
                        No items yet — tap + to add
                      </Text>
                    ) : (
                      items.map((item) => {
                        const addedBy = roommates.find((r) => r.id === item.addedBy);
                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.shopItem,
                              {
                                borderTopColor: colors.border,
                                opacity: item.completed ? 0.55 : 1,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={[
                                styles.shopCheck,
                                {
                                  borderColor: item.completed ? colors.success : colors.border,
                                  backgroundColor: item.completed
                                    ? colors.success + "22"
                                    : "transparent",
                                },
                              ]}
                              onPress={() => {
                                toggleShoppingItem(item.id);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                            >
                              {item.completed ? (
                                <Feather name="check" size={12} color={colors.success} />
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
                                {item.quantity} · {addedBy?.name ?? "?"}
                              </Text>
                            </View>
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
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
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
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
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
    paddingBottom: 8,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  addHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: { flexDirection: "row" },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  listSection: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
  },
  listName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  listCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  listAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listItems: { paddingBottom: 4 },
  listEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  shopItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  shopCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 4 },
  sheetSubtitle: { fontFamily: "Inter_400Regular", fontSize: 16 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 4 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});

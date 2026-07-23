import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { RoommateAvatar } from "@/components/RoommateAvatar";
import { useAppContext, type PendingIouDraft, type ShoppingItem, type ShoppingList } from "@/context/AppContext";

// Normalize the possibly-legacy `assignedTo` field on a shopping item to an
// array. Old data may have stored a single string; new data uses string[].
function normalizeAssignees(item: ShoppingItem): string[] {
  const a = item.assignedTo;
  if (Array.isArray(a)) return a;
  if (typeof a === "string") return [a];
  return [];
}
import { useTheme } from "@/constants/colors";
import { useConfirm } from "@/hooks/useConfirm";

export default function ShoppingScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const {
    roommates,
    shoppingLists,
    shoppingItems,
    addShoppingList,
    deleteShoppingList,
    reorderShoppingLists,
    pinShoppingList,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    reorderShoppingItems,
    assignShoppingList,
    assignShoppingItem,
    updateShoppingItemPrice,
    setPendingIouDraft,
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
  const [assignPickerListId, setAssignPickerListId] = useState<string | null>(null);

  // Per-item picker: which item are we editing, its selected assignees + price.
  // The picker now supports MULTI-SELECT — item price is split evenly across
  // whoever is selected.
  const [itemPickerId, setItemPickerId] = useState<string | null>(null);
  const [itemPickerAssignees, setItemPickerAssignees] = useState<string[]>([]);
  const [itemPickerPrice, setItemPickerPrice] = useState("");

  // "Fill in missing prices" prompt: kicked off when the user taps the list-
  // level $ and some assigned items don't yet have a price. Keyed by item id.
  const [pricePromptListId, setPricePromptListId] = useState<string | null>(null);
  const [pricePromptDrafts, setPricePromptDrafts] = useState<Record<string, string>>({});

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

  const pickerList = assignPickerListId
    ? shoppingLists.find((l) => l.id === assignPickerListId)
    : null;

  // `shoppingLists` is already in display order — pinned first, then unpinned,
  // maintained by the mutators in AppContext. No per-render sort so the array
  // reference passed to DraggableFlatList stays stable outside of explicit
  // user actions.

  const handleDragEnd = ({ data }: { data: ShoppingList[] }) => {
    reorderShoppingLists(data.map((l) => l.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleItemDragEnd = (listId: string, data: ShoppingItem[]) => {
    reorderShoppingItems(listId, data.map((i) => i.id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Sort a list's items so checked items float to the bottom while preserving
  // the user-defined order within each partition. Displayed order is stored
  // order after any drag (`reorderShoppingItems` enforces the same invariant).
  const sortItemsCheckedLast = (items: ShoppingItem[]): ShoppingItem[] => {
    const unchecked: ShoppingItem[] = [];
    const checked: ShoppingItem[] = [];
    items.forEach((s) => (s.completed ? checked.push(s) : unchecked.push(s)));
    return [...unchecked, ...checked];
  };

  const pickerItem = itemPickerId
    ? shoppingItems.find((s) => s.id === itemPickerId)
    : null;

  const openItemPicker = (itemId: string) => {
    const item = shoppingItems.find((s) => s.id === itemId);
    setItemPickerId(itemId);
    setItemPickerAssignees(item ? normalizeAssignees(item) : []);
    setItemPickerPrice(item?.price != null ? item.price.toFixed(2) : "");
  };

  const toggleItemPickerAssignee = (id: string) => {
    setItemPickerAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveItemPicker = () => {
    if (!itemPickerId) return;
    assignShoppingItem(itemPickerId, itemPickerAssignees);
    const parsed = parseFloat(itemPickerPrice);
    updateShoppingItemPrice(itemPickerId, Number.isFinite(parsed) && parsed > 0 ? parsed : null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItemPickerId(null);
    setItemPickerAssignees([]);
    setItemPickerPrice("");
  };

  // Build an IOU draft from a list's items and hand off to Expenses.
  // `priceOverrides` lets callers merge in prices that were just entered in
  // the prompt modal but may not have been persisted to state yet.
  //
  // The math:
  //   1. Each item with price + assignees[] distributes its price EVENLY across
  //      its assignees → contributes to `itemizedSplits`.
  //   2. `totalItemized` = sum of every assignee's per-item share.
  //   3. Participants = every roommate except the payer (so anyone can pick up
  //      a share of the group total in the IOU builder).
  //   4. `groupTotal` starts at 0 — the user enters a shared amount in the IOU
  //      builder, and the builder redistributes it evenly across participants
  //      ON TOP of each person's itemized amount.
  const buildIouFromList = (listId: string, priceOverrides: Record<string, number> = {}) => {
    const list = shoppingLists.find((l) => l.id === listId);
    if (!list) return;
    const listItems = shoppingItems.filter((s) => s.listId === listId);
    const paidBy = list.assignedTo ?? currentUserId;

    const itemized: Record<string, number> = {};
    let totalItemized = 0;
    listItems.forEach((it) => {
      const price = priceOverrides[it.id] ?? it.price;
      const assignees = normalizeAssignees(it);
      if (assignees.length > 0 && price != null && price > 0) {
        const share = price / assignees.length;
        assignees.forEach((personId) => {
          itemized[personId] = (itemized[personId] ?? 0) + share;
        });
        totalItemized += price;
      }
    });

    // Participants = everyone except the payer. Their initial split is just
    // their itemized amount (group total defaults to 0; user can add later).
    const participants = roommates.filter((r) => r.id !== paidBy).map((r) => r.id);
    const splits: Record<string, string> = {};
    participants.forEach((id) => {
      const amt = itemized[id] ?? 0;
      splits[id] = amt > 0 ? amt.toFixed(2) : "";
    });

    const draft: PendingIouDraft = {
      title: list.name,
      category: "other",
      paidBy,
      totalAmount: totalItemized > 0 ? totalItemized.toFixed(2) : "",
      participants,
      splits,
      itemizedSplits: itemized,
      groupTotal: "",
    };
    setPendingIouDraft(draft);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate("/expenses");
  };

  // List-level "$" handler: if any items have a person but no price, open the
  // price prompt first; otherwise build the IOU straight away.
  const handleListToIou = (listId: string) => {
    const listItems = shoppingItems.filter((s) => s.listId === listId);
    const missing = listItems.filter((i) => normalizeAssignees(i).length > 0 && (i.price == null || i.price <= 0));
    if (missing.length > 0) {
      const initial: Record<string, string> = {};
      missing.forEach((m) => {
        initial[m.id] = "";
      });
      setPricePromptDrafts(initial);
      setPricePromptListId(listId);
      return;
    }
    buildIouFromList(listId);
  };

  const submitPricePrompts = () => {
    if (!pricePromptListId) return;
    const overrides: Record<string, number> = {};
    Object.entries(pricePromptDrafts).forEach(([itemId, val]) => {
      const parsed = parseFloat(val);
      if (Number.isFinite(parsed) && parsed > 0) {
        updateShoppingItemPrice(itemId, parsed);
        overrides[itemId] = parsed;
      }
    });
    // Pass the overrides directly so we don't race the state update
    buildIouFromList(pricePromptListId, overrides);
    setPricePromptListId(null);
    setPricePromptDrafts({});
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
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Shopping</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Shared lists for the household</Text>
        </View>
        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewListModal(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
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
      {shoppingLists.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 40 }}>
          <EmptyState
            icon="shopping-cart"
            title="No lists yet"
            subtitle="Tap + to create your first shopping list"
          />
        </View>
      ) : (
        <NestableScrollContainer
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 90 + botPad },
          ]}
        >
        <NestableDraggableFlatList
          data={shoppingLists}
          keyExtractor={(l) => l.id}
          onDragEnd={handleDragEnd}
          activationDistance={14}
          renderItem={({ item: list, drag, isActive }: RenderItemParams<ShoppingList>) => {
            const items = sortItemsCheckedLast(shoppingItems.filter((s) => s.listId === list.id));
            const collapsed = collapsedLists.has(list.id);
            const doneCount = items.filter((i) => i.completed).length;
            const listAssignee = list.assignedTo
              ? roommates.find((r) => r.id === list.assignedTo)
              : null;
            return (
              <ScaleDecorator>
                <View
                  style={[
                    styles.listSection,
                    {
                      backgroundColor: colors.card,
                      borderColor: list.pinned ? colors.warning + "55" : colors.border,
                      opacity: isActive ? 0.9 : 1,
                    },
                  ]}
                >
                  {/* Section header — tap to collapse, long-press to drag reorder. */}
                  <TouchableOpacity
                    style={styles.listHeader}
                    onPress={() => toggleListCollapse(list.id)}
                    onLongPress={drag}
                    delayLongPress={220}
                    activeOpacity={0.7}
                    disabled={isActive}
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
                    onPress={() => setAssignPickerListId(list.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.assignBtn}
                  >
                    {listAssignee ? (
                      <View style={[styles.assignedPill, { backgroundColor: listAssignee.color + "22", borderColor: listAssignee.color + "55" }]}>
                        <View style={[styles.pillDot, { backgroundColor: listAssignee.color }]} />
                        <Text style={[styles.pillText, { color: listAssignee.color }]}>
                          {listAssignee.id === currentUserId ? "You" : listAssignee.name}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.assignGhost, { borderColor: colors.border }]}>
                        <Feather name="user-plus" size={12} color={colors.mutedForeground} />
                      </View>
                    )}
                  </TouchableOpacity>
                  {/* $ — turn this list into an IOU in the Expenses tab */}
                  <TouchableOpacity
                    style={[styles.listDollarBtn, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}
                    onPress={() => handleListToIou(list.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="dollar-sign" size={14} color={colors.success} />
                  </TouchableOpacity>
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
                      confirm("delete_shopping_list", "Delete List", `Delete "${list.name}" and all its items?`, () => deleteShoppingList(list.id), { confirmText: "Delete", destructive: true })
                    }
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {/* Pin toggle — tap to pin / unpin. Pinned lists float to the top. */}
                  <TouchableOpacity
                    onPress={() => {
                      pinShoppingList(list.id, !list.pinned);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 2 }}
                  >
                    <Ionicons
                      name="pin"
                      size={16}
                      color={list.pinned ? colors.warning : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Items — long-press to drag within the list. Checked items
                    are always sorted to the bottom (enforced by the reorder
                    mutator, so within-partition drag orders are preserved). */}
                {!collapsed && (
                  <View style={styles.listItems}>
                    {items.length === 0 ? (
                      <Text style={[styles.listEmpty, { color: colors.mutedForeground }]}>
                        No items yet — tap + to add
                      </Text>
                    ) : (
                      <NestableDraggableFlatList
                        data={items}
                        keyExtractor={(item) => item.id}
                        onDragEnd={({ data }) => handleItemDragEnd(list.id, data)}
                        activationDistance={14}
                        renderItem={({ item, drag, isActive }: RenderItemParams<ShoppingItem>) => {
                          const assigneeIds = normalizeAssignees(item);
                          const itemAssignees = assigneeIds
                            .map((id) => roommates.find((r) => r.id === id))
                            .filter((r): r is NonNullable<typeof r> => !!r);
                          const primaryColor = itemAssignees[0]?.color;
                          const assigneeLabel =
                            itemAssignees.length === 0
                              ? ""
                              : itemAssignees.length === 1
                              ? itemAssignees[0].id === currentUserId
                                ? "you"
                                : itemAssignees[0].name
                              : `${itemAssignees.length} people`;
                          return (
                            <ScaleDecorator>
                              <TouchableOpacity
                                activeOpacity={1}
                                onLongPress={drag}
                                delayLongPress={220}
                                disabled={isActive}
                                style={[
                                  styles.shopItem,
                                  {
                                    borderTopColor: colors.border,
                                    opacity: item.completed ? 0.55 : isActive ? 0.9 : 1,
                                    backgroundColor: isActive ? colors.muted : "transparent",
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
                                    {item.quantity}
                                    {assigneeLabel ? ` · ${assigneeLabel}` : ""}
                                    {item.price != null ? ` · $${item.price.toFixed(2)}` : ""}
                                  </Text>
                                </View>

                                {/* user-$: assign one or more people + optional amount */}
                                <TouchableOpacity
                                  onPress={() => openItemPicker(item.id)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={[
                                    styles.itemMoneyBtn,
                                    primaryColor
                                      ? { backgroundColor: primaryColor + "22", borderColor: primaryColor + "55" }
                                      : { borderColor: colors.border },
                                  ]}
                                >
                                  <Feather
                                    name={itemAssignees.length > 1 ? "users" : "user"}
                                    size={11}
                                    color={primaryColor ?? colors.mutedForeground}
                                  />
                                  <Feather
                                    name="dollar-sign"
                                    size={11}
                                    color={primaryColor ?? colors.mutedForeground}
                                  />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => deleteShoppingItem(item.id)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Feather name="x" size={15} color={colors.mutedForeground} />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            </ScaleDecorator>
                          );
                        }}
                      />
                    )}
                  </View>
                )}
                </View>
              </ScaleDecorator>
            );
          }}
        />
        </NestableScrollContainer>
      )}

      {/* ── Assignee Picker Modal ── */}
      <Modal
        visible={!!assignPickerListId}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignPickerListId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setAssignPickerListId(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Assign list to</Text>
          {pickerList && (
            <Text style={[styles.assignPickerItemName, { color: colors.mutedForeground }]}>
              {pickerList.name}
            </Text>
          )}
          <View style={styles.assignAvatarGrid}>
            {roommates.map((r) => {
              const selected = pickerList?.assignedTo === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.assignAvatarCell,
                    {
                      backgroundColor: selected ? r.color + "22" : colors.muted,
                      borderColor: selected ? r.color : colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => {
                    assignShoppingList(
                      assignPickerListId!,
                      selected ? null : r.id
                    );
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAssignPickerListId(null);
                  }}
                >
                  <RoommateAvatar name={r.name} color={r.color} size={40} imageUri={r.avatarUri} />
                  <Text
                    style={[
                      styles.assignAvatarName,
                      { color: selected ? r.color : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" },
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
          {pickerList?.assignedTo && (
            <TouchableOpacity
              style={[styles.clearAssignBtn, { borderColor: colors.border }]}
              onPress={() => {
                assignShoppingList(assignPickerListId!, null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAssignPickerListId(null);
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── New List Modal ── */}
      <Modal visible={showNewListModal} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowNewListModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Item Picker Modal (assign person + price to a single item) ── */}
      <Modal
        visible={!!itemPickerId}
        transparent
        animationType="slide"
        onRequestClose={() => setItemPickerId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setItemPickerId(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Who's paying?</Text>
            {pickerItem && (
              <Text style={[styles.assignPickerItemName, { color: colors.mutedForeground }]}>
                {pickerItem.name}
              </Text>
            )}
            <Text style={[styles.pickerHint, { color: colors.mutedForeground }]}>
              Tap multiple people to split this item's price evenly among them.
            </Text>
            <View style={styles.assignAvatarGrid}>
              {roommates.map((r) => {
                const selected = itemPickerAssignees.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.assignAvatarCell,
                      {
                        backgroundColor: selected ? r.color + "22" : colors.muted,
                        borderColor: selected ? r.color : colors.border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                    onPress={() => toggleItemPickerAssignee(r.id)}
                  >
                    <RoommateAvatar name={r.name} color={r.color} size={40} imageUri={r.avatarUri} />
                    <Text
                      style={[
                        styles.assignAvatarName,
                        { color: selected ? r.color : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular" },
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

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Amount (optional)</Text>
            <View style={[styles.priceInputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.foreground }]}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={itemPickerPrice}
                onChangeText={setItemPickerPrice}
                keyboardType="decimal-pad"
              />
            </View>
            {itemPickerAssignees.length > 1 && parseFloat(itemPickerPrice) > 0 ? (
              <Text style={[styles.pickerHint, { color: colors.mutedForeground }]}>
                Each of {itemPickerAssignees.length} pays ${(parseFloat(itemPickerPrice) / itemPickerAssignees.length).toFixed(2)}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {itemPickerAssignees.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearAssignBtn, { borderColor: colors.border, flex: 1 }]}
                  onPress={() => {
                    if (!itemPickerId) return;
                    assignShoppingItem(itemPickerId, []);
                    updateShoppingItemPrice(itemPickerId, null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setItemPickerId(null);
                    setItemPickerAssignees([]);
                    setItemPickerPrice("");
                  }}
                >
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.clearAssignText, { color: colors.mutedForeground }]}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: itemPickerAssignees.length > 0 ? colors.primary : colors.border, flex: 2 }]}
                disabled={itemPickerAssignees.length === 0}
                onPress={saveItemPicker}
              >
                <Text style={[styles.addBtnText, { color: itemPickerAssignees.length > 0 ? "#fff" : colors.mutedForeground }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Price Prompt Modal (fill in prices for assigned items before IOU) ── */}
      <Modal
        visible={!!pricePromptListId}
        transparent
        animationType="slide"
        onRequestClose={() => setPricePromptListId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPricePromptListId(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>How much for each?</Text>
            <Text style={[styles.assignPickerItemName, { color: colors.mutedForeground, marginBottom: 8 }]}>
              These assigned items don't have a price yet.
            </Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {pricePromptListId
                ? shoppingItems
                    .filter((s) => s.listId === pricePromptListId && normalizeAssignees(s).length > 0 && (s.price == null || s.price <= 0))
                    .map((item) => {
                      const owners = normalizeAssignees(item)
                        .map((id) => roommates.find((r) => r.id === id))
                        .filter((r): r is NonNullable<typeof r> => !!r);
                      const ownerLabel =
                        owners.length === 0
                          ? ""
                          : owners.length === 1
                          ? owners[0].id === currentUserId
                            ? "You"
                            : owners[0].name
                          : owners.map((o) => (o.id === currentUserId ? "You" : o.name.split(" ")[0])).join(", ");
                      return (
                        <View key={item.id} style={styles.promptRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.promptItemName, { color: colors.foreground }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[styles.promptItemOwner, { color: owners[0]?.color ?? colors.mutedForeground }]}>
                              {ownerLabel}
                            </Text>
                          </View>
                          <View style={[styles.priceInputRow, { backgroundColor: colors.muted, borderColor: colors.border, minWidth: 110 }]}>
                            <Text style={[styles.priceDollar, { color: colors.mutedForeground }]}>$</Text>
                            <TextInput
                              style={[styles.priceInput, { color: colors.foreground }]}
                              placeholder="0.00"
                              placeholderTextColor={colors.mutedForeground}
                              value={pricePromptDrafts[item.id] ?? ""}
                              onChangeText={(v) => setPricePromptDrafts((prev) => ({ ...prev, [item.id]: v }))}
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </View>
                      );
                    })
                : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.clearAssignBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={() => {
                  // Skip prices → build with only fully-priced items (may fall through to default split)
                  if (!pricePromptListId) return;
                  const listId = pricePromptListId;
                  setPricePromptListId(null);
                  setPricePromptDrafts({});
                  buildIouFromList(listId);
                }}
              >
                <Text style={[styles.clearAssignText, { color: colors.mutedForeground }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={submitPricePrompts}
              >
                <Text style={[styles.addBtnText, { color: "#fff" }]}>Save & Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  title: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 36 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  listSection: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    // Buffer between each list so tiles never visually touch — matters most
    // during drag-reorder when neighbours could otherwise "stick" together.
    marginBottom: 16,
    shadowColor: "#4A3426",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 15,
    gap: 8,
  },
  listName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  listCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  listAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listDollarBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMoneyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  priceDollar: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  priceInput: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, paddingVertical: 4 },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  promptItemName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  promptItemOwner: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  pickerHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
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
    gap: 10,
  },
  shopCheck: {
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  assignBtn: { alignItems: "center", justifyContent: "center" },
  assignedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  assignGhost: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
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
  assignPickerItemName: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: -6,
    marginBottom: 4,
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
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
    position: "relative",
  },
  assignAvatarName: {
    fontSize: 13,
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
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  clearAssignText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});

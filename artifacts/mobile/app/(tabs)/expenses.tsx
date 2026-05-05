import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { RoommateAvatar } from "@/components/RoommateAvatar";
import {
  type ExpenseCategory,
  type RecurringInterval,
  useAppContext,
} from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Tab = "expenses" | "shopping";

const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "groceries", label: "Groceries", icon: "shopping-cart" },
  { key: "utilities", label: "Utilities", icon: "zap" },
  { key: "rent", label: "Rent", icon: "home" },
  { key: "entertainment", label: "Fun", icon: "music" },
  { key: "other", label: "Other", icon: "package" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildEvenSplits(
  total: number,
  participants: string[]
): Record<string, string> {
  if (!participants.length || !total) return {};
  const even = (total / participants.length).toFixed(2);
  const result: Record<string, string> = {};
  participants.forEach((id) => (result[id] = even));
  return result;
}

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    roommates,
    expenses,
    shoppingLists,
    shoppingItems,
    addExpense,
    updateExpense,
    settleExpense,
    deleteExpense,
    markPersonPaid,
    addShoppingList,
    deleteShoppingList,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    getBalances,
    currentUserId,
  } = useAppContext();

  const [tab, setTab] = useState<Tab>("expenses");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);

  // ── IOU builder state ──────────────────────────────────────────────────────
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("groceries");
  const [expPaidBy, setExpPaidBy] = useState(currentUserId);
  const [expTotalAmount, setExpTotalAmount] = useState("");
  // participants = who OWES the payer (not including payer)
  const [expParticipants, setExpParticipants] = useState<string[]>(
    roommates.filter((r) => r.id !== currentUserId).map((r) => r.id)
  );
  // splits: person id → dollar string they owe
  const [expSplits, setExpSplits] = useState<Record<string, string>>({});
  const [expRecurring, setExpRecurring] = useState<RecurringInterval | null>(null);
  const [expRecurringCustom, setExpRecurringCustom] = useState("");

  // Shopping state
  const [shopName, setShopName] = useState("");
  const [shopQty, setShopQty] = useState("1");
  const [targetListId, setTargetListId] = useState<string | null>(null);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  const toggleListCollapse = (id: string) => {
    setCollapsedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const balances = getBalances();
  const activeExpenses = expenses.filter((e) => !e.settled);
  const myBalance = balances[currentUserId] ?? 0;

  // Gross amounts in each direction (not net) so both cards can show simultaneously
  const owedToMe = activeExpenses.reduce((sum, e) => {
    if (e.paidBy !== currentUserId) return sum;
    return (
      sum +
      Object.entries(e.splits ?? {}).reduce(
        (s, [id, amt]) => (id !== e.paidBy ? s + (amt as number) : s),
        0
      )
    );
  }, 0);

  const iOwe = activeExpenses.reduce((sum, e) => {
    if (e.paidBy === currentUserId) return sum;
    return sum + ((e.splits ?? {})[currentUserId] as number || 0);
  }, 0);

  const firstIOweIndex = activeExpenses.findIndex(
    (e) => e.paidBy !== currentUserId && ((e.splits ?? {})[currentUserId] as number || 0) > 0
  );
  const firstOwedToMeIndex = activeExpenses.findIndex(
    (e) => e.paidBy === currentUserId
  );

  const scrollToExpense = (index: number) => {
    if (index < 0) return;
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Recalculate even split when total or participants change ───────────────
  const recalcEvenSplit = useCallback(() => {
    const total = parseFloat(expTotalAmount);
    if (isNaN(total) || total <= 0 || !expParticipants.length) {
      setExpSplits({});
      return;
    }
    setExpSplits(buildEvenSplits(total, expParticipants));
  }, [expTotalAmount, expParticipants]);

  useEffect(() => {
    recalcEvenSplit();
  }, [expParticipants]);

  // ── Derived: sum of splits, remainder ─────────────────────────────────────
  const splitSum = useMemo(() => {
    return Object.values(expSplits).reduce(
      (acc, v) => acc + (parseFloat(v) || 0),
      0
    );
  }, [expSplits]);

  const totalParsed = parseFloat(expTotalAmount) || 0;
  const remainder = Math.round((totalParsed - splitSum) * 100) / 100;
  const splitsValid =
    expParticipants.length > 0 &&
    Math.abs(remainder) < 0.02 &&
    totalParsed > 0;

  const canSubmit = !!expTitle.trim() && totalParsed > 0 && expParticipants.length > 0;

  // ── Toggle participant ─────────────────────────────────────────────────────
  const toggleParticipant = (id: string) => {
    setExpParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Update individual split ────────────────────────────────────────────────
  const updateSplit = (id: string, val: string) => {
    setExpSplits((prev) => ({ ...prev, [id]: val }));
  };

  // ── Reset modal ────────────────────────────────────────────────────────────
  const resetModal = () => {
    setExpTitle("");
    setExpCategory("groceries");
    setExpPaidBy(currentUserId);
    setExpTotalAmount("");
    setExpParticipants(
      roommates.filter((r) => r.id !== currentUserId).map((r) => r.id)
    );
    setExpSplits({});
    setExpRecurring(null);
    setExpRecurringCustom("");
    setEditingExpenseId(null);
  };

  const openEditModal = (item: (typeof expenses)[number]) => {
    setEditingExpenseId(item.id);
    setExpTitle(item.title);
    setExpCategory(item.category);
    setExpPaidBy(item.paidBy);
    setExpTotalAmount(item.amount.toFixed(2));
    setExpParticipants(item.sharedWith);
    setExpSplits(
      Object.fromEntries(
        Object.entries(item.splits ?? {}).map(([id, amt]) => [id, (amt as number).toFixed(2)])
      )
    );
    setExpRecurring(item.recurring ?? null);
    setExpRecurringCustom(item.recurringCustom ?? "");
    setShowExpenseModal(true);
  };

  // ── Submit IOU ─────────────────────────────────────────────────────────────
  const doSendIOU = () => {
    const numericSplits: Record<string, number> = {};
    expParticipants.forEach((id) => {
      numericSplits[id] = parseFloat(expSplits[id] ?? "0") || 0;
    });
    const payload = {
      title: expTitle.trim(),
      amount: totalParsed,
      paidBy: expPaidBy,
      sharedWith: expParticipants,
      splits: numericSplits,
      category: expCategory,
      recurring: expRecurring ?? undefined,
      recurringCustom: expRecurring === "custom" ? expRecurringCustom.trim() || undefined : undefined,
    };
    if (editingExpenseId) {
      updateExpense(editingExpenseId, payload);
    } else {
      addExpense({ ...payload, date: new Date().toISOString(), settled: false });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
    setShowExpenseModal(false);
  };

  const handleSendIOU = () => {
    if (!canSubmit) return;
    if (Math.abs(remainder) >= 0.02) {
      const overUnder = remainder > 0 ? "unassigned" : "over-assigned";
      const amt = `$${Math.abs(remainder).toFixed(2)}`;
      Alert.alert(
        "Splits don't add up",
        `The splits are ${amt} ${overUnder}. Send the IOU anyway?`,
        [
          { text: "Go back", style: "cancel" },
          { text: "Send anyway", onPress: doSendIOU },
        ]
      );
      return;
    }
    doSendIOU();
  };

  // ── Shopping ───────────────────────────────────────────────────────────────
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
        <Text style={[styles.title, { color: colors.foreground }]}>
          {tab === "expenses" ? "Expenses" : "Shopping"}
        </Text>
        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (tab === "expenses") {
              resetModal();
              setShowExpenseModal(true);
            } else {
              setShowNewListModal(true);
            }
          }}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["expenses", "shopping"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              { borderBottomColor: tab === t ? colors.primary : "transparent" },
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: tab === t ? colors.primary : colors.mutedForeground,
                  fontFamily: tab === t ? "Inter_700Bold" : "Inter_400Regular",
                },
              ]}
            >
              {t === "expenses" ? "IOUs" : "Shopping List"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "expenses" ? (
        <>
          {/* Balance cards — You owe on top, Owed to you below */}
          <View style={styles.balanceRow}>
            {iOwe > 0 && (
              <TouchableOpacity
                style={[
                  styles.balanceCard,
                  { backgroundColor: colors.destructive + "14", borderColor: colors.destructive + "40" },
                ]}
                onPress={() => scrollToExpense(firstIOweIndex)}
                activeOpacity={0.75}
              >
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                  You owe
                </Text>
                <Text style={[styles.balanceAmount, { color: colors.destructive }]}>
                  -${iOwe.toFixed(2)}
                </Text>
                <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
                  Tap to view
                </Text>
              </TouchableOpacity>
            )}
            {owedToMe > 0 && (
              <TouchableOpacity
                style={[
                  styles.balanceCard,
                  { backgroundColor: colors.success + "14", borderColor: colors.success + "40" },
                ]}
                onPress={() => scrollToExpense(firstOwedToMeIndex)}
                activeOpacity={0.75}
              >
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                  Owed to you
                </Text>
                <Text style={[styles.balanceAmount, { color: colors.success }]}>
                  +${owedToMe.toFixed(2)}
                </Text>
                <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
                  Tap to view
                </Text>
              </TouchableOpacity>
            )}
            {owedToMe === 0 && iOwe === 0 && (
              <View
                style={[
                  styles.balanceCard,
                  { backgroundColor: colors.success + "14", borderColor: colors.success + "40" },
                ]}
              >
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                  Balance
                </Text>
                <Text style={[styles.balanceAmount, { color: colors.success }]}>
                  $0.00
                </Text>
                <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
                  All settled up
                </Text>
              </View>
            )}
          </View>

          {/* Per-roommate mini balance strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            style={{ marginBottom: 10 }}
          >
            {roommates
              .filter((r) => r.id !== currentUserId)
              .map((r) => {
                const bal = -(balances[r.id] ?? 0);
                return (
                  <View
                    key={r.id}
                    style={[
                      styles.miniBalance,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <RoommateAvatar name={r.name} color={r.color} size={28} />
                    <Text
                      style={[
                        styles.miniName,
                        { color: colors.foreground },
                      ]}
                    >
                      {r.name}
                    </Text>
                    <Text
                      style={[
                        styles.miniAmount,
                        {
                          color:
                            bal > 0
                              ? colors.destructive
                              : bal < 0
                              ? colors.success
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {bal > 0
                        ? `owes $${bal.toFixed(0)}`
                        : bal < 0
                        ? `gets $${Math.abs(bal).toFixed(0)}`
                        : "even"}
                    </Text>
                  </View>
                );
              })}
          </ScrollView>

          {/* Expense list */}
          <FlatList
            ref={flatListRef}
            data={activeExpenses}
            keyExtractor={(e) => e.id}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              flatListRef.current?.scrollToOffset({
                offset: index * averageItemLength,
                animated: true,
              });
            }}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 90 + botPad },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="dollar-sign"
                title="No IOUs yet"
                subtitle="Tap + to log a shared expense"
              />
            }
            renderItem={({ item }) => {
              const payer = roommates.find((r) => r.id === item.paidBy);
              const cat =
                EXPENSE_CATEGORIES.find((c) => c.key === item.category) ??
                EXPENSE_CATEGORIES[4];
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDetailExpenseId(item.id)}
                  style={[
                    styles.expenseCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Top row */}
                  <View style={styles.expenseCardTop}>
                    <View
                      style={[
                        styles.expCatIcon,
                        { backgroundColor: colors.primary + "18" },
                      ]}
                    >
                      <Feather
                        name={cat.icon}
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.expTitle,
                          { color: colors.foreground },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <View style={styles.expMetaRow}>
                        <Text
                          style={[
                            styles.expMeta,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          Paid by {payer?.name ?? "?"} · {formatDate(item.date)}
                        </Text>
                        {item.recurring ? (
                          <View style={[styles.recurringBadge, { backgroundColor: colors.primary + "14" }]}>
                            <Feather name="repeat" size={9} color={colors.primary} />
                            <Text style={[styles.recurringBadgeText, { color: colors.primary }]}>
                              {item.recurring === "custom" && item.recurringCustom
                                ? item.recurringCustom
                                : item.recurring}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.expRight}>
                      <Text
                        style={[
                          styles.expAmount,
                          { color: colors.foreground },
                        ]}
                      >
                        ${item.amount.toFixed(2)}
                      </Text>
                      {item.paidBy === currentUserId ? (
                        <View style={styles.expActions}>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => openEditModal(item)}
                          >
                            <Feather name="edit-2" size={15} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() =>
                              Alert.alert(
                                "Settle Up",
                                "Mark this IOU as settled?",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Settle",
                                    onPress: () => settleExpense(item.id),
                                  },
                                ]
                              )
                            }
                          >
                            <Feather
                              name="check-circle"
                              size={15}
                              color={colors.success}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() =>
                              Alert.alert("Delete IOU", "Remove this expense?", [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () => deleteExpense(item.id),
                                },
                              ])
                            }
                          >
                            <Feather
                              name="trash-2"
                              size={15}
                              color={colors.mutedForeground}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                      )}
                    </View>
                  </View>

                  {/* IOU breakdown chips */}
                  <View style={styles.iouChips}>
                    {Object.entries(item.splits ?? {}).map(([personId, amount]) => {
                      const person = roommates.find((r) => r.id === personId);
                      if (!person) return null;
                      const isMe = personId === currentUserId;
                      const isOwer = personId !== item.paidBy;
                      const hasPaidBack = !!(item.paidBack ?? {})[personId];
                      return (
                        <View
                          key={personId}
                          style={[
                            styles.iouChip,
                            {
                              backgroundColor: hasPaidBack
                                ? colors.success + "14"
                                : isOwer
                                ? isMe
                                  ? colors.destructive + "14"
                                  : colors.muted
                                : colors.success + "14",
                              borderColor: hasPaidBack
                                ? colors.success + "50"
                                : isOwer
                                ? isMe
                                  ? colors.destructive + "50"
                                  : colors.border
                                : colors.success + "50",
                            },
                          ]}
                        >
                          {hasPaidBack ? (
                            <Feather name="check" size={10} color={colors.success} style={{ marginRight: 3 }} />
                          ) : (
                            <View
                              style={[
                                styles.iouDot,
                                { backgroundColor: person.color },
                              ]}
                            />
                          )}
                          <Text
                            style={[
                              styles.iouChipText,
                              {
                                color: hasPaidBack
                                  ? colors.success
                                  : isOwer
                                  ? isMe
                                    ? colors.destructive
                                    : colors.foreground
                                  : colors.success,
                                textDecorationLine: hasPaidBack ? "line-through" : "none",
                              },
                            ]}
                          >
                            {isMe ? "You" : person.name}{hasPaidBack ? " paid" : ` owes $${(amount as number).toFixed(2)}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          {/* ── IOU Detail Modal ── */}
          {(() => {
            const detailExp = expenses.find((e) => e.id === detailExpenseId);
            if (!detailExp) return null;
            const payer = roommates.find((r) => r.id === detailExp.paidBy);
            const cat = EXPENSE_CATEGORIES.find((c) => c.key === detailExp.category) ?? EXPENSE_CATEGORIES[4];
            const iAmPayer = detailExp.paidBy === currentUserId;
            const myShare = (detailExp.splits ?? {})[currentUserId] ?? 0;
            const iAmOwer = !iAmPayer && myShare > 0;
            const alreadyPaidBack = !!(detailExp.paidBack ?? {})[currentUserId];
            return (
              <Modal
                visible={!!detailExpenseId}
                transparent
                animationType="slide"
                onRequestClose={() => setDetailExpenseId(null)}
              >
                <Pressable
                  style={styles.detailOverlay}
                  onPress={() => setDetailExpenseId(null)}
                />
                <View style={[styles.detailSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {/* Handle */}
                  <View style={[styles.detailHandle, { backgroundColor: colors.border }]} />

                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.expCatIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name={cat.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTitle, { color: colors.foreground }]}>{detailExp.title}</Text>
                      <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>
                        Paid by {payer?.name ?? "?"} · {formatDate(detailExp.date)}
                      </Text>
                    </View>
                    <Text style={[styles.detailAmount, { color: colors.foreground }]}>
                      ${detailExp.amount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

                  {/* Who owes what */}
                  <Text style={[styles.detailSectionLabel, { color: colors.mutedForeground }]}>Who owes</Text>
                  <View style={{ gap: 8 }}>
                    {Object.entries(detailExp.splits ?? {}).map(([personId, amount]) => {
                      const person = roommates.find((r) => r.id === personId);
                      if (!person) return null;
                      const isOwer = personId !== detailExp.paidBy;
                      const hasPaid = !!(detailExp.paidBack ?? {})[personId];
                      const isMe = personId === currentUserId;
                      return (
                        <View
                          key={personId}
                          style={[
                            styles.detailPersonRow,
                            {
                              backgroundColor: hasPaid
                                ? colors.success + "0C"
                                : colors.card,
                              borderColor: hasPaid
                                ? colors.success + "40"
                                : colors.border,
                            },
                          ]}
                        >
                          <RoommateAvatar name={person.name} color={person.color} size={32} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.detailPersonName, { color: colors.foreground }]}>
                              {isMe ? "You" : person.name}
                              {!isOwer ? " (paid)" : ""}
                            </Text>
                            <Text style={[
                              styles.detailPersonAmount,
                              {
                                color: hasPaid
                                  ? colors.success
                                  : isOwer
                                  ? isMe ? colors.destructive : colors.mutedForeground
                                  : colors.success,
                                textDecorationLine: hasPaid ? "line-through" : "none",
                              },
                            ]}>
                              {isOwer
                                ? hasPaid
                                  ? `Paid back $${(amount as number).toFixed(2)}`
                                  : `Owes $${(amount as number).toFixed(2)}`
                                : `Covered $${(amount as number).toFixed(2)}`}
                            </Text>
                          </View>
                          {isOwer && (
                            hasPaid ? (
                              <View style={[styles.detailPaidBadge, { backgroundColor: colors.success + "20" }]}>
                                <Feather name="check-circle" size={14} color={colors.success} />
                                <Text style={[styles.detailPaidBadgeText, { color: colors.success }]}>Paid</Text>
                              </View>
                            ) : isMe ? (
                              <TouchableOpacity
                                style={[styles.detailMarkPaidBtn, { backgroundColor: colors.primary }]}
                                onPress={() => {
                                  Alert.alert(
                                    "Mark as paid back?",
                                    `Confirm that you've paid ${payer?.name ?? "them"} back $${(amount as number).toFixed(2)}?`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Yes, I paid",
                                        onPress: () => {
                                          markPersonPaid(detailExp.id, currentUserId);
                                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        },
                                      },
                                    ]
                                  );
                                }}
                              >
                                <Feather name="check" size={13} color="#fff" />
                                <Text style={styles.detailMarkPaidText}>I paid</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={[styles.detailPendingBadge, { borderColor: colors.border }]}>
                                <Text style={[styles.detailPendingText, { color: colors.mutedForeground }]}>Pending</Text>
                              </View>
                            )
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* My action summary */}
                  {iAmOwer && !alreadyPaidBack && (
                    <View style={[styles.detailMyOweBanner, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "30" }]}>
                      <Feather name="alert-circle" size={14} color={colors.destructive} />
                      <Text style={[styles.detailMyOweText, { color: colors.destructive }]}>
                        You owe {payer?.name ?? "them"} ${myShare.toFixed(2)} — tap "I paid" to mark it done
                      </Text>
                    </View>
                  )}
                  {iAmOwer && alreadyPaidBack && (
                    <View style={[styles.detailMyOweBanner, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}>
                      <Feather name="check-circle" size={14} color={colors.success} />
                      <Text style={[styles.detailMyOweText, { color: colors.success }]}>
                        You've marked your share as paid back
                      </Text>
                    </View>
                  )}

                  {/* Payer actions */}
                  {iAmPayer && (
                    <View style={styles.detailPayerActions}>
                      <TouchableOpacity
                        style={[styles.detailActionBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30" }]}
                        onPress={() => { setDetailExpenseId(null); openEditModal(detailExp); }}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary} />
                        <Text style={[styles.detailActionBtnText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.detailActionBtn, { backgroundColor: colors.success + "14", borderColor: colors.success + "30" }]}
                        onPress={() => Alert.alert("Settle Up", "Mark this entire IOU as settled?", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Settle", onPress: () => { settleExpense(detailExp.id); setDetailExpenseId(null); } },
                        ])}
                      >
                        <Feather name="check-circle" size={14} color={colors.success} />
                        <Text style={[styles.detailActionBtnText, { color: colors.success }]}>Settle all</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.detailActionBtn, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "20" }]}
                        onPress={() => Alert.alert("Delete IOU", "Remove this expense?", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => { deleteExpense(detailExp.id); setDetailExpenseId(null); } },
                        ])}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                        <Text style={[styles.detailActionBtnText, { color: colors.destructive }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.detailCloseBtn, { backgroundColor: colors.muted }]}
                    onPress={() => setDetailExpenseId(null)}
                  >
                    <Text style={[styles.detailCloseBtnText, { color: colors.foreground }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </Modal>
            );
          })()}
        </>
      ) : (
        /* ── Shopping lists ── */
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
                      {items.filter((i) => !i.completed).length}/{items.length}
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
      )}

      {/* ── IOU Builder Modal ────────────────────────────────────────────── */}
      <Modal visible={showExpenseModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => { setShowExpenseModal(false); resetModal(); }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kvContainer}
        >
          <View
            style={[
              styles.sheet,
              styles.sheetTall,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {editingExpenseId ? "Edit IOU" : "New IOU"}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
            >
              {/* Title */}
              <View>
                <Text
                  style={[styles.label, { color: colors.mutedForeground }]}
                >
                  What for?
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
                  placeholder="e.g. Groceries run"
                  placeholderTextColor={colors.mutedForeground}
                  value={expTitle}
                  onChangeText={setExpTitle}
                />
              </View>

              {/* Category */}
              <View>
                <Text
                  style={[styles.label, { color: colors.mutedForeground }]}
                >
                  Category
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            expCategory === cat.key
                              ? colors.primary
                              : colors.muted,
                          borderColor:
                            expCategory === cat.key
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => setExpCategory(cat.key)}
                    >
                      <Feather
                        name={cat.icon}
                        size={12}
                        color={
                          expCategory === cat.key
                            ? "#fff"
                            : colors.mutedForeground
                        }
                      />
                      <Text
                        style={{
                          color:
                            expCategory === cat.key
                              ? "#fff"
                              : colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          marginLeft: 4,
                        }}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Paid by */}
              <View>
                <Text
                  style={[styles.label, { color: colors.mutedForeground }]}
                >
                  Who paid?
                </Text>
                <View style={styles.roommateRow}>
                  {roommates.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.roommateChip,
                        {
                          backgroundColor:
                            expPaidBy === r.id ? r.color + "22" : colors.muted,
                          borderColor:
                            expPaidBy === r.id ? r.color : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setExpPaidBy(r.id);
                        // Remove payer from participants
                        setExpParticipants((prev) =>
                          prev.filter((x) => x !== r.id)
                        );
                      }}
                    >
                      <RoommateAvatar
                        name={r.name}
                        color={r.color}
                        size={20}
                      />
                      <Text
                        style={{
                          color:
                            expPaidBy === r.id ? r.color : colors.mutedForeground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                          marginLeft: 6,
                        }}
                      >
                        {r.id === currentUserId ? "You" : r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Total amount */}
              <View>
                <Text
                  style={[styles.label, { color: colors.mutedForeground }]}
                >
                  Total amount
                </Text>
                <View
                  style={[
                    styles.amountInputRow,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.dollarSign, { color: colors.mutedForeground }]}
                  >
                    $
                  </Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={expTotalAmount}
                    onChangeText={(v) => setExpTotalAmount(v)}
                    onBlur={recalcEvenSplit}
                    keyboardType="decimal-pad"
                  />
                  {totalParsed > 0 && expParticipants.length > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.evenSplitBtn,
                        { backgroundColor: colors.primary + "18" },
                      ]}
                      onPress={recalcEvenSplit}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        Split evenly
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Split between */}
              <View>
                <Text
                  style={[styles.label, { color: colors.mutedForeground }]}
                >
                  Split between
                </Text>
                <View style={styles.roommateRow}>
                  {roommates
                    .filter((r) => r.id !== expPaidBy)
                    .map((r) => {
                      const selected = expParticipants.includes(r.id);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[
                            styles.roommateChip,
                            {
                              backgroundColor: selected
                                ? r.color + "22"
                                : colors.muted,
                              borderColor: selected ? r.color : colors.border,
                            },
                          ]}
                          onPress={() => toggleParticipant(r.id)}
                        >
                          <RoommateAvatar
                            name={r.name}
                            color={r.color}
                            size={20}
                          />
                          <Text
                            style={{
                              color: selected ? r.color : colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 12,
                              marginLeft: 6,
                            }}
                          >
                            {r.id === currentUserId ? "You" : r.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </View>

              {/* Recurring toggle */}
              <View>
                <TouchableOpacity
                  style={[
                    styles.recurringToggle,
                    {
                      backgroundColor: expRecurring ? colors.primary + "12" : colors.muted,
                      borderColor: expRecurring ? colors.primary + "55" : colors.border,
                    },
                  ]}
                  onPress={() => setExpRecurring(expRecurring ? null : "monthly")}
                >
                  <View
                    style={[
                      styles.recurringCheckbox,
                      {
                        backgroundColor: expRecurring ? colors.primary : "transparent",
                        borderColor: expRecurring ? colors.primary : colors.mutedForeground,
                      },
                    ]}
                  >
                    {expRecurring ? <Feather name="check" size={11} color="#fff" /> : null}
                  </View>
                  <Feather name="repeat" size={14} color={expRecurring ? colors.primary : colors.mutedForeground} />
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      color: expRecurring ? colors.primary : colors.mutedForeground,
                      flex: 1,
                    }}
                  >
                    Recurring expense
                  </Text>
                </TouchableOpacity>

                {expRecurring ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <View style={styles.recurringOptions}>
                      {(["daily", "monthly", "custom"] as RecurringInterval[]).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.recurringChip,
                            {
                              backgroundColor: expRecurring === opt ? colors.primary : colors.muted,
                              borderColor: expRecurring === opt ? colors.primary : colors.border,
                              flex: 1,
                            },
                          ]}
                          onPress={() => setExpRecurring(opt)}
                        >
                          <Text
                            style={{
                              fontFamily: "Inter_600SemiBold",
                              fontSize: 13,
                              color: expRecurring === opt ? "#fff" : colors.mutedForeground,
                              textAlign: "center",
                            }}
                          >
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {expRecurring === "custom" ? (
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.muted,
                            color: colors.foreground,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="e.g. every 2 weeks"
                        placeholderTextColor={colors.mutedForeground}
                        value={expRecurringCustom}
                        onChangeText={setExpRecurringCustom}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Per-person edit */}
              {expParticipants.length > 0 && (
                <View>
                  <View style={styles.splitHeaderRow}>
                    <Text
                      style={[styles.label, { color: colors.mutedForeground }]}
                    >
                      Each person owes
                    </Text>
                    {Math.abs(remainder) >= 0.02 && totalParsed > 0 && (
                      <Text
                        style={{
                          color:
                            remainder > 0
                              ? colors.warning
                              : colors.destructive,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {remainder > 0
                          ? `$${remainder.toFixed(2)} unassigned`
                          : `$${Math.abs(remainder).toFixed(2)} over`}
                      </Text>
                    )}
                    {splitsValid && (
                      <Text
                        style={{
                          color: colors.success,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        ✓ Balanced
                      </Text>
                    )}
                  </View>

                  <View style={{ gap: 8, marginTop: 4 }}>
                    {expParticipants.map((id) => {
                      const person = roommates.find((r) => r.id === id);
                      if (!person) return null;
                      return (
                        <View
                          key={id}
                          style={[
                            styles.splitRow,
                            {
                              backgroundColor: colors.muted,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <RoommateAvatar
                            name={person.name}
                            color={person.color}
                            size={28}
                          />
                          <Text
                            style={[
                              styles.splitName,
                              { color: colors.foreground },
                            ]}
                          >
                            {id === currentUserId ? "You" : person.name}
                          </Text>
                          <View
                            style={[
                              styles.splitAmountBox,
                              { borderColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.splitDollar,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              $
                            </Text>
                            <TextInput
                              style={[
                                styles.splitInput,
                                { color: colors.foreground },
                              ]}
                              value={expSplits[id] ?? ""}
                              onChangeText={(v) => updateSplit(id, v)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Send button */}
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: canSubmit
                      ? colors.primary
                      : colors.border,
                    marginTop: 4,
                  },
                ]}
                disabled={!canSubmit}
                onPress={handleSendIOU}
              >
                <Feather
                  name="send"
                  size={15}
                  color={canSubmit ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.addBtnText,
                    {
                      color: canSubmit ? "#fff" : colors.mutedForeground,
                      marginLeft: 8,
                    },
                  ]}
                >
                  {editingExpenseId ? "Save Changes" : "Send IOU"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Item Modal ────────────────────────────────────────────────── */}
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

      {/* ── New List Modal ────────────────────────────────────────────────── */}
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
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  tabText: { fontSize: 14 },
  balanceRow: {
    flexDirection: "column",
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  balanceCard: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  balanceLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 30, marginTop: 2 },
  balanceHint: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  miniBalance: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  miniName: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  miniAmount: { fontFamily: "Inter_500Medium", fontSize: 11 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  expenseCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  expenseCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  expCatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 },
  expMeta: { fontFamily: "Inter_400Regular", fontSize: 12 },
  expRight: { alignItems: "flex-end", gap: 6 },
  expAmount: { fontFamily: "Inter_700Bold", fontSize: 16 },
  expActions: { flexDirection: "row", gap: 12 },
  iouChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  iouChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 5,
  },
  iouDot: { width: 7, height: 7, borderRadius: 4 },
  iouChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  listSection: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
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
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  sheetSubtitle: { fontFamily: "Inter_400Regular", fontSize: 16 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  kvContainer: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
  },
  sheetTall: { maxHeight: "90%" },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 14,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  dollarSign: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    paddingVertical: 8,
  },
  evenSplitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  roommateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roommateChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  splitHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  splitName: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  splitAmountBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 90,
  },
  splitDollar: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginRight: 2,
  },
  splitInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    minWidth: 60,
    padding: 0,
  },
  addBtn: {
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  addBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  recurringToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  recurringCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  recurringOptions: {
    flexDirection: "row",
    gap: 8,
  },
  recurringChip: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  expMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recurringBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  detailSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  detailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  detailMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  detailAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  detailSectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  detailPersonName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  detailPersonAmount: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 1,
  },
  detailPaidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailPaidBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  detailMarkPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailMarkPaidText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#fff",
  },
  detailPendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailPendingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  detailMyOweBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailMyOweText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  detailPayerActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  detailActionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  detailCloseBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  detailCloseBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});

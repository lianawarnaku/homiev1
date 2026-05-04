import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    shoppingItems,
    addExpense,
    settleExpense,
    deleteExpense,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    getBalances,
    currentUserId,
  } = useAppContext();

  const [tab, setTab] = useState<Tab>("expenses");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);

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

  // Shopping state
  const [shopName, setShopName] = useState("");
  const [shopQty, setShopQty] = useState("1");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const balances = getBalances();
  const activeExpenses = expenses.filter((e) => !e.settled);
  const myBalance = balances[currentUserId] ?? 0;

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

  const canSubmit = expTitle.trim() && totalParsed > 0 && splitsValid;

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
  };

  // ── Submit IOU ─────────────────────────────────────────────────────────────
  const handleSendIOU = () => {
    if (!canSubmit) return;
    const numericSplits: Record<string, number> = {};
    expParticipants.forEach((id) => {
      numericSplits[id] = parseFloat(expSplits[id] ?? "0") || 0;
    });
    addExpense({
      title: expTitle.trim(),
      amount: totalParsed,
      paidBy: expPaidBy,
      sharedWith: expParticipants,
      splits: numericSplits,
      date: new Date().toISOString(),
      category: expCategory,
      settled: false,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetModal();
    setShowExpenseModal(false);
  };

  // ── Shopping ───────────────────────────────────────────────────────────────
  const handleAddShopItem = () => {
    if (!shopName.trim()) return;
    addShoppingItem({
      name: shopName.trim(),
      quantity: shopQty.trim() || "1",
      addedBy: currentUserId,
      completed: false,
    });
    setShopName("");
    setShopQty("1");
    setShowShoppingModal(false);
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
              setShowShoppingModal(true);
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
          {/* Balance card */}
          <View
            style={[
              styles.balanceCard,
              {
                backgroundColor:
                  myBalance >= 0
                    ? colors.success + "14"
                    : colors.destructive + "14",
                borderColor:
                  myBalance >= 0
                    ? colors.success + "40"
                    : colors.destructive + "40",
              },
            ]}
          >
            <Text
              style={[styles.balanceLabel, { color: colors.mutedForeground }]}
            >
              Your balance
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                {
                  color:
                    myBalance >= 0 ? colors.success : colors.destructive,
                },
              ]}
            >
              {myBalance >= 0 ? "+" : ""}${Math.abs(myBalance).toFixed(2)}
            </Text>
            <Text
              style={[styles.balanceHint, { color: colors.mutedForeground }]}
            >
              {myBalance > 0
                ? "Others owe you"
                : myBalance < 0
                ? "You owe others"
                : "All settled up"}
            </Text>
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
            data={activeExpenses}
            keyExtractor={(e) => e.id}
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
                <View
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
                      <Text
                        style={[
                          styles.expMeta,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Paid by {payer?.name ?? "?"} · {formatDate(item.date)}
                      </Text>
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
                      <View style={styles.expActions}>
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
                    </View>
                  </View>

                  {/* IOU breakdown chips */}
                  <View style={styles.iouChips}>
                    {Object.entries(item.splits ?? {}).map(([personId, amount]) => {
                      const person = roommates.find((r) => r.id === personId);
                      if (!person) return null;
                      const isMe = personId === currentUserId;
                      const isOwer = personId !== item.paidBy;
                      return (
                        <View
                          key={personId}
                          style={[
                            styles.iouChip,
                            {
                              backgroundColor: isOwer
                                ? isMe
                                  ? colors.destructive + "14"
                                  : colors.muted
                                : colors.success + "14",
                              borderColor: isOwer
                                ? isMe
                                  ? colors.destructive + "50"
                                  : colors.border
                                : colors.success + "50",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.iouDot,
                              { backgroundColor: person.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.iouChipText,
                              {
                                color: isOwer
                                  ? isMe
                                    ? colors.destructive
                                    : colors.foreground
                                  : colors.success,
                              },
                            ]}
                          >
                            {isMe ? "You" : person.name} owes $
                            {(amount as number).toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
        /* ── Shopping list ── */
        <FlatList
          data={shoppingItems}
          keyExtractor={(s) => s.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 90 + botPad },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="shopping-cart"
              title="Shopping list is empty"
              subtitle="Tap + to add items"
            />
          }
          renderItem={({ item }) => {
            const addedBy = roommates.find((r) => r.id === item.addedBy);
            return (
              <View
                style={[
                  styles.shopItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: item.completed ? 0.6 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.shopCheck,
                    {
                      borderColor: item.completed
                        ? colors.success
                        : colors.border,
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
                    <Feather name="check" size={13} color={colors.success} />
                  ) : null}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.shopName,
                      {
                        color: colors.foreground,
                        textDecorationLine: item.completed
                          ? "line-through"
                          : "none",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.shopMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.quantity} · added by {addedBy?.name ?? "?"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteShoppingItem(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* ── IOU Builder Modal ────────────────────────────────────────────── */}
      <Modal visible={showExpenseModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowExpenseModal(false)}
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
              New IOU
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
                  Send IOU
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Shopping Modal ────────────────────────────────────────────────── */}
      <Modal visible={showShoppingModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowShoppingModal(false)}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Add Item
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Item name
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
            placeholder="e.g. Dish soap"
            placeholderTextColor={colors.mutedForeground}
            value={shopName}
            onChangeText={setShopName}
          />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Quantity
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
            placeholder="e.g. 2 or 1 bag"
            placeholderTextColor={colors.mutedForeground}
            value={shopQty}
            onChangeText={setShopQty}
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: shopName.trim()
                  ? colors.primary
                  : colors.border,
                marginTop: 8,
              },
            ]}
            disabled={!shopName.trim()}
            onPress={handleAddShopItem}
          >
            <Text
              style={[
                styles.addBtnText,
                { color: shopName.trim() ? "#fff" : colors.mutedForeground },
              ]}
            >
              Add to List
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
  balanceCard: {
    marginHorizontal: 16,
    marginBottom: 10,
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
  shopItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  shopCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
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
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { FloatingActionButton, useFloatingActionMetrics } from "@/components/FloatingActionButton";
import { HeaderActions } from "@/components/HeaderActions";
import { RoommateAvatar } from "@/components/RoommateAvatar";
import { useTheme } from "@/constants/colors";
import { useConfirm } from "@/hooks/useConfirm";
import { useDraggableSheet } from "@/hooks/useDraggableSheet";
import { success as hapticSuccess } from "@/lib/haptics";
import { buildEvenSplitCents, centsToDollars, parseMoneyToCents, validateExpenseAllocation } from "@/lib/money";
import {
  type ExpenseCategory,
  type Expense,
  type PendingIouDraft,
  type RecurringInterval,
  useAppContextSelector,
} from "@/context/AppContext";

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

const AnimatedFlatList = Reanimated.createAnimatedComponent(FlatList<Expense>);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildEvenSplits(
  totalCents: number,
  participants: string[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(buildEvenSplitCents(totalCents, participants)).map(([id, cents]) => [
      id,
      centsToDollars(cents).toFixed(2),
    ]),
  );
}

export default function ExpensesScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollBottomPadding } = useFloatingActionMetrics();
  const {
    roommates,
    expenses,
    addExpense,
    updateExpense,
    settleExpense,
    deleteExpense,
    markPersonPaid,
    getBalances,
    currentUserId,
    pendingIouDraft,
    setPendingIouDraft,
    linkShoppingItemsToExpense,
  } = useAppContextSelector((context) => ({
    roommates: context.roommates,
    expenses: context.expenses,
    addExpense: context.addExpense,
    updateExpense: context.updateExpense,
    settleExpense: context.settleExpense,
    deleteExpense: context.deleteExpense,
    markPersonPaid: context.markPersonPaid,
    getBalances: context.getBalances,
    currentUserId: context.currentUserId,
    pendingIouDraft: context.pendingIouDraft,
    setPendingIouDraft: context.setPendingIouDraft,
    linkShoppingItemsToExpense: context.linkShoppingItemsToExpense,
  }));

  const { confirm } = useConfirm();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [submittingIou, setSubmittingIou] = useState(false);
  const submittingIouRef = useRef(false);

  // ── IOU builder state ──────────────────────────────────────────────────────
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("groceries");
  const [expPaidBy, setExpPaidBy] = useState(currentUserId);
  const [expTotalAmount, setExpTotalAmount] = useState("");
  // participants = everyone whose share is part of the expense (payer allowed)
  const [expParticipants, setExpParticipants] = useState<string[]>(
    roommates.filter((r) => r.id !== currentUserId).map((r) => r.id)
  );
  // splits: person id → dollar string they owe
  const [expSplits, setExpSplits] = useState<Record<string, string>>({});
  const [allocationMode, setAllocationMode] = useState<"equal" | "custom">("equal");
  const [expRecurring, setExpRecurring] = useState<RecurringInterval | null>(null);
  const [expRecurringCustom, setExpRecurringCustom] = useState("");
  const [expenseSource, setExpenseSource] = useState<PendingIouDraft["source"]>();

  // Consume a pre-filled IOU draft handed off from the Shopping tab. When
  // present, populate the builder state and pop the modal, then clear the
  // draft so we don't re-open on subsequent renders.
  useEffect(() => {
    if (!pendingIouDraft) return;
    setEditingExpenseId(null);
    setExpTitle(pendingIouDraft.title);
    setExpCategory(pendingIouDraft.category);
    setExpPaidBy(pendingIouDraft.paidBy);
    setExpTotalAmount(pendingIouDraft.totalAmount);
    setExpParticipants(pendingIouDraft.participants);
    setExpSplits(pendingIouDraft.splits);
    setAllocationMode("custom");
    setExpenseSource(pendingIouDraft.source);
    setExpRecurring(null);
    setExpRecurringCustom("");
    setShowExpenseModal(true);
    setPendingIouDraft(null);
  }, [pendingIouDraft, setPendingIouDraft]);

  const flatListRef = useRef<FlatList>(null);
  const expenseScrollY = useSharedValue(0);
  const expenseScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      expenseScrollY.value = Math.max(0, event.contentOffset.y);
    },
  });
  const balanceCardStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expenseScrollY.value,
      [0, 120],
      [112, 64],
      Extrapolation.CLAMP,
    ),
  }));
  const balanceCardContentStyle = useAnimatedStyle(() => ({
    paddingVertical: interpolate(
      expenseScrollY.value,
      [0, 120],
      [14, 6],
      Extrapolation.CLAMP,
    ),
  }));
  const balanceAmountStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      expenseScrollY.value,
      [0, 120],
      [34, 22],
      Extrapolation.CLAMP,
    ),
    marginTop: interpolate(
      expenseScrollY.value,
      [0, 120],
      [4, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const balanceHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      expenseScrollY.value,
      [0, 72],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    height: interpolate(
      expenseScrollY.value,
      [0, 100],
      [18, 0],
      Extrapolation.CLAMP,
    ),
    marginTop: interpolate(
      expenseScrollY.value,
      [0, 100],
      [2, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const {
    activeExpenses,
    firstIOweIndex,
    firstOwedToMeIndex,
    iOwe,
    myBalance,
    owedToMe,
  } = useMemo(() => {
    const balances = getBalances();
    const active = expenses.filter((expense) => !expense.settled);

    // Gross amounts in each direction — exclude entries already paid back.
    let nextOwedToMe = 0;
    let nextIOwe = 0;
    active.forEach((expense) => {
      if (expense.paidBy === currentUserId) {
        Object.entries(expense.splits ?? {}).forEach(([id, amount]) => {
          if (id !== expense.paidBy && !(expense.paidBack ?? {})[id]) {
            nextOwedToMe += amount as number;
          }
        });
      } else if (!(expense.paidBack ?? {})[currentUserId]) {
        nextIOwe += (expense.splits ?? {})[currentUserId] as number || 0;
      }
    });

    return {
      activeExpenses: active,
      firstIOweIndex: active.findIndex(
        (expense) =>
          expense.paidBy !== currentUserId &&
          ((expense.splits ?? {})[currentUserId] as number || 0) > 0,
      ),
      firstOwedToMeIndex: active.findIndex(
        (expense) => expense.paidBy === currentUserId,
      ),
      iOwe: nextIOwe,
      myBalance: balances[currentUserId] ?? 0,
      owedToMe: nextOwedToMe,
    };
  }, [currentUserId, expenses, getBalances]);

  const scrollToExpense = (index: number) => {
    if (index < 0) return;
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Recalculate even split when total or participants change ───────────────
  const recalcEvenSplit = useCallback(() => {
    const totalCents = parseMoneyToCents(expTotalAmount);
    if (totalCents === null || !expParticipants.length) {
      setExpSplits({});
      return;
    }
    setExpSplits(buildEvenSplits(totalCents, expParticipants));
    setAllocationMode("equal");
  }, [expTotalAmount, expParticipants]);

  // ── Derived: sum of splits, remainder ─────────────────────────────────────
  const totalCents = parseMoneyToCents(expTotalAmount);
  const activeMemberIds = new Set(roommates.map((member) => member.id));
  const allocationValidation = validateExpenseAllocation({
    total: expTotalAmount,
    payerId: expPaidBy,
    participantIds: expParticipants,
    allocations: expSplits,
    activeMemberIds,
  });
  const totalParsed = totalCents === null ? 0 : centsToDollars(totalCents);
  const remainingCents = allocationValidation.valid ? 0 : allocationValidation.remainingCents;
  const splitsValid = allocationValidation.valid;
  const canSubmit = !submittingIou && allocationValidation.valid;

  // ── Toggle participant ─────────────────────────────────────────────────────
  const toggleParticipant = (id: string) => {
    const next = expParticipants.includes(id)
      ? expParticipants.filter((value) => value !== id)
      : [...expParticipants, id];
    setExpParticipants(next);
    if (allocationMode === "equal" && totalCents !== null && next.length) {
      setExpSplits(buildEvenSplits(totalCents, next));
    } else {
      setExpSplits((current) => {
        const updated = Object.fromEntries(Object.entries(current).filter(([memberId]) => next.includes(memberId)));
        if (next.includes(id) && !(id in updated)) updated[id] = "";
        return updated;
      });
    }
  };

  // ── Update individual split ────────────────────────────────────────────────
  const updateSplit = (id: string, val: string) => {
    setAllocationMode("custom");
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
    setAllocationMode("equal");
    setExpRecurring(null);
    setExpRecurringCustom("");
    setEditingExpenseId(null);
    setExpenseSource(undefined);
  };

  // ── Open / close animation for the New IOU sheet ───────────────────────────
  // The sheet is a full-screen overlay driven entirely by a single translateY
  // value. On open: spring up from below with a subtle overshoot. On close (via
  // the top-right X button or after sending): timed slide back down off-screen,
  // then dismiss the modal and reset form state.
  const iouTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (showExpenseModal) {
      iouTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(iouTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
        mass: 0.8,
      }).start();
    }
  }, [showExpenseModal, iouTranslateY]);

  const closeIou = useCallback(() => {
    Animated.timing(iouTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShowExpenseModal(false);
      resetModal();
      submittingIouRef.current = false;
      setSubmittingIou(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iouTranslateY]);
  const iouDragHandlers = useDraggableSheet(iouTranslateY, () => {
    setShowExpenseModal(false);
    resetModal();
    submittingIouRef.current = false;
    setSubmittingIou(false);
  });

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
    setAllocationMode("custom");
    setExpRecurring(item.recurring ?? null);
    setExpRecurringCustom(item.recurringCustom ?? "");
    setExpenseSource(undefined);
    setShowExpenseModal(true);
  };

  // ── Submit IOU ─────────────────────────────────────────────────────────────
  const doSendIOU = () => {
    if (submittingIouRef.current || !canSubmit || !allocationValidation.valid) return;
    submittingIouRef.current = true;
    setSubmittingIou(true);
    const numericSplits: Record<string, number> = {};
    expParticipants.forEach((id) => {
      numericSplits[id] = centsToDollars(allocationValidation.allocationCents[id]);
    });
    const payload = {
      title: expTitle.trim() || "IOU",
      amount: centsToDollars(allocationValidation.totalCents),
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
      const expenseId = addExpense({ ...payload, date: new Date().toISOString(), settled: false });
      if (expenseSource) linkShoppingItemsToExpense(expenseSource.itemIds, expenseId);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeIou();
  };

  const handleSendIOU = () => {
    if (!canSubmit) return;
    doSendIOU();
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
          <Text style={[styles.title, { color: colors.foreground }]}>Expenses</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Shared costs and repayments</Text>
        </View>
        <View style={styles.headerButtons}>
          <HeaderActions />
        </View>
      </View>

      <>
          {/* Balance cards — You owe on top, Owed to you below */}
          <View style={styles.balanceRow}>
            {iOwe > 0 && (
              <Reanimated.View
                style={[
                  styles.balanceCard,
                  balanceCardStyle,
                  { backgroundColor: colors.destructive + "14", borderColor: colors.destructive + "40" },
                ]}
              >
                <TouchableOpacity
                  style={styles.balanceCardPressable}
                  onPress={() => scrollToExpense(firstIOweIndex)}
                  activeOpacity={0.75}
                >
                  <Reanimated.View style={[styles.balanceCardContent, balanceCardContentStyle]}>
                    <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>You owe</Text>
                    <Reanimated.Text style={[styles.balanceAmount, balanceAmountStyle, { color: colors.destructive }]}>
                      -${iOwe.toFixed(2)}
                    </Reanimated.Text>
                    <Reanimated.Text style={[styles.balanceHint, balanceHintStyle, { color: colors.mutedForeground }]}>
                      Tap to view
                    </Reanimated.Text>
                  </Reanimated.View>
                </TouchableOpacity>
              </Reanimated.View>
            )}
            {owedToMe > 0 && (
              <Reanimated.View
                style={[
                  styles.balanceCard,
                  balanceCardStyle,
                  { backgroundColor: colors.success + "14", borderColor: colors.success + "40" },
                ]}
              >
                <TouchableOpacity
                  style={styles.balanceCardPressable}
                  onPress={() => scrollToExpense(firstOwedToMeIndex)}
                  activeOpacity={0.75}
                >
                  <Reanimated.View style={[styles.balanceCardContent, balanceCardContentStyle]}>
                    <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Owed to you</Text>
                    <Reanimated.Text style={[styles.balanceAmount, balanceAmountStyle, { color: colors.success }]}>
                      +${owedToMe.toFixed(2)}
                    </Reanimated.Text>
                    <Reanimated.Text style={[styles.balanceHint, balanceHintStyle, { color: colors.mutedForeground }]}>
                      Tap to view
                    </Reanimated.Text>
                  </Reanimated.View>
                </TouchableOpacity>
              </Reanimated.View>
            )}
            {owedToMe === 0 && iOwe === 0 && (
              <Reanimated.View
                style={[
                  styles.balanceCard,
                  balanceCardStyle,
                  { backgroundColor: colors.success + "14", borderColor: colors.success + "40" },
                ]}
              >
                <Reanimated.View style={[styles.balanceCardContent, balanceCardContentStyle]}>
                  <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Balance</Text>
                  <Reanimated.Text style={[styles.balanceAmount, balanceAmountStyle, { color: colors.success }]}>
                    $0.00
                  </Reanimated.Text>
                  <Reanimated.Text style={[styles.balanceHint, balanceHintStyle, { color: colors.mutedForeground }]}>
                    All settled up
                  </Reanimated.Text>
                </Reanimated.View>
              </Reanimated.View>
            )}
          </View>

          {/* Expense list */}
          <AnimatedFlatList
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
              { paddingBottom: Math.max(scrollBottomPadding, 90 + botPad) },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={expenseScrollHandler}
            scrollEventThrottle={16}
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
                    <View style={styles.expCatIcon}>
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
                        numberOfLines={2}
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
                          Paid by {payer?.name ?? "Former Sweetmate"} · {formatDate(item.date)}
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
                              confirm("settle_expense", "Settle Up", "Mark this IOU as settled?", () => {
                                settleExpense(item.id);
                                hapticSuccess();
                              }, { confirmText: "Settle" })
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
                              confirm("delete_expense", "Delete IOU", "Remove this expense?", () => deleteExpense(item.id), { confirmText: "Delete", destructive: true })
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
                      const person = roommates.find((r) => r.id === personId) ?? {
                        id: personId,
                        name: "Former Sweetmate",
                        color: colors.mutedForeground,
                        points: 0,
                        weeklyPoints: 0,
                      };
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
                            {isMe ? "You" : person.name}{hasPaidBack ? " paid" : ` ${isMe ? "owe" : "owes"} $${(amount as number).toFixed(2)}`}
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
                    <View style={styles.expCatIcon}>
                      <Feather name={cat.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTitle, { color: colors.foreground }]}>{detailExp.title}</Text>
                      <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>
                        Paid by {payer?.name ?? "Former Sweetmate"} · {formatDate(detailExp.date)}
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
                      const person = roommates.find((r) => r.id === personId) ?? {
                        id: personId,
                        name: "Former Sweetmate",
                        color: colors.mutedForeground,
                        points: 0,
                        weeklyPoints: 0,
                      };
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
                          <RoommateAvatar name={person.name} color={person.color} size={32} imageUri={person.avatarUri} />
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
                                  confirm(
                                    "mark_paid",
                                    "Mark as paid back?",
                                    `Confirm that you've paid ${payer?.name ?? "them"} back $${(amount as number).toFixed(2)}?`,
                                    () => {
                                      markPersonPaid(detailExp.id, currentUserId);
                                      hapticSuccess();
                                    },
                                    { confirmText: "Yes, I paid" }
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
                        onPress={() => confirm("settle_expense", "Settle Up", "Mark this entire IOU as settled?", () => {
                          settleExpense(detailExp.id);
                          setDetailExpenseId(null);
                          hapticSuccess();
                        }, { confirmText: "Settle" })}
                      >
                        <Feather name="check-circle" size={14} color={colors.success} />
                        <Text style={[styles.detailActionBtnText, { color: colors.success }]}>Settle all</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.detailActionBtn, { backgroundColor: colors.destructive + "10", borderColor: colors.destructive + "20" }]}
                        onPress={() => confirm("delete_expense", "Delete IOU", "Remove this expense?", () => { deleteExpense(detailExp.id); setDetailExpenseId(null); }, { confirmText: "Delete", destructive: true })}
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

      <FloatingActionButton
        accessibilityLabel="Add expense"
        onPress={() => {
          resetModal();
          setShowExpenseModal(true);
        }}
      />

      {/* ── New IOU Modal (full-screen; custom spring slide-up, X-button close) ── */}
      <Modal visible={showExpenseModal} transparent animationType="none" onRequestClose={closeIou}>
        <Animated.View
          style={[
            styles.iouContainer,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: iouTranslateY }],
            },
          ]}
        >
          {/* Header: title left, X close button right */}
          <View
            {...iouDragHandlers}
            style={[
              styles.iouHeader,
              { paddingTop: insets.top + 10, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border, top: insets.top + 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.iouHeaderTitle, { color: colors.foreground }]}>
                {editingExpenseId ? "Edit IOU" : "New IOU"}
              </Text>
              <Text style={[styles.iouHeaderSub, { color: colors.mutedForeground }]}>
                {editingExpenseId ? "Update the details" : "Log a shared expense"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeIou}
              style={[styles.iouCloseBtn, { backgroundColor: colors.muted }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Body — keyboard-avoiding scroll with sticky footer */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.iouBody}
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
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const selected = expCategory === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected
                              ? colors.primary + "22"
                              : colors.muted,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setExpCategory(cat.key)}
                      >
                        <Feather
                          name={cat.icon}
                          size={12}
                          color={selected ? colors.primary : colors.mutedForeground}
                        />
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
                      onPress={() => setExpPaidBy(r.id)}
                    >
                      <RoommateAvatar
                        name={r.name}
                        color={r.color}
                        size={20}
                        imageUri={r.avatarUri}
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
                    onBlur={() => {
                      if (allocationMode === "equal") recalcEvenSplit();
                    }}
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
                  {roommates.map((r) => {
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
                            imageUri={r.avatarUri}
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
                      {(["daily", "monthly", "custom"] as RecurringInterval[]).map((opt) => {
                        const selected = expRecurring === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.recurringChip,
                              {
                                backgroundColor: selected ? colors.primary + "22" : colors.muted,
                                borderColor: selected ? colors.primary : colors.border,
                                flex: 1,
                              },
                            ]}
                            onPress={() => setExpRecurring(opt)}
                          >
                            <Text
                              style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 13,
                                color: selected ? colors.primary : colors.mutedForeground,
                                textAlign: "center",
                              }}
                            >
                              {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
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
                    {remainingCents !== 0 && totalParsed > 0 && (
                      <Text
                        style={{
                          color:
                            remainingCents > 0
                              ? colors.warning
                              : colors.destructive,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {remainingCents > 0
                          ? `$${centsToDollars(remainingCents).toFixed(2)} left to assign`
                          : `$${centsToDollars(Math.abs(remainingCents)).toFixed(2)} over the expense total`}
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
                        ✓ Fully allocated
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
                            imageUri={person.avatarUri}
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

            </ScrollView>

            {/* Sticky footer with the primary action */}
            <View
              style={[
                styles.iouFooter,
                {
                  backgroundColor: colors.background,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 12) + 4,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.iouSendBtn,
                  { backgroundColor: canSubmit ? colors.primary : colors.muted },
                ]}
                disabled={!canSubmit || submittingIou}
                onPress={handleSendIOU}
              >
                <Feather
                  name="send"
                  size={16}
                  color={canSubmit ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.iouSendBtnText,
                    { color: canSubmit ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {submittingIou ? "Saving…" : editingExpenseId ? "Save Changes" : "Send IOU"}
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
    flexDirection: "row",
    alignItems: "flex-start",
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
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceRow: {
    flexDirection: "column",
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  balanceCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  balanceCardPressable: { flex: 1 },
  balanceCardContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  balanceLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 34, marginTop: 4 },
  balanceHint: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, gap: 12 },
  expenseCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  expenseCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  expCatIcon: {
    width: 20,
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  kvContainer: { justifyContent: "flex-end" },
  // Full-screen variant: KAV fills the screen so the sheet can take the entire viewport.
  kvContainerFull: { flex: 1 },
  iouFullScreen: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
  },
  // Full-screen sheet: no rounded corners (it's the whole page), fills the screen.
  sheetFull: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetTall: { maxHeight: "90%" },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  handleHitArea: {
    paddingTop: 6,
    paddingBottom: 14,
    alignItems: "center",
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
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 10,
    marginHorizontal: 4,
  },
  detailCloseBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 0.3,
  },

  // ── New IOU full-screen modal (custom slide-up + X close) ──
  iouContainer: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  iouHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iouHeaderTitle: { fontFamily: "Inter_700Bold", fontSize: 26 },
  iouHeaderSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  iouCloseBtn: {
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
  iouBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  iouFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iouSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  iouSendBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
});

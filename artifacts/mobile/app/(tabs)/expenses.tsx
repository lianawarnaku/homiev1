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
import { RoommateAvatar } from "@/components/RoommateAvatar";
import {
  type ExpenseCategory,
  useAppContext,
} from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Tab = "expenses" | "shopping";

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
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

  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("groceries");
  const [expPaidBy, setExpPaidBy] = useState(currentUserId);
  const [expSharedWith, setExpSharedWith] = useState<string[]>(
    roommates.map((r) => r.id)
  );

  const [shopName, setShopName] = useState("");
  const [shopQty, setShopQty] = useState("1");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const balances = getBalances();
  const activeExpenses = expenses.filter((e) => !e.settled);

  const toggleSharedWith = (id: string) => {
    setExpSharedWith((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddExpense = () => {
    if (!expTitle.trim() || !expAmount.trim()) return;
    addExpense({
      title: expTitle.trim(),
      amount: parseFloat(expAmount),
      paidBy: expPaidBy,
      sharedWith: expSharedWith,
      date: new Date().toISOString(),
      category: expCategory,
      settled: false,
    });
    setExpTitle("");
    setExpAmount("");
    setExpCategory("groceries");
    setExpPaidBy(currentUserId);
    setExpSharedWith(roommates.map((r) => r.id));
    setShowExpenseModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

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

  const myBalance = balances[currentUserId] ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          onPress={() =>
            tab === "expenses"
              ? setShowExpenseModal(true)
              : setShowShoppingModal(true)
          }
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(["expenses", "shopping"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              {
                borderBottomColor:
                  tab === t ? colors.primary : "transparent",
              },
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: tab === t ? colors.primary : colors.mutedForeground,
                  fontFamily:
                    tab === t ? "Inter_700Bold" : "Inter_400Regular",
                },
              ]}
            >
              {t === "expenses" ? "Expenses" : "Shopping List"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "expenses" ? (
        <>
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: myBalance >= 0 ? colors.success + "12" : colors.destructive + "12", borderColor: myBalance >= 0 ? colors.success + "33" : colors.destructive + "33" },
            ]}
          >
            <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
              Your balance
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                { color: myBalance >= 0 ? colors.success : colors.destructive },
              ]}
            >
              {myBalance >= 0 ? "+" : ""}${Math.abs(myBalance).toFixed(2)}
            </Text>
            <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
              {myBalance > 0
                ? "Others owe you"
                : myBalance < 0
                ? "You owe others"
                : "All settled up"}
            </Text>
          </View>

          <ScrollView
            style={styles.balanceRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
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
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <RoommateAvatar name={r.name} color={r.color} size={30} />
                    <Text style={[styles.miniName, { color: colors.foreground }]}>
                      {r.name}
                    </Text>
                    <Text
                      style={[
                        styles.miniAmount,
                        {
                          color:
                            bal > 0
                              ? colors.success
                              : bal < 0
                              ? colors.destructive
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {bal > 0 ? "owes" : bal < 0 ? "owed" : "even"}
                      {"\n"}${Math.abs(bal).toFixed(0)}
                    </Text>
                  </View>
                );
              })}
          </ScrollView>

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
                title="No shared expenses"
                subtitle="Tap + to log a shared expense"
              />
            }
            renderItem={({ item }) => {
              const paidBy = roommates.find((r) => r.id === item.paidBy);
              const perPerson = item.amount / item.sharedWith.length;
              const cat =
                EXPENSE_CATEGORIES.find((c) => c.key === item.category) ??
                EXPENSE_CATEGORIES[4];
              return (
                <View
                  style={[
                    styles.expenseCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.expCatIcon,
                      { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Feather name={cat.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.expInfo}>
                    <Text
                      style={[styles.expTitle, { color: colors.foreground }]}
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
                      Paid by {paidBy?.name ?? "?"} · {formatDate(item.date)} ·
                      ${perPerson.toFixed(2)}/person
                    </Text>
                  </View>
                  <View style={styles.expRight}>
                    <Text style={[styles.expAmount, { color: colors.foreground }]}>
                      ${item.amount.toFixed(2)}
                    </Text>
                    <View style={styles.expActions}>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert("Settle Expense", "Mark as settled?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Settle",
                              onPress: () => settleExpense(item.id),
                            },
                          ])
                        }
                      >
                        <Feather name="check-circle" size={16} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert("Delete Expense", "Remove this expense?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteExpense(item.id),
                            },
                          ])
                        }
                      >
                        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </>
      ) : (
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

      <Modal visible={showExpenseModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowExpenseModal(false)}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Add Expense
          </Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Title
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="e.g. Groceries"
            placeholderTextColor={colors.mutedForeground}
            value={expTitle}
            onChangeText={setExpTitle}
          />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Amount ($)
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            value={expAmount}
            onChangeText={setExpAmount}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Category
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        expCategory === cat.key
                          ? colors.primary
                          : colors.secondary,
                      borderColor:
                        expCategory === cat.key
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setExpCategory(cat.key)}
                >
                  <Text
                    style={{
                      color:
                        expCategory === cat.key ? "#fff" : colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Paid by
          </Text>
          <View style={styles.roommateRow}>
            {roommates.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.roommateChip,
                  {
                    backgroundColor:
                      expPaidBy === r.id ? r.color + "22" : colors.secondary,
                    borderColor:
                      expPaidBy === r.id ? r.color : colors.border,
                  },
                ]}
                onPress={() => setExpPaidBy(r.id)}
              >
                <Text
                  style={{
                    color: expPaidBy === r.id ? r.color : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor:
                  expTitle.trim() && expAmount.trim()
                    ? colors.primary
                    : colors.muted,
              },
            ]}
            disabled={!expTitle.trim() || !expAmount.trim()}
            onPress={handleAddExpense}
          >
            <Text style={styles.addBtnText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showShoppingModal} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowShoppingModal(false)}
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
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Item Name
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
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
              { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder="e.g. 2 or 1 bag"
            placeholderTextColor={colors.mutedForeground}
            value={shopQty}
            onChangeText={setShopQty}
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              { backgroundColor: shopName.trim() ? colors.primary : colors.muted },
            ]}
            disabled={!shopName.trim()}
            onPress={handleAddShopItem}
          >
            <Text style={styles.addBtnText}>Add to List</Text>
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
    borderBottomColor: "#E5E7EB",
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
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 32, marginTop: 2 },
  balanceHint: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  balanceRow: { marginBottom: 10 },
  miniBalance: {
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    minWidth: 70,
  },
  miniName: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  miniAmount: { fontFamily: "Inter_700Bold", fontSize: 11, textAlign: "center" },
  listContent: { paddingHorizontal: 16, gap: 8 },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  expCatIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  expInfo: { flex: 1 },
  expTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  expMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  expRight: { alignItems: "flex-end", gap: 6 },
  expAmount: { fontFamily: "Inter_700Bold", fontSize: 17 },
  expActions: { flexDirection: "row", gap: 12 },
  shopItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  shopCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shopName: { fontFamily: "Inter_500Medium", fontSize: 15 },
  shopMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    gap: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 12 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  roommateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  roommateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  addBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});

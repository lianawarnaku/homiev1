import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useHousehold } from "./HouseholdContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoommateStatus = "home" | "away" | "asleep" | "unknown";
export type HomeLocation = { latitude: number; longitude: number; radius: number };
export type ChoreCategory = "cleaning" | "kitchen" | "bathroom" | "laundry" | "outdoor" | "other";

export type Roommate = {
  id: string;
  name: string;
  color: string;
  points: number;
  weeklyPoints: number;
};

export type Chore = {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  points: number;
  category: ChoreCategory;
  recurring?: "daily" | "weekly" | "monthly";
};

export type ExpenseCategory = "groceries" | "utilities" | "rent" | "entertainment" | "other";
export type RecurringInterval = "daily" | "monthly" | "custom";

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  sharedWith: string[];
  splits: Record<string, number>;
  date: string;
  category: ExpenseCategory;
  settled: boolean;
  recurring?: RecurringInterval;
  recurringCustom?: string;
  paidBack?: Record<string, boolean>;
};

export type ShoppingList = { id: string; name: string };

export type ShoppingItem = {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  addedBy: string;
  completed: boolean;
  assignedTo?: string;
};

export type BorrowItem = {
  id: string;
  item: string;
  borrowedFrom: string;
  borrowedAt: string;
  dueDate: string;
  returned: boolean;
  returnedAt?: string;
  notes?: string;
};

export type Nudge = { id: string; toRoommateId: string; choreId: string; sentAt: string };

export type AppContextType = {
  currentUserId: string;
  roommates: Roommate[];
  chores: Chore[];
  expenses: Expense[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  borrowItems: BorrowItem[];
  nudges: Nudge[];
  essentialsAssignees: Record<string, Record<string, string>>;
  suppressedAlerts: Record<string, boolean>;
  roommateStatuses: Record<string, RoommateStatus>;
  homeLocation: HomeLocation | null;
  loaded: boolean;
  // Chores
  addChore: (chore: Omit<Chore, "id">) => Promise<void>;
  completeChore: (id: string) => Promise<void>;
  pickUpChore: (id: string) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  // Expenses
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  settleExpense: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  markPersonPaid: (expenseId: string, roommateId: string) => Promise<void>;
  getBalances: () => Record<string, number>;
  // Shopping
  addShoppingList: (list: { name: string }) => Promise<void>;
  deleteShoppingList: (id: string) => Promise<void>;
  addShoppingItem: (item: Omit<ShoppingItem, "id">) => Promise<void>;
  toggleShoppingItem: (id: string) => Promise<void>;
  deleteShoppingItem: (id: string) => Promise<void>;
  assignShoppingItem: (id: string, roommateId: string | null | undefined) => Promise<void>;
  // Borrowing
  addBorrowItem: (item: Omit<BorrowItem, "id">) => Promise<void>;
  returnBorrowItem: (id: string) => Promise<void>;
  deleteBorrowItem: (id: string) => Promise<void>;
  // Misc
  setEssentialAssignee: (section: string, item: string, roommateId: string | null) => void;
  sendNudge: (toRoommateId: string, choreId: string) => void;
  removeNudge: (toRoommateId: string, choreId: string) => void;
  suppressAlert: (alertId: string) => void;
  setRoommateStatus: (roommateId: string, status: RoommateStatus) => void;
  setHomeLocation: (location: HomeLocation) => void;
  getRoommateById: (id: string) => Roommate | undefined;
  getChoresByRoommate: (roommateId: string) => Chore[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PICKUP_BONUS = 25;
const ESSENTIALS_KEY = "homebase_essentials_v1";

const ROOMMATE_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
];

// ── DB row → app type mappers ─────────────────────────────────────────────────

function toRoommate(m: any, index = 0): Roommate {
  return {
    id: m.id,
    name: m.display_name,
    color: m.avatar_color ?? ROOMMATE_COLORS[index % ROOMMATE_COLORS.length],
    points: m.points ?? 0,
    weeklyPoints: m.weekly_points ?? 0,
  };
}

function toChore(c: any): Chore {
  return {
    id: c.id,
    title: c.title,
    assignedTo: c.assigned_to ?? "",
    dueDate: c.due_date,
    completed: c.completed,
    completedAt: c.completed_at ?? undefined,
    points: c.points,
    category: c.category as ChoreCategory,
    recurring: c.recurring ?? undefined,
  };
}

function toExpense(e: any): Expense {
  return {
    id: e.id,
    title: e.title,
    amount: Number(e.amount),
    paidBy: e.paid_by,
    sharedWith: e.shared_with ?? [],
    splits: e.splits ?? {},
    date: e.date,
    category: e.category as ExpenseCategory,
    settled: e.settled,
    recurring: e.recurring ?? undefined,
    recurringCustom: e.recurring_custom ?? undefined,
    paidBack: e.paid_back ?? {},
  };
}

function toShoppingList(l: any): ShoppingList {
  return { id: l.id, name: l.name };
}

function toShoppingItem(i: any): ShoppingItem {
  return {
    id: i.id,
    listId: i.list_id,
    name: i.name,
    quantity: i.quantity,
    addedBy: i.added_by ?? "",
    completed: i.completed,
    assignedTo: i.assigned_to ?? undefined,
  };
}

function toBorrowItem(b: any): BorrowItem {
  return {
    id: b.id,
    item: b.item,
    borrowedFrom: b.borrowed_from ?? "",
    borrowedAt: b.borrowed_at,
    dueDate: b.due_date,
    returned: b.returned,
    returnedAt: b.returned_at ?? undefined,
    notes: b.notes ?? undefined,
  };
}

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { household, myMembership } = useHousehold();
  const currentUserId = myMembership?.id ?? "";

  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [essentialsAssignees, setEssentialsAssigneesState] = useState<Record<string, Record<string, string>>>({});
  const [suppressedAlerts, setSuppressedAlerts] = useState<Record<string, boolean>>({});
  const [roommateStatuses, setRoommateStatusesState] = useState<Record<string, RoommateStatus>>({});
  const [homeLocation, setHomeLocationState] = useState<HomeLocation | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load essentials assignees from local storage (device-local preference)
  useEffect(() => {
    AsyncStorage.getItem(ESSENTIALS_KEY)
      .then((raw) => raw && setEssentialsAssigneesState(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  // Load all Supabase data when household becomes available
  const loadAll = useCallback(async (householdId: string) => {
    setLoaded(false);
    const [members, choresRes, expensesRes, listsRes, itemsRes, borrowsRes] =
      await Promise.all([
        supabase.from("household_members").select("*").eq("household_id", householdId).order("joined_at"),
        supabase.from("chores").select("*").eq("household_id", householdId).order("created_at"),
        supabase.from("expenses").select("*").eq("household_id", householdId).order("created_at"),
        supabase.from("shopping_lists").select("*").eq("household_id", householdId).order("created_at"),
        supabase.from("shopping_items").select("*").eq("household_id", householdId).order("created_at"),
        supabase.from("borrow_items").select("*").eq("household_id", householdId).order("created_at"),
      ]);

    setRoommates((members.data ?? []).map((m, i) => toRoommate(m, i)));
    setChores((choresRes.data ?? []).map(toChore));
    setExpenses((expensesRes.data ?? []).map(toExpense));
    setShoppingLists((listsRes.data ?? []).map(toShoppingList));
    setShoppingItems((itemsRes.data ?? []).map(toShoppingItem));
    setBorrowItems((borrowsRes.data ?? []).map(toBorrowItem));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (household?.id) {
      loadAll(household.id);
    } else {
      setLoaded(false);
    }
  }, [household?.id, loadAll]);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  // One channel per household; each table listener applies minimal state patches
  // so any device's action propagates to all others instantly.

  useEffect(() => {
    if (!household?.id) return;
    const hid = household.id;

    const channel = supabase
      .channel(`household-rt:${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chores", filter: `household_id=eq.${hid}` },
        ({ eventType, new: n, old: o }: any) => {
          if (eventType === "INSERT")
            setChores((p) => p.some((c) => c.id === n.id) ? p : [...p, toChore(n)]);
          else if (eventType === "UPDATE")
            setChores((p) => p.map((c) => c.id === n.id ? toChore(n) : c));
          else if (eventType === "DELETE")
            setChores((p) => p.filter((c) => c.id !== o.id));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${hid}` },
        ({ eventType, new: n, old: o }: any) => {
          if (eventType === "INSERT")
            setExpenses((p) => p.some((e) => e.id === n.id) ? p : [...p, toExpense(n)]);
          else if (eventType === "UPDATE")
            setExpenses((p) => p.map((e) => e.id === n.id ? toExpense(n) : e));
          else if (eventType === "DELETE")
            setExpenses((p) => p.filter((e) => e.id !== o.id));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_lists", filter: `household_id=eq.${hid}` },
        ({ eventType, new: n, old: o }: any) => {
          if (eventType === "INSERT")
            setShoppingLists((p) => p.some((l) => l.id === n.id) ? p : [...p, toShoppingList(n)]);
          else if (eventType === "UPDATE")
            setShoppingLists((p) => p.map((l) => l.id === n.id ? toShoppingList(n) : l));
          else if (eventType === "DELETE")
            setShoppingLists((p) => p.filter((l) => l.id !== o.id));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${hid}` },
        ({ eventType, new: n, old: o }: any) => {
          if (eventType === "INSERT")
            setShoppingItems((p) => p.some((i) => i.id === n.id) ? p : [...p, toShoppingItem(n)]);
          else if (eventType === "UPDATE")
            setShoppingItems((p) => p.map((i) => i.id === n.id ? toShoppingItem(n) : i));
          else if (eventType === "DELETE")
            setShoppingItems((p) => p.filter((i) => i.id !== o.id));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "borrow_items", filter: `household_id=eq.${hid}` },
        ({ eventType, new: n, old: o }: any) => {
          if (eventType === "INSERT")
            setBorrowItems((p) => p.some((b) => b.id === n.id) ? p : [...p, toBorrowItem(n)]);
          else if (eventType === "UPDATE")
            setBorrowItems((p) => p.map((b) => b.id === n.id ? toBorrowItem(n) : b));
          else if (eventType === "DELETE")
            setBorrowItems((p) => p.filter((b) => b.id !== o.id));
        })
      // Points updates from other devices (complete/pick-up chore)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "household_members", filter: `household_id=eq.${hid}` },
        ({ new: n }: any) => {
          setRoommates((p) => p.map((r, i) => r.id === n.id ? toRoommate(n, i) : r));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [household?.id]);

  // ── Chore actions ──────────────────────────────────────────────────────────

  const addChore = useCallback(async (chore: Omit<Chore, "id">) => {
    if (!household) return;
    const id = generateId();
    const optimistic: Chore = { ...chore, id };
    setChores((prev) => [...prev, optimistic]);
    await supabase.from("chores").insert({
      id,
      household_id: household.id,
      title: chore.title,
      assigned_to: chore.assignedTo || null,
      due_date: chore.dueDate,
      completed: false,
      points: chore.points,
      category: chore.category,
      recurring: chore.recurring ?? null,
    });
  }, [household]);

  const completeChore = useCallback(async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore || chore.completed) return;
    const now = new Date().toISOString();
    // Optimistic
    setChores((prev) => prev.map((c) => c.id === choreId ? { ...c, completed: true, completedAt: now } : c));
    setRoommates((prev) => prev.map((r) =>
      r.id === chore.assignedTo
        ? { ...r, points: r.points + chore.points, weeklyPoints: r.weeklyPoints + chore.points }
        : r
    ));
    // Persist
    await supabase.from("chores").update({ completed: true, completed_at: now }).eq("id", choreId);
    const member = roommates.find((r) => r.id === chore.assignedTo);
    if (member) {
      await supabase.from("household_members").update({
        points: member.points + chore.points,
        weekly_points: member.weeklyPoints + chore.points,
      }).eq("id", chore.assignedTo);
    }
  }, [chores, roommates]);

  const pickUpChore = useCallback(async (choreId: string) => {
    const chore = chores.find((c) => c.id === choreId);
    if (!chore || chore.completed) return;
    const earned = chore.points + PICKUP_BONUS;
    const now = new Date().toISOString();
    setChores((prev) => prev.map((c) => c.id === choreId ? { ...c, completed: true, completedAt: now, assignedTo: currentUserId } : c));
    setRoommates((prev) => prev.map((r) =>
      r.id === currentUserId
        ? { ...r, points: r.points + earned, weeklyPoints: r.weeklyPoints + earned }
        : r
    ));
    await supabase.from("chores").update({ completed: true, completed_at: now, assigned_to: currentUserId }).eq("id", choreId);
    const me = roommates.find((r) => r.id === currentUserId);
    if (me) {
      await supabase.from("household_members").update({
        points: me.points + earned,
        weekly_points: me.weeklyPoints + earned,
      }).eq("id", currentUserId);
    }
  }, [chores, roommates, currentUserId]);

  const deleteChore = useCallback(async (choreId: string) => {
    setChores((prev) => prev.filter((c) => c.id !== choreId));
    await supabase.from("chores").delete().eq("id", choreId);
  }, []);

  // ── Expense actions ────────────────────────────────────────────────────────

  const addExpense = useCallback(async (expense: Omit<Expense, "id">) => {
    if (!household) return;
    const id = generateId();
    setExpenses((prev) => [...prev, { ...expense, id }]);
    await supabase.from("expenses").insert({
      id,
      household_id: household.id,
      title: expense.title,
      amount: expense.amount,
      paid_by: expense.paidBy,
      shared_with: expense.sharedWith,
      splits: expense.splits,
      date: expense.date,
      category: expense.category,
      settled: false,
      recurring: expense.recurring ?? null,
      recurring_custom: expense.recurringCustom ?? null,
      paid_back: expense.paidBack ?? {},
    });
  }, [household]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.paidBy !== undefined) dbUpdates.paid_by = updates.paidBy;
    if (updates.sharedWith !== undefined) dbUpdates.shared_with = updates.sharedWith;
    if (updates.splits !== undefined) dbUpdates.splits = updates.splits;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.settled !== undefined) dbUpdates.settled = updates.settled;
    if (updates.recurring !== undefined) dbUpdates.recurring = updates.recurring;
    if (updates.recurringCustom !== undefined) dbUpdates.recurring_custom = updates.recurringCustom;
    if (updates.paidBack !== undefined) dbUpdates.paid_back = updates.paidBack;
    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from("expenses").update(dbUpdates).eq("id", id);
    }
  }, []);

  const settleExpense = useCallback(async (id: string) => {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, settled: true } : e));
    await supabase.from("expenses").update({ settled: true }).eq("id", id);
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("expenses").delete().eq("id", id);
  }, []);

  const markPersonPaid = useCallback(async (expenseId: string, roommateId: string) => {
    setExpenses((prev) => prev.map((e) => {
      if (e.id !== expenseId) return e;
      const paidBack = { ...(e.paidBack ?? {}), [roommateId]: true };
      const allPaid = e.sharedWith.filter((id) => id !== e.paidBy).every((id) => paidBack[id]);
      return { ...e, paidBack, settled: allPaid ? true : e.settled };
    }));
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const paidBack = { ...(expense.paidBack ?? {}), [roommateId]: true };
    const allPaid = expense.sharedWith.filter((id) => id !== expense.paidBy).every((id) => paidBack[id]);
    await supabase.from("expenses").update({ paid_back: paidBack, settled: allPaid }).eq("id", expenseId);
  }, [expenses]);

  const getBalances = useCallback((): Record<string, number> => {
    const balances: Record<string, number> = {};
    roommates.forEach((r) => { balances[r.id] = 0; });
    expenses.filter((e) => !e.settled).forEach((e) => {
      const participants = e.sharedWith.length > 0 ? e.sharedWith : roommates.map((r) => r.id);
      participants.forEach((id) => {
        if (id === e.paidBy) return;
        if (e.paidBack?.[id]) return;
        const share = e.splits[id] ?? e.amount / participants.length;
        balances[e.paidBy] = (balances[e.paidBy] ?? 0) + share;
        balances[id] = (balances[id] ?? 0) - share;
      });
    });
    return balances;
  }, [expenses, roommates]);

  // ── Shopping actions ───────────────────────────────────────────────────────

  const addShoppingList = useCallback(async ({ name }: { name: string }) => {
    if (!household) return;
    const id = generateId();
    setShoppingLists((prev) => [...prev, { id, name }]);
    await supabase.from("shopping_lists").insert({ id, household_id: household.id, name });
  }, [household]);

  const deleteShoppingList = useCallback(async (id: string) => {
    setShoppingLists((prev) => prev.filter((l) => l.id !== id));
    setShoppingItems((prev) => prev.filter((i) => i.listId !== id));
    await supabase.from("shopping_lists").delete().eq("id", id); // cascades to items
  }, []);

  const addShoppingItem = useCallback(async (item: Omit<ShoppingItem, "id">) => {
    if (!household) return;
    const id = generateId();
    setShoppingItems((prev) => [...prev, { ...item, id }]);
    await supabase.from("shopping_items").insert({
      id,
      household_id: household.id,
      list_id: item.listId,
      name: item.name,
      quantity: item.quantity,
      added_by: item.addedBy || null,
      completed: false,
      assigned_to: item.assignedTo ?? null,
    });
  }, [household]);

  const toggleShoppingItem = useCallback(async (id: string) => {
    let next = false;
    setShoppingItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      next = !i.completed;
      return { ...i, completed: next };
    }));
    await supabase.from("shopping_items").update({ completed: next }).eq("id", id);
  }, []);

  const deleteShoppingItem = useCallback(async (id: string) => {
    setShoppingItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("shopping_items").delete().eq("id", id);
  }, []);

  const assignShoppingItem = useCallback(async (id: string, roommateId: string | null | undefined) => {
    const normalized = roommateId ?? undefined; // treat null (unassign) as undefined in state
    setShoppingItems((prev) => prev.map((i) => i.id === id ? { ...i, assignedTo: normalized } : i));
    await supabase.from("shopping_items").update({ assigned_to: roommateId ?? null }).eq("id", id);
  }, []);

  // ── Borrow actions ─────────────────────────────────────────────────────────

  const addBorrowItem = useCallback(async (item: Omit<BorrowItem, "id">) => {
    if (!household) return;
    const id = generateId();
    setBorrowItems((prev) => [...prev, { ...item, id }]);
    await supabase.from("borrow_items").insert({
      id,
      household_id: household.id,
      item: item.item,
      borrowed_from: item.borrowedFrom || null,
      borrowed_at: item.borrowedAt,
      due_date: item.dueDate,
      returned: false,
      notes: item.notes ?? null,
      created_by: currentUserId || null,
    });
  }, [household, currentUserId]);

  const returnBorrowItem = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setBorrowItems((prev) => prev.map((b) => b.id === id ? { ...b, returned: true, returnedAt: now } : b));
    await supabase.from("borrow_items").update({ returned: true, returned_at: now }).eq("id", id);
  }, []);

  const deleteBorrowItem = useCallback(async (id: string) => {
    setBorrowItems((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("borrow_items").delete().eq("id", id);
  }, []);

  // ── Misc ───────────────────────────────────────────────────────────────────

  const setEssentialAssignee = useCallback((section: string, item: string, roommateId: string | null) => {
    setEssentialsAssigneesState((prev) => {
      const sectionMap = { ...(prev[section] ?? {}) };
      if (roommateId === null) {
        delete sectionMap[item]; // null = unassign
      } else {
        sectionMap[item] = roommateId;
      }
      const next = { ...prev, [section]: sectionMap };
      AsyncStorage.setItem(ESSENTIALS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const sendNudge = useCallback((toRoommateId: string, choreId: string) => {
    setNudges((prev) => [
      ...prev,
      { id: generateId(), toRoommateId, choreId, sentAt: new Date().toISOString() },
    ]);
  }, []);

  const removeNudge = useCallback((toRoommateId: string, choreId: string) => {
    setNudges((prev) => prev.filter((n) => !(n.toRoommateId === toRoommateId && n.choreId === choreId)));
  }, []);

  const suppressAlert = useCallback((alertId: string) => {
    setSuppressedAlerts((prev) => ({ ...prev, [alertId]: true }));
  }, []);

  const setRoommateStatus = useCallback((roommateId: string, status: RoommateStatus) => {
    setRoommateStatusesState((prev) => ({ ...prev, [roommateId]: status }));
  }, []);

  const setHomeLocation = useCallback((location: HomeLocation) => {
    setHomeLocationState(location);
  }, []);

  const getRoommateById = useCallback((id: string) => roommates.find((r) => r.id === id), [roommates]);

  const getChoresByRoommate = useCallback((roommateId: string) =>
    chores.filter((c) => c.assignedTo === roommateId), [chores]);

  return (
    <AppContext.Provider
      value={{
        currentUserId,
        roommates,
        chores,
        expenses,
        shoppingLists,
        shoppingItems,
        borrowItems,
        nudges,
        essentialsAssignees,
        suppressedAlerts,
        roommateStatuses,
        homeLocation,
        loaded,
        addChore,
        completeChore,
        pickUpChore,
        deleteChore,
        addExpense,
        updateExpense,
        settleExpense,
        deleteExpense,
        markPersonPaid,
        getBalances,
        addShoppingList,
        deleteShoppingList,
        addShoppingItem,
        toggleShoppingItem,
        deleteShoppingItem,
        assignShoppingItem,
        addBorrowItem,
        returnBorrowItem,
        deleteBorrowItem,
        setEssentialAssignee,
        sendNudge,
        removeNudge,
        suppressAlert,
        setRoommateStatus,
        setHomeLocation,
        getRoommateById,
        getChoresByRoommate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
// Alias used throughout tab screens
export const useAppContext = useApp;

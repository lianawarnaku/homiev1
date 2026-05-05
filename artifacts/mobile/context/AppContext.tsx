import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ChoreCategory =
  | "cleaning"
  | "kitchen"
  | "bathroom"
  | "laundry"
  | "outdoor"
  | "other";

export interface Roommate {
  id: string;
  name: string;
  color: string;
  points: number;
  weeklyPoints: number;
}

export interface Chore {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  points: number;
  category: ChoreCategory;
  recurring?: "daily" | "weekly" | "monthly";
}

export type ExpenseCategory =
  | "groceries"
  | "utilities"
  | "rent"
  | "entertainment"
  | "other";

export type RecurringInterval = "daily" | "monthly" | "custom";

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  sharedWith: string[];
  splits: Record<string, number>; // person id → amount they owe payer
  date: string;
  category: ExpenseCategory;
  settled: boolean;
  recurring?: RecurringInterval;
  recurringCustom?: string;
  paidBack?: Record<string, boolean>; // person id → true if they've paid back
}

export interface ShoppingList {
  id: string;
  name: string;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  addedBy: string;
  completed: boolean;
}

export interface BorrowItem {
  id: string;
  item: string;
  borrowedFrom: string;
  borrowedAt: string;
  dueDate: string;
  returned: boolean;
  returnedAt?: string;
  notes?: string;
}

export interface Nudge {
  id: string;
  toRoommateId: string;
  choreId: string;
  sentAt: string;
}

interface AppContextType {
  currentUserId: string;
  roommates: Roommate[];
  chores: Chore[];
  expenses: Expense[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  borrowItems: BorrowItem[];
  nudges: Nudge[];
  addChore: (chore: Omit<Chore, "id">) => void;
  completeChore: (id: string) => void;
  pickUpChore: (choreId: string, completedById: string) => void;
  deleteChore: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, updates: Partial<Omit<Expense, "id">>) => void;
  settleExpense: (id: string) => void;
  deleteExpense: (id: string) => void;
  markPersonPaid: (expenseId: string, personId: string) => void;
  addShoppingList: (name: string) => void;
  deleteShoppingList: (id: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id">) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  addBorrowItem: (item: Omit<BorrowItem, "id">) => void;
  returnBorrowItem: (id: string) => void;
  deleteBorrowItem: (id: string) => void;
  sendNudge: (toRoommateId: string, choreId: string) => void;
  removeNudge: (toRoommateId: string, choreId: string) => void;
  getRoommateById: (id: string) => Roommate | undefined;
  getChoresByRoommate: (id: string) => Chore[];
  getBalances: () => Record<string, number>;
  essentialsAssignees: Record<string, Record<string, string>>;
  setEssentialAssignee: (sectionKey: string, item: string, roommateId: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const CURRENT_USER_ID = "current";

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

const INITIAL_ROOMMATES: Roommate[] = [
  {
    id: "current",
    name: "Liana",
    color: "#4F7FF7",
    points: 450,
    weeklyPoints: 85,
  },
  {
    id: "2",
    name: "Roha",
    color: "#22C55E",
    points: 320,
    weeklyPoints: 60,
  },
  { id: "3", name: "Safa", color: "#F97316", points: 280, weeklyPoints: 45 },
  { id: "4", name: "Akshaya", color: "#8B5CF6", points: 190, weeklyPoints: 30 },
  { id: "5", name: "Sumaiya", color: "#EC4899", points: 240, weeklyPoints: 50 },
  { id: "6", name: "Esha", color: "#14B8A6", points: 310, weeklyPoints: 70 },
];

const INITIAL_CHORES: Chore[] = [
  {
    id: "c1",
    title: "Clean bathroom",
    assignedTo: "current",
    dueDate: daysFromNow(0),
    completed: false,
    points: 25,
    category: "bathroom",
  },
  {
    id: "c2",
    title: "Vacuum living room",
    assignedTo: "current",
    dueDate: daysFromNow(1),
    completed: false,
    points: 20,
    category: "cleaning",
  },
  {
    id: "c3",
    title: "Take out trash",
    assignedTo: "current",
    dueDate: daysFromNow(-1),
    completed: false,
    points: 10,
    category: "other",
  },
  {
    id: "c4",
    title: "Wash dishes",
    assignedTo: "current",
    dueDate: daysFromNow(3),
    completed: true,
    points: 15,
    category: "kitchen",
    completedAt: new Date().toISOString(),
  },
  {
    id: "c5",
    title: "Do laundry",
    assignedTo: "2",
    dueDate: daysFromNow(0),
    completed: false,
    points: 20,
    category: "laundry",
  },
  {
    id: "c6",
    title: "Clean kitchen counters",
    assignedTo: "2",
    dueDate: daysFromNow(1),
    completed: true,
    points: 25,
    category: "kitchen",
    completedAt: new Date().toISOString(),
  },
  {
    id: "c7",
    title: "Mop floors",
    assignedTo: "3",
    dueDate: daysFromNow(-1),
    completed: false,
    points: 20,
    category: "cleaning",
  },
  {
    id: "c8",
    title: "Clean shower",
    assignedTo: "4",
    dueDate: daysFromNow(4),
    completed: false,
    points: 25,
    category: "bathroom",
  },
  {
    id: "c9",
    title: "Take out recycling",
    assignedTo: "4",
    dueDate: daysFromNow(0),
    completed: true,
    points: 10,
    category: "other",
    completedAt: new Date().toISOString(),
  },
  {
    id: "c10",
    title: "Wipe down appliances",
    assignedTo: "5",
    dueDate: daysFromNow(2),
    completed: false,
    points: 15,
    category: "kitchen",
  },
  {
    id: "c11",
    title: "Sweep entryway",
    assignedTo: "5",
    dueDate: daysFromNow(-1),
    completed: true,
    points: 10,
    category: "cleaning",
    completedAt: new Date().toISOString(),
  },
  {
    id: "c12",
    title: "Replace trash bags",
    assignedTo: "6",
    dueDate: daysFromNow(1),
    completed: false,
    points: 10,
    category: "other",
  },
  {
    id: "c13",
    title: "Clean fridge",
    assignedTo: "6",
    dueDate: daysFromNow(3),
    completed: false,
    points: 20,
    category: "kitchen",
  },
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: "e1",
    title: "Monthly groceries",
    amount: 300,
    paidBy: "current",
    sharedWith: ["2", "3", "4", "5", "6"],
    splits: { "2": 50, "3": 50, "4": 50, "5": 50, "6": 50 },
    date: daysFromNow(-3),
    category: "groceries",
    settled: false,
  },
  {
    id: "e2",
    title: "Internet bill",
    amount: 90,
    paidBy: "2",
    sharedWith: ["current", "3", "4", "5", "6"],
    splits: { current: 15, "3": 15, "4": 15, "5": 15, "6": 15 },
    date: daysFromNow(-10),
    category: "utilities",
    settled: false,
  },
  {
    id: "e3",
    title: "Cleaning supplies",
    amount: 60,
    paidBy: "3",
    sharedWith: ["current", "2", "4", "5", "6"],
    splits: { current: 10, "2": 10, "4": 10, "5": 10, "6": 10 },
    date: daysFromNow(-7),
    category: "other",
    settled: false,
  },
];

const INITIAL_SHOPPING_LISTS: ShoppingList[] = [
  { id: "list1", name: "Groceries" },
  { id: "list2", name: "Household" },
];

const INITIAL_SHOPPING: ShoppingItem[] = [
  { id: "s1", listId: "list1", name: "Coffee beans", quantity: "1 bag", addedBy: "current", completed: false },
  { id: "s2", listId: "list1", name: "Milk", quantity: "2L", addedBy: "2", completed: true },
  { id: "s3", listId: "list1", name: "Greek yogurt", quantity: "2", addedBy: "5", completed: false },
  { id: "s4", listId: "list2", name: "Dish soap", quantity: "2 bottles", addedBy: "current", completed: false },
  { id: "s5", listId: "list2", name: "Paper towels", quantity: "1 pack", addedBy: "2", completed: false },
  { id: "s6", listId: "list2", name: "Trash bags", quantity: "1 box", addedBy: "3", completed: false },
];

const INITIAL_BORROWS: BorrowItem[] = [
  {
    id: "b1",
    item: "Phone charger",
    borrowedFrom: "2",
    borrowedAt: daysFromNow(-5),
    dueDate: daysFromNow(-1),
    returned: false,
    notes: "USB-C",
  },
  {
    id: "b2",
    item: "Umbrella",
    borrowedFrom: "3",
    borrowedAt: daysFromNow(-2),
    dueDate: daysFromNow(3),
    returned: false,
  },
];

const STORAGE_KEY = "homebase_data_v7";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [roommates, setRoommates] = useState<Roommate[]>(INITIAL_ROOMMATES);
  const [chores, setChores] = useState<Chore[]>(INITIAL_CHORES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>(INITIAL_SHOPPING_LISTS);
  const [shoppingItems, setShoppingItems] =
    useState<ShoppingItem[]>(INITIAL_SHOPPING);
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>(INITIAL_BORROWS);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [essentialsAssignees, setEssentialsAssignees] = useState<Record<string, Record<string, string>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.roommates) setRoommates(data.roommates);
          if (data.chores) setChores(data.chores);
          if (data.expenses) setExpenses(data.expenses);
          if (data.shoppingLists) setShoppingLists(data.shoppingLists);
          if (data.shoppingItems) setShoppingItems(data.shoppingItems);
          if (data.borrowItems) setBorrowItems(data.borrowItems);
          if (data.nudges) setNudges(data.nudges);
          if (data.essentialsAssignees) setEssentialsAssignees(data.essentialsAssignees);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ roommates, chores, expenses, shoppingLists, shoppingItems, borrowItems, nudges, essentialsAssignees })
    );
  }, [loaded, roommates, chores, expenses, shoppingLists, shoppingItems, borrowItems, nudges, essentialsAssignees]);

  const addChore = useCallback((chore: Omit<Chore, "id">) => {
    setChores((prev) => [...prev, { ...chore, id: makeId() }]);
  }, []);

  const completeChore = useCallback((id: string) => {
    setChores((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, completed: true, completedAt: new Date().toISOString() }
          : c
      )
    );
    setRoommates((prev) =>
      prev.map((r) => {
        const chore = chores.find((c) => c.id === id);
        if (chore && r.id === chore.assignedTo) {
          return {
            ...r,
            points: r.points + chore.points,
            weeklyPoints: r.weeklyPoints + chore.points,
          };
        }
        return r;
      })
    );
  }, [chores]);

  const PICKUP_BONUS = 25;

  const pickUpChore = useCallback((choreId: string, completedById: string) => {
    setChores((prev) =>
      prev.map((c) =>
        c.id === choreId
          ? { ...c, completed: true, completedAt: new Date().toISOString() }
          : c
      )
    );
    setRoommates((prev) =>
      prev.map((r) => {
        if (r.id === completedById) {
          const chore = chores.find((c) => c.id === choreId);
          const earned = (chore?.points ?? 0) + PICKUP_BONUS;
          return {
            ...r,
            points: r.points + earned,
            weeklyPoints: r.weeklyPoints + earned,
          };
        }
        return r;
      })
    );
  }, [chores]);

  const deleteChore = useCallback((id: string) => {
    setChores((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    setExpenses((prev) => [...prev, { ...expense, id: makeId() }]);
  }, []);

  const updateExpense = useCallback(
    (id: string, updates: Partial<Omit<Expense, "id">>) => {
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const settleExpense = useCallback((id: string) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, settled: true } : e))
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const markPersonPaid = useCallback((expenseId: string, personId: string) => {
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id !== expenseId) return e;
        const paidBack = { ...(e.paidBack ?? {}), [personId]: true };
        const allPaid = Object.keys(e.splits ?? {}).every(
          (id) => id === e.paidBy || paidBack[id]
        );
        return { ...e, paidBack, settled: allPaid ? true : e.settled };
      })
    );
  }, []);

  const addShoppingList = useCallback((name: string) => {
    setShoppingLists((prev) => [...prev, { id: makeId(), name }]);
  }, []);

  const deleteShoppingList = useCallback((id: string) => {
    setShoppingLists((prev) => prev.filter((l) => l.id !== id));
    setShoppingItems((prev) => prev.filter((s) => s.listId !== id));
  }, []);

  const addShoppingItem = useCallback((item: Omit<ShoppingItem, "id">) => {
    setShoppingItems((prev) => [...prev, { ...item, id: makeId() }]);
  }, []);

  const toggleShoppingItem = useCallback((id: string) => {
    setShoppingItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  }, []);

  const deleteShoppingItem = useCallback((id: string) => {
    setShoppingItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addBorrowItem = useCallback((item: Omit<BorrowItem, "id">) => {
    setBorrowItems((prev) => [...prev, { ...item, id: makeId() }]);
  }, []);

  const returnBorrowItem = useCallback((id: string) => {
    setBorrowItems((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, returned: true, returnedAt: new Date().toISOString() }
          : b
      )
    );
  }, []);

  const deleteBorrowItem = useCallback((id: string) => {
    setBorrowItems((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const setEssentialAssignee = useCallback((sectionKey: string, item: string, roommateId: string | null) => {
    setEssentialsAssignees((prev) => {
      const section = { ...(prev[sectionKey] ?? {}) };
      if (roommateId === null) {
        delete section[item];
      } else {
        section[item] = roommateId;
      }
      return { ...prev, [sectionKey]: section };
    });
  }, []);

  const sendNudge = useCallback((toRoommateId: string, choreId: string) => {
    setNudges((prev) => [
      ...prev,
      { id: makeId(), toRoommateId, choreId, sentAt: new Date().toISOString() },
    ]);
  }, []);

  const removeNudge = useCallback((toRoommateId: string, choreId: string) => {
    setNudges((prev) =>
      prev.filter((n) => !(n.toRoommateId === toRoommateId && n.choreId === choreId))
    );
  }, []);

  const getRoommateById = useCallback(
    (id: string) => roommates.find((r) => r.id === id),
    [roommates]
  );

  const getChoresByRoommate = useCallback(
    (id: string) => chores.filter((c) => c.assignedTo === id),
    [chores]
  );

  const getBalances = useCallback((): Record<string, number> => {
    const balances: Record<string, number> = {};
    roommates.forEach((r) => (balances[r.id] = 0));
    expenses
      .filter((e) => !e.settled)
      .forEach((e) => {
        Object.entries(e.splits ?? {}).forEach(([personId, amount]) => {
          if (personId !== e.paidBy) {
            balances[personId] = (balances[personId] ?? 0) - amount;
            balances[e.paidBy] = (balances[e.paidBy] ?? 0) + amount;
          }
        });
      });
    return balances;
  }, [expenses, roommates]);

  return (
    <AppContext.Provider
      value={{
        currentUserId: CURRENT_USER_ID,
        roommates,
        chores,
        expenses,
        shoppingLists,
        shoppingItems,
        borrowItems,
        nudges,
        addChore,
        completeChore,
        pickUpChore,
        deleteChore,
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
        addBorrowItem,
        returnBorrowItem,
        deleteBorrowItem,
        sendNudge,
        removeNudge,
        getRoommateById,
        getChoresByRoommate,
        getBalances,
        essentialsAssignees,
        setEssentialAssignee,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

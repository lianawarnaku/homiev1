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

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  sharedWith: string[];
  date: string;
  category: ExpenseCategory;
  settled: boolean;
}

export interface ShoppingItem {
  id: string;
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
  shoppingItems: ShoppingItem[];
  borrowItems: BorrowItem[];
  nudges: Nudge[];
  addChore: (chore: Omit<Chore, "id">) => void;
  completeChore: (id: string) => void;
  deleteChore: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  settleExpense: (id: string) => void;
  deleteExpense: (id: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id">) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  addBorrowItem: (item: Omit<BorrowItem, "id">) => void;
  returnBorrowItem: (id: string) => void;
  deleteBorrowItem: (id: string) => void;
  sendNudge: (toRoommateId: string, choreId: string) => void;
  getRoommateById: (id: string) => Roommate | undefined;
  getChoresByRoommate: (id: string) => Chore[];
  getBalances: () => Record<string, number>;
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
    name: "Alex",
    color: "#4F7FF7",
    points: 450,
    weeklyPoints: 85,
  },
  {
    id: "2",
    name: "Jordan",
    color: "#22C55E",
    points: 320,
    weeklyPoints: 60,
  },
  { id: "3", name: "Sam", color: "#F97316", points: 280, weeklyPoints: 45 },
  { id: "4", name: "Riley", color: "#8B5CF6", points: 190, weeklyPoints: 30 },
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
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: "e1",
    title: "Monthly groceries",
    amount: 240,
    paidBy: "current",
    sharedWith: ["current", "2", "3", "4"],
    date: daysFromNow(-3),
    category: "groceries",
    settled: false,
  },
  {
    id: "e2",
    title: "Internet bill",
    amount: 80,
    paidBy: "2",
    sharedWith: ["current", "2", "3", "4"],
    date: daysFromNow(-10),
    category: "utilities",
    settled: false,
  },
  {
    id: "e3",
    title: "Cleaning supplies",
    amount: 45,
    paidBy: "3",
    sharedWith: ["current", "2", "3", "4"],
    date: daysFromNow(-7),
    category: "other",
    settled: false,
  },
];

const INITIAL_SHOPPING: ShoppingItem[] = [
  {
    id: "s1",
    name: "Dish soap",
    quantity: "2",
    addedBy: "current",
    completed: false,
  },
  {
    id: "s2",
    name: "Paper towels",
    quantity: "1 pack",
    addedBy: "2",
    completed: false,
  },
  {
    id: "s3",
    name: "Coffee beans",
    quantity: "1 bag",
    addedBy: "current",
    completed: false,
  },
  {
    id: "s4",
    name: "Trash bags",
    quantity: "1 box",
    addedBy: "3",
    completed: false,
  },
  {
    id: "s5",
    name: "Milk",
    quantity: "2L",
    addedBy: "2",
    completed: true,
  },
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

const STORAGE_KEY = "homebase_data_v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [roommates, setRoommates] = useState<Roommate[]>(INITIAL_ROOMMATES);
  const [chores, setChores] = useState<Chore[]>(INITIAL_CHORES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [shoppingItems, setShoppingItems] =
    useState<ShoppingItem[]>(INITIAL_SHOPPING);
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>(INITIAL_BORROWS);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.roommates) setRoommates(data.roommates);
          if (data.chores) setChores(data.chores);
          if (data.expenses) setExpenses(data.expenses);
          if (data.shoppingItems) setShoppingItems(data.shoppingItems);
          if (data.borrowItems) setBorrowItems(data.borrowItems);
          if (data.nudges) setNudges(data.nudges);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ roommates, chores, expenses, shoppingItems, borrowItems, nudges })
    );
  }, [loaded, roommates, chores, expenses, shoppingItems, borrowItems, nudges]);

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

  const deleteChore = useCallback((id: string) => {
    setChores((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    setExpenses((prev) => [...prev, { ...expense, id: makeId() }]);
  }, []);

  const settleExpense = useCallback((id: string) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, settled: true } : e))
    );
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
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

  const sendNudge = useCallback((toRoommateId: string, choreId: string) => {
    setNudges((prev) => [
      ...prev,
      { id: makeId(), toRoommateId, choreId, sentAt: new Date().toISOString() },
    ]);
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
        const perPerson = e.amount / e.sharedWith.length;
        e.sharedWith.forEach((id) => {
          if (id !== e.paidBy) {
            balances[id] = (balances[id] ?? 0) - perPerson;
            balances[e.paidBy] = (balances[e.paidBy] ?? 0) + perPerson;
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
        shoppingItems,
        borrowItems,
        nudges,
        addChore,
        completeChore,
        deleteChore,
        addExpense,
        settleExpense,
        deleteExpense,
        addShoppingItem,
        toggleShoppingItem,
        deleteShoppingItem,
        addBorrowItem,
        returnBorrowItem,
        deleteBorrowItem,
        sendNudge,
        getRoommateById,
        getChoresByRoommate,
        getBalances,
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

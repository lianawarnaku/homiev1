import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState, InteractionManager } from "react-native";

import { supabase } from "@/lib/supabase";
import {
  normalizeColorScheme,
  type ColorScheme,
} from "@/constants/themeTokens";
import type { ItemCategory } from "@/constants/itemDifficulty";
import type { Difficulty } from "@/lib/itemDifficulty";
import { reportSupabaseError, reportRuntimeError } from "@/lib/runtimeDiagnostics";
import { findAssignedLoadDeviations } from "@/lib/chartLoadBalance";

export type RoommateStatus = "home" | "away" | "asleep" | "unknown";

export interface HomeLocation {
  latitude: number;
  longitude: number;
  radius: number; // meters
}

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
  role?: "owner" | "member";
  points: number;
  weeklyPoints: number;
  avatarUri?: string;
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
  sourceKey?: string;
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
  assignedTo?: string;
  pinned?: boolean;
  // NOTE: no `order` field — the array position in `shoppingLists` IS the
  // display order. Mutators below preserve the invariant "pinned lists first,
  // then unpinned lists" so consumers can render `shoppingLists` directly.
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  addedBy: string;
  completed: boolean;
  // Optional per-item owners + price used when converting the list into an IOU.
  // If set, the roommates in `assignedTo` split `price` evenly for this item.
  // Legacy: earlier versions stored `assignedTo` as a plain string; readers
  // should coerce via `normalizeAssignees()` in shopping.tsx.
  assignedTo?: string[] | string;
  price?: number;
  convertedExpenseId?: string;
}

// Pre-filled expense builder state — Shopping tab pushes one of these when the
// user turns a list into an IOU; the Expenses tab consumes it on next mount to
// pop the IOU builder pre-populated, then clears it.
export interface PendingIouDraft {
  title: string;
  category: ExpenseCategory;
  paidBy: string;
  totalAmount: string;
  participants: string[];
  splits: Record<string, string>;
  source?: { type: "shopping-item" | "shopping-list"; itemIds: string[] };
}

export interface BorrowItem {
  id: string;
  item: string;
  borrowedBy?: string;
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
  seen: boolean;
}

export type ChoreAssignment = Record<string, string>;

export interface ChoreSlot {
  key: string;
  label: string;
  category?: ChoreCategory;
}

export interface ChoreChartData {
  slots?: ChoreSlot[];
  weeks: { week: number; assignments: ChoreAssignment }[];
  fairness_note?: string;
}

export type HousingType = "traditional" | "suite" | "apartment";

export interface HomeProfile {
  housingType: HousingType;
  items: string[];
  additionalChores: string[];
  roomCounts?: Partial<Record<"kitchen" | "bathroom" | "living" | "bedroom" | "other", number>>;
}

export interface GeneratedTask {
  id: string;
  itemCategory: ItemCategory;
  item: string;
  title: string;
  frequency: "daily" | "everyOtherDay" | "weekly" | "biweekly" | "monthly";
  timeOfDay: "morning" | "night" | "any";
  keepTogetherGroup?: string;
  difficulty: Difficulty;
}

export interface CustomTask {
  id: string;
  item: string;
  title: string;
  frequency: GeneratedTask["frequency"];
  timeOfDay: GeneratedTask["timeOfDay"];
  difficulty: Difficulty;
  keepTogetherGroup?: string;
}

export interface MemberPreference {
  id?: string;
  householdId: string;
  memberId: string;
  key: string;
  value: number;
}

export interface Assignment {
  memberId: string;
  taskIds: string[];
  totalLoad: number;
}

export interface MemberLoad {
  memberId: string;
  totalLoad: number;
}

export interface ProposedChart {
  id: string;
  householdId: string;
  createdBy: string;
  status: "pending" | "approved" | "cancelled";
  payload: {
    assignments: Assignment[];
    memberLoads?: MemberLoad[];
    generatedTasks?: GeneratedTask[];
    customTasks?: CustomTask[];
  };
  createdAt: string;
}

export interface ChartApproval {
  id: string;
  proposedChartId: string;
  memberId: string;
  approved: boolean;
  approvedAt: string;
}

export interface AppAlert {
  id: string;
  type: "difficulty-imbalance" | "overdue-chore" | "expense" | "borrowing" | "membership" | "planner" | "general";
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  deduplicationKey: string;
  severity: "info" | "attention" | "important";
}

export interface ItemDifficulty {
  id?: string;
  householdId: string;
  category: ItemCategory;
  item: string;
  difficulty: Difficulty;
}

interface AppContextType {
  itemDifficulties: ItemDifficulty[];
  setItemDifficulty: (category: ItemCategory, item: string, difficulty: Difficulty) => Promise<void>;
  resetItemDifficulties: () => Promise<void>;
  memberPreferences: MemberPreference[];
  setMemberPreference: (key: string, value: number) => Promise<void>;
  currentProposedChart: ProposedChart | null;
  setCurrentProposedChart: (chart: ProposedChart | null) => Promise<void>;
  liveChart: Assignment[] | null;
  setLiveChart: (assignments: Assignment[] | null) => void;
  customTasks: CustomTask[];
  addCustomTask: (task: Omit<CustomTask, "id">) => void;
  deleteCustomTask: (id: string) => void;
  chartApprovals: ChartApproval[];
  proposeChart: (payload: ProposedChart["payload"]) => Promise<void>;
  approveProposedChart: () => Promise<void>;
  forceApproveProposedChart: () => Promise<void>;
  restartChartProcess: () => Promise<void>;
  isHost: boolean;
  preferencesLoaded: boolean;
  preferencesOnboardingPending: boolean;
  finishPreferencesOnboarding: () => Promise<void>;
  quickGuideOpen: boolean;
  openQuickGuide: () => void;
  dismissQuickGuide: () => void;
  appAlerts: AppAlert[];
  markAlertRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
  householdComplete: boolean;
  setHouseholdComplete: (complete: boolean) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  pointsEnabled: boolean;
  setPointsEnabled: (enabled: boolean) => void;
  plantEnabled: boolean;
  setPlantEnabled: (enabled: boolean) => void;
  householdId: string | null;
  householdName: string | null;
  inviteCode: string | null;
  householdLoading: boolean;
  membersLoading: boolean;
  currentMemberRole: "owner" | "member";
  refreshMembers: () => Promise<void>;
  refreshHousehold: () => void;
  createHousehold: (householdName: string, displayName: string, color: string, inviteCode: string) => Promise<void>;
  joinHousehold: (inviteCode: string, displayName: string, color: string) => Promise<void>;
  deleteHousehold: () => Promise<void>;
  removeRoommate: (roommateId: string) => Promise<void>;
  deleteOwnAccount: () => Promise<void>;
  currentUserId: string;
  setCurrentUser: (id: string) => void;
  roommates: Roommate[];
  chores: Chore[];
  expenses: Expense[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  borrowItems: BorrowItem[];
  nudges: Nudge[];
  addChore: (chore: Omit<Chore, "id">) => void;
  addChores: (chores: Omit<Chore, "id">[]) => number;
  completeChore: (id: string) => void;
  pickUpChore: (choreId: string, completedById: string) => void;
  deleteChore: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => string;
  updateExpense: (id: string, updates: Partial<Omit<Expense, "id">>) => void;
  settleExpense: (id: string) => void;
  deleteExpense: (id: string) => void;
  markPersonPaid: (expenseId: string, personId: string) => void;
  addShoppingList: (name: string) => void;
  reorderShoppingLists: (newIds: string[]) => void;
  pinShoppingList: (id: string, pinned: boolean) => void;
  deleteShoppingList: (id: string) => void;
  addShoppingItem: (item: Omit<ShoppingItem, "id">) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  reorderShoppingItems: (listId: string, newIds: string[]) => void;
  assignShoppingList: (id: string, roommateId: string | null) => void;
  assignShoppingItem: (id: string, roommateIds: string[]) => void;
  updateShoppingItemPrice: (id: string, price: number | null) => void;
  linkShoppingItemsToExpense: (itemIds: string[], expenseId: string) => void;
  pendingIouDraft: PendingIouDraft | null;
  setPendingIouDraft: (draft: PendingIouDraft | null) => void;
  addBorrowItem: (item: Omit<BorrowItem, "id">) => void;
  updateBorrowItem: (id: string, updates: Partial<Omit<BorrowItem, "id">>) => void;
  returnBorrowItem: (id: string) => void;
  deleteBorrowItem: (id: string) => void;
  sendNudge: (toRoommateId: string, choreId: string) => Promise<void>;
  removeNudge: (toRoommateId: string, choreId: string) => Promise<void>;
  acknowledgeNudge: (nudgeId: string) => Promise<void>;
  getRoommateById: (id: string) => Roommate | undefined;
  updateRoommate: (id: string, patch: Partial<Pick<Roommate, "name" | "color" | "avatarUri">>) => Promise<void>;
  getChoresByRoommate: (id: string) => Chore[];
  getBalances: () => Record<string, number>;
  essentialsAssignees: Record<string, Record<string, string>>;
  setEssentialAssignee: (sectionKey: string, item: string, roommateId: string | null) => void;
  suppressedAlerts: Record<string, boolean>;
  suppressAlert: (id: string) => void;
  roommateStatuses: Record<string, RoommateStatus>;
  setRoommateStatus: (id: string, status: RoommateStatus) => void;
  sleepStartedAt: Record<string, number>;
  homeLocation: HomeLocation | null;
  setHomeLocation: (loc: HomeLocation | null) => void;
  choreChart: ChoreChartData | null;
  choreChartStartedAt: string | null;
  setChoreChart: (data: ChoreChartData | null, startedAt: string | null) => void;
  homeProfile: HomeProfile | null;
  setHomeProfile: (profile: HomeProfile | null) => void;
}

const ASLEEP_AUTO_REVERT_MS = 9 * 60 * 60 * 1000;

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppContextStore {
  getSnapshot: () => AppContextType;
  setSnapshot: (value: AppContextType) => void;
  subscribe: (listener: () => void) => () => void;
}

const AppContextStoreContext = createContext<AppContextStore | undefined>(
  undefined,
);

function createAppContextStore(initialValue: AppContextType): AppContextStore {
  let snapshot = initialValue;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    setSnapshot: (value) => {
      if (Object.is(snapshot, value)) return;
      snapshot = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function shallowEqualSelection<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true;
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    Array.isArray(left) ||
    Array.isArray(right)
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  if (keys.length !== Object.keys(rightRecord).length) return false;
  return keys.every((key) => Object.is(leftRecord[key], rightRecord[key]));
}

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

const STORAGE_KEY = "homebase_data_v7";
const PREFERENCES_KEY = "homie_user_preferences_v1";
const QUICK_GUIDE_VERSION = 2;
interface SharedHouseholdState {
  roommates: Roommate[];
  chores: Chore[];
  expenses: Expense[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  borrowItems: BorrowItem[];
  essentialsAssignees: Record<string, Record<string, string>>;
  roommateStatuses: Record<string, RoommateStatus>;
  sleepStartedAt: Record<string, number>;
  homeLocation: HomeLocation | null;
  choreChart: ChoreChartData | null;
  choreChartStartedAt: string | null;
  homeProfile: HomeProfile | null;
  liveChart: Assignment[] | null;
  customTasks: CustomTask[];
}

export function AppProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [membershipVersion, setMembershipVersion] = useState(0);
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [chores, setChores] = useState<Chore[]>([]);
  const choresRef = useRef<Chore[]>(chores);
  choresRef.current = chores;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [shoppingItems, setShoppingItems] =
    useState<ShoppingItem[]>([]);
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [essentialsAssignees, setEssentialsAssignees] = useState<Record<string, Record<string, string>>>({});
  const [suppressedAlerts, setSuppressedAlerts] = useState<Record<string, boolean>>({});
  const [roommateStatuses, setRoommateStatusesState] = useState<Record<string, RoommateStatus>>({});
  const [sleepStartedAt, setSleepStartedAtState] = useState<Record<string, number>>({});
  const [homeLocation, setHomeLocationState] = useState<HomeLocation | null>(null);
  const [choreChart, setChoreChartState] = useState<ChoreChartData | null>(null);
  const [choreChartStartedAt, setChoreChartStartedAtState] = useState<string | null>(null);
  const [homeProfile, setHomeProfileState] = useState<HomeProfile | null>(null);
  const [liveChart, setLiveChartState] = useState<Assignment[] | null>(null);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [itemDifficulties, setItemDifficulties] = useState<ItemDifficulty[]>([]);
  const [memberPreferences, setMemberPreferences] = useState<MemberPreference[]>([]);
  const [currentProposedChart, setCurrentProposedChartState] = useState<ProposedChart | null>(null);
  const [chartApprovals, setChartApprovals] = useState<ChartApproval[]>([]);
  const [currentMemberRole, setCurrentMemberRole] = useState<"owner" | "member">("member");
  const isHost = currentMemberRole === "owner";
  const [currentUserId, setCurrentUserIdState] = useState<string>(CURRENT_USER_ID);
  const [pendingIouDraft, setPendingIouDraftState] = useState<PendingIouDraft | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("mono");
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [plantEnabled, setPlantEnabled] = useState(true);
  const [localPreferencesLoaded, setLocalPreferencesLoaded] = useState(false);
  const [householdPreferencesReady, setHouseholdPreferencesReady] = useState(false);
  const [preferencesOnboardingPending, setPreferencesOnboardingPending] = useState(false);
  const [quickGuideVersions, setQuickGuideVersions] = useState<Record<string, number>>({});
  const [quickGuideOpen, setQuickGuideOpen] = useState(false);
  const [appAlerts, setAppAlerts] = useState<AppAlert[]>([]);
  const [householdComplete, setHouseholdCompleteState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const applyingRemoteRef = useRef(false);
  const memberMetadataRef = useRef<Map<string, Roommate>>(new Map());
  const previousMemberIdsRef = useRef<{ householdId: string | null; ids: Set<string> }>({
    householdId: null,
    ids: new Set(),
  });
  const applyingRemotePreferencesRef = useRef(false);
  const preferencesLoaded =
    localPreferencesLoaded && (!householdId || householdPreferencesReady);

  useEffect(() => {
    AsyncStorage.getItem(PREFERENCES_KEY)
      .then((raw) => {
        if (raw) {
          try {
          const preferences = JSON.parse(raw) as Partial<{
            colorScheme: ColorScheme;
            pointsEnabled: boolean;
            plantEnabled: boolean;
            onboardingPending: boolean;
            quickGuideVersions: Record<string, number>;
            householdComplete: boolean;
          }>;
          if (preferences.colorScheme) {
            setColorScheme(normalizeColorScheme(preferences.colorScheme));
          }
          if (typeof preferences.pointsEnabled === "boolean") setPointsEnabled(preferences.pointsEnabled);
          if (typeof preferences.plantEnabled === "boolean") setPlantEnabled(preferences.plantEnabled);
          if (typeof preferences.onboardingPending === "boolean") {
            setPreferencesOnboardingPending(preferences.onboardingPending);
          }
          if (
            preferences.quickGuideVersions &&
            typeof preferences.quickGuideVersions === "object"
          ) {
            setQuickGuideVersions(preferences.quickGuideVersions);
          }
          if (typeof preferences.householdComplete === "boolean") {
            setHouseholdCompleteState(preferences.householdComplete);
          }
          } catch (error) {
            reportRuntimeError("parse cached user preferences", error);
          }
        }
      })
      .catch((error) => {
        reportRuntimeError("hydrate cached user preferences", error);
      })
      .finally(() => setLocalPreferencesLoaded(true));
  }, []);

  useEffect(() => {
    if (!localPreferencesLoaded) return;
    const interaction = InteractionManager.runAfterInteractions(() => {
      AsyncStorage.mergeItem(PREFERENCES_KEY, JSON.stringify({
        onboardingPending: preferencesOnboardingPending,
      })).catch((error) => {
        reportRuntimeError("cache onboarding preference", error);
      });
    });
    return () => interaction.cancel();
  }, [localPreferencesLoaded, preferencesOnboardingPending]);

  const finishPreferencesOnboarding = useCallback(async () => {
    await AsyncStorage.mergeItem(PREFERENCES_KEY, JSON.stringify({ onboardingPending: false }));
    setPreferencesOnboardingPending(false);
  }, []);

  const currentGuideUserId = session?.user.id;
  const currentGuideVersion = currentGuideUserId
    ? quickGuideVersions[currentGuideUserId] ?? 0
    : QUICK_GUIDE_VERSION;

  useEffect(() => {
    if (
      localPreferencesLoaded &&
      householdId &&
      !preferencesOnboardingPending &&
      currentGuideVersion < QUICK_GUIDE_VERSION
    ) {
      setQuickGuideOpen(true);
    }
  }, [
    currentGuideVersion,
    householdId,
    localPreferencesLoaded,
    preferencesOnboardingPending,
  ]);

  const openQuickGuide = useCallback(() => {
    setQuickGuideOpen(true);
  }, []);

  const dismissQuickGuide = useCallback(() => {
    setQuickGuideOpen(false);
    if (!currentGuideUserId) return;

    setQuickGuideVersions((current) => {
      const next = {
        ...current,
        [currentGuideUserId]: QUICK_GUIDE_VERSION,
      };
      InteractionManager.runAfterInteractions(() => {
        AsyncStorage.mergeItem(
          PREFERENCES_KEY,
          JSON.stringify({ quickGuideVersions: next }),
        ).catch((error) => {
          reportRuntimeError("cache Quick guide completion", error);
        });
      });
      return next;
    });
  }, [currentGuideUserId]);

  // Household-wide preferences use their own realtime row. The first member
  // to connect creates it from defaults (or legacy local values), after which
  // Supabase is authoritative for every roommate.
  useEffect(() => {
    const userId = session?.user.id;
    if (!localPreferencesLoaded || !userId || !householdId) {
      setHouseholdPreferencesReady(false);
      return;
    }

    let active = true;
    setHouseholdPreferencesReady(false);
    const channel = supabase.channel(`household-preferences:${householdId}`);

    const applyPreferences = (row: {
      color_scheme?: string;
      points_enabled?: boolean;
      plant_enabled?: boolean;
      household_complete?: boolean;
    }) => {
      applyingRemotePreferencesRef.current = true;
      if (row.color_scheme) {
        setColorScheme(normalizeColorScheme(row.color_scheme));
      }
      if (typeof row.points_enabled === "boolean") setPointsEnabled(row.points_enabled);
      if (typeof row.plant_enabled === "boolean") setPlantEnabled(row.plant_enabled);
      if (typeof row.household_complete === "boolean") {
        setHouseholdCompleteState(row.household_complete);
      }
    };

    async function connectPreferences() {
      const { data, error } = await supabase
        .from("household_preferences")
        .select("color_scheme, points_enabled, plant_enabled, household_complete")
        .eq("household_id", householdId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        reportSupabaseError("load household preferences", error, { householdId });
        console.warn("SweetMate preferences sync could not start:", error.message);
        return;
      }

      if (data) {
        applyPreferences(data);
      } else {
        const { error: createError } = await supabase.from("household_preferences").insert({
          household_id: householdId,
          color_scheme: colorScheme,
          points_enabled: pointsEnabled,
          plant_enabled: plantEnabled,
          household_complete: householdComplete,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
        if (createError) {
          reportSupabaseError("create household preferences", createError, { householdId });
          // Another member may have won the first-row race; load that row.
          if (createError.code === "23505") {
            const { data: existing, error: reloadError } = await supabase
              .from("household_preferences")
              .select("color_scheme, points_enabled, plant_enabled, household_complete")
              .eq("household_id", householdId)
              .maybeSingle();
            if (reloadError) {
              reportSupabaseError("reload household preferences", reloadError, { householdId });
            }
            if (existing) applyPreferences(existing);
          } else {
            console.warn("SweetMate preferences could not be created:", createError.message);
            return;
          }
        }
      }

      if (!active) return;
      setHouseholdPreferencesReady(true);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "household_preferences",
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const row = payload.new as {
              color_scheme?: string;
              points_enabled?: boolean;
              plant_enabled?: boolean;
              household_complete?: boolean;
              updated_by?: string;
            };
            if (row.updated_by === userId) return;
            applyPreferences(row);
          },
        )
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reportSupabaseError(
              "subscribe to household preferences",
              error ?? new Error(status),
              { householdId, status },
            );
          }
        });
    }

    connectPreferences().catch((error) => {
      reportRuntimeError("connect household preferences", error, { householdId });
    });
    return () => {
      active = false;
      setHouseholdPreferencesReady(false);
      supabase.removeChannel(channel);
    };
  }, [householdId, localPreferencesLoaded, session?.user.id]);

  // Coalesce preference changes and ignore realtime echoes.
  useEffect(() => {
    const userId = session?.user.id;
    if (!householdPreferencesReady || !userId || !householdId) return;
    if (applyingRemotePreferencesRef.current) {
      applyingRemotePreferencesRef.current = false;
      return;
    }

    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(async () => {
        const { error } = await supabase.from("household_preferences").upsert({
          household_id: householdId,
          color_scheme: colorScheme,
          points_enabled: pointsEnabled,
          plant_enabled: plantEnabled,
          household_complete: householdComplete,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          reportSupabaseError("save household preferences", error, { householdId });
          console.warn("SweetMate preference could not sync:", error.message);
        }
      });
    }, 220);
    return () => {
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [
    colorScheme,
    householdComplete,
    householdId,
    householdPreferencesReady,
    plantEnabled,
    pointsEnabled,
    session?.user.id,
  ]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setHouseholdId(null);
      setHouseholdName(null);
      setInviteCode(null);
      setHouseholdLoading(false);
      return;
    }
    let active = true;
    setHouseholdLoading(true);
    (async () => {
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("household_id, display_name, color, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error || !membership) {
        if (error) {
          reportSupabaseError("load current household membership", error, { userId });
        }
        setHouseholdId(null);
        setHouseholdName(null);
        setInviteCode(null);
        setHouseholdLoading(false);
        return;
      }
      const { data: household, error: householdError } = await supabase
        .from("households")
        .select("name, invite_code")
        .eq("id", membership.household_id)
        .single();
      if (householdError) {
        reportSupabaseError("load current household", householdError, {
          householdId: membership.household_id,
        });
        if (active) {
          setHouseholdId(null);
          setHouseholdName(null);
          setInviteCode(null);
          setHouseholdLoading(false);
        }
        return;
      }
      if (!active) return;
      setCurrentUserIdState(userId);
      setCurrentMemberRole(membership.role === "owner" ? "owner" : "member");
      setHouseholdId(membership.household_id);
      setHouseholdName(household?.name ?? "My household");
      setInviteCode(household?.invite_code ?? null);
      setHouseholdLoading(false);
    })().catch((error) => {
      reportRuntimeError("load current household", error, { userId });
      if (active) {
        setHouseholdId(null);
        setHouseholdName(null);
        setInviteCode(null);
        setHouseholdLoading(false);
      }
    });
    return () => { active = false; };
  }, [session?.user.id, membershipVersion]);

  const refreshMembers = useCallback(async () => {
    if (!householdId) {
      setRoommates([]);
      return;
    }
    setMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from("household_members")
        .select("user_id, display_name, color, role")
        .eq("household_id", householdId)
        .order("joined_at", { ascending: true });
      if (error) {
        reportSupabaseError("refresh household members", error, { householdId });
        return;
      }
      setRoommates((current) => {
        const existingById = new Map([
          ...memberMetadataRef.current,
          ...current.map((member) => [member.id, member] as const),
        ]);
        return (data ?? []).map((member) => {
          const existing = existingById.get(member.user_id);
          return {
            id: member.user_id,
            name: member.display_name,
            color: member.color,
            role: member.role === "owner" ? "owner" : "member",
            points: existing?.points ?? 0,
            weeklyPoints: existing?.weeklyPoints ?? 0,
            avatarUri: existing?.avatarUri,
          };
        });
      });
    } finally {
      setMembersLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    void refreshMembers();
    const channel = supabase
      .channel(`household-members:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_members",
          filter: `household_id=eq.${householdId}`,
        },
        () => void refreshMembers(),
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportSupabaseError(
            "subscribe to household members",
            error ?? new Error(status),
            { householdId, status },
          );
        }
      });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshMembers();
    });
    return () => {
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [householdId, refreshMembers]);

  const createHousehold = useCallback(async (name: string, displayName: string, color: string, code: string) => {
    const { error } = await supabase.rpc("create_household", {
      household_name: name.trim(), member_name: displayName.trim(), member_color: color,
      requested_invite_code: code,
    });
    if (error) {
      reportSupabaseError("create household", error);
      throw error;
    }
    await AsyncStorage.mergeItem(PREFERENCES_KEY, JSON.stringify({ onboardingPending: true }));
    setPreferencesOnboardingPending(true);
    setHouseholdCompleteState(false);
    const userId = session?.user.id;
    if (userId) {
      setRoommates([{ id: userId, name: displayName.trim(), color, points: 0, weeklyPoints: 0 }]);
      setChores([]); setExpenses([]); setShoppingLists([]); setShoppingItems([]);
      setBorrowItems([]); setNudges([]); setCurrentUserIdState(userId);
    }
    setMembershipVersion((value) => value + 1);
  }, [session?.user.id]);

  const refreshHousehold = useCallback(() => {
    setMembershipVersion((value) => value + 1);
  }, []);

  const joinHousehold = useCallback(async (code: string, displayName: string, color: string) => {
    const { error } = await supabase.rpc("join_household", {
      code: code.trim(), member_name: displayName.trim(), member_color: color,
    });
    if (error) {
      reportSupabaseError("join household", error);
      throw error;
    }
    await AsyncStorage.mergeItem(PREFERENCES_KEY, JSON.stringify({ onboardingPending: true }));
    setPreferencesOnboardingPending(true);
    if (session?.user.id) setCurrentUserIdState(session.user.id);
    setMembershipVersion((value) => value + 1);
  }, [session?.user.id]);

  const deleteHousehold = useCallback(async () => {
    if (!householdId) throw new Error("No household is selected.");
    if (!isHost) {
      throw new Error("Only the household host can delete this household.");
    }
    const { data, error, count, status, statusText } = await supabase
      .from("households")
      .delete({ count: "exact" })
      .eq("id", householdId)
      .select("id")
      .maybeSingle();
    if (error || !data || count !== 1) {
      const failure = {
        status,
        statusText,
        code: error?.code ?? "RLS_DELETE_REJECTED",
        message:
          error?.message ??
          "The household was not deleted. Only the household host has permission.",
        details:
          error?.details ??
          `Expected one deleted household row, received ${count ?? 0}.`,
        hint:
          error?.hint ??
          "Confirm you are signed in as the household creator and try again.",
        count,
      };
      console.error("Supabase household delete failed", failure);
      throw new Error(failure.message);
    }

    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.mergeItem(
      PREFERENCES_KEY,
      JSON.stringify({ onboardingPending: false, householdComplete: false }),
    );
    setHouseholdId(null);
    setHouseholdName(null);
    setInviteCode(null);
    setCurrentMemberRole("member");
    setCloudReady(false);
    setHouseholdPreferencesReady(false);
    setPreferencesOnboardingPending(false);
    setHouseholdCompleteState(false);
    setRoommates([]);
    setChores([]);
    setExpenses([]);
    setShoppingLists([]);
    setShoppingItems([]);
    setBorrowItems([]);
    setNudges([]);
    setAppAlerts([]);
    setSuppressedAlerts({});
    setEssentialsAssignees({});
    setRoommateStatusesState({});
    setSleepStartedAtState({});
    setHomeLocationState(null);
    setChoreChartState(null);
    setChoreChartStartedAtState(null);
    setHomeProfileState(null);
    setLiveChartState(null);
    setCustomTasks([]);
    setItemDifficulties([]);
    setMemberPreferences([]);
    setCurrentProposedChartState(null);
    setChartApprovals([]);
    setPendingIouDraftState(null);
    setMembershipVersion((value) => value + 1);
  }, [householdId, isHost]);

  const removeRoommate = useCallback(async (roommateId: string) => {
    if (!householdId) throw new Error("No household is selected.");
    if (!isHost) throw new Error("Only the household host can remove a roommate.");
    if (roommateId === currentUserId) throw new Error("You cannot remove yourself.");
    const { error } = await supabase.rpc("remove_household_member", {
      target_household_id: householdId,
      target_user_id: roommateId,
    });
    if (error) {
      reportSupabaseError("remove household member", error, {
        householdId,
        roommateId,
      });
      throw error;
    }
    setRoommates((current) => current.filter((roommate) => roommate.id !== roommateId));
    setChores((current) => current.filter((chore) => chore.assignedTo !== roommateId));
    setMemberPreferences((current) => current.filter((entry) => entry.memberId !== roommateId));
    setCurrentProposedChartState(null);
    setChartApprovals([]);
  }, [currentUserId, householdId, isHost]);

  const deleteOwnAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      reportSupabaseError("delete own account", error);
      throw error;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PREFERENCES_KEY);
    await supabase.auth.signOut({ scope: "local" });
    setHouseholdId(null);
    setHouseholdName(null);
    setInviteCode(null);
    setRoommates([]);
    setChores([]);
    setExpenses([]);
    setShoppingLists([]);
    setShoppingItems([]);
    setBorrowItems([]);
    setNudges([]);
    setLiveChartState(null);
    setCustomTasks([]);
    setItemDifficulties([]);
    setMemberPreferences([]);
    setCurrentProposedChartState(null);
    setChartApprovals([]);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
          const data = JSON.parse(raw);
          // Membership rows in Supabase are authoritative. Cached roommates
          // must never overwrite a newer server roster.
          if (data.chores) setChores(data.chores);
          if (data.expenses) setExpenses(data.expenses);
          if (data.shoppingLists) setShoppingLists(data.shoppingLists);
          if (data.shoppingItems) setShoppingItems(data.shoppingItems);
          if (data.borrowItems) setBorrowItems(data.borrowItems);
          if (data.nudges) setNudges(data.nudges);
          if (Array.isArray(data.appAlerts)) setAppAlerts(data.appAlerts);
          if (data.essentialsAssignees) setEssentialsAssignees(data.essentialsAssignees);
          if (data.suppressedAlerts) setSuppressedAlerts(data.suppressedAlerts);
          if (data.roommateStatuses) setRoommateStatusesState(data.roommateStatuses);
          if (data.sleepStartedAt) setSleepStartedAtState(data.sleepStartedAt);
          if (data.homeLocation) setHomeLocationState(data.homeLocation);
          if (data.choreChart) setChoreChartState(data.choreChart);
          if (data.choreChartStartedAt) setChoreChartStartedAtState(data.choreChartStartedAt);
          if (data.homeProfile) setHomeProfileState(data.homeProfile);
          if (data.currentUserId && typeof data.currentUserId === "string") {
            setCurrentUserIdState(data.currentUserId);
          }
          } catch (error) {
            reportRuntimeError("parse cached household state", error);
          }
        }
      })
      .catch((error) => {
        reportRuntimeError("hydrate cached household state", error);
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // Coalesce rapid mutations and move the full-state serialization off the
    // interaction frame. This is especially important when a user completes
    // a chore and immediately switches tabs.
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(() => {
        AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ roommates, chores, expenses, shoppingLists, shoppingItems, borrowItems, nudges, appAlerts, essentialsAssignees, suppressedAlerts, roommateStatuses, sleepStartedAt, homeLocation, choreChart, choreChartStartedAt, homeProfile, currentUserId })
        ).catch((error) => {
          reportRuntimeError("cache household state", error);
        });
      });
    }, 120);
    return () => {
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [loaded, roommates, chores, expenses, shoppingLists, shoppingItems, borrowItems, nudges, appAlerts, essentialsAssignees, suppressedAlerts, roommateStatuses, sleepStartedAt, homeLocation, choreChart, choreChartStartedAt, homeProfile, currentUserId]);

  const upsertInformationalAlerts = useCallback((incoming: AppAlert[]) => {
    if (!incoming.length) return;
    setAppAlerts((current) => {
      const existingKeys = new Set(current.map((alert) => alert.deduplicationKey));
      const additions = incoming.filter((alert) => !existingKeys.has(alert.deduplicationKey));
      return additions.length ? [...additions, ...current] : current;
    });
  }, []);

  const markAlertRead = useCallback((alertId: string) => {
    setAppAlerts((current) =>
      current.map((alert) => alert.id === alertId && !alert.readAt
        ? { ...alert, readAt: new Date().toISOString() }
        : alert),
    );
  }, []);

  const markAllAlertsRead = useCallback(() => {
    const readAt = new Date().toISOString();
    setAppAlerts((current) => current.map((alert) => alert.readAt ? alert : { ...alert, readAt }));
  }, []);

  useEffect(() => {
    if (!loaded || !householdId || !currentUserId || currentUserId === CURRENT_USER_ID) return;
    const now = new Date();
    const createdAt = now.toISOString();
    const incoming: AppAlert[] = [];
    chores
      .filter((chore) => !chore.completed && chore.assignedTo === currentUserId && new Date(chore.dueDate).getTime() < now.getTime())
      .forEach((chore) => incoming.push({
        id: `overdue-chore:${chore.id}`,
        type: "overdue-chore",
        title: "Chore overdue",
        message: `“${chore.title}” is past its due date.`,
        createdAt,
        relatedEntityId: chore.id,
        relatedEntityType: "chore",
        deduplicationKey: `overdue-chore:${householdId}:${currentUserId}:${chore.id}:${chore.dueDate}`,
        severity: "attention",
      }));
    expenses
      .filter((expense) =>
        !expense.settled &&
        (expense.paidBy === currentUserId || (expense.splits[currentUserId] ?? 0) > 0),
      )
      .forEach((expense) => incoming.push({
        id: `expense:${expense.id}`,
        type: "expense",
        title: "IOU still unsettled",
        message: `“${expense.title}” still has an outstanding balance.`,
        createdAt,
        relatedEntityId: expense.id,
        relatedEntityType: "expense",
        deduplicationKey: `expense:${householdId}:${currentUserId}:${expense.id}`,
        severity: "attention",
      }));
    borrowItems
      .filter((item) =>
        !item.returned &&
        (item.borrowedBy === currentUserId || item.borrowedFrom === currentUserId) &&
        new Date(item.dueDate).getTime() <= now.getTime(),
      )
      .forEach((item) => incoming.push({
        id: `borrowing:${item.id}`,
        type: "borrowing",
        title: "Borrowed item due",
        message: `“${item.item}” is due to be returned.`,
        createdAt,
        relatedEntityId: item.id,
        relatedEntityType: "borrow-item",
        deduplicationKey: `borrowing:${householdId}:${currentUserId}:${item.id}:${item.dueDate}`,
        severity: "attention",
      }));
    const approvedChart = currentProposedChart?.status === "approved" ? currentProposedChart : null;
    if ((approvedChart?.payload.assignments.length ?? 0) >= 2 && (approvedChart?.payload.generatedTasks?.length ?? 0) >= 3) {
      findAssignedLoadDeviations(
        approvedChart!.payload.assignments,
        approvedChart!.payload.generatedTasks ?? [],
      ).filter((deviation) => deviation.direction === "above").forEach((deviation) => {
        const member = memberMetadataRef.current.get(deviation.memberId);
        incoming.push({
          id: `difficulty-imbalance:${approvedChart!.id}:${deviation.memberId}`,
          type: "difficulty-imbalance",
          title: "Chore workload may be uneven",
          message: `${member?.name ?? "A Sweetmate"} has been assigned more chore difficulty than the Sweet average. You may want to rebalance upcoming tasks.`,
          createdAt,
          relatedEntityId: approvedChart!.id,
          relatedEntityType: "chore-chart",
          deduplicationKey: `difficulty-imbalance:${householdId}:${approvedChart!.id}:${deviation.memberId}`,
          severity: "attention",
        });
      });
    }
    upsertInformationalAlerts(incoming);
  }, [borrowItems, chores, currentProposedChart, currentUserId, expenses, householdId, loaded, upsertInformationalAlerts]);

  const memberRosterKey = useMemo(
    () => roommates.map((member) => `${member.id}:${member.name}`).sort().join("|"),
    [roommates],
  );

  useEffect(() => {
    if (!loaded || !householdId || membersLoading || !roommates.length) return;
    const currentIds = new Set(roommates.map((member) => member.id));
    const previous = previousMemberIdsRef.current;
    if (previous.householdId !== householdId || previous.ids.size === 0) {
      previousMemberIdsRef.current = { householdId, ids: currentIds };
      return;
    }
    const createdAt = new Date().toISOString();
    const joined = roommates.filter(
      (member) => member.id !== currentUserId && !previous.ids.has(member.id),
    );
    previousMemberIdsRef.current = { householdId, ids: currentIds };
    upsertInformationalAlerts(joined.map((member) => ({
      id: `membership:${householdId}:${member.id}`,
      type: "membership",
      title: "New Sweetmate joined",
      message: `${member.name} joined ${householdName ?? "your Sweet"}.`,
      createdAt,
      relatedEntityId: member.id,
      relatedEntityType: "member",
      deduplicationKey: `membership:${householdId}:${member.id}`,
      severity: "info",
    })));
  }, [currentUserId, householdId, householdName, loaded, memberRosterKey, membersLoading, upsertInformationalAlerts]);

  const sharedState = useMemo<SharedHouseholdState>(() => ({
    // Kept only for score/avatar synchronization. Active membership identity
    // always comes from household_members and snapshot-only IDs are ignored.
    roommates,
    chores,
    expenses,
    shoppingLists,
    shoppingItems,
    borrowItems,
    essentialsAssignees,
    roommateStatuses,
    sleepStartedAt,
    homeLocation,
    choreChart,
    choreChartStartedAt,
    homeProfile,
    liveChart,
    customTasks,
  }), [roommates, chores, expenses, shoppingLists, shoppingItems, borrowItems, essentialsAssignees, roommateStatuses, sleepStartedAt, homeLocation, choreChart, choreChartStartedAt, homeProfile, liveChart, customTasks]);

  const latestSharedStateRef = useRef(sharedState);
  latestSharedStateRef.current = sharedState;

  const applySharedState = useCallback((next: Partial<SharedHouseholdState>) => {
    // currentUserId, suppressedAlerts, and pendingIouDraft remain private to
    // this device. Shared tab collections all come from the cloud snapshot.
    // Snapshot roommates carry scores/avatars only. They can update active
    // members but can never add or remove membership identities.
    if (Array.isArray(next.roommates)) {
      const snapshotById = new Map(next.roommates.map((member) => [member.id, member]));
      memberMetadataRef.current = snapshotById;
      setRoommates((activeMembers) =>
        activeMembers.map((member) => {
          const snapshot = snapshotById.get(member.id);
          return snapshot
            ? {
                ...member,
                points: snapshot.points ?? member.points,
                weeklyPoints: snapshot.weeklyPoints ?? member.weeklyPoints,
                avatarUri: snapshot.avatarUri ?? member.avatarUri,
              }
            : member;
        }),
      );
    }
    if (Array.isArray(next.chores)) setChores(next.chores);
    if (Array.isArray(next.expenses)) setExpenses(next.expenses);
    if (Array.isArray(next.shoppingLists)) setShoppingLists(next.shoppingLists);
    if (Array.isArray(next.shoppingItems)) setShoppingItems(next.shoppingItems);
    if (Array.isArray(next.borrowItems)) setBorrowItems(next.borrowItems);
    if (next.essentialsAssignees) setEssentialsAssignees(next.essentialsAssignees);
    if (next.roommateStatuses) setRoommateStatusesState(next.roommateStatuses);
    if (next.sleepStartedAt) setSleepStartedAtState(next.sleepStartedAt);
    if ("homeLocation" in next) setHomeLocationState(next.homeLocation ?? null);
    if ("choreChart" in next) setChoreChartState(next.choreChart ?? null);
    if ("choreChartStartedAt" in next) setChoreChartStartedAtState(next.choreChartStartedAt ?? null);
    if ("homeProfile" in next) setHomeProfileState(next.homeProfile ?? null);
    if ("liveChart" in next) setLiveChartState(next.liveChart ?? null);
    if (Array.isArray(next.customTasks)) setCustomTasks(next.customTasks);
  }, []);

  // Load the shared household document and subscribe to other devices.
  useEffect(() => {
    const userId = session?.user.id;
    if (!loaded || !userId || !householdId) {
      setCloudReady(false);
      return;
    }

    let active = true;
    const channel = supabase.channel(`household:${householdId}`);

    async function connect() {
      const { data, error } = await supabase
        .from("household_states")
        .select("state")
        .eq("household_id", householdId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        reportSupabaseError("load shared household state", error, { householdId });
        console.warn("SweetMate cloud sync could not start:", error.message);
        return;
      }

      if (data?.state) {
        applyingRemoteRef.current = true;
        const remote = data.state as Partial<SharedHouseholdState>;
        applySharedState(remote);
      } else {
        const { error: createError } = await supabase.from("household_states").upsert({
          household_key: householdId,
          household_id: householdId,
          state: latestSharedStateRef.current,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
        if (createError) {
          reportSupabaseError("create shared household state", createError, { householdId });
          console.warn("SweetMate household could not be created:", createError.message);
          return;
        }
      }

      if (!active) return;
      setCloudReady(true);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "household_states",
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const row = payload.new as { state?: Partial<SharedHouseholdState>; updated_by?: string };
            if (!row.state || row.updated_by === userId) return;
            applyingRemoteRef.current = true;
            applySharedState(row.state);
          }
        )
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reportSupabaseError(
              "subscribe to shared household state",
              error ?? new Error(status),
              { householdId, status },
            );
          }
        });
    }

    connect().catch((error) => {
      reportRuntimeError("connect shared household state", error, { householdId });
    });
    return () => {
      active = false;
      setCloudReady(false);
      supabase.removeChannel(channel);
    };
  }, [applySharedState, householdId, loaded, session?.user.id]);

  // Coalesce quick mutations into one update and ignore realtime echoes.
  useEffect(() => {
    const userId = session?.user.id;
    if (!loaded || !cloudReady || !userId || !householdId) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(async () => {
        const { error } = await supabase.from("household_states").upsert({
          household_key: householdId,
          household_id: householdId,
          state: latestSharedStateRef.current,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          reportSupabaseError("save shared household state", error, { householdId });
          console.warn("SweetMate change could not sync:", error.message);
        }
      });
    }, 220);
    return () => {
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [cloudReady, householdId, loaded, session?.user.id, sharedState]);

  // Nudges live in their own table so acknowledgement is per row and updates
  // immediately on every signed-in device. Never select sent_by: received
  // reminders are deliberately anonymous in the client.
  useEffect(() => {
    if (!householdId || !session?.user.id) {
      setNudges([]);
      return;
    }
    let active = true;
    const channel = supabase.channel(`nudges:${householdId}`);

    const refreshNudges = async () => {
      const { data, error } = await supabase
        .from("nudges")
        .select("id, to_member_id, chore_id, sent_at, seen")
        .eq("household_id", householdId)
        .order("sent_at", { ascending: false });
      if (!active) return;
      if (error) {
        // Allow the app to remain usable while the additive `seen` migration
        // is being rolled out. The fallback can be removed after every
        // environment has 202607240001.
        if (error.code === "42703") {
          const legacyResult = await supabase
            .from("nudges")
            .select("id, to_member_id, chore_id, sent_at")
            .eq("household_id", householdId)
            .order("sent_at", { ascending: false });
          if (!active) return;
          if (legacyResult.error) {
            reportSupabaseError("load legacy household nudges", legacyResult.error, { householdId });
            return;
          }
          setNudges((legacyResult.data ?? []).map((row) => ({
            id: row.id,
            toRoommateId: row.to_member_id,
            choreId: row.chore_id,
            sentAt: row.sent_at,
            seen: false,
          })));
          return;
        }
        reportSupabaseError("load household nudges", error, { householdId });
        return;
      }
      setNudges((data ?? []).map((row) => ({
        id: row.id,
        toRoommateId: row.to_member_id,
        choreId: row.chore_id,
        sentAt: row.sent_at,
        seen: row.seen,
      })));
    };

    void refreshNudges();
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nudges",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void refreshNudges();
        }
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportSupabaseError(
            "subscribe to household nudges",
            error ?? new Error(status),
            { householdId, status },
          );
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [householdId, session?.user.id]);

  // Load deterministic-chart configuration and keep it live across roommates.
  useEffect(() => {
    if (!householdId || !session?.user.id) {
      setItemDifficulties([]);
      setMemberPreferences([]);
      setCurrentProposedChartState(null);
      setChartApprovals([]);
      return;
    }
    let active = true;
    const channel = supabase.channel(`chore-foundation:${householdId}`);

    const refresh = async () => {
      const [difficultyResult, preferenceResult, chartResult] = await Promise.all([
        supabase.from("item_difficulty").select("id, household_id, category, item, difficulty").eq("household_id", householdId),
        supabase.from("member_task_preferences").select("id, household_id, member_id, key, value").eq("household_id", householdId),
        supabase.from("proposed_charts").select("id, household_id, created_by, status, payload, created_at").eq("household_id", householdId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      if (difficultyResult.error) {
        reportSupabaseError("load item difficulties", difficultyResult.error, { householdId });
      }
      if (preferenceResult.error) {
        reportSupabaseError("load member task preferences", preferenceResult.error, { householdId });
      }
      if (chartResult.error) {
        reportSupabaseError("load proposed chart", chartResult.error, { householdId });
      }
      setItemDifficulties((difficultyResult.data ?? []).map((row) => ({
        id: row.id,
        householdId: row.household_id,
        category: row.category as ItemCategory,
        item: row.item,
        difficulty: row.difficulty as Difficulty,
      })));
      setMemberPreferences((preferenceResult.data ?? []).map((row) => ({
        id: row.id,
        householdId: row.household_id,
        memberId: row.member_id,
        key: row.key,
        value: row.value,
      })));
      const row = chartResult.data;
      const chart = row ? {
        id: row.id,
        householdId: row.household_id,
        createdBy: row.created_by,
        status: row.status as ProposedChart["status"],
        payload: row.payload as ProposedChart["payload"],
        createdAt: row.created_at,
      } as ProposedChart : null;
      setCurrentProposedChartState(chart);
      if (chart) {
        const { data: approvalRows, error: approvalsError } = await supabase
          .from("proposed_chart_approvals")
          .select("id, proposed_chart_id, member_id, approved, approved_at")
          .eq("proposed_chart_id", chart.id);
        if (approvalsError) {
          reportSupabaseError("load proposed chart approvals", approvalsError, {
            householdId,
            chartId: chart.id,
          });
        }
        if (!active) return;
        setChartApprovals((approvalRows ?? []).map((approval) => ({
          id: approval.id,
          proposedChartId: approval.proposed_chart_id,
          memberId: approval.member_id,
          approved: approval.approved,
          approvedAt: approval.approved_at,
        })));
      } else {
        setChartApprovals([]);
      }

      if (chart?.status === "approved") {
        setLiveChartState(chart.payload.assignments);
        const generated = chart.payload.generatedTasks ?? [];
        const ownerByTask = new Map<string, string>();
        chart.payload.assignments.forEach((assignment) => {
          assignment.taskIds.forEach((taskId) => ownerByTask.set(taskId, assignment.memberId));
        });
        setChores((current) => {
          const existingIds = new Set(current.map((chore) => chore.id));
          const additions: Chore[] = generated.flatMap((task) => {
            const id = `chart:${chart.id}:${task.id}`;
            const assignedTo = ownerByTask.get(task.id);
            if (!assignedTo || existingIds.has(id)) return [];
            return [{
              id,
              title: task.title,
              assignedTo,
              dueDate: daysFromNow(7),
              completed: false,
              points: task.difficulty * 5,
              category: task.itemCategory === "living" ? "cleaning" : task.itemCategory === "other" ? "other" : task.itemCategory,
              recurring: task.frequency === "daily" ? "daily" : task.frequency === "monthly" ? "monthly" : "weekly",
            }];
          });
          return additions.length ? [...current, ...additions] : current;
        });
      }
    };

    refresh().catch((error) => {
      reportRuntimeError("refresh deterministic chart state", error, { householdId });
    });
    for (const table of ["item_difficulty", "member_task_preferences", "proposed_charts", "proposed_chart_approvals"] as const) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        () => {
          refresh().catch((error) => {
            reportRuntimeError("refresh deterministic chart state", error, {
              householdId,
              table,
            });
          });
        },
      );
    }
    channel.subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reportSupabaseError("subscribe to deterministic chart state", error ?? new Error(status), {
          householdId,
          status,
        });
      }
    });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [householdId, session?.user.id]);

  const addChore = useCallback((chore: Omit<Chore, "id">) => {
    setChores((prev) => {
      if (chore.sourceKey && prev.some((item) => item.sourceKey === chore.sourceKey)) return prev;
      if (!chore.sourceKey && prev.some((item) => !item.sourceKey && item.title.trim().toLowerCase() === chore.title.trim().toLowerCase())) return prev;
      return [...prev, { ...chore, id: makeId() }];
    });
  }, []);

  const addChores = useCallback((newChores: Omit<Chore, "id">[]): number => {
    const current = choresRef.current;
    const sourceKeys = new Set(current.flatMap((chore) => chore.sourceKey ? [chore.sourceKey] : []));
    const manualTitles = new Set(current.filter((chore) => !chore.sourceKey).map((chore) => chore.title.trim().toLowerCase()));
    const accepted: Chore[] = [];
    for (const chore of newChores) {
      const titleKey = chore.title.trim().toLowerCase();
      if ((chore.sourceKey && sourceKeys.has(chore.sourceKey)) || (!chore.sourceKey && manualTitles.has(titleKey))) continue;
      if (chore.sourceKey) sourceKeys.add(chore.sourceKey);
      else manualTitles.add(titleKey);
      accepted.push({ ...chore, id: makeId() });
    }
    if (accepted.length) {
      const next = [...current, ...accepted];
      choresRef.current = next;
      setChores(next);
    }
    return accepted.length;
  }, []);

  // Toggle: complete an open chore (award points) or un-complete a done chore
  // (deduct the same points). Only the original assignee's points are moved —
  // picked-up chores would ideally track a separate creditee, but this keeps
  // the model simple and matches the "unclick to uncross out" UX the user asked
  // for on their own chores in My Home / Group.
  const completeChore = useCallback((id: string) => {
    const chore = chores.find((c) => c.id === id);
    if (!chore) return;
    const wasCompleted = chore.completed;
    const delta = wasCompleted ? -chore.points : chore.points;

    setChores((prev) =>
      prev.map((c) =>
        c.id === id
          ? wasCompleted
            ? { ...c, completed: false, completedAt: undefined }
            : { ...c, completed: true, completedAt: new Date().toISOString() }
          : c
      )
    );
    setRoommates((prev) =>
      prev.map((r) =>
        r.id === chore.assignedTo
          ? {
              ...r,
              points: r.points + delta,
              weeklyPoints: r.weeklyPoints + delta,
            }
          : r
      )
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
    const id = makeId();
    setExpenses((prev) => [...prev, { ...expense, id }]);
    return id;
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
    setShoppingLists((prev) => {
      // Insert at the TOP of the unpinned partition.
      const newList: ShoppingList = { id: makeId(), name };
      const pinned = prev.filter((l) => l.pinned);
      const unpinned = prev.filter((l) => !l.pinned);
      return [...pinned, newList, ...unpinned];
    });
  }, []);

  // Accept whatever id order the DraggableFlatList emits, then re-partition
  // pinned-first / unpinned-second while preserving the user's relative order
  // within each group. `shoppingLists` is the ONLY source of truth for the
  // rendered order — consumers pass it directly to DraggableFlatList (no
  // per-render re-sort).
  const reorderShoppingLists = useCallback((newIds: string[]) => {
    setShoppingLists((prev) => {
      const byId = new Map(prev.map((l) => [l.id, l]));
      // Rebuild in the exact order the drag emitted, keeping every list.
      const reordered: ShoppingList[] = [];
      newIds.forEach((id) => {
        const l = byId.get(id);
        if (l) {
          reordered.push(l);
          byId.delete(id);
        }
      });
      // Defensive: append any list that wasn't in newIds (shouldn't happen).
      byId.forEach((l) => reordered.push(l));
      // Enforce the pinned-first partition after the drag.
      const pinnedArr = reordered.filter((l) => l.pinned);
      const unpinnedArr = reordered.filter((l) => !l.pinned);
      return [...pinnedArr, ...unpinnedArr];
    });
  }, []);

  const pinShoppingList = useCallback((id: string, pinned: boolean) => {
    setShoppingLists((prev) => {
      const target = prev.find((l) => l.id === id);
      if (!target) return prev;
      const updated: ShoppingList = { ...target, pinned };
      const others = prev.filter((l) => l.id !== id);
      const pinnedArr = others.filter((l) => l.pinned);
      const unpinnedArr = others.filter((l) => !l.pinned);
      // Pin: move to the TOP of the pinned partition.
      // Unpin: move to the TOP of the unpinned partition.
      return pinned
        ? [updated, ...pinnedArr, ...unpinnedArr]
        : [...pinnedArr, updated, ...unpinnedArr];
    });
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

  // Accept the visible order emitted by NestableDraggableFlatList and rewrite
  // the items belonging to `listId` in that order, then enforce the unchecked-
  // first / checked-last partition so users can drag freely within either
  // partition without the sort snapping items back on the next render.
  const reorderShoppingItems = useCallback((listId: string, newIds: string[]) => {
    setShoppingItems((prev) => {
      const inList = prev.filter((s) => s.listId === listId);
      const byId = new Map(inList.map((s) => [s.id, s]));
      const reordered: ShoppingItem[] = [];
      newIds.forEach((id) => {
        const s = byId.get(id);
        if (s) {
          reordered.push(s);
          byId.delete(id);
        }
      });
      byId.forEach((s) => reordered.push(s));
      const unchecked = reordered.filter((s) => !s.completed);
      const checked = reordered.filter((s) => s.completed);
      const finalListItems = [...unchecked, ...checked];
      // Splice the reordered items back into the flat array at the position of
      // this list's first item so other lists' relative ordering is preserved.
      const firstIdx = prev.findIndex((s) => s.listId === listId);
      const others = prev.filter((s) => s.listId !== listId);
      if (firstIdx === -1) return prev;
      return [
        ...others.slice(0, firstIdx),
        ...finalListItems,
        ...others.slice(firstIdx),
      ];
    });
  }, []);

  const assignShoppingList = useCallback((id: string, roommateId: string | null) => {
    setShoppingLists((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, assignedTo: roommateId ?? undefined }
          : l
      )
    );
  }, []);

  const assignShoppingItem = useCallback((id: string, roommateIds: string[]) => {
    setShoppingItems((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, assignedTo: roommateIds.length > 0 ? roommateIds : undefined } : s
      )
    );
  }, []);

  const updateShoppingItemPrice = useCallback((id: string, price: number | null) => {
    setShoppingItems((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, price: price ?? undefined } : s
      )
    );
  }, []);

  const linkShoppingItemsToExpense = useCallback((itemIds: string[], expenseId: string) => {
    const ids = new Set(itemIds);
    setShoppingItems((current) =>
      current.map((item) =>
        ids.has(item.id)
          ? { ...item, convertedExpenseId: expenseId, completed: true }
          : item,
      ),
    );
  }, []);

  const addBorrowItem = useCallback((item: Omit<BorrowItem, "id">) => {
    setBorrowItems((prev) => [...prev, { ...item, id: makeId() }]);
  }, []);

  const updateBorrowItem = useCallback(
    (id: string, updates: Partial<Omit<BorrowItem, "id">>) => {
      setBorrowItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    []
  );

  // Toggle: if the item was returned, un-return it (clear returnedAt);
  // otherwise mark it returned with the current timestamp.
  const returnBorrowItem = useCallback((id: string) => {
    setBorrowItems((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.returned) return { ...b, returned: false, returnedAt: undefined };
        return { ...b, returned: true, returnedAt: new Date().toISOString() };
      })
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

  const sendNudge = useCallback(async (toRoommateId: string, choreId: string) => {
    if (!householdId || !session?.user.id) {
      throw new Error("Your household is still loading.");
    }
    const { error } = await supabase.from("nudges").insert({
      household_id: householdId,
      to_member_id: toRoommateId,
      chore_id: choreId,
      sent_by: session.user.id,
    });
    if (error) {
      reportSupabaseError("send anonymous nudge", error, {
        householdId,
        choreId,
        recipientId: toRoommateId,
      });
      throw error;
    }
  }, [householdId, session?.user.id]);

  const suppressAlert = useCallback((id: string) => {
    setSuppressedAlerts((prev) => ({ ...prev, [id]: true }));
  }, []);

  const setRoommateStatus = useCallback((id: string, status: RoommateStatus) => {
    setRoommateStatusesState((prev) => ({ ...prev, [id]: status }));
    setSleepStartedAtState((prev) => {
      if (status === "asleep") {
        return { ...prev, [id]: Date.now() };
      }
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Auto-revert "asleep" → "home" after 9 hours; schedules the next-due timer
  // and runs an immediate sweep on load (covers app being closed past expiry).
  useEffect(() => {
    if (!loaded) return;
    const now = Date.now();
    const expired: string[] = [];
    let nextExpiry = Infinity;
    for (const [id, startedAt] of Object.entries(sleepStartedAt)) {
      if (roommateStatuses[id] !== "asleep") continue;
      const expiresAt = startedAt + ASLEEP_AUTO_REVERT_MS;
      if (expiresAt <= now) expired.push(id);
      else if (expiresAt < nextExpiry) nextExpiry = expiresAt;
    }
    if (expired.length > 0) {
      setRoommateStatusesState((prev) => {
        const next = { ...prev };
        for (const id of expired) if (next[id] === "asleep") next[id] = "home";
        return next;
      });
      setSleepStartedAtState((prev) => {
        const next = { ...prev };
        for (const id of expired) delete next[id];
        return next;
      });
      return;
    }
    if (nextExpiry === Infinity) return;
    const t = setTimeout(() => {
      setSleepStartedAtState((prev) => ({ ...prev }));
    }, nextExpiry - now);
    return () => clearTimeout(t);
  }, [loaded, sleepStartedAt, roommateStatuses]);

  const setHomeLocation = useCallback((loc: HomeLocation | null) => {
    setHomeLocationState(loc);
  }, []);

  const setChoreChart = useCallback(
    (data: ChoreChartData | null, startedAt: string | null) => {
      setChoreChartState(data);
      setChoreChartStartedAtState(startedAt);
    },
    []
  );

  const setLiveChart = useCallback((assignments: Assignment[] | null) => {
    setLiveChartState(assignments);
  }, []);

  const addCustomTask = useCallback((task: Omit<CustomTask, "id">) => {
    setCustomTasks((current) => [...current, { ...task, id: makeId() }]);
  }, []);

  const deleteCustomTask = useCallback((id: string) => {
    setCustomTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const setHouseholdComplete = useCallback((complete: boolean) => {
    setHouseholdCompleteState(complete);
  }, []);

  useEffect(() => {
    if (!householdComplete || !householdId) return;
    Promise.resolve(
      supabase.rpc("seed_item_difficulty", { target_household_id: householdId }),
    ).then(
      ({ error }) => {
        if (error) {
          reportSupabaseError("seed item difficulties", error, { householdId });
          console.warn("Item difficulties could not be seeded:", error.message);
        }
      },
    ).catch((error) => {
      reportRuntimeError("seed item difficulties", error, { householdId });
    });
  }, [householdComplete, householdId]);

  const setItemDifficulty = useCallback(async (
    category: ItemCategory,
    item: string,
    difficulty: Difficulty,
  ) => {
    if (!householdId) throw new Error("No household is selected.");
    const { error } = await supabase.from("item_difficulty").upsert(
      { household_id: householdId, category, item, difficulty },
      { onConflict: "household_id,category,item" },
    );
    if (error) {
      reportSupabaseError("save item difficulty", error, { householdId, category, item });
      throw error;
    }
    setItemDifficulties((current) => {
      const next = current.filter((entry) => !(entry.category === category && entry.item === item));
      return [...next, { householdId, category, item, difficulty }];
    });
  }, [householdId]);

  const resetItemDifficulties = useCallback(async () => {
    if (!householdId) throw new Error("No household is selected.");
    const { error: deleteError } = await supabase
      .from("item_difficulty")
      .delete()
      .eq("household_id", householdId);
    if (deleteError) {
      reportSupabaseError("clear item difficulties", deleteError, { householdId });
      throw deleteError;
    }
    const { error: seedError } = await supabase.rpc("seed_item_difficulty", {
      target_household_id: householdId,
    });
    if (seedError) {
      reportSupabaseError("reset item difficulties", seedError, { householdId });
      throw seedError;
    }
  }, [householdId]);

  const setMemberPreference = useCallback(async (key: string, value: number) => {
    const memberId = session?.user.id;
    if (!householdId || !memberId) throw new Error("No household member is selected.");
    const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
    const { error } = await supabase.from("member_task_preferences").upsert(
      {
        household_id: householdId,
        member_id: memberId,
        key,
        value: normalizedValue,
      },
      { onConflict: "household_id,member_id,key" },
    );
    if (error) {
      reportSupabaseError("save member task preference", error, {
        householdId,
        memberId,
        key,
      });
      throw error;
    }
    setMemberPreferences((current) => [
      ...current.filter((entry) => !(entry.memberId === memberId && entry.key === key)),
      { householdId, memberId, key, value: normalizedValue },
    ]);
  }, [householdId, session?.user.id]);

  const setCurrentProposedChart = useCallback(async (chart: ProposedChart | null) => {
    if (!householdId) throw new Error("No household is selected.");
    if (!chart) {
      if (currentProposedChart) {
        const { error } = await supabase
          .from("proposed_charts")
          .update({ status: "cancelled" })
          .eq("id", currentProposedChart.id);
        if (error) {
          reportSupabaseError("cancel proposed chart", error, {
            householdId,
            chartId: currentProposedChart.id,
          });
          throw error;
        }
      }
      setCurrentProposedChartState(null);
      return;
    }
    const { error } = await supabase.from("proposed_charts").upsert({
      id: chart.id,
      household_id: householdId,
      created_by: chart.createdBy,
      status: chart.status,
      payload: chart.payload,
      created_at: chart.createdAt,
    });
    if (error) {
      reportSupabaseError("save proposed chart", error, {
        householdId,
        chartId: chart.id,
      });
      throw error;
    }
    setCurrentProposedChartState(chart);
  }, [currentProposedChart, householdId]);

  const proposeChart = useCallback(async (payload: ProposedChart["payload"]) => {
    if (!householdId) throw new Error("No household is selected.");
    const { error } = await supabase.rpc("replace_proposed_chart", {
      target_household_id: householdId,
      chart_payload: payload,
    });
    if (error) {
      reportSupabaseError("replace proposed chart", error, { householdId });
      throw error;
    }
  }, [householdId]);

  const approveProposedChart = useCallback(async () => {
    if (!currentProposedChart || currentProposedChart.status !== "pending") return;
    const { error } = await supabase.rpc("approve_proposed_chart", {
      target_chart_id: currentProposedChart.id,
    });
    if (error) {
      reportSupabaseError("approve proposed chart", error, {
        chartId: currentProposedChart.id,
      });
      throw error;
    }
  }, [currentProposedChart]);

  const forceApproveProposedChart = useCallback(async () => {
    if (!currentProposedChart || currentProposedChart.status !== "pending") return;
    const { error } = await supabase.rpc("force_approve_proposed_chart", {
      target_chart_id: currentProposedChart.id,
    });
    if (error) {
      reportSupabaseError("force approve proposed chart", error, {
        chartId: currentProposedChart.id,
      });
      throw error;
    }
  }, [currentProposedChart]);

  const restartChartProcess = useCallback(async () => {
    if (!householdId) return;
    const { error } = await supabase.rpc("cancel_proposed_charts", {
      target_household_id: householdId,
    });
    if (error) {
      reportSupabaseError("restart chart process", error, { householdId });
      throw error;
    }
    setCurrentProposedChartState(null);
    setChartApprovals([]);
  }, [householdId]);

  const setCurrentUser = useCallback((id: string) => {
    setCurrentUserIdState(id);
  }, []);

  const setPendingIouDraft = useCallback((draft: PendingIouDraft | null) => {
    setPendingIouDraftState(draft);
  }, []);

  const removeNudge = useCallback(async (toRoommateId: string, choreId: string) => {
    if (!householdId) throw new Error("Your household is still loading.");
    const { error } = await supabase
      .from("nudges")
      .delete()
      .eq("household_id", householdId)
      .eq("to_member_id", toRoommateId)
      .eq("chore_id", choreId)
      .eq("seen", false);
    if (error) {
      reportSupabaseError("remove anonymous nudge", error, {
        householdId,
        choreId,
        recipientId: toRoommateId,
      });
      throw error;
    }
    setNudges((current) =>
      current.filter((nudge) => !(nudge.toRoommateId === toRoommateId && nudge.choreId === choreId))
    );
  }, [householdId]);

  const acknowledgeNudge = useCallback(async (nudgeId: string) => {
    if (!householdId || !session?.user.id) {
      throw new Error("Your household is still loading.");
    }
    const { error } = await supabase
      .from("nudges")
      .update({ seen: true })
      .eq("id", nudgeId)
      .eq("household_id", householdId)
      .eq("to_member_id", session.user.id);
    if (error) {
      reportSupabaseError("acknowledge received nudge", error, {
        householdId,
        nudgeId,
      });
      throw error;
    }
    setNudges((current) =>
      current.map((nudge) => nudge.id === nudgeId ? { ...nudge, seen: true } : nudge)
    );
  }, [householdId, session?.user.id]);

  const getRoommateById = useCallback(
    (id: string) => roommates.find((r) => r.id === id),
    [roommates]
  );

  const updateRoommate = useCallback(
    async (id: string, patch: Partial<Pick<Roommate, "name" | "color" | "avatarUri">>) => {
      if (id !== session?.user.id || !householdId) {
        throw new Error("You can only update your own active Sweetmate profile.");
      }
      const membershipPatch: { display_name?: string; color?: string } = {};
      if (patch.name !== undefined) membershipPatch.display_name = patch.name.trim();
      if (patch.color !== undefined) membershipPatch.color = patch.color;
      if (Object.keys(membershipPatch).length > 0) {
        const { error } = await supabase
          .from("household_members")
          .update(membershipPatch)
          .eq("household_id", householdId)
          .eq("user_id", id);
        if (error) {
          reportSupabaseError("update household member profile", error, { householdId });
          throw error;
        }
      }
      setRoommates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    [householdId, session?.user.id]
  );

  const getChoresByRoommate = useCallback(
    (id: string) => chores.filter((c) => c.assignedTo === id),
    [chores]
  );

  const getBalances = useCallback((): Record<string, number> => {
    const balanceCents: Record<string, number> = {};
    roommates.forEach((r) => (balanceCents[r.id] = 0));
    expenses
      .filter((e) => !e.settled)
      .forEach((e) => {
        Object.entries(e.splits ?? {}).forEach(([personId, amount]) => {
          if (personId !== e.paidBy && !(e.paidBack ?? {})[personId]) {
            const cents = Math.round((amount as number) * 100);
            balanceCents[personId] = (balanceCents[personId] ?? 0) - cents;
            balanceCents[e.paidBy] = (balanceCents[e.paidBy] ?? 0) + cents;
          }
        });
      });
    return Object.fromEntries(
      Object.entries(balanceCents).map(([memberId, cents]) => [memberId, cents / 100]),
    );
  }, [expenses, roommates]);

  // AppProvider also owns synchronization-only state (hydration flags,
  // realtime readiness, auth token refreshes). Those updates should not
  // broadcast a brand-new context object to every mounted tab when none of
  // the values that screens consume changed.
  const contextValue = useMemo<AppContextType>(() => ({
    itemDifficulties,
    setItemDifficulty,
    resetItemDifficulties,
    memberPreferences,
    setMemberPreference,
    currentProposedChart,
    setCurrentProposedChart,
    liveChart,
    setLiveChart,
    customTasks,
    addCustomTask,
    deleteCustomTask,
    chartApprovals,
    proposeChart,
    approveProposedChart,
    forceApproveProposedChart,
    restartChartProcess,
    isHost,
    preferencesLoaded,
    preferencesOnboardingPending,
    finishPreferencesOnboarding,
    quickGuideOpen,
    openQuickGuide,
    dismissQuickGuide,
    appAlerts,
    markAlertRead,
    markAllAlertsRead,
    householdComplete,
    setHouseholdComplete,
    colorScheme,
    setColorScheme,
    pointsEnabled,
    setPointsEnabled,
    plantEnabled,
    setPlantEnabled,
    householdId,
    householdName,
    inviteCode,
    householdLoading,
    membersLoading,
    currentMemberRole,
    refreshMembers,
    refreshHousehold,
    createHousehold,
    joinHousehold,
    deleteHousehold,
    removeRoommate,
    deleteOwnAccount,
    currentUserId,
    setCurrentUser,
    roommates,
    chores,
    expenses,
    shoppingLists,
    shoppingItems,
    borrowItems,
    nudges,
    addChore,
    addChores,
    completeChore,
    pickUpChore,
    deleteChore,
    addExpense,
    updateExpense,
    settleExpense,
    deleteExpense,
    markPersonPaid,
    addShoppingList,
    reorderShoppingLists,
    pinShoppingList,
    deleteShoppingList,
    addShoppingItem,
    toggleShoppingItem,
    deleteShoppingItem,
    reorderShoppingItems,
    assignShoppingList,
    assignShoppingItem,
    updateShoppingItemPrice,
    linkShoppingItemsToExpense,
    pendingIouDraft,
    setPendingIouDraft,
    addBorrowItem,
    updateBorrowItem,
    returnBorrowItem,
    deleteBorrowItem,
    sendNudge,
    removeNudge,
    acknowledgeNudge,
    getRoommateById,
    updateRoommate,
    getChoresByRoommate,
    getBalances,
    essentialsAssignees,
    setEssentialAssignee,
    suppressedAlerts,
    suppressAlert,
    roommateStatuses,
    setRoommateStatus,
    sleepStartedAt,
    homeLocation,
    setHomeLocation,
    choreChart,
    choreChartStartedAt,
    setChoreChart,
    homeProfile,
    setHomeProfile: setHomeProfileState,
  }), [
    itemDifficulties, setItemDifficulty, resetItemDifficulties,
    memberPreferences, setMemberPreference, currentProposedChart,
    setCurrentProposedChart, liveChart, setLiveChart, customTasks,
    addCustomTask, deleteCustomTask, chartApprovals, proposeChart,
    approveProposedChart, forceApproveProposedChart, restartChartProcess,
    isHost, preferencesLoaded, preferencesOnboardingPending,
    finishPreferencesOnboarding, quickGuideOpen, openQuickGuide,
    dismissQuickGuide, appAlerts, markAlertRead, markAllAlertsRead,
    householdComplete, setHouseholdComplete,
    colorScheme, pointsEnabled, plantEnabled, householdId, householdName,
    inviteCode, householdLoading, membersLoading, currentMemberRole,
    refreshMembers, refreshHousehold, createHousehold, joinHousehold,
    deleteHousehold, removeRoommate, deleteOwnAccount, currentUserId,
    setCurrentUser, roommates, chores, expenses, shoppingLists, shoppingItems,
    borrowItems, nudges, addChore, addChores, completeChore, pickUpChore, deleteChore,
    addExpense, updateExpense, settleExpense, deleteExpense, markPersonPaid,
    addShoppingList, reorderShoppingLists, pinShoppingList, deleteShoppingList,
    addShoppingItem, toggleShoppingItem, deleteShoppingItem,
    reorderShoppingItems, assignShoppingList, assignShoppingItem,
    updateShoppingItemPrice, linkShoppingItemsToExpense, pendingIouDraft, setPendingIouDraft, addBorrowItem,
    updateBorrowItem, returnBorrowItem, deleteBorrowItem, sendNudge,
    removeNudge, acknowledgeNudge, getRoommateById, updateRoommate,
    getChoresByRoommate, getBalances, essentialsAssignees,
    setEssentialAssignee, suppressedAlerts, suppressAlert, roommateStatuses,
    setRoommateStatus, sleepStartedAt, homeLocation, setHomeLocation,
    choreChart, choreChartStartedAt, setChoreChart, homeProfile,
  ]);

  const selectorStoreRef = useRef<AppContextStore | null>(null);
  if (!selectorStoreRef.current) {
    selectorStoreRef.current = createAppContextStore(contextValue);
  }
  const selectorStore = selectorStoreRef.current;
  useLayoutEffect(() => {
    selectorStore.setSnapshot(contextValue);
  }, [contextValue, selectorStore]);

  return (
    <AppContextStoreContext.Provider value={selectorStore}>
      <AppContext.Provider value={contextValue}>
        {children}
      </AppContext.Provider>
    </AppContextStoreContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

/**
 * Subscribe to only the context fields a component actually consumes.
 * This keeps an expense edit from rerendering Shopping/Borrowing, and keeps
 * theme-only changes from rebuilding domain selectors. AppContext remains the
 * single state owner; this is a selective subscription layer, not a new store.
 */
export function useAppContextSelector<T>(
  selector: (context: AppContextType) => T,
): T {
  const store = useContext(AppContextStoreContext);
  if (!store) {
    throw new Error("useAppContextSelector must be used within AppProvider");
  }
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const hasSelectionRef = useRef(false);
  const selectionRef = useRef<T>(undefined);
  const getSelection = useCallback(() => {
    const next = selectorRef.current(store.getSnapshot());
    if (
      hasSelectionRef.current &&
      shallowEqualSelection(selectionRef.current, next)
    ) {
      return selectionRef.current as T;
    }
    hasSelectionRef.current = true;
    selectionRef.current = next;
    return next;
  }, [store]);
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

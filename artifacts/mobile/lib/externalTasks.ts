import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Linking, Platform } from "react-native";

const REMINDER_LIST_TITLE = "SweetMate";
const MAPPING_KEY_PREFIX = "@sweetmate/external-task/v1";
const DESTINATION_KEY_PREFIX = "@sweetmate/external-task-destination/v1";

export type ExternalTaskDestination =
  | "googleCalendar"
  | "reminders"
  | "both";

export type ExternalTaskChore = {
  id: string;
  title: string;
  dueDate: string;
  category?: string;
  assignedToName?: string;
  points?: number;
  includePoints?: boolean;
};

type StoredExternalTask = {
  provider: "ios-reminders";
  externalId: string;
  fingerprint: string;
};

export type ExternalTaskExportFailure = {
  choreId: string;
  title: string;
  message: string;
};

export type ExternalTaskExportResult = {
  created: number;
  updated: number;
  unchanged: number;
  failures: ExternalTaskExportFailure[];
};

export type ExternalTaskSupport = {
  supported: boolean;
  actionLabel: string;
  destinationLabel: string;
  unavailableReason?: string;
};

export class ExternalTaskError extends Error {
  constructor(
    public readonly code:
      | "UNSUPPORTED"
      | "PERMISSION_DENIED"
      | "PERMISSION_RESTRICTED"
      | "NATIVE_MODULE_UNAVAILABLE"
      | "NO_WRITABLE_LIST"
      | "EXPORT_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ExternalTaskError";
  }
}

export function getExternalTaskSupport(): ExternalTaskSupport {
  if (Platform.OS === "ios") {
    return {
      supported: true,
      actionLabel: "Add My Tasks to Reminders",
      destinationLabel: "Apple Reminders",
    };
  }

  if (Platform.OS === "android") {
    return {
      supported: false,
      actionLabel: "Add My Tasks",
      destinationLabel: "Tasks",
      unavailableReason:
        "Task export is not available on Android yet. SweetMate will not create calendar events in its place.",
    };
  }

  return {
    supported: false,
    actionLabel: "Add My Tasks",
    destinationLabel: "Tasks",
    unavailableReason:
      "Task export is available in the SweetMate iOS app, not in the web preview.",
  };
}

function destinationKey(userScope: string) {
  return `${DESTINATION_KEY_PREFIX}/${encodeURIComponent(userScope)}`;
}

export async function getExternalTaskDestination(
  userScope: string,
): Promise<ExternalTaskDestination | null> {
  const stored = await AsyncStorage.getItem(destinationKey(userScope));
  return stored === "googleCalendar" ||
    stored === "reminders" ||
    stored === "both"
    ? stored
    : null;
}

export async function setExternalTaskDestination(
  userScope: string,
  destination: ExternalTaskDestination,
) {
  await AsyncStorage.setItem(destinationKey(userScope), destination);
}

function mappingKey(userScope: string, choreId: string) {
  return `${MAPPING_KEY_PREFIX}/${encodeURIComponent(userScope)}/${encodeURIComponent(choreId)}`;
}

function taskFingerprint(chore: ExternalTaskChore) {
  return JSON.stringify({
    title: chore.title.trim(),
    dueDate: new Date(chore.dueDate).toISOString(),
    category: chore.category ?? "",
    assignedToName: chore.assignedToName ?? "",
  });
}

function reminderDetails(chore: ExternalTaskChore): Calendar.Reminder {
  const notes = [
    "Added from SweetMate",
    chore.assignedToName ? `Assigned to: ${chore.assignedToName}` : null,
    chore.category ? `Category: ${chore.category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: chore.title.trim(),
    notes,
    dueDate: new Date(chore.dueDate),
    allDay: true,
    completed: false,
  };
}

function normalizeNativeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The reminder could not be saved.";
}

function looksLikeMissingReminder(error: unknown) {
  const message = normalizeNativeError(error).toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no reminder") ||
    message.includes("invalid identifier")
  );
}

async function requireReminderPermission() {
  let response: Awaited<ReturnType<typeof Calendar.getRemindersPermissionsAsync>>;
  try {
    response = await Calendar.getRemindersPermissionsAsync();
    if (!response.granted && response.canAskAgain) {
      response = await Calendar.requestRemindersPermissionsAsync();
    }
  } catch (error) {
    throw new ExternalTaskError(
      "NATIVE_MODULE_UNAVAILABLE",
      `Apple Reminders access is unavailable in this build. If you're using Expo Go, open SweetMate in a development or release build instead. ${normalizeNativeError(error)}`,
    );
  }

  if (response.granted) return;
  if (response.status === "denied" && !response.canAskAgain) {
    throw new ExternalTaskError(
      "PERMISSION_DENIED",
      "Reminders access is off. Enable SweetMate in Settings → Privacy & Security → Reminders, then try again.",
    );
  }
  throw new ExternalTaskError(
    "PERMISSION_RESTRICTED",
    "SweetMate cannot access Reminders on this device. Check Screen Time or device privacy restrictions.",
  );
}

async function getOrCreateReminderList(): Promise<string | null> {
  let calendars: Calendar.Calendar[];
  try {
    calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
  } catch (error) {
    throw new ExternalTaskError(
      "NO_WRITABLE_LIST",
      `SweetMate could not read your reminder lists. ${normalizeNativeError(error)}`,
    );
  }

  const existing = calendars.find(
    (calendar) =>
      calendar.title === REMINDER_LIST_TITLE && calendar.allowsModifications,
  );
  if (existing) return existing.id;

  const writable = calendars.find((calendar) => calendar.allowsModifications);
  const sourceId = writable?.sourceId ?? writable?.source?.id;

  if (sourceId) {
    try {
      return await Calendar.createCalendarAsync({
        title: REMINDER_LIST_TITLE,
        color: "#111111",
        entityType: Calendar.EntityTypes.REMINDER,
        sourceId,
      });
    } catch {
      // Some managed reminder accounts do not allow apps to create lists.
      // Use an existing writable list rather than failing the whole export.
    }
  }

  // A null calendar ID asks EventKit to use the OS default Reminders list.
  // If that is unavailable, the individual create call returns a useful error.
  return writable?.id ?? null;
}

async function createReminder(
  calendarId: string | null,
  chore: ExternalTaskChore,
) {
  try {
    return await Calendar.createReminderAsync(calendarId, reminderDetails(chore));
  } catch (error) {
    throw new ExternalTaskError(
      "NO_WRITABLE_LIST",
      `No writable Reminders list was available. ${normalizeNativeError(error)}`,
    );
  }
}

async function exportOne(
  userScope: string,
  calendarId: string | null,
  chore: ExternalTaskChore,
): Promise<"created" | "updated" | "unchanged"> {
  const key = mappingKey(userScope, chore.id);
  const fingerprint = taskFingerprint(chore);
  const rawMapping = await AsyncStorage.getItem(key);
  let mapping: StoredExternalTask | null = null;

  if (rawMapping) {
    try {
      const parsed = JSON.parse(rawMapping) as Partial<StoredExternalTask>;
      if (
        parsed.provider === "ios-reminders" &&
        typeof parsed.externalId === "string" &&
        typeof parsed.fingerprint === "string"
      ) {
        mapping = parsed as StoredExternalTask;
      }
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }

  if (mapping) {
    try {
      await Calendar.getReminderAsync(mapping.externalId);
      if (mapping.fingerprint === fingerprint) return "unchanged";
      await Calendar.updateReminderAsync(
        mapping.externalId,
        reminderDetails(chore),
      );
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ ...mapping, fingerprint }),
      );
      return "updated";
    } catch (error) {
      if (!looksLikeMissingReminder(error)) throw error;
      await AsyncStorage.removeItem(key);
    }
  }

  const externalId = await createReminder(calendarId, chore);
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      provider: "ios-reminders",
      externalId,
      fingerprint,
    } satisfies StoredExternalTask),
  );
  return "created";
}

export async function exportChoresToExternalTasks(
  userScope: string,
  chores: ExternalTaskChore[],
): Promise<ExternalTaskExportResult> {
  const support = getExternalTaskSupport();
  if (!support.supported || Platform.OS !== "ios") {
    throw new ExternalTaskError(
      "UNSUPPORTED",
      support.unavailableReason ?? "Task export is not supported on this device.",
    );
  }

  await requireReminderPermission();
  const calendarId = await getOrCreateReminderList();
  const result: ExternalTaskExportResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    failures: [],
  };

  for (const chore of chores) {
    try {
      const outcome = await exportOne(userScope, calendarId, chore);
      result[outcome] += 1;
    } catch (error) {
      result.failures.push({
        choreId: chore.id,
        title: chore.title,
        message: normalizeNativeError(error),
      });
    }
  }

  return result;
}

export async function openChoreInGoogleCalendar(chore: ExternalTaskChore) {
  const due = new Date(chore.dueDate);
  if (Number.isNaN(due.getTime())) {
    throw new ExternalTaskError("EXPORT_FAILED", "This chore has an invalid due date.");
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const formatDate = (date: Date) =>
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const next = new Date(due);
  next.setDate(due.getDate() + 1);
  const notes = [
    "Added from SweetMate",
    chore.assignedToName ? `Assigned to: ${chore.assignedToName}` : null,
    chore.category ? `Category: ${chore.category}` : null,
    chore.includePoints && chore.points ? `Points: +${chore.points}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `🏠 ${chore.title}`,
    dates: `${formatDate(due)}/${formatDate(next)}`,
    details: notes,
  });
  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
  if (!(await Linking.canOpenURL(url))) {
    throw new ExternalTaskError(
      "EXPORT_FAILED",
      "Google Calendar could not be opened on this device.",
    );
  }
  await Linking.openURL(url);
}

export async function exportChoreToDestinations(
  userScope: string,
  chore: ExternalTaskChore,
  destination: ExternalTaskDestination,
) {
  const failures: string[] = [];

  if (destination === "reminders" || destination === "both") {
    try {
      const result = await exportChoresToExternalTasks(userScope, [chore]);
      failures.push(...result.failures.map((failure) => failure.message));
    } catch (error) {
      failures.push(normalizeNativeError(error));
    }
  }

  if (destination === "googleCalendar" || destination === "both") {
    try {
      await openChoreInGoogleCalendar(chore);
    } catch (error) {
      failures.push(normalizeNativeError(error));
    }
  }

  if (failures.length > 0) {
    throw new ExternalTaskError(
      "EXPORT_FAILED",
      failures.join("\n"),
    );
  }
}

import type { Chore } from "../context/AppContext";
import { advanceChoreDueDate } from "./choreSchedule.ts";

export function choreLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function choreOccurrenceIdentity(chore: Chore): string {
  return `${chore.householdId ?? "unknown"}:${chore.recurrenceSeriesId ?? chore.id}:${choreLocalDateKey(chore.dueDate)}`;
}

export function isChoreActiveOnDay(chore: Chore, selectedDay: Date): boolean {
  const scheduled = choreLocalDateKey(chore.dueDate);
  const selected = choreLocalDateKey(selectedDay);
  return !chore.completed && Boolean(scheduled && selected && scheduled <= selected);
}

export function isChoreCarryoverOnDay(chore: Chore, selectedDay: Date): boolean {
  return isChoreActiveOnDay(chore, selectedDay) &&
    choreLocalDateKey(chore.dueDate) < choreLocalDateKey(selectedDay);
}

function seriesIdsFor(chores: Chore[]): Map<string, string> {
  const parentByChild = new Map<string, string>();
  chores.forEach((chore) => {
    if (chore.nextOccurrenceId) parentByChild.set(chore.nextOccurrenceId, chore.id);
  });
  const byId = new Map(chores.map((chore) => [chore.id, chore]));
  const result = new Map<string, string>();
  chores.forEach((chore) => {
    if (!chore.recurring) return;
    if (chore.recurrenceSeriesId) {
      result.set(chore.id, chore.recurrenceSeriesId);
      return;
    }
    let root = chore;
    const seen = new Set<string>();
    while (parentByChild.has(root.id) && !seen.has(root.id)) {
      seen.add(root.id);
      const parent = byId.get(parentByChild.get(root.id)!);
      if (!parent) break;
      root = parent;
    }
    result.set(chore.id, root.id);
  });
  return result;
}

export function materializeRecurringOccurrences(
  chores: Chore[],
  throughDay: Date,
  createId: () => string,
  createdAt = new Date().toISOString(),
): Chore[] {
  const throughKey = choreLocalDateKey(throughDay);
  if (!throughKey) return chores;
  const seriesIds = seriesIdsFor(chores);
  let changed = false;
  const normalized = chores.map((chore) => {
    const seriesId = seriesIds.get(chore.id);
    if (!seriesId || chore.recurrenceSeriesId === seriesId) return chore;
    changed = true;
    return { ...chore, recurrenceSeriesId: seriesId };
  });
  const groups = new Map<string, Chore[]>();
  normalized.forEach((chore) => {
    if (!chore.recurring) return;
    const seriesId = chore.recurrenceSeriesId ?? chore.id;
    const groupKey = `${chore.householdId ?? "unknown"}:${seriesId}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), chore]);
  });
  const additions: Chore[] = [];
  groups.forEach((series) => {
    const ordered = [...series].sort(
      (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
    );
    const existingDates = new Set(ordered.map((chore) => choreLocalDateKey(chore.dueDate)));
    const anchor = ordered[0];
    const seriesId = anchor.recurrenceSeriesId ?? anchor.id;
    let dueDate = anchor.initialDueDate ?? anchor.dueDate;
    let occurrenceIndex = 0;
    for (let guard = 0; guard < 1000; guard += 1) {
      const dueKey = choreLocalDateKey(dueDate);
      if (!dueKey || dueKey > throughKey) break;
      if (!existingDates.has(dueKey)) {
        const prior = [...ordered, ...additions]
          .filter((candidate) =>
            candidate.recurrenceSeriesId === seriesId &&
            candidate.householdId === anchor.householdId &&
            choreLocalDateKey(candidate.dueDate) < dueKey
          )
          .sort((left, right) => right.dueDate.localeCompare(left.dueDate))[0] ?? anchor;
        const participants = (anchor.roundRobinParticipantIds ?? []).filter(
          (memberId) => !(anchor.excludedParticipantIds ?? []).includes(memberId),
        );
        const cursor = participants.length
          ? ((anchor.roundRobinCursor ?? 0) + occurrenceIndex) % participants.length
          : 0;
        additions.push({
          ...prior,
          id: createId(),
          assignedTo:
            anchor.assignmentMode === "round-robin"
              ? participants[cursor] ?? prior.assignedTo
              : prior.assignedTo,
          roundRobinCursor: cursor,
          dueDate,
          nextDueDate: dueDate,
          completed: false,
          completedAt: undefined,
          recurrenceSeriesId: seriesId,
          occurrenceIndex,
          nextOccurrenceId: undefined,
          createdAt,
          updatedAt: createdAt,
        });
        existingDates.add(dueKey);
        changed = true;
      }
      dueDate = advanceChoreDueDate(dueDate, anchor.recurring!);
      occurrenceIndex += 1;
    }
  });
  return changed ? [...normalized, ...additions] : chores;
}

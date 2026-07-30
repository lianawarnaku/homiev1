import type { Chore } from "../context/AppContext";
import { choreScheduledDate } from "./choreOccurrences.ts";

export type RecurringChoreClaim = {
  household_id: string;
  recurrence_series_id: string;
  scheduled_date: string;
  occurrence_id: string;
};

export function recurringChoreClaims(
  chores: readonly Chore[],
  householdId: string,
): RecurringChoreClaim[] {
  const claims = new Map<string, RecurringChoreClaim>();
  chores.forEach((chore) => {
    if (!chore.recurring || !chore.recurrenceSeriesId) return;
    const scheduledDate = choreScheduledDate(chore);
    if (!scheduledDate) return;
    const key = `${chore.recurrenceSeriesId}:${scheduledDate}`;
    claims.set(key, {
      household_id: householdId,
      recurrence_series_id: chore.recurrenceSeriesId,
      scheduled_date: scheduledDate,
      occurrence_id: chore.id,
    });
  });
  return [...claims.values()];
}

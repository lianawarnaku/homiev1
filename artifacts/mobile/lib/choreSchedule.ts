import type { Chore, ChoreRecurrence } from "../context/AppContext";

export function advanceChoreDueDate(
  dateValue: string,
  recurrence: ChoreRecurrence,
): string {
  const next = new Date(dateValue);
  if (recurrence === "monthly") {
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const finalDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0,
    ).getDate();
    next.setDate(Math.min(originalDay, finalDay));
  } else {
    next.setDate(
      next.getDate() +
        (recurrence === "daily" ? 1 : recurrence === "biweekly" ? 14 : 7),
    );
  }
  return next.toISOString();
}

export function resolveRoundRobinParticipants(
  chore: Chore,
  activeMemberIds: string[],
): string[] {
  const active = new Set(activeMemberIds);
  const excluded = new Set(chore.excludedParticipantIds ?? []);
  const stored = (chore.roundRobinParticipantIds ?? []).filter(
    (id) => active.has(id) && !excluded.has(id),
  );
  if (!chore.roundRobinAllMembers) return stored;
  const addedMembers = activeMemberIds
    .filter((id) => !stored.includes(id) && !excluded.has(id))
    .sort();
  return [...stored, ...addedMembers];
}

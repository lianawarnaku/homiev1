export const NUDGE_DISMISS_DISTANCE = 88;
export const NUDGE_DISMISS_VELOCITY = 700;

export type DisplayNudge = {
  id: string;
  toRoommateId: string;
  sentAt: string;
  dismissedAt?: string;
};

export function visibleNudges<T extends DisplayNudge>(
  nudges: readonly T[],
  recipientId: string,
): T[] {
  return nudges
    .filter(
      (nudge) =>
        nudge.toRoommateId === recipientId && nudge.dismissedAt === undefined,
    )
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
    );
}

export function shouldDismissNudge(translationX: number, velocityX: number) {
  return (
    Math.abs(translationX) >= NUDGE_DISMISS_DISTANCE ||
    Math.abs(velocityX) >= NUDGE_DISMISS_VELOCITY
  );
}

export interface CompletionTransition {
  changed: boolean;
  pointsDelta: number;
}

export function choreCompletionTransition(
  current: boolean,
  desired: boolean,
  points: number,
): CompletionTransition {
  if (current === desired) return { changed: false, pointsDelta: 0 };
  return {
    changed: true,
    pointsDelta: desired ? points : -points,
  };
}

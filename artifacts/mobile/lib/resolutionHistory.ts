const DAY_MS = 86_400_000;

export const HISTORY_PAGE_SIZE = 50;

export function becomesHistoricalAt(
  resolvedAt: string | undefined,
): number | null {
  if (!resolvedAt) return null;
  const resolved = new Date(resolvedAt);
  if (!Number.isFinite(resolved.getTime())) return null;
  resolved.setDate(resolved.getDate() + 7);
  return resolved.getTime();
}

export function isHistoricalResolution(
  resolvedAt: string | undefined,
  now = new Date(),
): boolean {
  const boundary = becomesHistoricalAt(resolvedAt);
  return boundary !== null && now.getTime() >= boundary;
}

export function historyPage<T>(
  records: T[],
  resolvedAt: (record: T) => string | undefined,
  page: number,
  pageSize = HISTORY_PAGE_SIZE,
): T[] {
  return records
    .slice()
    .sort(
      (left, right) =>
        new Date(resolvedAt(right) ?? 0).getTime() -
        new Date(resolvedAt(left) ?? 0).getTime(),
    )
    .slice(0, Math.max(1, page) * pageSize);
}

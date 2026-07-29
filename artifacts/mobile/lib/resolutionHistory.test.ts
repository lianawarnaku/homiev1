import {
  HISTORY_PAGE_SIZE,
  historyPage,
  isHistoricalResolution,
} from "./resolutionHistory.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const resolved = "2026-07-01T12:00:00.000Z";
assert(
  !isHistoricalResolution(resolved, new Date("2026-07-08T11:59:59.999Z")),
  "resolved records under seven days must remain active",
);
assert(
  isHistoricalResolution(resolved, new Date("2026-07-08T12:00:00.000Z")),
  "resolved records must enter history at the exact seven-day boundary",
);
assert(
  !isHistoricalResolution(undefined, new Date("2030-01-01T00:00:00.000Z")),
  "legacy resolved records without a timestamp must not be assigned a fake history date",
);

const large = Array.from({ length: 10_000 }, (_, index) => ({
  id: String(index),
  resolvedAt: new Date(2026, 0, 1, 0, index).toISOString(),
}));
const firstPage = historyPage(large, (record) => record.resolvedAt, 1);
assert(firstPage.length === HISTORY_PAGE_SIZE, "history must render a bounded first page");
assert(firstPage[0].id === "9999", "history must sort most recently resolved first");
assert(historyPage(large, (record) => record.resolvedAt, 2).length === 100, "history pagination must be bounded");

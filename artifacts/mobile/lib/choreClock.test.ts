// Node does not define React Native's development global.
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

const { choreNow } = await import("./choreClock.ts");

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const previous = process.env.EXPO_PUBLIC_CHORE_NOW;
process.env.EXPO_PUBLIC_CHORE_NOW = "2028-02-29T12:00:00-05:00";
assert(
  choreNow(new Date("2026-01-01T00:00:00Z")).toISOString() ===
    "2028-02-29T17:00:00.000Z",
  "development clock must accept a controllable ISO timestamp",
);
process.env.EXPO_PUBLIC_CHORE_NOW = "not-a-date";
assert(
  choreNow(new Date("2026-01-01T00:00:00Z")).toISOString() ===
    "2026-01-01T00:00:00.000Z",
  "an invalid development clock must safely use real time",
);
if (previous === undefined) delete process.env.EXPO_PUBLIC_CHORE_NOW;
else process.env.EXPO_PUBLIC_CHORE_NOW = previous;

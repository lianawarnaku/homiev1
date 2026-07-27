import type { GeneratedTask } from "../context/AppContext";
import {
  buildBalancedChart,
  loadSpread,
  taskLoad,
} from "./choreEngine.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const tasks: GeneratedTask[] = [
  { id: "daily", itemCategory: "kitchen", item: "Sink", title: "Sink", frequency: "daily", timeOfDay: "any", difficulty: 2 },
  { id: "weekly-a", itemCategory: "bathroom", item: "Shower", title: "Shower", frequency: "weekly", timeOfDay: "morning", difficulty: 5 },
  { id: "weekly-b", itemCategory: "living", item: "Floor", title: "Floor", frequency: "weekly", timeOfDay: "night", difficulty: 4 },
];

assert(taskLoad(tasks[0]) === 14, "daily task load must be frequency weighted");
const chart = buildBalancedChart(tasks, [{ id: "a" }, { id: "b" }]);
assert(chart.assignments.flatMap((assignment) => assignment.taskIds).sort().join(",") === "daily,weekly-a,weekly-b", "every task must be assigned once");
assert(loadSpread(chart.memberLoads ?? []) <= 5, "deterministic balancing should bound this fixture's load spread");

const pinned = buildBalancedChart(tasks, [{ id: "a" }, { id: "b" }], [], {
  pinnedAssignments: { daily: "b" },
});
assert(pinned.assignments.find((assignment) => assignment.memberId === "b")?.taskIds.includes("daily") === true, "pinned tasks must use the selected member");

let rejected = false;
try {
  buildBalancedChart(tasks, []);
} catch {
  rejected = true;
}
assert(rejected, "chart generation must reject an empty member list");

rejected = false;
try {
  buildBalancedChart([tasks[0]], [{ id: "a" }], [], {
    excludedAssignments: { daily: ["a"] },
  });
} catch {
  rejected = true;
}
assert(rejected, "chart generation must reject tasks with no eligible member");

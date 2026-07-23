import { occurrencesPerWeek } from "../constants/choreRules";
import type {
  Assignment,
  GeneratedTask,
  MemberLoad,
  MemberPreference,
  ProposedChart,
} from "../context/AppContext";

export type ChoreEngineMode = "perfectSplit" | "preference";

export interface ChoreEngineMember {
  id: string;
}

export interface ChoreEngineOptions {
  mode?: ChoreEngineMode;
  /**
   * When false, load is raw difficulty and frequency is ignored.
   * Defaults to true.
   */
  frequencyWeighted?: boolean;
  /**
   * Soft preference influence. Kept deliberately small so preferences nudge
   * close choices without defeating balance. Recommended range: 0–0.35.
   */
  preferenceWeight?: number;
  /** A value at or below this threshold may break a keep-together group. */
  strongAversionThreshold?: number;
  pinnedAssignments?: Record<string, string>;
  excludedAssignments?: Record<string, string[]>;
}

export type ChoreEnginePayload = Pick<
  ProposedChart["payload"],
  "assignments" | "memberLoads" | "generatedTasks"
>;

interface WorkUnit {
  key: string;
  tasks: GeneratedTask[];
  load: number;
}

const DEFAULT_PREFERENCE = 50;

export function taskLoad(
  task: GeneratedTask,
  frequencyWeighted = true,
): number {
  return task.difficulty * (
    frequencyWeighted ? occurrencesPerWeek(task.frequency) : 1
  );
}

function preferenceValue(
  preferences: MemberPreference[],
  memberId: string,
  key: string,
): number {
  return preferences.find(
    (preference) =>
      preference.memberId === memberId && preference.key === key,
  )?.value ?? DEFAULT_PREFERENCE;
}

function shouldSplitGroup(
  tasks: GeneratedTask[],
  members: ChoreEngineMember[],
  preferences: MemberPreference[],
  threshold: number,
): boolean {
  return tasks.some(
    (task) =>
      task.timeOfDay !== "any" &&
      members.some(
        (member) =>
          preferenceValue(preferences, member.id, task.timeOfDay) <= threshold,
      ),
  );
}

function buildWorkUnits(
  tasks: GeneratedTask[],
  members: ChoreEngineMember[],
  preferences: MemberPreference[],
  options: Required<Pick<
    ChoreEngineOptions,
    "mode" | "frequencyWeighted" | "strongAversionThreshold"
  >>,
): WorkUnit[] {
  const grouped = new Map<string, GeneratedTask[]>();
  for (const task of tasks) {
    const key = task.keepTogetherGroup
      ? `group:${task.keepTogetherGroup}`
      : `task:${task.id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }

  const units: WorkUnit[] = [];
  for (const [key, groupedTasks] of grouped) {
    const maySplit =
      options.mode === "preference" &&
      groupedTasks.length > 1 &&
      shouldSplitGroup(
        groupedTasks,
        members,
        preferences,
        options.strongAversionThreshold,
      );
    const taskSets = maySplit
      ? groupedTasks.map((task) => [task])
      : [groupedTasks];
    taskSets.forEach((unitTasks, index) => {
      units.push({
        key: maySplit ? `${key}:${index}` : key,
        tasks: unitTasks,
        load: unitTasks.reduce(
          (sum, task) =>
            sum + taskLoad(task, options.frequencyWeighted),
          0,
        ),
      });
    });
  }

  return units.sort(
    (a, b) => b.load - a.load || a.key.localeCompare(b.key),
  );
}

function preferencePenalty(
  unit: WorkUnit,
  memberId: string,
  preferences: MemberPreference[],
  preferenceWeight: number,
  frequencyWeighted: boolean,
): number {
  return unit.tasks.reduce((penalty, task) => {
    if (task.timeOfDay === "any") return penalty;
    const preference = preferenceValue(
      preferences,
      memberId,
      task.timeOfDay,
    );
    // -1 at fully preferred, 0 at impartial, +1 at not preferred.
    const direction = (DEFAULT_PREFERENCE - preference) / DEFAULT_PREFERENCE;
    return (
      penalty +
      taskLoad(task, frequencyWeighted) * direction * preferenceWeight
    );
  }, 0);
}

/**
 * Pure deterministic LPT-style chore assignment.
 *
 * Work units are sorted heaviest-first. Perfect mode always chooses the
 * currently lightest member. Preference mode scores projected load plus a
 * bounded time-of-day penalty; stable input order resolves exact ties.
 */
export function buildBalancedChart(
  tasks: GeneratedTask[],
  members: ChoreEngineMember[],
  preferences: MemberPreference[] = [],
  options: ChoreEngineOptions = {},
): ChoreEnginePayload {
  if (members.length === 0) {
    throw new Error("At least one household member is required.");
  }

  const mode = options.mode ?? "perfectSplit";
  const frequencyWeighted = options.frequencyWeighted ?? true;
  const preferenceWeight = Math.max(
    0,
    Math.min(0.35, options.preferenceWeight ?? 0.2),
  );
  const strongAversionThreshold =
    options.strongAversionThreshold ?? 10;
  const units = buildWorkUnits(tasks, members, preferences, {
    mode,
    frequencyWeighted,
    strongAversionThreshold,
  });

  const totals = new Map(members.map((member) => [member.id, 0]));
  const taskIdsByMember = new Map(
    members.map((member) => [member.id, [] as string[]]),
  );

  for (const unit of units) {
    const pinnedMembers = new Set(
      unit.tasks
        .map((task) => options.pinnedAssignments?.[task.id])
        .filter((memberId): memberId is string => !!memberId),
    );
    let selected = members[0];
    let bestScore = Number.POSITIVE_INFINITY;
    members.forEach((member) => {
      if (pinnedMembers.size > 0 && !pinnedMembers.has(member.id)) return;
      if (unit.tasks.some((task) =>
        options.excludedAssignments?.[task.id]?.includes(member.id)
      )) return;
      const currentLoad = totals.get(member.id) ?? 0;
      const penalty =
        mode === "preference"
          ? preferencePenalty(
              unit,
              member.id,
              preferences,
              preferenceWeight,
              frequencyWeighted,
            )
          : 0;
      const score = currentLoad + unit.load + penalty;
      if (score < bestScore) {
        selected = member;
        bestScore = score;
      }
    });
    if (!Number.isFinite(bestScore)) {
      throw new Error(`No eligible member can be assigned ${unit.key}.`);
    }

    totals.set(selected.id, (totals.get(selected.id) ?? 0) + unit.load);
    taskIdsByMember.get(selected.id)?.push(
      ...unit.tasks.map((task) => task.id),
    );
  }

  const memberLoads: MemberLoad[] = members.map((member) => ({
    memberId: member.id,
    totalLoad: totals.get(member.id) ?? 0,
  }));
  const assignments: Assignment[] = members.map((member) => ({
    memberId: member.id,
    taskIds: taskIdsByMember.get(member.id) ?? [],
    totalLoad: totals.get(member.id) ?? 0,
  }));

  return { assignments, memberLoads, generatedTasks: tasks };
}

export function loadSpread(memberLoads: MemberLoad[]): number {
  if (memberLoads.length < 2) return 0;
  const loads = memberLoads.map((member) => member.totalLoad);
  return Math.max(...loads) - Math.min(...loads);
}

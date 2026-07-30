export type EssentialAssignments = Record<
  string,
  Record<string, string[]>
>;

export function normalizeAssignedUserIds(value: unknown): string[] {
  const ids =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function migrateEssentialAssignments(value: unknown): EssentialAssignments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([sectionId, section]) => [
      sectionId,
      section && typeof section === "object" && !Array.isArray(section)
        ? Object.fromEntries(
            Object.entries(section as Record<string, unknown>)
              .map(([itemId, assignees]) => [
                itemId,
                normalizeAssignedUserIds(assignees),
              ])
              .filter(([, assignees]) => (assignees as string[]).length > 0),
          )
        : {},
    ]),
  );
}

export function setSelfAssignment(
  assignments: EssentialAssignments,
  sectionId: string,
  itemId: string,
  userId: string,
  assigned: boolean,
): EssentialAssignments {
  const currentIds = normalizeAssignedUserIds(assignments[sectionId]?.[itemId]);
  const nextIds = assigned
    ? normalizeAssignedUserIds([...currentIds, userId])
    : currentIds.filter((id) => id !== userId);
  const nextSection = { ...(assignments[sectionId] ?? {}) };
  if (nextIds.length) nextSection[itemId] = nextIds;
  else delete nextSection[itemId];
  return { ...assignments, [sectionId]: nextSection };
}

export function assignmentsFromRows(
  rows: Array<{ section_key: string; item_id: string; user_id: string }>,
): EssentialAssignments {
  return rows.reduce(
    (result, row) =>
      setSelfAssignment(result, row.section_key, row.item_id, row.user_id, true),
    {} as EssentialAssignments,
  );
}

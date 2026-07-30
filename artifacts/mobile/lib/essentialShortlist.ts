import type { EssentialAssignments } from "./essentialAssignments";

export type EssentialShortlist = Record<string, Record<string, boolean>>;

export function shortlistFromRows(
  rows: Array<{ section_key: string; item_id: string }>,
): EssentialShortlist {
  return rows.reduce<EssentialShortlist>((result, row) => ({
    ...result,
    [row.section_key]: {
      ...(result[row.section_key] ?? {}),
      [row.item_id]: true,
    },
  }), {});
}

export function shortlistSelectionRows(shortlist: EssentialShortlist) {
  return Object.entries(shortlist).flatMap(([sectionKey, items]) =>
    Object.entries(items).flatMap(([itemId, selected]) =>
      selected ? [{ section_key: sectionKey, item_id: itemId }] : [],
    ),
  );
}

export function removedShortlistRows(
  baseline: EssentialShortlist,
  next: EssentialShortlist,
) {
  return shortlistSelectionRows(baseline).filter(
    ({ section_key, item_id }) => !next[section_key]?.[item_id],
  );
}

export function personalShortlistedEssentials(
  shortlist: EssentialShortlist,
  assignments: EssentialAssignments,
  userId: string,
) {
  return shortlistSelectionRows(shortlist).filter(({ section_key, item_id }) =>
    (assignments[section_key]?.[item_id] ?? []).includes(userId),
  );
}

export function hasValidBorrowParticipants(
  ownerId: string,
  borrowerId: string,
  householdMemberIds: Iterable<string>,
) {
  if (!ownerId || !borrowerId) return false;
  const members = new Set(householdMemberIds);
  return members.has(ownerId) && members.has(borrowerId);
}

export function canManageBorrowItem(
  item: {
    visibility?: "shared" | "private";
    ownerId?: string;
    creatorId?: string;
    borrowedBy?: string;
    borrowedFrom: string;
  },
  currentUserId: string,
  isHost: boolean,
) {
  if (item.visibility === "private") {
    return item.ownerId === currentUserId;
  }
  const canManageLegacy =
    !item.creatorId &&
    (item.borrowedBy === currentUserId ||
      item.borrowedFrom === currentUserId);
  return isHost || item.creatorId === currentUserId || canManageLegacy;
}

export function canSaveBorrowDraft({
  item,
  ownerId,
  borrowerId,
  householdMemberIds,
}: {
  item: string;
  ownerId: string;
  borrowerId: string;
  householdMemberIds: Iterable<string>;
}) {
  return (
    item.trim().length > 0 &&
    hasValidBorrowParticipants(ownerId, borrowerId, householdMemberIds)
  );
}

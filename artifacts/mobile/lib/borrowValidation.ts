export function hasValidBorrowParticipants(
  ownerId: string,
  borrowerId: string,
  householdMemberIds: Iterable<string>,
) {
  if (!ownerId || !borrowerId) return false;
  const members = new Set(householdMemberIds);
  return members.has(ownerId) && members.has(borrowerId);
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

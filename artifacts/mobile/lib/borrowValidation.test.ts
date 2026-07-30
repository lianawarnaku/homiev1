import {
  canManageBorrowItem,
  canSaveBorrowDraft,
  hasValidBorrowParticipants,
} from "./borrowValidation.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const members = ["user-a", "user-b"];
assert(
  canSaveBorrowDraft({
    item: "Storage key",
    ownerId: "user-a",
    borrowerId: "user-a",
    householdMemberIds: members,
  }),
  "a current household member must be allowed to borrow from themselves",
);
assert(
  canSaveBorrowDraft({
    item: "Book",
    ownerId: "user-a",
    borrowerId: "user-b",
    householdMemberIds: members,
  }),
  "normal owner-to-borrower records must remain valid",
);
assert(
  !canSaveBorrowDraft({
    item: "",
    ownerId: "user-a",
    borrowerId: "user-a",
    householdMemberIds: members,
  }),
  "self-borrowing must not weaken required item validation",
);
assert(
  !hasValidBorrowParticipants("user-a", "outsider", members),
  "cross-household borrowers must remain invalid",
);

const shared = {
  borrowedFrom: "user-b",
  borrowedBy: "user-a",
  creatorId: "user-a",
  visibility: "shared" as const,
};
assert(
  canManageBorrowItem(shared, "user-a", false),
  "the authenticated record creator must be able to manage a shared borrow",
);
assert(
  !canManageBorrowItem(shared, "user-b", false),
  "a non-creator participant must not manage a modern shared borrow",
);
assert(
  canManageBorrowItem(shared, "host", true),
  "the current Sweet host must retain shared-borrow management permission",
);
assert(
  canManageBorrowItem(
    {
      ...shared,
      visibility: "private",
      ownerId: "user-a",
    },
    "user-a",
    true,
  ),
  "a private borrow must remain manageable by its stable owner id",
);
assert(
  !canManageBorrowItem(
    {
      ...shared,
      visibility: "private",
      ownerId: "user-a",
    },
    "host",
    true,
  ),
  "host status must not expose another user's private borrow",
);

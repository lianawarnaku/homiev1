import {
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

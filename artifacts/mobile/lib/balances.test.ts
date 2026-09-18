import { computeNetBalances, isSettled, round2 } from "./balances.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const members = ["a", "b", "c"];

// Members with no expenses are still present, at zero.
const empty = computeNetBalances([], members);
assert(
  members.every((id) => empty[id] === 0),
  "every member must start settled",
);

// A paid $10, B owes $10 of it.
const single = computeNetBalances(
  [{ paidBy: "a", splits: { a: 0, b: 10 }, settled: false }],
  members,
);
assert(single.a === 10 && single.b === -10 && single.c === 0, "simple debt must net both sides");

// Reciprocal debts cancel: B owes A $10, A owes B $6 → net $4.
const reciprocal = computeNetBalances(
  [
    { paidBy: "a", splits: { b: 10 }, settled: false },
    { paidBy: "b", splits: { a: 6 }, settled: false },
  ],
  members,
);
assert(reciprocal.a === 4 && reciprocal.b === -4, "reciprocal debts must cancel to a single net");

// Chains collapse: A→B→C leaves the middle person at zero.
const chain = computeNetBalances(
  [
    { paidBy: "b", splits: { a: 5 }, settled: false },
    { paidBy: "c", splits: { b: 5 }, settled: false },
  ],
  members,
);
assert(chain.a === -5 && chain.b === 0 && chain.c === 5, "chained debts must collapse through the middle");

// Settled expenses and repaid shares are excluded.
const excluded = computeNetBalances(
  [
    { paidBy: "a", splits: { b: 20 }, settled: true },
    { paidBy: "a", splits: { b: 8 }, paidBack: { b: true }, settled: false },
  ],
  members,
);
assert(
  excluded.a === 0 && excluded.b === 0,
  "settled expenses and paid-back shares must not count",
);

// A partial numeric repayment leaves only the remainder outstanding.
const partial = computeNetBalances(
  [{ paidBy: "a", splits: { b: 8 }, paidBack: { b: 3 }, settled: false }],
  members,
);
assert(partial.a === 5 && partial.b === -5, "partial repayment must leave the remainder");

// The payer's own share never becomes a debt to themselves.
const payerShare = computeNetBalances(
  [{ paidBy: "a", splits: { a: 7.5, b: 7.5 }, settled: false }],
  members,
);
assert(payerShare.a === 7.5 && payerShare.b === -7.5, "payer share must be ignored");

// Sub-cent residue reads as settled, and the graph always balances to zero.
const residue = computeNetBalances(
  [
    { paidBy: "a", splits: { b: 3.335 }, settled: false },
    { paidBy: "b", splits: { a: 3.335 }, settled: false },
  ],
  members,
);
assert(residue.a === 0 && residue.b === 0, "sub-cent residue must read as settled");

const spread = computeNetBalances(
  [
    { paidBy: "a", splits: { b: 3.33, c: 3.34 }, settled: false },
    { paidBy: "b", splits: { a: 1.11, c: 2.22 }, settled: false },
  ],
  members,
);
assert(
  round2(Object.values(spread).reduce((sum, value) => sum + value, 0)) === 0,
  "net balances must sum to zero across the household",
);

// Non-members appearing in a split still balance the graph.
const formerMember = computeNetBalances(
  [{ paidBy: "a", splits: { gone: 4 }, settled: false }],
  members,
);
assert(formerMember.a === 4 && formerMember.gone === -4, "unknown split members must still balance");

assert(isSettled(0) && isSettled(0.004) && !isSettled(0.01), "settled threshold must be half a cent");

console.log("balances.test.ts passed");

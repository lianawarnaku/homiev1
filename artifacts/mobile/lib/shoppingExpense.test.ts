import assert from "node:assert/strict";
import {
  linkedItemAllocations,
  pricedListTotalCents,
  remainingListExpenseCents,
} from "./shoppingExpense.ts";
import { buildEvenSplitCents } from "./money.ts";

const items = [
  { id: "a", listId: "groceries", name: "A", price: 20, convertedExpenseId: "expense-a" },
  { id: "b", listId: "groceries", name: "B", price: 10, convertedExpenseId: "expense-b" },
  { id: "duplicate", listId: "groceries", name: "Duplicate", convertedExpenseId: "expense-b" },
  { id: "c", listId: "groceries", name: "C", price: 90 },
  { id: "other", listId: "hardware", name: "Other", price: 500, convertedExpenseId: "expense-other" },
];
const expenses = [
  { id: "expense-a", amount: 20, amountCents: 2000, settled: false },
  { id: "expense-b", amount: 10, settled: true },
  { id: "expense-other", amount: 500, settled: false },
];
const allocations = linkedItemAllocations("groceries", items, expenses);
assert.deepEqual(allocations.map((entry) => entry.expenseId), ["expense-a", "expense-b"]);
assert.equal(pricedListTotalCents("groceries", items), 12000);
assert.equal(remainingListExpenseCents(12000, allocations), 9000);
assert.equal(remainingListExpenseCents(2500, allocations), null);
assert.deepEqual(buildEvenSplitCents(9001, ["a", "b", "c"]), {
  a: 3001,
  b: 3000,
  c: 3000,
});

const manyItems = Array.from({ length: 1000 }, (_, index) => ({
  id: `item-${index}`,
  listId: "large",
  name: `Item ${index}`,
  convertedExpenseId: index < 300 ? `linked-${index}` : undefined,
}));
const manyExpenses = Array.from({ length: 10000 }, (_, index) => ({
  id: index < 300 ? `linked-${index}` : `history-${index}`,
  amount: 1,
  amountCents: 100,
  settled: index % 2 === 0,
}));
assert.equal(linkedItemAllocations("large", manyItems, manyExpenses).length, 300);

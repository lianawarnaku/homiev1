export type ShoppingExpenseItem = {
  id: string;
  listId: string;
  name: string;
  price?: number;
  convertedExpenseId?: string;
};

export type LinkedExpense = {
  id: string;
  amount: number;
  amountCents?: number;
  settled: boolean;
};

export type IndividualAllocation = {
  itemId: string;
  itemName: string;
  expenseId: string;
  amountCents: number;
};

export function linkedItemAllocations(
  listId: string,
  items: readonly ShoppingExpenseItem[],
  expenses: readonly LinkedExpense[],
): IndividualAllocation[] {
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const countedExpenseIds = new Set<string>();
  const allocations: IndividualAllocation[] = [];
  for (const item of items) {
    if (item.listId !== listId || !item.convertedExpenseId) continue;
    const expense = expenseById.get(item.convertedExpenseId);
    if (!expense || countedExpenseIds.has(expense.id)) continue;
    const amountCents =
      expense.amountCents ?? Math.round(expense.amount * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) continue;
    countedExpenseIds.add(expense.id);
    allocations.push({
      itemId: item.id,
      itemName: item.name,
      expenseId: expense.id,
      amountCents,
    });
  }
  return allocations;
}

export function pricedListTotalCents(
  listId: string,
  items: readonly ShoppingExpenseItem[],
): number {
  return items.reduce((total, item) => {
    if (item.listId !== listId || item.price === undefined) return total;
    const cents = Math.round(item.price * 100);
    return Number.isSafeInteger(cents) && cents > 0 ? total + cents : total;
  }, 0);
}

export function remainingListExpenseCents(
  listTotalCents: number,
  allocations: readonly IndividualAllocation[],
): number | null {
  if (!Number.isSafeInteger(listTotalCents) || listTotalCents < 0) return null;
  const allocated = allocations.reduce(
    (total, allocation) => total + allocation.amountCents,
    0,
  );
  return allocated > listTotalCents ? null : listTotalCents - allocated;
}

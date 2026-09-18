// Household-wide IOU netting.
//
// Every unsettled expense contributes a credit to whoever paid and a matching
// debit to each person who still owes a share. Summing those per person gives
// one net figure each, which collapses both reciprocal debts (A owes B, B owes
// A) and chains (A → B → C nets to A owing, C owed, and B at zero) without a
// separate transaction-pairing pass.

export type PaidBackEntry = boolean | number;

export interface NettableExpense {
  paidBy: string;
  // person id → dollars of this expense that person owes the payer
  splits?: Record<string, number> | null;
  // person id → repayment. The app records a boolean ("they paid me back"),
  // but a partial dollar amount is accepted so the column can carry one later.
  paidBack?: Record<string, PaidBackEntry> | null;
  settled?: boolean;
}

// Anything below half a cent is rounding noise, not a debt.
const SETTLED_EPSILON = 0.005;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function repaidAmount(entry: PaidBackEntry | undefined, owed: number): number {
  if (entry === true) return owed;
  if (typeof entry === "number" && Number.isFinite(entry)) return entry;
  return 0;
}

/**
 * Net position per member: positive = the household owes them, negative = they
 * owe the household, 0 = settled. Members with no activity are present at 0.
 */
export function computeNetBalances(
  expenses: readonly NettableExpense[],
  memberIds: readonly string[],
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const memberId of memberIds) net[memberId] = 0;

  for (const expense of expenses) {
    if (expense.settled) continue;
    const payer = expense.paidBy;
    for (const [debtor, share] of Object.entries(expense.splits ?? {})) {
      if (debtor === payer) continue;
      if (typeof share !== "number" || !Number.isFinite(share)) continue;
      const owed = round2(share - repaidAmount((expense.paidBack ?? {})[debtor], share));
      if (owed <= 0) continue;
      net[payer] = (net[payer] ?? 0) + owed;
      net[debtor] = (net[debtor] ?? 0) - owed;
    }
  }

  return Object.fromEntries(
    Object.entries(net).map(([memberId, amount]) => {
      const rounded = round2(amount);
      return [memberId, Math.abs(rounded) < SETTLED_EPSILON ? 0 : rounded];
    }),
  );
}

export function netBalanceOf(
  balances: Record<string, number>,
  memberId: string,
): number {
  return balances[memberId] ?? 0;
}

export function isSettled(net: number): boolean {
  return Math.abs(net) < SETTLED_EPSILON;
}

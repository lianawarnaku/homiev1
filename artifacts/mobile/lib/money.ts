export function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(/^\$/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function parseAllocationToCents(value: string): number | null {
  const normalized = value.trim().replace(/^\$/, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function buildEvenSplitCents(
  totalCents: number,
  participantIds: string[],
): Record<string, number> {
  if (totalCents <= 0 || participantIds.length === 0) return {};
  const base = Math.floor(totalCents / participantIds.length);
  let remainder = totalCents % participantIds.length;
  return Object.fromEntries(
    participantIds.map((id) => {
      const cents = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return [id, cents];
    }),
  );
}

export interface ExpenseAllocationInput {
  total: string;
  payerId: string;
  participantIds: string[];
  allocations: Record<string, string>;
  activeMemberIds: ReadonlySet<string>;
}

export type ExpenseAllocationValidation =
  | { valid: true; totalCents: number; allocationCents: Record<string, number> }
  | { valid: false; reason: string; remainingCents: number };

export function validateExpenseAllocation(input: ExpenseAllocationInput): ExpenseAllocationValidation {
  const totalCents = parseMoneyToCents(input.total);
  if (totalCents === null) return { valid: false, reason: "Enter a positive total.", remainingCents: 0 };
  if (!input.activeMemberIds.has(input.payerId)) return { valid: false, reason: "Choose an active Sweetmate as payer.", remainingCents: totalCents };
  const uniqueParticipants = [...new Set(input.participantIds)];
  if (!uniqueParticipants.length || uniqueParticipants.length !== input.participantIds.length) {
    return { valid: false, reason: "Choose at least one unique participant.", remainingCents: totalCents };
  }
  if (uniqueParticipants.some((id) => !input.activeMemberIds.has(id))) {
    return { valid: false, reason: "A selected Sweetmate is no longer active.", remainingCents: totalCents };
  }
  const allocationCents: Record<string, number> = {};
  for (const id of uniqueParticipants) {
    const cents = parseAllocationToCents(input.allocations[id] ?? "");
    if (cents === null) return { valid: false, reason: "Enter a valid amount for everyone.", remainingCents: totalCents };
    allocationCents[id] = cents;
  }
  const assignedCents = Object.values(allocationCents).reduce((sum, cents) => sum + cents, 0);
  const remainingCents = totalCents - assignedCents;
  if (remainingCents !== 0) return { valid: false, reason: "Allocate the full expense total.", remainingCents };
  return { valid: true, totalCents, allocationCents };
}

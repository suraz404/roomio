import { isUuid } from "./ids";
import { parseAmountToPaisa, splitEqually } from "./money";
import { db } from "@/db/client";
import { expenseAuditLogs, expense_splits, expenses } from "@/db/schema";

export const EXPENSE_TITLE_MAX = 100;

type ParseTitleResult =
  | { ok: true; title: string }
  | { ok: false; error: string };

export function parseExpenseTitle(input: unknown): ParseTitleResult {
  if (typeof input !== "string") {
    return { ok: false, error: "name is required" };
  }

  const title = input.trim();

  if (title.length === 0 || title.length > EXPENSE_TITLE_MAX) {
    return {
      ok: false,
      error: `name must be 1-${EXPENSE_TITLE_MAX} characters`,
    };
  }

  return { ok: true, title };
}
//------spenOn validation------------------------------------------------------------
const SPENT_ON_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SPENT_ON_MIN = "2000-01-01";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ParseSpentOnResult =
  | { ok: true; spentOn: string }
  | { ok: false; error: string };

// Accepts a real calendar date as "YYYY-MM-DD", from 2000-01-01 to
// tomorrow (tomorrow because the user's "today" can be ahead of UTC).
export function parseSpentOn(
  input: unknown,
  now: Date = new Date(),
): ParseSpentOnResult {
  // 1. Text ho?
  if (typeof input !== "string") {
    return { ok: false, error: 'spentOn must be a string like "2026-11-24"' };
  }

  // 2. Aakar: YYYY-MM-DD
  if (!SPENT_ON_PATTERN.test(input)) {
    return { ok: false, error: 'spentOn must look like "2026-11-24"' };
  }

  // 3. Round-trip: JavaScript le rollover (Feb 30 → Mar 2) garyo ki?
  const date = new Date(`${input}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input
  ) {
    return { ok: false, error: "spentOn is not a real date" };
  }

  // 4. Simana: 2000-01-01 dekhi bholi samma (ISO text ko kram = date ko kram)
  const max = new Date(now.getTime() + ONE_DAY_MS).toISOString().slice(0, 10);

  if (input < SPENT_ON_MIN || input > max) {
    return {
      ok: false,
      error: `spentOn must be between ${SPENT_ON_MIN} and ${max}`,
    };
  }

  // 5. Pass
  return { ok: true, spentOn: input };
}
// writing pure function in one function for easeness
type ParsedExpense = {
  title: string;
  amount: number;
  spentOn: string;
  paidBy: string;
  participantIds: string[];
  shares: { userId: string; paisa: number }[];
};

type ParseExpenseResult =
  | { ok: true; value: ParsedExpense }
  | { ok: false; error: string };

// All the cheap checks (no database). Membership is checked separately.
export function parseExpenseBody(
  body: unknown,
  now: Date = new Date(),
): ParseExpenseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  // D: title, amount, spentOn (tapai ka 3 function)
  const title = parseExpenseTitle(b.title);
  if (!title.ok) return title;

  const amount = parseAmountToPaisa(b.amount);
  if (!amount.ok) return amount;

  const spentOn = parseSpentOn(b.spentOn, now);
  if (!spentOn.ok) return spentOn;

  // E: paidBy ra participantIds ko aakar
  if (typeof b.paidBy !== "string" || !isUuid(b.paidBy)) {
    return { ok: false, error: "paidBy must be a user id" };
  }

  const ids = b.participantIds;
  if (
    !Array.isArray(ids) ||
    !ids.every((id) => typeof id === "string" && isUuid(id))
  ) {
    return { ok: false, error: "participantIds must be a list of user ids" };
  }

  // A: split (khali ra duplicate yahi le rokchha)
  const split = splitEqually(amount.paisa, ids);
  if (!split.ok) return split;

  return {
    ok: true,
    value: {
      title: title.title,
      amount: amount.paisa,
      spentOn: spentOn.spentOn,
      paidBy: b.paidBy,
      participantIds: ids,
      shares: split.shares,
    },
  };
}
// Writes the expense, its splits and the audit log in one transaction.
// Does not check access or membership: the route does that first.
export async function createExpense(input: {
  spaceId: string;
  createdBy: string;
  expense: ParsedExpense;
}) {
  const { spaceId, createdBy, expense } = input;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        spaceId,
        createdBy,
        title: expense.title,
        amount: expense.amount,
        paidBy: expense.paidBy,
        spentOn: expense.spentOn,
      })
      .returning({
        id: expenses.id,
        title: expenses.title,
        amount: expenses.amount,
        paidBy: expenses.paidBy,
        createdBy: expenses.createdBy,
        spentOn: expenses.spentOn,
        version: expenses.version,
        createdAt: expenses.createdAt,
      });

    const splits = expense.shares.map((s) => ({
      userId: s.userId,
      amount: s.paisa,
    }));

    await tx
      .insert(expense_splits)
      .values(splits.map((s) => ({ ...s, expenseId: row.id })));

    await tx.insert(expenseAuditLogs).values({
      expenseId: row.id,
      actorId: createdBy,
      action: "CREATE",
      oldValues: null,
      newValues: {
        title: row.title,
        amount: row.amount,
        paidBy: row.paidBy,
        spentOn: row.spentOn,
        splits,
      },
    });

    return { ...row, splits };
  });
}

import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenseAuditLogs, expense_splits, expenses } from "@/db/schema";
import { POST } from "@/app/api/spaces/[spaceId]/expenses/route";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";
import { validate } from "better-auth";

function postExpense(spaceId: string, body: unknown, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/spaces/${spaceId}/expenses`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );

  return POST(request, { params: Promise.resolve({ spaceId }) });
}

// Flat 4B with Ram (admin) and Sita (member).
async function setupFlat() {
  const ram = await signUpAndGetCookie("Ram");
  const sita = await signUpAndGetCookie("Sita");
  const space = await createSpace(ram.user.id, "Flat 4B");
  await addMember(space.id, sita.user.id);

  return { ram, sita, space };
}

// A valid body: Ram paid Rs 1500.50 for Ram and Sita.
function validBody(ramId: string, sitaId: string) {
  return {
    title: "Groceries",
    amount: "1500.50",
    paidBy: ramId,
    participantIds: [ramId, sitaId],
    spentOn: new Date().toISOString().slice(0, 10),
  };
}

async function countRows() {
  return {
    expenses: (await db.select().from(expenses)).length,
    splits: (await db.select().from(expense_splits)).length,
    logs: (await db.select().from(expenseAuditLogs)).length,
  };
}

const NOTHING = { expenses: 0, splits: 0, logs: 0 };

describe("POST /api/spaces/[spaceId]/expenses", () => {
  it("returns 401 without a session", async () => {
    const { ram, sita, space } = await setupFlat();

    const response = await postExpense(
      space.id,
      validBody(ram.user.id, sita.user.id),
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-member", async () => {
    const { ram, sita, space } = await setupFlat();
    const hari = await signUpAndGetCookie("Hari");

    const response = await postExpense(
      space.id,
      validBody(ram.user.id, sita.user.id),
      hari.cookie,
    );

    expect(response.status).toBe(403);
    expect(await countRows()).toEqual(NOTHING);
  });

  it("creates the expense, its splits, and a CREATE audit log", async () => {
    const { ram, sita, space } = await setupFlat();
    const body = validBody(ram.user.id, sita.user.id);

    const response = await postExpense(space.id, body, ram.cookie);
    const json = await response.json();

    // Response
    expect(response.status).toBe(201);
    expect(json.expense).toMatchObject({
      title: "Groceries",
      amount: 150050,
      paidBy: ram.user.id,
      createdBy: ram.user.id,
      spentOn: body.spentOn,
      version: 1,
    });
    expect(json.expense.splits).toHaveLength(2);

    // Splits: jamma = amount
    const splits = await db
      .select()
      .from(expense_splits)
      .where(eq(expense_splits.expenseId, json.expense.id));
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(150050);

    // Audit log
    const [log] = await db
      .select()
      .from(expenseAuditLogs)
      .where(eq(expenseAuditLogs.expenseId, json.expense.id));
    expect(log).toMatchObject({
      action: "CREATE",
      actorId: ram.user.id,
      oldValues: null,
    });
    expect(log.newValues).toMatchObject({ title: "Groceries", amount: 150050 });
  });

  it("takes createdBy from the session, not the body", async () => {
    const { ram, sita, space } = await setupFlat();

    const response = await postExpense(
      space.id,
      { ...validBody(ram.user.id, sita.user.id), createdBy: sita.user.id },
      ram.cookie,
    );
    const json = await response.json();

    expect(json.expense.createdBy).toBe(ram.user.id);
  });

  it("returns 400 when paidBy is not a member, and writes nothing", async () => {
    const { ram, sita, space } = await setupFlat();
    const gita = await signUpAndGetCookie("Gita");

    const response = await postExpense(
      space.id,
      { ...validBody(ram.user.id, sita.user.id), paidBy: gita.user.id },
      ram.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "paidBy and participants must be members of this space",
    });
    expect(await countRows()).toEqual(NOTHING);
  });

  it("returns 400 when a participant is not a member, and writes nothing", async () => {
    const { ram, sita, space } = await setupFlat();
    const gita = await signUpAndGetCookie("Gita");

    const response = await postExpense(
      space.id,
      {
        ...validBody(ram.user.id, sita.user.id),
        participantIds: [ram.user.id, gita.user.id],
      },
      ram.cookie,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "paidBy and participants must be members of this space",
    });
    expect(await countRows()).toEqual(NOTHING);
  });
  // 🫵 TEST 7: accepts a payer who is also a participant
  it("accepts a payer who is also a participant", async () => {
    const { ram, sita, space } = await setupFlat();

    const response = await postExpense(
      space.id,
      {
        ...validBody(ram.user.id, sita.user.id),
        paidBy: ram.user.id,
      },
      ram.cookie,
    );
    const json = await response.json();

    expect(response.status).toBe(201);

    const splits = await db
      .select()
      .from(expense_splits)
      .where(eq(expense_splits.expenseId, json.expense.id));
    expect(splits).toHaveLength(2);
  });

  it.each([
    ["missing title", { title: undefined }, "title is required"],
    [
      "amount as number",
      { amount: 1500.5 },
      'amount must be a string like "15.50"',
    ],
    ["zero amount", { amount: "0" }, "amount must be greater than 0"],
    ["fake date", { spentOn: "2026-02-30" }, "spentOn is not a real date"],
    ["bad paidBy", { paidBy: "abc" }, "paidBy must be a user id"],
    [
      "no participants",
      { participantIds: [] },
      "at least one participant is required",
    ],
    [
      "repeated participants",
      { participantIds: "SAME" },
      "participants must not repeat",
    ],
  ])("returns 400 for %s", async (_label, change, error) => {
    const { ram, sita, space } = await setupFlat();
    const body = { ...validBody(ram.user.id, sita.user.id), ...change };
    if (body.participantIds === "SAME") {
      body.participantIds = [sita.user.id, sita.user.id];
    }

    const response = await postExpense(space.id, body, ram.cookie);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(await countRows()).toEqual(NOTHING);
  });

  it("returns 400 for invalid JSON", async () => {
    const { ram, space } = await setupFlat();

    const response = await postExpense(space.id, "{not json", ram.cookie);

    expect(response.status).toBe(400);
  });
});

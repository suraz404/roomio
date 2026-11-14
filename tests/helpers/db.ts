import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function resetDb() {
  await db.execute(sql`
    TRUNCATE TABLE
      expense_audit_logs,
      expense_splits,
      expenses,
      space_members,
      spaces,
      session,
      account,
      verification,
      users
    RESTART IDENTITY CASCADE
  `);
}

export async function createTestUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [user] = await db
    .insert(users)
    .values({
      name: "Test User",
      email: `user-${crypto.randomUUID()}@example.com`,
      ...overrides,
    })
    .returning();

  return user;
}

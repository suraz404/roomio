import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { space_members, users } from "@/db/schema";

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
// Adds a user to a space directly. Stand-in for the invite flow (M4).
export async function addMember(
  spaceId: string,
  userId: string,
  role: "admin" | "member" = "member",
) {
  await db.insert(space_members).values({
    user_id: userId,
    space_id: spaceId,
    role,
  });
}

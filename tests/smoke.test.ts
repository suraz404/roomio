import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { space_members, spaces } from "@/db/schema";
import { createSpace } from "@/lib/spaces";
import { createTestUser } from "./helpers/db";

describe("test harness", () => {
  it("creates a space with its creator as admin", async () => {
    const user = await createTestUser();

    const space = await createSpace(user.id, "Flat 4B");

    const members = await db
      .select()
      .from(space_members)
      .where(eq(space_members.space_id, space.id));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ user_id: user.id, role: "admin" });
  });

  it("starts every test from an empty database", async () => {
    const rows = await db.select().from(spaces);

    expect(rows).toHaveLength(0);
  });
});

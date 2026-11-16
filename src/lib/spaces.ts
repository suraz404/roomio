import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { spaces, space_members, users } from "@/db/schema";

export const SPACE_NAME_MAX_LENGTH = 60;
type ParseResult = { ok: true; name: string } | { ok: false; error: string };

// Validates the "name" field of a request body. Shared by POST and PATCH so
// both follow the same rules.
export function parseSpaceName(body: unknown): ParseResult {
  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? body.name
      : undefined;

  if (typeof rawName !== "string") {
    return { ok: false, error: "name is required" };
  }

  const name = rawName.trim();

  if (name.length === 0 || name.length > SPACE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `name must be 1-${SPACE_NAME_MAX_LENGTH} characters`,
    };
  }

  return { ok: true, name };
}
// Creates the space and the creator's admin membership atomically:
// either both rows exist, or neither does.
export async function createSpace(userId: string, name: string) {
  return db.transaction(async (tx) => {
    const [space] = await tx
      .insert(spaces)
      .values({ name, createdBy: userId })
      .returning();

    await tx.insert(space_members).values({
      user_id: userId,
      space_id: space.id,
      role: "admin",
    });

    return space;
  });
}
// Lists every space the user belongs to, with their role, newest first.
export async function listSpacesForUser(userId: string) {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      role: space_members.role,
      createdAt: spaces.createdAt,
    })
    .from(space_members)
    .innerJoin(spaces, eq(space_members.space_id, spaces.id))
    .where(eq(space_members.user_id, userId))
    .orderBy(desc(spaces.createdAt));
}
// Returns a space with its members (name + role), or null if it does not
// exist. Does not check access: call requireSpaceMembership() first.
export async function getSpaceWithMembers(spaceId: string) {
  const [space] = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      createdAt: spaces.createdAt,
    })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    return null;
  }

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      role: space_members.role,
    })
    .from(space_members)
    .innerJoin(users, eq(space_members.user_id, users.id))
    .where(eq(space_members.space_id, spaceId))
    .orderBy(asc(users.name));

  return { ...space, members };
}
// Renames a space and returns it, or null if it does not exist.
// Does not check access: call requireSpaceAdmin() first.
export async function renameSpace(spaceId: string, name: string) {
  const [space] = await db
    .update(spaces)
    .set({ name })
    .where(eq(spaces.id, spaceId))
    .returning({
      id: spaces.id,
      name: spaces.name,
      createdAt: spaces.createdAt,
    });

  return space ?? null;
}

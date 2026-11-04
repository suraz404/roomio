import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { space_members } from "@/db/schema";
import { getApiSession } from "./api-auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("You must be logged in.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("You are not a member of this space.");
    this.name = "ForbiddenError";
  }
}

export async function requireSpaceMembership(
  spaceId: string,
  headers: Headers,
) {
  const session = await getApiSession(headers);

  if (!session) {
    throw new UnauthorizedError();
  }

  const [membership] = await db
    .select()
    .from(space_members)
    .where(
      and(
        eq(space_members.user_id, session.user.id),
        eq(space_members.space_id, spaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new ForbiddenError();
  }

  return membership;
}

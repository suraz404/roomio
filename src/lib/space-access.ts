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
  constructor(message = "You are not a member of this space.") {
    super(message);
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

// Like requireSpaceMembership, but the user must also be an admin.
export async function requireSpaceAdmin(spaceId: string, headers: Headers) {
  const membership = await requireSpaceMembership(spaceId, headers);

  if (membership.role !== "admin") {
    throw new ForbiddenError("Only space admins can do this.");
  }

  return membership;
}
// Turns an access error into an HTTP response. Returns null for any other
// error, so the caller can rethrow it.
export function accessErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  return null;
}

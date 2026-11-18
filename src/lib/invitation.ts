import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, space_members, users } from "@/db/schema";
import { generateToken, hashToken } from "./token";

export const INVITE_TTL_DAYS = 7;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvitationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationConflictError";
  }
}

type ParseResult = { ok: true; email: string } | { ok: false; error: string };

export function parseInviteEmail(body: unknown): ParseResult {
  const raw =
    typeof body === "object" && body !== null && "email" in body
      ? body.email
      : undefined;

  if (typeof raw !== "string") {
    return { ok: false, error: "email is required" };
  }

  const email = raw.trim().toLowerCase();

  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "email must be a valid email address" };
  }

  return { ok: true, email };
}

// Postgres error 23505 = unique violation. Drizzle may wrap the driver
// error, so look at the error and its cause.
function isUniqueViolation(error: unknown, constraint: string) {
  for (const e of [error, (error as { cause?: unknown })?.cause]) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === "23505" &&
      "constraint_name" in e &&
      e.constraint_name === constraint
    ) {
      return true;
    }
  }

  return false;
}

// Creates a pending invite and returns it with the plain token (shown once).
// Does not check access: call requireSpaceAdmin() first.
export async function createInvitation(input: {
  spaceId: string;
  email: string;
  invitedBy: string;
}) {
  const [existingMember] = await db
    .select({ userId: users.id })
    .from(space_members)
    .innerJoin(users, eq(space_members.user_id, users.id))
    .where(
      and(
        eq(space_members.space_id, input.spaceId),
        eq(users.email, input.email),
      ),
    )
    .limit(1);

  if (existingMember) {
    throw new InvitationConflictError(
      "This person is already a member of this space.",
    );
  }

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const [invitation] = await db
      .insert(invitations)
      .values({
        spaceId: input.spaceId,
        email: input.email,
        invitedBy: input.invitedBy,
        tokenHash: hashToken(token),
        expiresAt,
      })
      .returning({
        id: invitations.id,
        email: invitations.email,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
      });

    return { invitation, token };
  } catch (error) {
    if (isUniqueViolation(error, "invitations_one_pending_per_email")) {
      throw new InvitationConflictError(
        "There is already a pending invitation for this email.",
      );
    }

    throw error;
  }
}

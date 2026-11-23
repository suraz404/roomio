import { and, desc, eq, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, space_members, users, spaces } from "@/db/schema";
import { generateToken, hashToken } from "./token";

export const INVITE_TTL_DAYS = 7;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class InvitationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationConflictError";
  }
}
export class InviteeNotFoundError extends Error {
  constructor() {
    super("No Roomio account uses this email.");
    this.name = "InviteeNotFoundError";
  }
}
export class InvitationNotFoundError extends Error {
  constructor() {
    super("Invitation not found");
    this.name = "InvitationNotFoundError";
  }
}

export class InvitationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationStateError";
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
  // 1. The invitee must already have a Roomio account.
  const [invitee] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!invitee) {
    throw new InviteeNotFoundError();
  }

  // 2. And must not already be in the space.
  const [existingMember] = await db
    .select({ userId: space_members.user_id })
    .from(space_members)
    .where(
      and(
        eq(space_members.space_id, input.spaceId),
        eq(space_members.user_id, invitee.id),
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
    return await db.transaction(async (tx) => {
      // 1. Purano myaad sakiyeko kaard ma "expired" lekha
      await tx
        .update(invitations)
        .set({ status: "expired", respondedAt: new Date() })
        .where(
          and(
            eq(invitations.spaceId, input.spaceId),
            eq(invitations.email, input.email),
            eq(invitations.status, "pending"),
            lte(invitations.expiresAt, new Date()),
          ),
        );

      // 2. Naya kaard tasa
      const [invitation] = await tx
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
    });
  } catch (error) {
    if (isUniqueViolation(error, "invitations_one_pending_per_email")) {
      throw new InvitationConflictError(
        "There is already a pending invitation for this email.",
      );
    }

    throw error;
  }
}
type StoredStatus = (typeof invitations.$inferSelect)["status"];
export type InvitationStatus = StoredStatus | "expired";

// What the user should see. A pending invite past its expiry is "expired";
// answered invites keep their status even after expiry.
export function effectiveStatus(
  invitation: { status: StoredStatus; expiresAt: Date },
  now: Date = new Date(),
): InvitationStatus {
  if (invitation.status === "pending" && invitation.expiresAt <= now) {
    return "expired";
  }

  return invitation.status;
}

// Looks up an invite by its plain token (from the link). Does not check who
// is asking: the caller must compare the invite email with the session.
export async function findInvitationByToken(token: string) {
  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      spaceId: spaces.id,
      spaceName: spaces.name,
      inviterName: users.name,
    })
    .from(invitations)
    .innerJoin(spaces, eq(invitations.spaceId, spaces.id))
    .innerJoin(users, eq(invitations.invitedBy, users.id))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  return row ?? null;
}
const NOT_PENDING_MESSAGES: Record<
  Exclude<InvitationStatus, "pending">,
  string
> = {
  expired: "This invitation has expired.",
  accepted: "This invitation has already been accepted.",
  rejected: "This invitation was declined.",
  revoked: "This invitation was cancelled.",
};

// Accept ra reject dubai ko saajha bhag:
// kaard lock gara, Sita kai ho jaach, pending ho jaach.
async function lockMyPendingInvite(tx: Tx, token: string, email: string) {
  const [invite] = await tx
    .select({
      id: invitations.id,
      spaceId: invitations.spaceId,
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1)
    .for("update");

  if (!invite || invite.email !== email.toLowerCase()) {
    throw new InvitationNotFoundError();
  }

  const status = effectiveStatus(invite);

  if (status !== "pending") {
    throw new InvitationStateError(NOT_PENDING_MESSAGES[status]);
  }

  return invite;
}

// Accepts an invite in one transaction: lock the invite row, check it, add
// the member, mark it accepted. Returns the space the user joined.
export async function acceptInvitation(input: {
  token: string;
  userId: string;
  email: string;
}) {
  return db.transaction(async (tx) => {
    const invite = await lockMyPendingInvite(tx, input.token, input.email);

    //accepts
    await tx
      .insert(space_members)
      .values({
        user_id: input.userId,
        space_id: invite.spaceId,
        role: "member",
      })
      .onConflictDoNothing();

    await tx
      .update(invitations)
      .set({
        status: "accepted",
        acceptedBy: input.userId,
        respondedAt: new Date(),
      })
      .where(eq(invitations.id, invite.id));

    const [space] = await tx
      .select({ id: spaces.id, name: spaces.name })
      .from(spaces)
      .where(eq(spaces.id, invite.spaceId));

    return space;
  });
}

export async function rejectInvitation(input: {
  token: string;
  email: string;
}) {
  await db.transaction(async (tx) => {
    const invite = await lockMyPendingInvite(tx, input.token, input.email);

    await tx
      .update(invitations)
      .set({
        status: "rejected",
        respondedAt: new Date(),
      })
      .where(eq(invitations.id, invite.id));
  });
}
export async function revokeInvitation(input: {
  spaceId: string;
  invitationId: string;
}) {
  await db.transaction(async (tx) => {
    const [invite] = await tx
      .select({ id: invitations.id, status: invitations.status })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, input.invitationId),
          eq(invitations.spaceId, input.spaceId),
        ),
      )
      .limit(1)
      .for("update");

    if (!invite) {
      throw new InvitationNotFoundError();
    }

    if (invite.status !== "pending") {
      throw new InvitationStateError(NOT_PENDING_MESSAGES[invite.status]);
    }

    await tx
      .update(invitations)
      .set({ status: "revoked", respondedAt: new Date() })
      .where(eq(invitations.id, invite.id));
  });
}

// Pending invites of a space (including expired ones), newest first.
// Does not check access: call requireSpaceAdmin() first.
export async function listPendingInvitations(spaceId: string) {
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      invitedByName: users.name,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.invitedBy, users.id))
    .where(
      and(eq(invitations.spaceId, spaceId), eq(invitations.status, "pending")),
    )
    .orderBy(desc(invitations.createdAt));

  return rows.map((row) => ({ ...row, status: effectiveStatus(row) }));
}
// Turns an invitation error into an HTTP response. Returns null for any
// other error, so the caller can rethrow it. Same idea as
// accessErrorResponse() in space-access.ts.
export function invitationErrorResponse(error: unknown) {
  if (
    error instanceof InvitationNotFoundError ||
    error instanceof InviteeNotFoundError
  ) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (
    error instanceof InvitationStateError ||
    error instanceof InvitationConflictError
  ) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  return null;
}

import {
  createInvitation,
  InvitationConflictError,
  InviteeNotFoundError,
  listPendingInvitations,
  parseInviteEmail,
} from "@/lib/invitation";
import { accessErrorResponse, requireSpaceAdmin } from "@/lib/space-access";
import { param } from "drizzle-orm";

type RouteContext = { params: Promise<{ spaceId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { spaceId } = await params;

  // 1. Access first.
  let membership;

  try {
    membership = await requireSpaceAdmin(spaceId, request.headers);
  } catch (error) {
    const response = accessErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  // 2. Then the body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseInviteEmail(body);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // 3. Then the change.
  try {
    const { invitation, token } = await createInvitation({
      spaceId,
      email: parsed.email,
      invitedBy: membership.user_id,
    });

    const inviteUrl = new URL(`/invite/${token}`, request.url).toString();

    return Response.json({ invitation, inviteUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof InviteeNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvitationConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    throw error;
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { spaceId } = await params;

  try {
    await requireSpaceAdmin(spaceId, request.headers);
  } catch (error) {
    const response = accessErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  const invitations = await listPendingInvitations(spaceId);

  return Response.json({ invitations });
}

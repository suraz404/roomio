import { getApiSession } from "@/lib/api-auth";
import { effectiveStatus, findInvitationByToken } from "@/lib/invitation";

type RouteContext = { params: Promise<{ token: string }> };

const NOT_FOUND = { error: "Invitation not found" };

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const found = await findInvitationByToken(token);

  // Unknown token and someone else's invite look the same, so a stolen or
  // guessed link reveals nothing.
  if (!found || found.email !== session.user.email.toLowerCase()) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  return Response.json({
    invitation: {
      id: found.id,
      status: effectiveStatus(found),
      expiresAt: found.expiresAt,
      space: { id: found.spaceId, name: found.spaceName },
      invitedBy: { name: found.inviterName },
    },
  });
}

import { isUuid } from "@/lib/ids";
import { invitationErrorResponse, revokeInvitation } from "@/lib/invitation";
import { accessErrorResponse, requireSpaceAdmin } from "@/lib/space-access";

type RouteContext = {
  params: Promise<{ spaceId: string; invitationId: string }>;
};

const NOT_FOUND = { error: "Invitation not found" };

export async function POST(request: Request, { params }: RouteContext) {
  // 1. URL bata dui id
  const { spaceId, invitationId } = await params;

  // 2. Taalcha: Ram yo flat ko admin ho?
  try {
    await requireSpaceAdmin(spaceId, request.headers);
  } catch (error) {
    const response = accessErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  // 3. Invite id ko format (Postgres crash nahos)
  if (!isUuid(invitationId)) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  // 4. Kaam
  try {
    await revokeInvitation({ spaceId, invitationId });

    return new Response(null, { status: 204 });
  } catch (error) {
    const response = invitationErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

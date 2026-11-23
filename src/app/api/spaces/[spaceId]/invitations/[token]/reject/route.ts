import { getApiSession } from "@/lib/api-auth";
import { invitationErrorResponse, rejectInvitation } from "@/lib/invitation";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await rejectInvitation({
      token,
      email: session.user.email,
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    const response = invitationErrorResponse(error);
    if (response) {
      return response;
    }

    throw error;
  }
}

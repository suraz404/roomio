import { getApiSession } from "@/lib/api-auth";
import { acceptInvitation, invitationErrorResponse } from "@/lib/invitation";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const space = await acceptInvitation({
      token,
      userId: session.user.id,
      email: session.user.email,
    });

    return Response.json({ space, role: "member" });
  } catch (error) {
    const response = invitationErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }
}

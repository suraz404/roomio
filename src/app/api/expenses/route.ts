import { getApiSession } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    message: "Authenticated successfully",
    user: session.user,
  });
}

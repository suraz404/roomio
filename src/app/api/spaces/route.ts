import { getApiSession } from "@/lib/api-auth";
import { createSpace, listSpacesForUser, parseSpaceName } from "@/lib/spaces";

export async function GET(request: Request) {
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spaces = await listSpacesForUser(session.user.id);

  return Response.json({ spaces });
}

export async function POST(request: Request) {
  const session = await getApiSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseSpaceName(body);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // createdBy always comes from the session, never from the request body.
  const space = await createSpace(session.user.id, parsed.name);

  return Response.json({ space }, { status: 201 });
}

import { getApiSession } from "@/lib/api-auth";
import { createSpace, SPACE_NAME_MAX_LENGTH } from "@/lib/spaces";

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

  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? body.name
      : undefined;

  if (typeof rawName !== "string") {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const name = rawName.trim();

  if (name.length === 0 || name.length > SPACE_NAME_MAX_LENGTH) {
    return Response.json(
      { error: `name must be 1-${SPACE_NAME_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }

  // createdBy always comes from the session, never from the request body.
  const space = await createSpace(session.user.id, name);

  return Response.json({ space }, { status: 201 });
}

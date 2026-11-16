import {
  accessErrorResponse,
  requireSpaceAdmin,
  requireSpaceMembership,
} from "@/lib/space-access";
import { getSpaceWithMembers, parseSpaceName, renameSpace } from "@/lib/spaces";

type RouteContext = { params: Promise<{ spaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { spaceId } = await params;

  try {
    const membership = await requireSpaceMembership(spaceId, request.headers);
    const space = await getSpaceWithMembers(spaceId);

    if (!space) {
      return Response.json({ error: "Space not found" }, { status: 404 });
    }

    return Response.json({ space: { ...space, myRole: membership.role } });
  } catch (error) {
    const response = accessErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
export async function PATCH(request: Request, { params }: RouteContext) {
  const { spaceId } = await params;

  // 1. Access first: a non-admin learns nothing about the body rules.
  try {
    await requireSpaceAdmin(spaceId, request.headers);
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

  const parsed = parseSpaceName(body);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // 3. Then the change.
  const space = await renameSpace(spaceId, parsed.name);

  if (!space) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  return Response.json({ space });
}

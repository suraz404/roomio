import { NextRequest, NextResponse } from "next/server";
import {
  requireSpaceMembership,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/space-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const { spaceId } = await params;

    const membership = await requireSpaceMembership(spaceId, request.headers);

    return NextResponse.json({
      success: true,
      message: "You are a member of this space.",
      membership,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 },
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }

    throw error;
  }
}

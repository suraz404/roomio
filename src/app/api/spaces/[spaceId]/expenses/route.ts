import { createExpense, listExpenses, parseExpenseBody } from "@/lib/expense";
import {
  accessErrorResponse,
  areAllMembers,
  requireSpaceMembership,
} from "@/lib/space-access";

type RouteContext = { params: Promise<{ spaceId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  // I. URL
  const { spaceId } = await params;

  // Membership Check
  let membership;

  try {
    membership = await requireSpaceMembership(spaceId, request.headers);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }

  // C. JSON
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Cheap function
  const parsed = parseExpenseBody(body);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // F. Membership Checking Step
  const everyone = [parsed.value.paidBy, ...parsed.value.participantIds];

  if (!(await areAllMembers(spaceId, everyone))) {
    return Response.json(
      { error: "paidBy and participants must be members of this space" },
      { status: 400 },
    );
  }

  // G. Creating an Expense
  const expense = await createExpense({
    spaceId,
    createdBy: membership.user_id,
    expense: parsed.value,
  });

  // H.
  return Response.json({ expense }, { status: 201 });
}

export async function GET(request: Request, { params }: RouteContext) {
  const { spaceId } = await params;

  try {
    await requireSpaceMembership(spaceId, request.headers);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const expenses = await listExpenses(spaceId);

  return Response.json({ expenses });
}

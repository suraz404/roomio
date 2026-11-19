import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, space_members } from "@/db/schema";
import { POST } from "@/app/api/spaces/[spaceId]/invitations/[token]/accept/route";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";
import { setupInvite } from "../helpers/invitation";

function accept(token: string, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/invitations/${token}/accept`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );

  return POST(request, { params: Promise.resolve({ token }) });
}

function membershipsOf(userId: string, spaceId: string) {
  return db
    .select()
    .from(space_members)
    .where(
      and(
        eq(space_members.user_id, userId),
        eq(space_members.space_id, spaceId),
      ),
    );
}

async function invitationRow(id: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, id));

  return row;
}

describe("POST /api/invitations/[token]/accept", () => {
  it("returns 401 without a session", async () => {
    const { token } = await setupInvite();

    const response = await accept(token);

    expect(response.status).toBe(401);
  });

  it("adds the user as a member and marks the invite accepted", async () => {
    const { sita, space, invitationId, token } = await setupInvite();

    const response = await accept(token, sita.cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      space: { id: space.id, name: "Flat 4B" },
      role: "member",
    });

    const members = await membershipsOf(sita.user.id, space.id);
    expect(members).toEqual([
      { user_id: sita.user.id, space_id: space.id, role: "member" },
    ]);

    const row = await invitationRow(invitationId);
    expect(row.status).toBe("accepted");
    expect(row.acceptedBy).toBe(sita.user.id);
    expect(row.respondedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["the inviter", "ram"],
    ["an unrelated user", "hari"],
  ] as const)("returns 404 to %s and adds nobody", async (_label, who) => {
    const { ram, space, token } = await setupInvite();
    const hari = await signUpAndGetCookie("Hari");
    const caller = who === "ram" ? ram : hari;

    const response = await accept(token, caller.cookie);

    expect(response.status).toBe(404);
    expect(await membershipsOf(hari.user.id, space.id)).toHaveLength(0);
  });

  it("returns 404 for an unknown token", async () => {
    const { sita } = await setupInvite();

    const response = await accept("not-a-real-token", sita.cookie);

    expect(response.status).toBe(404);
  });

  it.each([
    [
      "expired",
      { expiresAt: new Date(Date.now() - 60_000) },
      "This invitation has expired.",
    ],
    [
      "rejected",
      { status: "rejected" as const, respondedAt: new Date() },
      "This invitation was declined.",
    ],
    [
      "revoked",
      { status: "revoked" as const, respondedAt: new Date() },
      "This invitation was cancelled.",
    ],
  ])(
    "returns 409 for a %s invite and adds nobody",
    async (_label, change, message) => {
      const { sita, space, invitationId, token } = await setupInvite();
      await db
        .update(invitations)
        .set(change)
        .where(eq(invitations.id, invitationId));

      const response = await accept(token, sita.cookie);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: message });
      expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(0);
    },
  );

  it("returns 409 when accepting twice", async () => {
    const { sita, space, token } = await setupInvite();

    await accept(token, sita.cookie);
    const second = await accept(token, sita.cookie);

    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: "This invitation has already been accepted.",
    });
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(1);
  });

  it("succeeds when the user is already a member", async () => {
    const { sita, space, invitationId, token } = await setupInvite();
    await addMember(space.id, sita.user.id);

    const response = await accept(token, sita.cookie);

    expect(response.status).toBe(200);
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(1);
    expect((await invitationRow(invitationId)).status).toBe("accepted");
  });

  it("accepts only once when two requests race", async () => {
    const { sita, space, invitationId, token } = await setupInvite();

    const responses = await Promise.all([
      accept(token, sita.cookie),
      accept(token, sita.cookie),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(1);
    expect((await invitationRow(invitationId)).acceptedBy).toBe(sita.user.id);
  });
});

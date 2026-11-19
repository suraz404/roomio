import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations } from "@/db/schema";
import { GET } from "@/app/api/spaces/[spaceId]/invitations/[token]/route";
import { createInvitation } from "@/lib/invitation";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "../helpers/auth";

async function inviteToSpace(
  spaceId: string,
  email: string,
  invitedBy: string,
) {
  const { invitation, token } = await createInvitation({
    spaceId,
    email,
    invitedBy,
  });

  return { invitationId: invitation.id, token };
}

function getInvitation(token: string, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/invitations/${token}`,
    {
      headers: cookie ? { cookie } : {},
    },
  );

  return GET(request, { params: Promise.resolve({ token }) });
}

// Ram creates "Flat 4B" and invites Sita. Used by most tests below.
async function setup() {
  const ram = await signUpAndGetCookie("Ram");
  const sita = await signUpAndGetCookie("Sita");
  const space = await createSpace(ram.user.id, "Flat 4B");
  const { invitationId, token } = await inviteToSpace(
    space.id,
    sita.user.email,
    ram.user.id,
  );

  return { ram, sita, space, invitationId, token };
}

describe("GET /api/invitations/[token]", () => {
  it("returns 401 without a session", async () => {
    const { token } = await setup();

    const response = await getInvitation(token);

    expect(response.status).toBe(401);
  });

  it("shows the invite to the invited user", async () => {
    const { sita, space, invitationId, token } = await setup();

    const response = await getInvitation(token, sita.cookie);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      invitation: {
        id: invitationId,
        status: "pending",
        expiresAt: expect.any(String),
        space: { id: space.id, name: "Flat 4B" },
        invitedBy: { name: "Ram" },
      },
    });
  });

  it("returns 404 to the inviter", async () => {
    const { ram, token } = await setup();

    const response = await getInvitation(token, ram.cookie);

    expect(response.status).toBe(404);
  });

  it("returns 404 to an unrelated user", async () => {
    const { token } = await setup();
    const hari = await signUpAndGetCookie("Hari");

    const response = await getInvitation(token, hari.cookie);

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown token", async () => {
    const { sita } = await setup();

    const response = await getInvitation("not-a-real-token", sita.cookie);

    expect(response.status).toBe(404);
  });

  it("answers someone else's invite exactly like an unknown token", async () => {
    const { token } = await setup();
    const hari = await signUpAndGetCookie("Hari");

    const stolen = await getInvitation(token, hari.cookie);
    const unknown = await getInvitation("not-a-real-token", hari.cookie);

    expect(stolen.status).toBe(unknown.status);
    expect(await stolen.json()).toEqual(await unknown.json());
  });

  it("shows expired for a pending invite past its expiry", async () => {
    const { sita, invitationId, token } = await setup();
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invitations.id, invitationId));

    const response = await getInvitation(token, sita.cookie);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.invitation.status).toBe("expired");
  });

  it("shows accepted for an answered invite", async () => {
    const { sita, invitationId, token } = await setup();
    await db
      .update(invitations)
      .set({
        status: "accepted",
        acceptedBy: sita.user.id,
        respondedAt: new Date(),
      })
      .where(eq(invitations.id, invitationId));

    const response = await getInvitation(token, sita.cookie);
    const json = await response.json();

    expect(json.invitation.status).toBe("accepted");
  });

  it("does not change anything in the database", async () => {
    const { sita, token } = await setup();
    const before = await db.select().from(invitations);

    await getInvitation(token, sita.cookie);
    await getInvitation(token, sita.cookie);

    const after = await db.select().from(invitations);
    expect(after).toEqual(before);
  });
});

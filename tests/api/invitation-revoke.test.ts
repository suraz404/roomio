import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations } from "@/db/schema";
import { POST as accept } from "@/app/api/spaces/[spaceId]/invitations/[token]/accept/route";
import { POST as revoke } from "@/app/api/spaces/[spaceId]/invitations/[invitationId]/revoke/route";
import { POST as invite } from "@/app/api/spaces/[spaceId]/invitations/route";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";
import {
  invitationRow,
  membershipsOf,
  setupInvite,
} from "../helpers/invitation";

function doRevoke(spaceId: string, invitationId: string, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/spaces/${spaceId}/invitations/${invitationId}/revoke`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );

  return revoke(request, {
    params: Promise.resolve({ spaceId, invitationId }),
  });
}

function doAccept(token: string, cookie: string) {
  const request = new Request(
    `http://localhost:3000/api/invitations/${token}/accept`,
    { method: "POST", headers: { cookie } },
  );

  return accept(request, { params: Promise.resolve({ token }) });
}

function doInvite(spaceId: string, email: string, cookie: string) {
  const request = new Request(
    `http://localhost:3000/api/spaces/${spaceId}/invitations`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email }),
    },
  );

  return invite(request, { params: Promise.resolve({ spaceId }) });
}

describe("POST /api/spaces/[spaceId]/invitations/[invitationId]/revoke", () => {
  it("returns 401 without a session", async () => {
    const { space, invitationId } = await setupInvite();

    expect((await doRevoke(space.id, invitationId)).status).toBe(401);
  });

  it("lets the admin revoke, and the link stops working", async () => {
    const { ram, sita, space, invitationId, token } = await setupInvite();

    const response = await doRevoke(space.id, invitationId, ram.cookie);

    expect(response.status).toBe(204);
    expect((await invitationRow(invitationId)).status).toBe("revoked");

    const acceptResponse = await doAccept(token, sita.cookie);
    expect(acceptResponse.status).toBe(409);
    expect(await acceptResponse.json()).toEqual({
      error: "This invitation was cancelled.",
    });
  });

  it("returns 403 for a plain member", async () => {
    const { space, invitationId } = await setupInvite();
    const anil = await signUpAndGetCookie("Anil");
    await addMember(space.id, anil.user.id);

    const response = await doRevoke(space.id, invitationId, anil.cookie);

    expect(response.status).toBe(403);
    expect((await invitationRow(invitationId)).status).toBe("pending");
  });

  it("does not let another space's admin revoke it via their own space URL", async () => {
    const { space: ramSpace, invitationId } = await setupInvite();
    const gita = await signUpAndGetCookie("Gita");
    const gitaSpace = await createSpace(gita.user.id, "Flat 9C");

    const response = await doRevoke(gitaSpace.id, invitationId, gita.cookie);

    expect(response.status).toBe(404);
    expect((await invitationRow(invitationId)).status).toBe("pending");
    expect(ramSpace.id).not.toBe(gitaSpace.id);
  });

  it.each([
    ["malformed", "abc"],
    ["unknown", crypto.randomUUID()],
  ])("returns 404 for a %s invitation id", async (_label, id) => {
    const { ram, space } = await setupInvite();

    expect((await doRevoke(space.id, id, ram.cookie)).status).toBe(404);
  });

  it("returns 409 for an already accepted invite", async () => {
    const { ram, sita, space, invitationId, token } = await setupInvite();
    await doAccept(token, sita.cookie);

    const response = await doRevoke(space.id, invitationId, ram.cookie);

    expect(response.status).toBe(409);
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(1);
  });

  it("can revoke an expired invite, which allows a fresh one", async () => {
    const { ram, sita, space, invitationId } = await setupInvite();
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invitations.id, invitationId));

    const blocked = await doInvite(space.id, sita.user.email, ram.cookie);
    expect(blocked.status).toBe(409);

    expect((await doRevoke(space.id, invitationId, ram.cookie)).status).toBe(
      204,
    );

    const fresh = await doInvite(space.id, sita.user.email, ram.cookie);
    expect(fresh.status).toBe(201);
  });

  it("keeps data consistent when accept and revoke race", async () => {
    const { ram, sita, space, invitationId, token } = await setupInvite();

    await Promise.all([
      doAccept(token, sita.cookie),
      doRevoke(space.id, invitationId, ram.cookie),
    ]);

    const row = await invitationRow(invitationId);
    const members = await membershipsOf(sita.user.id, space.id);

    expect(["accepted", "revoked"]).toContain(row.status);
    expect(members.length === 1).toBe(row.status === "accepted");
  });
});

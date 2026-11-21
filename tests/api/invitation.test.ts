import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations } from "@/db/schema";
import { GET, POST } from "@/app/api/spaces/[spaceId]/invitations/route";
import { createSpace } from "@/lib/spaces";
import { hashToken } from "@/lib/token";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";
import { setupInvite, inviteToSpace } from "../helpers/invitation";

function postInvite(spaceId: string, body: unknown, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/spaces/${spaceId}/invitations`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );

  return POST(request, { params: Promise.resolve({ spaceId }) });
}

function tokenFrom(inviteUrl: string) {
  return new URL(inviteUrl).pathname.split("/").pop()!;
}

function invitationRows() {
  return db.select().from(invitations);
}

describe("POST /api/spaces/[spaceId]/invitations", () => {
  it("returns 401 without a session", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(space.id, { email: "x@example.com" });

    expect(response.status).toBe(401);
  });

  it("creates a pending invite and stores only the token hash", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(
      space.id,
      { email: `  ${sita.user.email.toUpperCase()}  ` },
      ram.cookie,
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.invitation).toMatchObject({
      email: sita.user.email,
      status: "pending",
    });
    expect(json.invitation).not.toHaveProperty("tokenHash");

    const days =
      (new Date(json.invitation.expiresAt).getTime() - Date.now()) /
      (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);

    const token = tokenFrom(json.inviteUrl);
    const [row] = await invitationRows();

    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.invitedBy).toBe(ram.user.id);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("returns 403 for a plain member and creates nothing", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const hari = await signUpAndGetCookie("Hari");
    const space = await createSpace(ram.user.id, "Flat 4B");
    await addMember(space.id, sita.user.id);

    const response = await postInvite(
      space.id,
      { email: hari.user.email },
      sita.cookie,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Only space admins can do this.",
    });
    expect(await invitationRows()).toHaveLength(0);
  });

  it("returns 403 for a non-member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const hari = await signUpAndGetCookie("Hari");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(
      space.id,
      { email: "x@example.com" },
      hari.cookie,
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid email", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(space.id, { email: "sita@" }, ram.cookie);

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(space.id, "{not json", ram.cookie);

    expect(response.status).toBe(400);
  });

  it("returns 404 when no account uses the email", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(
      space.id,
      { email: "nobody@example.com" },
      ram.cookie,
    );

    expect(response.status).toBe(404);
    expect(await invitationRows()).toHaveLength(0);
  });

  it("returns 409 when the person is already a member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await postInvite(
      space.id,
      { email: ram.user.email },
      ram.cookie,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This person is already a member of this space.",
    });
  });

  it("returns 409 for a second pending invite to the same email", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await postInvite(space.id, { email: sita.user.email }, ram.cookie);
    const second = await postInvite(
      space.id,
      { email: sita.user.email },
      ram.cookie,
    );

    expect(second.status).toBe(409);
    expect(await invitationRows()).toHaveLength(1);
  });

  it("creates only one invite when two requests race", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const responses = await Promise.all([
      postInvite(space.id, { email: sita.user.email }, ram.cookie),
      postInvite(space.id, { email: sita.user.email }, ram.cookie),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await invitationRows()).toHaveLength(1);
  });

  it("allows a new invite after the previous one was rejected", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const first = await postInvite(
      space.id,
      { email: sita.user.email },
      ram.cookie,
    );
    const { invitation } = await first.json();
    await db
      .update(invitations)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    const second = await postInvite(
      space.id,
      { email: sita.user.email },
      ram.cookie,
    );

    expect(second.status).toBe(201);
  });

  it("allows the same email to be invited to different spaces", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const gita = await signUpAndGetCookie("Gita");
    const sita = await signUpAndGetCookie("Sita");
    const flat4B = await createSpace(ram.user.id, "Flat 4B");
    const flat9C = await createSpace(gita.user.id, "Flat 9C");

    const a = await postInvite(
      flat4B.id,
      { email: sita.user.email },
      ram.cookie,
    );
    const b = await postInvite(
      flat9C.id,
      { email: sita.user.email },
      gita.cookie,
    );

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });
});
function listInvites(spaceId: string, cookie?: string) {
  const request = new Request(
    `http://localhost:3000/api/spaces/${spaceId}/invitations`,
    { headers: cookie ? { cookie } : {} },
  );

  return GET(request, { params: Promise.resolve({ spaceId }) });
}

describe("GET /api/spaces/[spaceId]/invitations", () => {
  it("lists pending invites with no token hash", async () => {
    const { ram, sita, space, invitationId } = await setupInvite();

    const response = await listInvites(space.id, ram.cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      invitations: [
        {
          id: invitationId,
          email: sita.user.email,
          status: "pending",
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          invitedByName: "Ram",
        },
      ],
    });
  });

  it("leaves out answered invites", async () => {
    const { ram, space, invitationId } = await setupInvite();
    await db
      .update(invitations)
      .set({ status: "rejected", respondedAt: new Date() })
      .where(eq(invitations.id, invitationId));

    const json = await (await listInvites(space.id, ram.cookie)).json();

    expect(json.invitations).toEqual([]);
  });

  it("shows expired invites as expired", async () => {
    const { ram, space, invitationId } = await setupInvite();
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invitations.id, invitationId));

    const json = await (await listInvites(space.id, ram.cookie)).json();

    expect(json.invitations[0].status).toBe("expired");
  });

  it("returns 403 for a plain member", async () => {
    const { space } = await setupInvite();
    const anil = await signUpAndGetCookie("Anil");
    await addMember(space.id, anil.user.id);

    const response = await listInvites(space.id, anil.cookie);

    expect(response.status).toBe(403);
  });

  it("does not show another space's invites", async () => {
    const { space: ramSpace } = await setupInvite();
    const gita = await signUpAndGetCookie("Gita");
    const hari = await signUpAndGetCookie("Hari");
    const gitaSpace = await createSpace(gita.user.id, "Flat 9C");
    await inviteToSpace(gitaSpace.id, hari.user.email, gita.user.id);

    const json = await (await listInvites(gitaSpace.id, gita.cookie)).json();

    expect(json.invitations).toHaveLength(1);
    expect(json.invitations[0].email).toBe(hari.user.email);
    expect(ramSpace.id).not.toBe(gitaSpace.id);
  });
});

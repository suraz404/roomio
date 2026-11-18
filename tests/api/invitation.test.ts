import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations } from "@/db/schema";
import { POST } from "@/app/api/spaces/[spaceId]/invitations/route";
import { createSpace } from "@/lib/spaces";
import { hashToken } from "@/lib/token";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";

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

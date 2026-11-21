import { describe, expect, it } from "vitest";
import { POST as accept } from "@/app/api/spaces/[spaceId]/invitations/[token]/accept/route";
import { POST as reject } from "@/app/api/spaces/[spaceId]/invitations/[token]/reject/route";
import { signUpAndGetCookie } from "../helpers/auth";
import {
  invitationRow,
  membershipsOf,
  setupInvite,
} from "../helpers/invitation";

function call(
  handler: typeof accept,
  token: string,
  action: string,
  cookie?: string,
) {
  const request = new Request(
    `http://localhost:3000/api/invitations/${token}/${action}`,
    { method: "POST", headers: cookie ? { cookie } : {} },
  );

  return handler(request, { params: Promise.resolve({ token }) });
}

const doReject = (token: string, cookie?: string) =>
  call(reject, token, "reject", cookie);
const doAccept = (token: string, cookie?: string) =>
  call(accept, token, "accept", cookie);

describe("POST /api/invitations/[token]/reject", () => {
  it("returns 401 without a session", async () => {
    const { token } = await setupInvite();

    expect((await doReject(token)).status).toBe(401);
  });

  it("marks the invite rejected and adds nobody", async () => {
    const { sita, space, invitationId, token } = await setupInvite();

    const response = await doReject(token, sita.cookie);

    expect(response.status).toBe(204);
    const row = await invitationRow(invitationId);
    expect(row.status).toBe("rejected");
    expect(row.respondedAt).toBeInstanceOf(Date);
    expect(row.acceptedBy).toBeNull();
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(0);
  });

  it("returns 404 to anyone but the invitee", async () => {
    const { ram, invitationId, token } = await setupInvite();
    const hari = await signUpAndGetCookie("Hari");

    expect((await doReject(token, ram.cookie)).status).toBe(404);
    expect((await doReject(token, hari.cookie)).status).toBe(404);
    expect((await invitationRow(invitationId)).status).toBe("pending");
  });

  it("returns 404 for an unknown token", async () => {
    const { sita } = await setupInvite();

    expect((await doReject("not-a-real-token", sita.cookie)).status).toBe(404);
  });

  it("returns 409 when rejecting twice", async () => {
    const { sita, token } = await setupInvite();

    await doReject(token, sita.cookie);
    const second = await doReject(token, sita.cookie);

    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: "This invitation was declined.",
    });
  });

  it("blocks accepting after rejecting", async () => {
    const { sita, space, token } = await setupInvite();

    await doReject(token, sita.cookie);
    const response = await doAccept(token, sita.cookie);

    expect(response.status).toBe(409);
    expect(await membershipsOf(sita.user.id, space.id)).toHaveLength(0);
  });

  it("keeps data consistent when accept and reject race", async () => {
    const { sita, space, invitationId, token } = await setupInvite();

    await Promise.all([
      doAccept(token, sita.cookie),
      doReject(token, sita.cookie),
    ]);

    const row = await invitationRow(invitationId);
    const members = await membershipsOf(sita.user.id, space.id);

    expect(["accepted", "rejected"]).toContain(row.status);
    expect(members.length === 1).toBe(row.status === "accepted");
  });
});

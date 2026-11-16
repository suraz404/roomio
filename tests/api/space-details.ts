import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { spaces } from "@/db/schema";
import { GET, PATCH } from "@/app/api/spaces/[spaceId]/route";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";

function getSpace(spaceId: string, cookie?: string) {
  const request = new Request(`http://localhost:3000/api/spaces/${spaceId}`, {
    headers: cookie ? { cookie } : {},
  });

  return GET(request, { params: Promise.resolve({ spaceId }) });
}

describe("GET /api/spaces/[spaceId]", () => {
  it("returns 401 without a session", async () => {
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(sita.user.id, "Flat 4B");

    const response = await getSpace(space.id);

    expect(response.status).toBe(401);
  });

  it("returns the space with sorted members and no emails", async () => {
    const sita = await signUpAndGetCookie("Sita");
    const anil = await signUpAndGetCookie("Anil");
    const space = await createSpace(sita.user.id, "Flat 4B");
    await addMember(space.id, anil.user.id);

    const response = await getSpace(space.id, sita.cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      space: {
        id: space.id,
        name: "Flat 4B",
        createdAt: space.createdAt.toISOString(),
        myRole: "admin",
        members: [
          { userId: anil.user.id, name: "Anil", role: "member" },
          { userId: sita.user.id, name: "Sita", role: "admin" },
        ],
      },
    });
  });

  it("returns myRole member for a plain member", async () => {
    const sita = await signUpAndGetCookie("Sita");
    const anil = await signUpAndGetCookie("Anil");
    const space = await createSpace(sita.user.id, "Flat 4B");
    await addMember(space.id, anil.user.id);

    const response = await getSpace(space.id, anil.cookie);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.space.myRole).toBe("member");
  });

  it("returns 403 for a non-member", async () => {
    const sita = await signUpAndGetCookie("Sita");
    const hari = await signUpAndGetCookie("Hari");
    const space = await createSpace(sita.user.id, "Flat 4B");

    const response = await getSpace(space.id, hari.cookie);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You are not a member of this space.",
    });
  });

  it("returns 403 for the admin of a different space", async () => {
    const sita = await signUpAndGetCookie("Sita");
    const gita = await signUpAndGetCookie("Gita");
    const sitaSpace = await createSpace(sita.user.id, "Flat 4B");
    await createSpace(gita.user.id, "Flat 9C");

    const response = await getSpace(sitaSpace.id, gita.cookie);

    expect(response.status).toBe(403);
  });

  it("returns 403, not 404, for a space that does not exist", async () => {
    const sita = await signUpAndGetCookie("Sita");

    const response = await getSpace(crypto.randomUUID(), sita.cookie);

    expect(response.status).toBe(403);
  });
});
function patchSpace(spaceId: string, body: unknown, cookie?: string) {
  const request = new Request(`http://localhost:3000/api/spaces/${spaceId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  return PATCH(request, { params: Promise.resolve({ spaceId }) });
}

async function nameInDb(spaceId: string) {
  const [row] = await db
    .select({ name: spaces.name })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  return row?.name;
}

describe("PATCH /api/spaces/[spaceId]", () => {
  it("returns 401 without a session", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await patchSpace(space.id, { name: "X" });

    expect(response.status).toBe(401);
  });

  it("lets an admin rename the space", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await patchSpace(
      space.id,
      { name: "  Sunshine Flat  " },
      ram.cookie,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      space: {
        id: space.id,
        name: "Sunshine Flat",
        createdAt: space.createdAt.toISOString(),
      },
    });
    expect(await nameInDb(space.id)).toBe("Sunshine Flat");
  });

  it("returns 403 for a plain member and leaves the name unchanged", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");
    await addMember(space.id, sita.user.id);

    const response = await patchSpace(
      space.id,
      { name: "Hacked" },
      sita.cookie,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Only space admins can do this.",
    });
    expect(await nameInDb(space.id)).toBe("Flat 4B");
  });

  it("checks access before the body (403, not 400, for a member)", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");
    await addMember(space.id, sita.user.id);

    const response = await patchSpace(space.id, { name: "" }, sita.cookie);

    expect(response.status).toBe(403);
  });

  it("returns 403 for a non-member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const hari = await signUpAndGetCookie("Hari");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await patchSpace(space.id, { name: "X" }, hari.cookie);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You are not a member of this space.",
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await patchSpace(space.id, "{not json", ram.cookie);

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid name and leaves the name unchanged", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await patchSpace(space.id, { name: "   " }, ram.cookie);

    expect(response.status).toBe(400);
    expect(await nameInDb(space.id)).toBe("Flat 4B");
  });

  it("only renames the requested space", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const flat4B = await createSpace(ram.user.id, "Flat 4B");
    const flat7A = await createSpace(ram.user.id, "Flat 7A");

    await patchSpace(flat4B.id, { name: "Sunshine Flat" }, ram.cookie);

    expect(await nameInDb(flat4B.id)).toBe("Sunshine Flat");
    expect(await nameInDb(flat7A.id)).toBe("Flat 7A");
  });
});
describe("malformed spaceId", () => {
  it("GET returns 403, not 500", async () => {
    const ram = await signUpAndGetCookie("Ram");

    const response = await getSpace("abc", ram.cookie);

    expect(response.status).toBe(403);
  });

  it("PATCH returns 403, not 500", async () => {
    const ram = await signUpAndGetCookie("Ram");

    const response = await patchSpace("abc", { name: "X" }, ram.cookie);

    expect(response.status).toBe(403);
  });
});

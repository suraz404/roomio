import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { space_members } from "@/db/schema";
import { GET, POST } from "@/app/api/spaces/route";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "../helpers/auth";
import { spaces } from "@/db/schema";
import { parseSpaceName } from "@/lib/spaces";

// Builds a POST /api/spaces request. Pass a cookie to act as a logged-in user.
function makeRequest(body: unknown, cookie?: string) {
  return new Request("http://localhost:3000/api/spaces", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
//Get req
function makeGetRequest(cookie?: string) {
  return new Request("http://localhost:3000/api/spaces", {
    method: "GET",
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/spaces", () => {
  it("returns 401 without a session", async () => {
    const response = await GET(makeGetRequest());

    expect(response.status).toBe(401);
  });

  it("returns an empty list for a user with no spaces", async () => {
    const { cookie } = await signUpAndGetCookie();

    const response = await GET(makeGetRequest(cookie));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ spaces: [] });
  });

  it("returns the user's space with their role", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const response = await GET(makeGetRequest(ram.cookie));
    const json = await response.json();

    expect(json.spaces).toEqual([
      {
        id: space.id,
        name: "Flat 4B",
        role: "admin",
        createdAt: space.createdAt.toISOString(),
      },
    ]);
  });

  it("does not return spaces the user is not a member of", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    await createSpace(ram.user.id, "Flat 4B");
    await createSpace(sita.user.id, "Flat 7A");

    const response = await GET(makeGetRequest(ram.cookie));
    const json = await response.json();

    const names = json.spaces.map((s: { name: string }) => s.name);
    expect(names).toEqual(["Flat 4B"]);
  });

  it("includes spaces where the user is a plain member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await db.insert(space_members).values({
      user_id: sita.user.id,
      space_id: space.id,
      role: "member",
    });

    const response = await GET(makeGetRequest(sita.cookie));
    const json = await response.json();

    expect(json.spaces).toHaveLength(1);
    expect(json.spaces[0]).toMatchObject({ id: space.id, role: "member" });
  });

  it("lists the newest space first", async () => {
    const ram = await signUpAndGetCookie("Ram");
    await createSpace(ram.user.id, "Old Flat");
    await createSpace(ram.user.id, "New Flat");

    const response = await GET(makeGetRequest(ram.cookie));
    const json = await response.json();

    const names = json.spaces.map((s: { name: string }) => s.name);
    expect(names).toEqual(["New Flat", "Old Flat"]);
  });
});

describe("POST /api/spaces", () => {
  it("returns 401 without a session", async () => {
    const response = await POST(makeRequest({ name: "Flat 4B" }));

    expect(response.status).toBe(401);
  });

  it("creates the space and makes the creator admin", async () => {
    // Arrange
    const { user, cookie } = await signUpAndGetCookie();

    // Act
    const response = await POST(makeRequest({ name: "Flat 4B" }, cookie));
    const json = await response.json();

    // Assert: the API response
    expect(response.status).toBe(201);
    expect(json.space).toMatchObject({ name: "Flat 4B", createdBy: user.id });

    // Assert: the database
    const members = await db
      .select()
      .from(space_members)
      .where(eq(space_members.space_id, json.space.id));

    expect(members).toEqual([
      { user_id: user.id, space_id: json.space.id, role: "admin" },
    ]);
  });

  it("ignores createdBy in the body", async () => {
    // Arrange
    const attacker = await signUpAndGetCookie("Attacker");
    const victim = await signUpAndGetCookie("Victim");

    // Act
    const response = await POST(
      makeRequest({ name: "Fake", createdBy: victim.user.id }, attacker.cookie),
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(json.space.createdBy).toBe(attacker.user.id);
  });
  it("returns 400 for invalid JSON", async () => {
    const { cookie } = await signUpAndGetCookie();

    const request = new Request("http://localhost:3000/api/spaces", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: "{not json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it.each([
    ["missing", {}],
    ["a number", { name: 123 }],
    ["null", { name: null }],
    ["empty", { name: "" }],
    ["only spaces", { name: "   " }],
    ["61 characters", { name: "a".repeat(61) }],
  ])("returns 400 when name is %s", async (_label, body) => {
    const { cookie } = await signUpAndGetCookie();

    const response = await POST(makeRequest(body, cookie));

    expect(response.status).toBe(400);
  });

  it("trims the name", async () => {
    const { cookie } = await signUpAndGetCookie();

    const response = await POST(makeRequest({ name: "  Flat 4B  " }, cookie));
    const json = await response.json();

    expect(json.space.name).toBe("Flat 4B");
  });

  it("accepts a name of exactly 60 characters", async () => {
    const { cookie } = await signUpAndGetCookie();

    const response = await POST(makeRequest({ name: "a".repeat(60) }, cookie));

    expect(response.status).toBe(201);
  });

  it("does not create a space when the request is invalid", async () => {
    const { cookie } = await signUpAndGetCookie();

    await POST(makeRequest({ name: "" }, cookie));

    const rows = await db.select().from(spaces);
    expect(rows).toHaveLength(0);
  });
});
describe("parseSpaceName", () => {
  it.each([
    [{ name: "Flat 4B" }, "Flat 4B"],
    [{ name: "  Flat 4B  " }, "Flat 4B"],
    [{ name: "a".repeat(60) }, "a".repeat(60)],
    [{ name: "Flat 4B", extra: true }, "Flat 4B"],
  ])("accepts %j", (body, expected) => {
    expect(parseSpaceName(body)).toEqual({ ok: true, name: expected });
  });

  it.each([
    [{}, "name is required"],
    [{ name: 123 }, "name is required"],
    [{ name: null }, "name is required"],
    [null, "name is required"],
    ["Flat 4B", "name is required"],
    [{ name: "" }, "name must be 1-60 characters"],
    [{ name: "   " }, "name must be 1-60 characters"],
    [{ name: "a".repeat(61) }, "name must be 1-60 characters"],
  ])("rejects %j", (body, error) => {
    expect(parseSpaceName(body)).toEqual({ ok: false, error });
  });
});

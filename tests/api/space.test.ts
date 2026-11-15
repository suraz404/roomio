import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { space_members } from "@/db/schema";
import { POST } from "@/app/api/spaces/route";
import { signUpAndGetCookie } from "../helpers/auth";
import { spaces } from "@/db/schema";

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

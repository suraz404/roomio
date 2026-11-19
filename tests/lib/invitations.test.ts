import { describe, expect, it } from "vitest";
import { parseInviteEmail, effectiveStatus } from "@/lib/invitation";
import { generateToken, hashToken } from "@/lib/token";

describe("parseInviteEmail", () => {
  it.each([
    [{ email: "sita@example.com" }, "sita@example.com"],
    [{ email: "  Sita@Example.COM  " }, "sita@example.com"],
    [{ email: "a.b+roomio@mail.co.np" }, "a.b+roomio@mail.co.np"],
  ])("accepts %j", (body, expected) => {
    expect(parseInviteEmail(body)).toEqual({ ok: true, email: expected });
  });

  it.each([
    [{}, "email is required"],
    [{ email: 123 }, "email is required"],
    [null, "email is required"],
    [{ email: "" }, "email must be a valid email address"],
    [{ email: "sita@" }, "email must be a valid email address"],
    [{ email: "sita@example" }, "email must be a valid email address"],
    [{ email: "si ta@example.com" }, "email must be a valid email address"],
    [
      { email: `${"a".repeat(250)}@x.com` },
      "email must be a valid email address",
    ],
  ])("rejects %j", (body, error) => {
    expect(parseInviteEmail(body)).toEqual({ ok: false, error });
  });
});

describe("tokens", () => {
  it("generates a URL-safe 43-character token", () => {
    const token = generateToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates a different token every time", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));

    expect(tokens.size).toBe(100);
  });

  it("hashes the same token to the same value, and differs from the token", () => {
    const token = generateToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes different tokens to different values", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
describe("effectiveStatus", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const yesterday = new Date("2026-11-19T12:00:00Z");
  const tomorrow = new Date("2026-11-21T12:00:00Z");

  it.each([
    ["pending", tomorrow, "pending"],
    ["pending", yesterday, "expired"],
    ["pending", now, "expired"],
    ["accepted", yesterday, "accepted"],
    ["rejected", yesterday, "rejected"],
    ["revoked", yesterday, "revoked"],
  ] as const)("%s expiring %s → %s", (status, expiresAt, expected) => {
    expect(effectiveStatus({ status, expiresAt }, now)).toBe(expected);
  });
});

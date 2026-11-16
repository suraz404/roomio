import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/ids";

describe("isUuid", () => {
  it("accepts a uuid", () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
  });

  it("accepts uppercase", () => {
    expect(isUuid(crypto.randomUUID().toUpperCase())).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["word", "abc"],
    ["too short", "a1b2c3d4-e5f6-4789-abcd-ef012345678"],
    ["extra text", `x${crypto.randomUUID()}`],
    ["sql", "1' OR '1'='1"],
  ])("rejects %s", (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });
});

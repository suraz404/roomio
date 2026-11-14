import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "./env";

describe("assertTestDatabase", () => {
  it("returns the database name for a *_test database", () => {
    const url = "postgresql://roomio:pw@localhost:5440/roomio_test";

    const result = assertTestDatabase(url);

    expect(result).toBe("roomio_test");
  });

  it("throws for the development database", () => {
    const url = "postgresql://roomio:pw@localhost:5440/roomio";

    expect(() => assertTestDatabase(url)).toThrow(
      'database "roomio" does not end with "_test"',
    );
  });
});

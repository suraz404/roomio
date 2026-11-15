import { describe, expect, it } from "vitest";
import { createSpace } from "@/lib/spaces";
import {
  ForbiddenError,
  requireSpaceMembership,
  UnauthorizedError,
} from "@/lib/space-access";
import { signUpAndGetCookie } from "../helpers/auth";

function headersWith(cookie?: string) {
  return new Headers(cookie ? { cookie } : {});
}

describe("requireSpaceMembership", () => {
  it("returns the membership for a member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const membership = await requireSpaceMembership(
      space.id,
      headersWith(ram.cookie),
    );

    expect(membership).toMatchObject({
      user_id: ram.user.id,
      space_id: space.id,
      role: "admin",
    });
  });

  it("throws ForbiddenError for a non-member", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await expect(
      requireSpaceMembership(space.id, headersWith(sita.cookie)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError even if the user is admin of another space", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const ramSpace = await createSpace(ram.user.id, "Flat 4B");
    await createSpace(sita.user.id, "Flat 7A");

    await expect(
      requireSpaceMembership(ramSpace.id, headersWith(sita.cookie)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws UnauthorizedError without a session", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await expect(
      requireSpaceMembership(space.id, headersWith()),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ForbiddenError for a space that does not exist", async () => {
    const ram = await signUpAndGetCookie("Ram");

    await expect(
      requireSpaceMembership(crypto.randomUUID(), headersWith(ram.cookie)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.todo("rejects a spaceId that is not a valid uuid (currently a 500)");
});

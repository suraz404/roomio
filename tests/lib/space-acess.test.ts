import { describe, expect, it } from "vitest";
import { createSpace } from "@/lib/spaces";
import {
  ForbiddenError,
  requireSpaceAdmin,
  requireSpaceMembership,
  UnauthorizedError,
} from "@/lib/space-access";
import { signUpAndGetCookie } from "../helpers/auth";
import { addMember } from "../helpers/db";

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
describe("requireSpaceAdmin", () => {
  it("returns the membership for an admin", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    const membership = await requireSpaceAdmin(
      space.id,
      headersWith(ram.cookie),
    );

    expect(membership).toMatchObject({ user_id: ram.user.id, role: "admin" });
  });

  it("rejects a plain member with an admin-only message", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const sita = await signUpAndGetCookie("Sita");
    const space = await createSpace(ram.user.id, "Flat 4B");
    await addMember(space.id, sita.user.id);

    await expect(
      requireSpaceAdmin(space.id, headersWith(sita.cookie)),
    ).rejects.toMatchObject({
      name: "ForbiddenError",
      message: "Only space admins can do this.",
    });
  });

  it("rejects a non-member with the not-a-member message", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const hari = await signUpAndGetCookie("Hari");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await expect(
      requireSpaceAdmin(space.id, headersWith(hari.cookie)),
    ).rejects.toMatchObject({
      name: "ForbiddenError",
      message: "You are not a member of this space.",
    });
  });

  it("throws UnauthorizedError without a session", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const space = await createSpace(ram.user.id, "Flat 4B");

    await expect(
      requireSpaceAdmin(space.id, headersWith()),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects the admin of a different space", async () => {
    const ram = await signUpAndGetCookie("Ram");
    const gita = await signUpAndGetCookie("Gita");
    const ramSpace = await createSpace(ram.user.id, "Flat 4B");
    await createSpace(gita.user.id, "Flat 9C");

    await expect(
      requireSpaceAdmin(ramSpace.id, headersWith(gita.cookie)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

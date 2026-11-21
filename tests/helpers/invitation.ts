import { createInvitation } from "@/lib/invitation";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "./auth";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invitations, space_members } from "@/db/schema";

export async function inviteToSpace(
  spaceId: string,
  email: string,
  invitedBy: string,
) {
  const { invitation, token } = await createInvitation({
    spaceId,
    email,
    invitedBy,
  });

  return { invitationId: invitation.id, token };
}

// Ram creates "Flat 4B" and invites Sita.
export async function setupInvite() {
  const ram = await signUpAndGetCookie("Ram");
  const sita = await signUpAndGetCookie("Sita");
  const space = await createSpace(ram.user.id, "Flat 4B");
  const { invitationId, token } = await inviteToSpace(
    space.id,
    sita.user.email,
    ram.user.id,
  );

  return { ram, sita, space, invitationId, token };
}

export async function invitationRow(id: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, id));

  return row;
}

export function membershipsOf(userId: string, spaceId: string) {
  return db
    .select()
    .from(space_members)
    .where(
      and(
        eq(space_members.user_id, userId),
        eq(space_members.space_id, spaceId),
      ),
    );
}

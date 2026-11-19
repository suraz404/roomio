import { createInvitation } from "@/lib/invitation";
import { createSpace } from "@/lib/spaces";
import { signUpAndGetCookie } from "./auth";

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

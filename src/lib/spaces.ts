import { db } from "@/db/client";
import { spaces, space_members } from "@/db/schema";

export const SPACE_NAME_MAX_LENGTH = 60;

// Creates the space and the creator's admin membership atomically:
// either both rows exist, or neither does.
export async function createSpace(userId: string, name: string) {
  return db.transaction(async (tx) => {
    const [space] = await tx
      .insert(spaces)
      .values({ name, createdBy: userId })
      .returning();

    await tx.insert(space_members).values({
      user_id: userId,
      space_id: space.id,
      role: "admin",
    });

    return space;
  });
}

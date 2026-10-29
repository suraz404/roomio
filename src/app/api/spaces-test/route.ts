import { db } from "@/db/client";
import { spaces, space_members } from "@/db/schema";

export async function POST() {
  const result = await db.transaction(async (tx) => {
    const [space] = await tx
      .insert(spaces)
      .values({
        name: "Roomio Test Space",
        createdBy: "c5aca987-40b4-4de2-8129-d1bbf7a655a9",
      })
      .returning();

    const [membership] = await tx
      .insert(space_members)
      .values({
        user_id: space.createdBy,
        space_id: space.id,
        role: "admin",
      })
      .returning();

    return { space, membership };
  });

  return Response.json({
    success: true,
    ...result,
  });
}

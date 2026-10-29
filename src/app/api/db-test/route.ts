import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  const result = await db.execute(sql`SELECT 1 AS connected`);

  return Response.json({
    success: true,
    result,
  });
}

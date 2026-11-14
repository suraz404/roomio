import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { TEST_DATABASE_URL, assertTestDatabase } from "./env";

export default async function globalSetup() {
  const dbName = assertTestDatabase(TEST_DATABASE_URL);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });

  try {
    const existing = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (existing.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(TEST_DATABASE_URL, { max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}

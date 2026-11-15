import { beforeEach } from "vitest";
import { assertTestDatabase } from "./env";
import { resetDb } from "./helpers/db";

assertTestDatabase(process.env.DATABASE_URL!);

beforeEach(async () => {
  await resetDb();
});

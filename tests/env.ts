export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://roomio:roomio_dev_password@localhost:5440/roomio_test";

export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:3000",
};

export function assertTestDatabase(url: string) {
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);

  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: database "${dbName}" does not end with "_test".`,
    );
  }

  return dbName;
}

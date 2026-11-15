import { auth } from "@/lib/auth";

export async function signUpAndGetCookie(name = "Test User") {
  const email = `user-${crypto.randomUUID()}@example.com`;

  const { headers, response } = await auth.api.signUpEmail({
    body: { name, email, password: "test-password-123" },
    returnHeaders: true,
  });

  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  return { user: response.user, cookie };
}

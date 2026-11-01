import { auth } from "@/lib/auth";

export async function getApiSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });

  return session;
}

import { createHash, randomBytes } from "node:crypto";

// 32 random bytes = 256 bits: impossible to guess. base64url is URL-safe.
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

// Store this, never the token. Tokens are long and random, so a fast hash
// (unlike passwords, which need a slow one) is enough.
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

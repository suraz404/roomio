// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

// No baseURL: the client resolves against the origin the page was served from.
export const authClient = createAuthClient();

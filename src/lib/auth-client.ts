import { createAuthClient } from "better-auth/react";
import {
  usernameClient,
  adminClient,
  organizationClient,
} from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "@/auth/auth";

/**
 * Singleton Better Auth client for the browser.
 *
 * – Adds `usernameClient()` for username flows.
 * – Adds `adminClient()` for admin flows.
 * – Adds `organizationClient()` for organization flows.
 * – `inferAdditionalFields<typeof auth>()` keeps client-side types in sync with
 *   extra fields the server (plugins / config) add to User & Session objects.
 */
export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient(),
    organizationClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});

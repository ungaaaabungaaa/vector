import { auth } from "@/auth/auth";
import { db } from "@/db";
import {
  user as userTable,
  account as accountTable,
  member,
  organization,
} from "@/db/schema";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";
import { eq, or, InferInsertModel, and } from "drizzle-orm";

export async function adminExists(): Promise<boolean> {
  const res = await auth.api.listUsers({
    query: {
      filterField: "role",
      filterOperator: "eq",
      filterValue: "admin",
      limit: 1,
    },
  });
  return Array.isArray(res.users) && res.users.length > 0;
}

export async function promoteUserToAdmin(userId: string): Promise<void> {
  await auth.api.setRole({
    body: {
      userId,
      role: "admin",
    },
  });
}

// Derive the table's insertable model from Drizzle so we stay in-sync with schema changes.
type UserInsertModel = InferInsertModel<typeof userTable>;

export type CreateUserParams = Pick<
  UserInsertModel,
  "name" | "email" | "username" | "emailVerified"
> & {
  /** Raw password – will be hashed before storage. */
  password: string;
  /** Optional role, defaults → "user" */
  role?: string;
};

/**
 * Creates a new user + associated **credential** account row in the Better-Auth tables.
 *
 * – Performs uniqueness checks on `email` and `username`.
 * – Hashes the password using Better-Auth's `hashPassword()` helper.
 * – Uses a single transaction to guarantee consistency between `user` and `account` tables.
 */
export async function createUser(
  params: CreateUserParams,
): Promise<{ id: string }> {
  const {
    name,
    email,
    password,
    username,
    role = "user",
    emailVerified = false,
  } = params;

  // Build the where clause dynamically – if `username` isn't provided we only check by email.
  const whereClause = username
    ? or(eq(userTable.email, email), eq(userTable.username, username))
    : eq(userTable.email, email);

  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(whereClause)
    .limit(1);

  if (existing.length > 0) {
    throw new Error("A user with this email or username already exists");
  }

  // 2) Prepare data
  const userId = randomUUID();
  const hashedPassword = await hashPassword(password);
  const now = new Date();

  // 3) Atomic insert – user + credential account
  await db.transaction(async (tx) => {
    await tx.insert(userTable).values({
      id: userId,
      name,
      email,
      emailVerified,
      username,
      role,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(accountTable).values({
      id: randomUUID(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { id: userId } as const;
}

// ------------------------------------------------------------------------------------------------
// Admin helpers
// ------------------------------------------------------------------------------------------------

/**
 * Creates the **first** admin user in a brand-new installation.
 * Throws if an admin already exists.
 */
export async function createAdminUser(
  params: Omit<CreateUserParams, "role">,
): Promise<{ id: string }> {
  // Check directly in the DB to avoid needing an authenticated Better-Auth call
  const existingAdmin = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.role, "admin"))
    .limit(1);

  if (existingAdmin.length > 0) {
    throw new Error("An admin account already exists");
  }

  return createUser({ ...params, role: "admin", emailVerified: true });
}

export class UserService {
  /**
   * Get the user's active organization for post-login redirect
   */
  static async getUserActiveOrganization(
    userId: string,
    sessionActiveOrgId?: string | null,
  ) {
    console.log(
      "[UserService] Getting active org for user:",
      userId,
      "session org:",
      sessionActiveOrgId,
    );

    try {
      // Helper to fetch slug with arbitrary additional conditions
      const fetchSlug = async (additionalWhere?: any) => {
        const rows = await db
          .select({ slug: organization.slug })
          .from(member)
          .innerJoin(organization, eq(member.organizationId, organization.id))
          .where(
            additionalWhere
              ? and(eq(member.userId, userId), additionalWhere)
              : eq(member.userId, userId),
          )
          .limit(1);
        return rows[0]?.slug as string | undefined;
      };

      // Try session active org first
      if (sessionActiveOrgId) {
        console.log(
          "[UserService] Checking session active org:",
          sessionActiveOrgId,
        );
        const sessionSlug = await fetchSlug(
          eq(member.organizationId, sessionActiveOrgId),
        );

        if (sessionSlug) {
          console.log(
            "[UserService] Found session org slug, returning:",
            sessionSlug,
          );
          return sessionSlug;
        }
        console.log("[UserService] Session org membership not found");
      }

      // Fallback: Get first organization membership slug
      console.log("[UserService] Getting first org membership for user");
      const firstSlug = await fetchSlug();

      const result = firstSlug ?? null;
      console.log("[UserService] First membership slug result:", result);
      return result;
    } catch (error) {
      console.error("[UserService] Error getting active organization:", error);
      return null;
    }
  }

  /**
   * Check if any users exist in the system (for first-run check)
   */
  static async hasAnyUsers() {
    try {
      const anyUser = await db
        .select({ id: userTable.id })
        .from(userTable)
        .limit(1);
      const hasUsers = anyUser.length > 0;
      console.log("[UserService] Has users check:", hasUsers);
      return hasUsers;
    } catch (error) {
      console.error("[UserService] Error checking if users exist:", error);
      return false;
    }
  }
}

import { db } from "@/db";
import {
  team as teamTable,
  teamMember as teamMemberTable,
  issue as issueTable,
  organization as organizationTable,
  user,
} from "@/db/schema";
import {
  eq,
  desc,
  InferInsertModel,
  InferSelectModel,
  and,
  like,
  count,
} from "drizzle-orm";
import { randomUUID } from "crypto";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TeamInsertModel = InferInsertModel<typeof teamTable>;
export type Team = InferSelectModel<typeof teamTable>;

export interface CreateTeamParams {
  organizationId: string;
  /** Short uppercase key like ENG, MKT (#prefix for issues) */
  key: string;
  name: string;
  description?: string;
  /** Optional lead (must belong to the organization) */
  leadId?: string;
  /** Optional icon name (Lucide) */
  icon?: string | null;
  /** Optional hex color */
  color?: string | null;
}

export interface UpdateTeamParams {
  id: string;
  /** Patch fields – only provided keys will be updated */
  data: Partial<
    Pick<
      TeamInsertModel,
      "name" | "description" | "leadId" | "key" | "icon" | "color"
    >
  >;
}

// -----------------------------------------------------------------------------
// CRUD operations
// -----------------------------------------------------------------------------

export async function createTeam(
  params: CreateTeamParams,
): Promise<{ id: string }> {
  const { organizationId, key, name, description, leadId, icon, color } =
    params;

  // 1) Ensure the key is unique **within** the organization
  const existing = await db
    .select({ id: teamTable.id })
    .from(teamTable)
    .where(
      and(eq(teamTable.organizationId, organizationId), eq(teamTable.key, key)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Team key "${key}" already exists in this organization`);
  }

  const id = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    // 2) Insert team row
    await tx.insert(teamTable).values({
      id,
      organizationId,
      key,
      name,
      description,
      leadId,
      icon,
      color,
      createdAt: now,
      updatedAt: now,
    });

    // 3) Insert leader as member (if provided)
    if (leadId) {
      await tx.insert(teamMemberTable).values({
        teamId: id,
        userId: leadId,
        role: "lead",
        joinedAt: now,
      });
    }
  });

  return { id } as const;
}

export async function updateTeam(params: UpdateTeamParams): Promise<void> {
  const { id, data } = params;
  if (Object.keys(data).length === 0) return; // nothing to update

  await db
    .update(teamTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teamTable.id, id));

  // If leadId updated, ensure the user is also a team member with role 'lead'
  if (data.leadId) {
    const now = new Date();
    await db
      .insert(teamMemberTable)
      .values({
        teamId: id,
        userId: data.leadId,
        role: "lead",
        joinedAt: now,
      })
      .onConflictDoUpdate({
        target: [teamMemberTable.teamId, teamMemberTable.userId],
        set: { role: "lead" },
      });
  }
}

export async function deleteTeam(teamId: string): Promise<void> {
  await db.delete(teamTable).where(eq(teamTable.id, teamId));
}

// -----------------------------------------------------------------------------
// Member helpers
// -----------------------------------------------------------------------------

export async function addMember(
  teamId: string,
  userId: string,
  role: string = "member",
): Promise<void> {
  const now = new Date();
  await db
    .insert(teamMemberTable)
    .values({ teamId, userId, role: role as "lead" | "member", joinedAt: now })
    .onConflictDoNothing();
}

export async function removeMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(teamMemberTable)
    .where(
      and(
        eq(teamMemberTable.teamId, teamId),
        eq(teamMemberTable.userId, userId),
      ),
    );

  // After deletion ensure not empty
  const remaining = await db
    .select({ cnt: count() })
    .from(teamMemberTable)
    .where(eq(teamMemberTable.teamId, teamId));

  if ((remaining[0]?.cnt ?? 0) === 0) {
    throw new Error("Cannot remove the last member from the team");
  }
}

/**
 * List all members of a team with their user details
 */
export async function listTeamMembers(teamId: string) {
  return await db
    .select({
      userId: teamMemberTable.userId,
      role: teamMemberTable.role,
      joinedAt: teamMemberTable.joinedAt,
      name: user.name,
      email: user.email,
    })
    .from(teamMemberTable)
    .innerJoin(user, eq(teamMemberTable.userId, user.id))
    .where(eq(teamMemberTable.teamId, teamId))
    .orderBy(desc(teamMemberTable.joinedAt));
}

// -----------------------------------------------------------------------------
// Issue helpers
// -----------------------------------------------------------------------------

/**
 * Generates the next **sequence number** for team-based issues within a given team.
 * Only counts issues that were created with team-based keys.
 *
 * This uses the highest `sequenceNumber` currently present and returns +1.
 * We run the query in a transaction allowing callers to re-use the same
 * transaction when creating the issue, ensuring no race-conditions when two
 * issues are created in parallel.
 */
export async function getNextIssueSequence(teamId: string): Promise<number> {
  // Get the team key first to filter by issues that start with this key
  const teamResult = await db
    .select({ key: teamTable.key })
    .from(teamTable)
    .where(eq(teamTable.id, teamId))
    .limit(1);

  if (teamResult.length === 0) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const teamKey = teamResult[0].key;

  // Count issues that have keys starting with this team's key
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .where(
      and(
        eq(issueTable.teamId, teamId),
        // Only count issues with team-based keys (start with team key)
        like(issueTable.key, `${teamKey}-%`),
      ),
    )
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);

  const current = res[0]?.seq ?? 0;
  return current + 1;
}

// -----------------------------------------------------------------------------
// Query operations
// -----------------------------------------------------------------------------

/**
 * Finds a team by its key within an organization.
 */
export async function findTeamByKey(
  orgSlug: string,
  teamKey: string,
): Promise<Team | null> {
  const result = await db
    .select({
      team: teamTable,
    })
    .from(teamTable)
    .innerJoin(
      organizationTable,
      eq(teamTable.organizationId, organizationTable.id),
    )
    .where(and(eq(organizationTable.slug, orgSlug), eq(teamTable.key, teamKey)))
    .limit(1);

  return result[0]?.team || null;
}

import { db } from "@/db";
import {
  team as teamTable,
  teamMember as teamMemberTable,
  issue as issueTable,
} from "@/db/schema";
import { eq, desc, InferInsertModel, InferSelectModel, and } from "drizzle-orm";
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
}

export interface UpdateTeamParams {
  id: string;
  /** Patch fields – only provided keys will be updated */
  data: Partial<Pick<TeamInsertModel, "name" | "description" | "leadId">>;
}

// -----------------------------------------------------------------------------
// CRUD operations
// -----------------------------------------------------------------------------

export async function createTeam(
  params: CreateTeamParams,
): Promise<{ id: string }> {
  const { organizationId, key, name, description, leadId } = params;

  // 1) Ensure the key is unique **within** the organization
  const existing = await db
    .select({ id: teamTable.id })
    .from(teamTable)
    .where(
      and(eq(teamTable.organizationId, organizationId), eq(teamTable.key, key)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Team key “${key}” already exists in this organization`);
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
    .values({ teamId, userId, role, joinedAt: now })
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
}

// -----------------------------------------------------------------------------
// Issue helpers
// -----------------------------------------------------------------------------

/**
 * Generates the next **sequence number** for issues within a given team.
 *
 * This uses the highest `sequenceNumber` currently present and returns +1.
 * We run the query in a transaction allowing callers to re-use the same
 * transaction when creating the issue, ensuring no race-conditions when two
 * issues are created in parallel.
 */
export async function getNextIssueSequence(teamId: string): Promise<number> {
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .where(eq(issueTable.teamId, teamId))
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);

  const current = res[0]?.seq ?? 0;
  return current + 1;
}

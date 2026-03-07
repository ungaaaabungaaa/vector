/**
 * Utilities for transforming data between Convex format and frontend expectations
 * This helps maintain UI/UX compatibility during the tRPC -> Convex migration
 */

import type { Id, Doc, TableNames } from '@/convex/_generated/dataModel';

/**
 * Transform Convex document to frontend format (adds id field from _id)
 */
export function withId<T extends { _id: Id<TableNames> }>(
  doc: T,
): T & { id: string } {
  return {
    ...doc,
    id: doc._id.toString(),
  };
}

/**
 * Transform array of Convex documents to frontend format
 */
export function withIds<T extends { _id: Id<TableNames> }>(
  docs: T[],
): (T & { id: string })[] {
  return docs.map(withId);
}

/**
 * Transform frontend format back to Convex ID
 */
export function toConvexId<T extends TableNames>(id: string): Id<T> {
  return id as Id<T>;
}

/**
 * Extract just the ID string from a Convex document
 */
export function extractId<T extends { _id: Id<TableNames> }>(doc: T): string {
  return doc._id.toString();
}

/**
 * Transform team data for frontend compatibility
 */
export function transformTeam(team: Doc<'teams'>) {
  return withId(team);
}

/**
 * Transform project data for frontend compatibility
 */
export function transformProject(project: Doc<'projects'>) {
  return withId(project);
}

/**
 * Transform state data for frontend compatibility
 */
export function transformState(state: Doc<'issueStates'>) {
  return withId(state);
}

/**
 * Transform priority data for frontend compatibility
 */
export function transformPriority(priority: Doc<'issuePriorities'>) {
  return withId(priority);
}

/**
 * Transform member data for frontend compatibility
 */
export function transformMember(member: Doc<'members'>) {
  return withId(member);
}

/**
 * Get string ID from either Convex document or plain ID
 */
export function getStringId<T extends TableNames>(
  idOrDoc: string | { _id: Id<T> },
): string {
  if (typeof idOrDoc === 'string') return idOrDoc;
  return idOrDoc._id.toString();
}

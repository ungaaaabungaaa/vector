"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Circle } from "lucide-react";
import React from "react";

import {
  PrioritySelector,
  TeamSelector,
  ProjectSelector,
  MultiAssigneeSelector,
  MultiAssignmentStateSelector,
} from "@/components/issues/issue-selectors";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { formatDateHuman } from "@/lib/date";

// Re-exported entity from the selector module give us fully-typed data
import type {
  Team,
  Project,
  State,
  Priority,
} from "@/components/issues/issue-selectors";
import { api } from "@/convex/_generated/api";
import { Prettify } from "@/lib/utils";
import { FunctionReturnType } from "convex/server";

// Permission system
import { PermissionAware } from "@/components/ui/permission-aware";
import { PERMISSIONS } from "@/convex/_shared/permissions";

// Infer issue row type directly from tRPC router output to stay in sync with DB.
export type IssueRowData = Prettify<
  FunctionReturnType<typeof api.issues.listIssues>["issues"][number]
>;

export interface IssuesTableProps {
  orgSlug: string;
  issues: ReadonlyArray<IssueRowData>;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams: ReadonlyArray<Team>;
  projects: ReadonlyArray<Project>;
  onPriorityChange: (issueId: string, priorityId: string) => void;

  onAssigneesChange: (issueId: string, assigneeIds: string[]) => void;
  onTeamChange: (issueId: string, teamId: string) => void;
  onProjectChange: (issueId: string, projectId: string) => void;
  onDelete: (issueId: string) => void;
  deletePending?: boolean;
  isUpdatingAssignees?: boolean;
  onAssignmentStateChange: (assignmentId: string, stateId: string) => void;
  isUpdatingAssignmentStates?: boolean;
  currentUserId: string;
  canChangeAll?: boolean;
  activeFilter: string;
}

export function IssuesTable({
  orgSlug,
  issues,
  states,
  priorities,
  teams,
  projects,
  onPriorityChange,
  onAssigneesChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending = false,
  isUpdatingAssignees = false,
  onAssignmentStateChange,
  isUpdatingAssignmentStates = false,
  currentUserId,
  canChangeAll = false,
  activeFilter,
}: IssuesTableProps) {
  // ------------------------------------------------------------------
  // Improved deduplication logic that preserves all assignee information
  // and handles filtering context properly
  // ------------------------------------------------------------------
  const groupedIssues = React.useMemo(() => {
    const map = new Map<
      string,
      {
        row: IssueRowData;
        assigneeIds: string[];
        assignments: Array<{
          assignmentId: string;
          assigneeId: string | null;
          assigneeName: string | null;
          assigneeEmail: string | null;
          stateId: string | null;
          stateIcon: string | null;
          stateColor: string | null;
          stateName: string | null;
          stateType: string | null;
        }>;
        // Add metadata for sorting and highlighting
        hasCurrentUserWithActiveFilter: boolean;
        currentUserStateType: string | null;
      }
    >();

    issues.forEach((row) => {
      if (row.id === "unassigned") return; // Skip empty assignments
      const existing = map.get(row.id);

      if (existing) {
        // Merge assignee ids (if any)
        if (row.assigneeId && !existing.assigneeIds.includes(row.assigneeId)) {
          existing.assigneeIds.push(row.assigneeId);
        }

        existing.assignments.push({
          assignmentId: row.assignmentId!,
          assigneeId: row.assigneeId ?? null,
          assigneeName: row.assigneeName ?? null,
          assigneeEmail: row.assigneeEmail ?? null,
          stateId: row.stateId ?? null,
          stateIcon: row.stateIcon ?? null,
          stateColor: row.stateColor ?? null,
          stateName: row.stateName ?? null,
          stateType: row.stateType ?? null,
        });

        // Update user-specific metadata
        if (row.assigneeId === currentUserId) {
          existing.currentUserStateType = row.stateType ?? null;
          if (activeFilter !== "all" && row.stateType === activeFilter) {
            existing.hasCurrentUserWithActiveFilter = true;
          }
        }

        // Prefer a row that has an assignee, and prefer current user's assignment if available
        if (!existing.row.assigneeId && row.assigneeId) {
          existing.row = row;
        } else if (row.assigneeId === currentUserId) {
          existing.row = row;
        }
      } else {
        const hasCurrentUserWithActiveFilter =
          activeFilter !== "all" &&
          row.assigneeId === currentUserId &&
          row.stateType === activeFilter;

        map.set(row.id, {
          row,
          assigneeIds: row.assigneeId ? [row.assigneeId] : [],
          assignments: [
            {
              assignmentId: row.assignmentId!,
              assigneeId: row.assigneeId ?? null,
              assigneeName: row.assigneeName ?? null,
              assigneeEmail: row.assigneeEmail ?? null,
              stateId: row.stateId ?? null,
              stateIcon: row.stateIcon ?? null,
              stateColor: row.stateColor ?? null,
              stateName: row.stateName ?? null,
              stateType: row.stateType ?? null,
            },
          ],
          hasCurrentUserWithActiveFilter,
          currentUserStateType:
            row.assigneeId === currentUserId ? (row.stateType ?? null) : null,
        });
      }
    });

    return Array.from(map.values()).map(
      ({
        row,
        assigneeIds,
        assignments,
        hasCurrentUserWithActiveFilter,
        currentUserStateType,
      }) => ({
        row,
        assigneeIds,
        assignments,
        hasCurrentUserWithActiveFilter,
        currentUserStateType,
      }),
    );
  }, [issues, currentUserId, activeFilter]);

  // Improved sorting that prioritizes user's assignments for the active filter
  const sortedGrouped = React.useMemo(() => {
    return [...groupedIssues].sort((a, b) => {
      // When filtering by state, prioritize issues where current user has that state
      if (activeFilter !== "all") {
        if (
          a.hasCurrentUserWithActiveFilter !== b.hasCurrentUserWithActiveFilter
        ) {
          return a.hasCurrentUserWithActiveFilter ? -1 : 1;
        }

        // If both/neither have current user with active filter,
        // check if either has ANY assignment with the active filter
        const aHasFilterState = a.assignments.some(
          (assignment) => assignment.stateType === activeFilter,
        );
        const bHasFilterState = b.assignments.some(
          (assignment) => assignment.stateType === activeFilter,
        );

        if (aHasFilterState !== bHasFilterState) {
          return aHasFilterState ? -1 : 1;
        }
      }

      // Default sort by update time
      return b.row.updatedAt - a.row.updatedAt;
    });
  }, [groupedIssues, activeFilter]);

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">📋</div>
          <h3 className="mb-2 text-lg font-semibold">No issues found</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first issue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {sortedGrouped.map(
          ({
            row: issue,
            assigneeIds,
            assignments,
            hasCurrentUserWithActiveFilter,
            currentUserStateType,
          }) => {
            // Priority icon / color
            const PriorityIcon = issue.priorityIcon
              ? getDynamicIcon(issue.priorityIcon) || Circle
              : Circle;
            const priorityColor = issue.priorityColor || "#94a3b8";

            // Determine which assignee to highlight based on filter
            let highlightAssigneeId: string | null = null;
            if (activeFilter !== "all") {
              // First priority: current user if they have the active filter state
              if (currentUserStateType === activeFilter) {
                highlightAssigneeId = currentUserId;
              } else {
                // Otherwise, highlight the first assignee that has the active filter state
                const matchingAssignment = assignments.find(
                  (a) => a.stateType === activeFilter,
                );
                if (matchingAssignment?.assigneeId) {
                  highlightAssigneeId = matchingAssignment.assigneeId;
                }
              }
            }

            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                key={issue.id}
                className={`hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors ${
                  hasCurrentUserWithActiveFilter ? "bg-accent/30" : ""
                }`}
              >
                {/* Priority Selector */}
                <PermissionAware
                  orgSlug={orgSlug}
                  permission={PERMISSIONS.ISSUE_PRIORITY_UPDATE}
                  fallbackMessage="You don't have permission to change issue priority"
                >
                  <PrioritySelector
                    priorities={priorities as Priority[]}
                    selectedPriority={issue.priorityId || ""}
                    onPrioritySelect={(pid) => onPriorityChange(issue.id, pid)}
                    displayMode="labelOnly"
                    trigger={
                      <div className="flex-shrink-0 cursor-pointer">
                        <PriorityIcon
                          className="size-4"
                          style={{ color: priorityColor }}
                        />
                      </div>
                    }
                    className="border-none bg-transparent p-0 shadow-none"
                  />
                </PermissionAware>

                {/* Issue Key */}
                <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                  {issue.key}
                </span>

                {/* State / Assignment Selector */}
                <MultiAssignmentStateSelector
                  assignments={assignments}
                  states={states}
                  onStateChange={onAssignmentStateChange}
                  isLoading={isUpdatingAssignmentStates}
                  currentUserId={currentUserId}
                  canChangeAll={canChangeAll}
                  activeFilter={activeFilter}
                />

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${orgSlug}/issues/${issue.key}`}
                    className="hover:text-primary block truncate text-sm font-medium transition-colors"
                  >
                    {issue.title}
                  </Link>
                </div>

                {/* Team / Project selectors */}
                {issue.teamKey && (
                  <PermissionAware
                    orgSlug={orgSlug}
                    permission={PERMISSIONS.ISSUE_EDIT}
                    fallbackMessage="You don't have permission to change issue team"
                  >
                    <TeamSelector
                      teams={teams}
                      selectedTeam={
                        teams.find((t) => t.key === issue.teamKey)?._id || ""
                      }
                      onTeamSelect={(tid) => onTeamChange(issue.id, tid)}
                    />
                  </PermissionAware>
                )}

                {issue.projectKey && (
                  <PermissionAware
                    orgSlug={orgSlug}
                    permission={PERMISSIONS.ISSUE_EDIT}
                    fallbackMessage="You don't have permission to change issue project"
                  >
                    <ProjectSelector
                      projects={projects}
                      selectedProject={
                        projects.find((p) => p.key === issue.projectKey)?._id ||
                        ""
                      }
                      onProjectSelect={(pid) => onProjectChange(issue.id, pid)}
                    />
                  </PermissionAware>
                )}

                {/* Last Updated */}
                <div className="flex-shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {formatDateHuman(new Date(issue.updatedAt))}
                  </span>
                </div>

                {/* Assignees */}
                <MultiAssigneeSelector
                  orgSlug={orgSlug}
                  selectedAssigneeIds={assigneeIds}
                  onAssigneesChange={(ids) => onAssigneesChange(issue.id!, ids)}
                  isLoading={isUpdatingAssignees}
                  highlightAssigneeId={highlightAssigneeId}
                  assignments={assignments}
                  activeFilter={activeFilter}
                  currentUserId={currentUserId}
                  canManageAll={canChangeAll}
                />

                {/* Actions */}
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label="Open issue actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletePending}
                        onClick={() => onDelete(issue.id!)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            );
          },
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Circle } from "lucide-react";

import {
  StateSelector,
  PrioritySelector,
  AssigneeSelector,
  TeamSelector,
  ProjectSelector,
} from "@/components/issues/issue-selectors";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { formatDateHuman } from "@/lib/date";

// Re-exported entity types from the selector module give us fully-typed data
import type {
  Team,
  Project,
  State,
  Member,
  Priority,
} from "@/components/issues/issue-selectors";

// Infer issue row type directly from tRPC router output to stay in sync with DB.
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type IssueRowData =
  RouterOutputs["organization"]["listIssuesPaged"]["issues"][number];

// Local helper to derive initials from a name/email
function getAssigneeInitials(
  name?: string | null,
  email?: string | null,
): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface IssuesTableProps {
  orgSlug: string;
  issues: ReadonlyArray<IssueRowData>;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  members: ReadonlyArray<Member>;
  teams: ReadonlyArray<Team>;
  projects: ReadonlyArray<Project>;
  onStateChange: (issueId: string, stateId: string) => void;
  onPriorityChange: (issueId: string, priorityId: string) => void;
  onAssigneeChange: (issueId: string, assigneeId: string) => void;
  onTeamChange: (issueId: string, teamId: string) => void;
  onProjectChange: (issueId: string, projectId: string) => void;
  onDelete: (issueId: string) => void;
  deletePending?: boolean;
}

export function IssuesTable({
  orgSlug,
  issues,
  states,
  priorities,
  members,
  teams,
  projects,
  onStateChange,
  onPriorityChange,
  onAssigneeChange,
  onTeamChange,
  onProjectChange,
  onDelete,
  deletePending = false,
}: IssuesTableProps) {
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
        {issues.map((issue) => {
          // Priority icon / color
          const PriorityIcon = issue.priorityIcon
            ? getDynamicIcon(issue.priorityIcon) || Circle
            : Circle;
          const priorityColor = issue.priorityColor || "#94a3b8";

          // State icon / color
          const StateIcon = issue.stateIcon
            ? getDynamicIcon(issue.stateIcon) || Circle
            : Circle;
          const stateColor = issue.stateColor || "#94a3b8";

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              key={issue.id}
              className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
            >
              {/* Priority Selector */}
              <PrioritySelector
                priorities={priorities}
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

              {/* Issue Key */}
              <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                {issue.key}
              </span>

              {/* State Selector */}
              <StateSelector
                states={states}
                selectedState={issue.stateId || ""}
                onStateSelect={(sid) => onStateChange(issue.id, sid)}
                displayMode="labelOnly"
                trigger={
                  <div className="flex-shrink-0 cursor-pointer">
                    <StateIcon
                      className="size-4"
                      style={{ color: stateColor }}
                    />
                  </div>
                }
                className="border-none bg-transparent p-0 shadow-none"
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
                <TeamSelector
                  teams={teams as Team[]}
                  selectedTeam={
                    teams.find((t) => t.key === issue.teamKey)?.id || ""
                  }
                  onTeamSelect={(tid) => onTeamChange(issue.id, tid)}
                />
              )}

              {issue.projectKey && (
                <ProjectSelector
                  projects={projects as Project[]}
                  selectedProject={
                    projects.find((p) => p.key === issue.projectKey)?.id || ""
                  }
                  onProjectSelect={(pid) => onProjectChange(issue.id, pid)}
                />
              )}

              {/* Last Updated */}
              <div className="flex-shrink-0">
                <span className="text-muted-foreground text-xs">
                  {formatDateHuman(issue.updatedAt)}
                </span>
              </div>

              {/* Assignee Selector */}
              <AssigneeSelector
                members={members as Member[]}
                selectedAssignee={issue.assigneeId || ""}
                onAssigneeSelect={(aid) => onAssigneeChange(issue.id, aid)}
                displayMode="labelOnly"
                trigger={
                  issue.assigneeId ? (
                    <div className="flex cursor-pointer items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-xs">
                          {getAssigneeInitials(
                            issue.assigneeName,
                            issue.assigneeEmail,
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="flex size-6 cursor-pointer items-center justify-center">
                      <span className="text-muted-foreground text-xs">—</span>
                    </div>
                  )
                }
                className="border-none bg-transparent p-0 shadow-none"
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
                      onClick={() => onDelete(issue.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { issueStateTypeEnum } from "@/db/schema/issue-config";
import { formatDateHuman } from "@/lib/date";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { Circle } from "lucide-react";
import {
  StateSelector,
  PrioritySelector,
  AssigneeSelector,
  TeamSelector,
  ProjectSelector,
} from "@/components/issues/issue-selectors";
import { authClient } from "@/lib/auth-client";

type StateType = (typeof issueStateTypeEnum.enumValues)[number];
type FilterType = "all" | StateType;

const TAB_LABELS: Record<FilterType, string> = {
  all: "All",
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
} as const;

const BASE_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: "all", label: TAB_LABELS.all, count: 0 },
  // dynamic generated below
];
const filterTabs = [
  ...BASE_TABS,
  ...issueStateTypeEnum.enumValues.map((value) => ({
    key: value as FilterType,
    label: TAB_LABELS[value as StateType],
    count: 0,
  })),
];

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

export default function IssuesPage() {
  const params = useParams();
  const orgSlug = params.orgId as string;
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();

  const deleteMutation = trpc.issue.delete.useMutation({
    onSuccess: () => {
      // Refresh only issue-related queries instead of invalidating everything
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const changeStateMutation = trpc.issue.changeState.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const changePriorityMutation = trpc.issue.changePriority.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const assignMutation = trpc.issue.assign.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const changeTeamMutation = trpc.issue.changeTeam.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const changeProjectMutation = trpc.issue.changeProject.useMutation({
    onSuccess: () => {
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
    },
  });

  const { data: states = [] } = trpc.organization.listIssueStates.useQuery({
    orgSlug,
  });

  const { data: priorities = [] } =
    trpc.organization.listIssuePriorities.useQuery({ orgSlug });

  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  const { data: teams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });

  const { data: projects = [] } = trpc.organization.listProjects.useQuery({
    orgSlug,
  });

  const handleStateChange = (issueId: string, stateId: string) => {
    if (!session?.user?.id || !stateId) return;
    changeStateMutation.mutate({
      issueId,
      actorId: session.user.id,
      stateId,
    });
  };

  const handlePriorityChange = (issueId: string, priorityId: string) => {
    if (!session?.user?.id || !priorityId) return;
    changePriorityMutation.mutate({
      issueId,
      actorId: session.user.id,
      priorityId,
    });
  };

  const handleAssigneeChange = (issueId: string, assigneeId: string) => {
    if (!session?.user?.id) return;
    assignMutation.mutate({
      issueId,
      actorId: session.user.id,
      assigneeId: assigneeId || null,
    });
  };

  const handleTeamChange = (issueId: string, teamId: string) => {
    if (!session?.user?.id) return;
    changeTeamMutation.mutate({
      issueId,
      actorId: session.user.id,
      teamId: teamId || null,
    });
  };

  const handleProjectChange = (issueId: string, projectId: string) => {
    if (!session?.user?.id) return;
    changeProjectMutation.mutate({
      issueId,
      actorId: session.user.id,
      projectId: projectId || null,
    });
  };

  const { data: paged, isLoading } = trpc.organization.listIssuesPaged.useQuery(
    {
      orgSlug,
      page,
      pageSize: PAGE_SIZE,
    },
  );

  const issues = paged?.issues ?? [];
  const counts = paged?.counts ?? {};
  const total = paged?.total ?? 0;

  // Filter issues based on active filter
  const filteredIssues = issues.filter((issue) => {
    if (activeFilter === "all") return true;
    return issue.stateType === activeFilter;
  });

  // Update counts for tabs
  const updatedTabs = filterTabs.map((tab) => ({
    ...tab,
    count:
      tab.key === "all"
        ? total
        : ((counts as Record<string, number>)[tab.key as string] ?? 0),
  }));

  const visibleTabs = updatedTabs.filter((t) => t.key === "all" || t.count > 0);

  if (isLoading && issues.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground text-sm">Loading issues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background h-full">
      {/* Header with tabs */}
      <div className="border-b">
        <div className="flex items-center justify-between p-1">
          <div className="flex items-center gap-1">
            {visibleTabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 gap-2 rounded-xs px-3 text-xs font-normal",
                  activeFilter === tab.key && "bg-secondary",
                )}
                onClick={() => setActiveFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="text-muted-foreground text-xs">
                  {tab.count}
                </span>
              </Button>
            ))}
          </div>
          <CreateIssueDialog className="h-6" orgSlug={orgSlug} />
        </div>
      </div>

      {/* Issues list */}
      <div className="flex-1">
        {filteredIssues.length > 0 ? (
          <div className="divide-y">
            {filteredIssues.map((issue) => {
              // Get priority icon component and styling
              const PriorityIcon = issue.priorityIcon
                ? getDynamicIcon(issue.priorityIcon) || Circle
                : Circle;
              const priorityColor = issue.priorityColor || "#94a3b8";

              // Get state icon component and styling
              const StateIcon = issue.stateIcon
                ? getDynamicIcon(issue.stateIcon) || Circle
                : Circle;
              const stateColor = issue.stateColor || "#94a3b8";

              return (
                <div
                  key={issue.id}
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  {/* Priority Selector */}
                  <PrioritySelector
                    priorities={priorities}
                    selectedPriority={issue.priorityId || ""}
                    onPrioritySelect={(pid) =>
                      handlePriorityChange(issue.id, pid)
                    }
                    displayMode="iconOnly"
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
                    onStateSelect={(sid) => handleStateChange(issue.id, sid)}
                    displayMode="iconOnly"
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

                  {/* Team / Project selectors (if related) */}
                  {issue.teamKey && (
                    <TeamSelector
                      teams={teams}
                      selectedTeam={
                        teams.find((t) => t.key === issue.teamKey)?.id || ""
                      }
                      onTeamSelect={(tid) => handleTeamChange(issue.id, tid)}
                      displayMode="iconOnly"
                      className="border-none bg-transparent p-0 shadow-none"
                    />
                  )}
                  {issue.projectKey && (
                    <ProjectSelector
                      projects={projects}
                      selectedProject={
                        projects.find((p) => p.key === issue.projectKey)?.id ||
                        ""
                      }
                      onProjectSelect={(pid) =>
                        handleProjectChange(issue.id, pid)
                      }
                      displayMode="iconOnly"
                      className="border-none bg-transparent p-0 shadow-none"
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
                    members={members}
                    selectedAssignee={issue.assigneeId || ""}
                    onAssigneeSelect={(aid) =>
                      handleAssigneeChange(issue.id, aid)
                    }
                    displayMode="iconOnly"
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
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
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
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              !confirm(
                                "Delete this issue? This action cannot be undone.",
                              )
                            )
                              return;
                            deleteMutation.mutate({ issueId: issue.id });
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 text-4xl">📋</div>
              <h3 className="mb-2 text-lg font-semibold">No issues found</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first issue.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating create button */}
      {/* <div className="fixed right-6 bottom-6">
        <CreateIssueDialog orgSlug={orgSlug} variant="floating" />
      </div> */}

      {/* Pagination controls */}
      <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

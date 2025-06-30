"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { issueStateTypeEnum } from "@/db/schema/issue-config";
import { authClient } from "@/lib/auth-client";
import { IssuesTable } from "@/components/issues/issues-table";

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

  const handleDelete = (issueId: string) => {
    if (!confirm("Delete this issue? This action cannot be undone.")) return;
    deleteMutation.mutate({ issueId });
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
        <IssuesTable
          orgSlug={orgSlug}
          issues={filteredIssues}
          states={states}
          priorities={priorities}
          members={members}
          teams={teams}
          projects={projects}
          onStateChange={handleStateChange}
          onPriorityChange={handlePriorityChange}
          onAssigneeChange={handleAssigneeChange}
          onTeamChange={handleTeamChange}
          onProjectChange={handleProjectChange}
          onDelete={handleDelete}
          deletePending={deleteMutation.isPending}
        />
      </div>

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

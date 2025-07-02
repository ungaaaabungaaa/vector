"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ProjectsTable } from "./projects-table";
import type { ProjectRowData } from "./projects-table";
import { CreateProjectButton } from "./create-project-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { projectStatusTypeEnum } from "@/db/schema/projects";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { authClient } from "@/lib/auth-client";

type StatusType = (typeof projectStatusTypeEnum.enumValues)[number];
type FilterType = "all" | StatusType;

const TAB_LABELS: Record<FilterType, string> = {
  all: "All",
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  canceled: "Canceled",
};

// Base tabs array used to compute counts later
const BASE_TABS: { key: FilterType; label: string; count: number }[] = [
  { key: "all", label: TAB_LABELS.all, count: 0 },
  // status tabs appended dynamically below
];

const filterTabs = [
  ...BASE_TABS,
  ...projectStatusTypeEnum.enumValues.map((value) => ({
    key: value as FilterType,
    label: TAB_LABELS[value as StatusType],
    count: 0,
  })),
];

interface ProjectsPageContentProps {
  orgSlug: string;
}

export function ProjectsPageContent({ orgSlug }: ProjectsPageContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Pagination constants
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  // Current user session – needed for actorId in mutations
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;

  // Queries
  const pagedQuery = trpc.organization.listProjectsPaged.useQuery({
    orgSlug,
    page,
    pageSize: PAGE_SIZE,
  });

  const statusesQuery = trpc.organization.listProjectStatuses.useQuery({
    orgSlug,
  });
  const teamsQuery = trpc.organization.listTeams.useQuery({ orgSlug });
  const membersQuery = trpc.organization.listMembers.useQuery({ orgSlug });

  // Mutations
  const changeStatusMutation = trpc.project.changeStatus.useMutation({
    onSuccess: () => {
      pagedQuery.refetch();
      toast.success("Project status updated");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update status: ${message}`);
    },
  });

  const changeTeamMutation = trpc.project.changeTeam.useMutation({
    onSuccess: () => {
      pagedQuery.refetch();
      toast.success("Project team updated");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update team: ${message}`);
    },
  });

  const changeLeadMutation = trpc.project.changeLead.useMutation({
    onSuccess: () => {
      pagedQuery.refetch();
      toast.success("Project lead updated");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update lead: ${message}`);
    },
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      pagedQuery.refetch();
      toast.success("Project deleted");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to delete project";
      toast.error(message);
    },
  });

  // Event handlers
  const handleStatusChange = (projectId: string, statusId: string) => {
    if (!currentUserId) return;
    changeStatusMutation.mutate({
      projectId,
      statusId: statusId || null,
      actorId: currentUserId,
    });
  };

  const handleTeamChange = (projectId: string, teamId: string) => {
    if (!currentUserId) return;
    changeTeamMutation.mutate({
      projectId,
      teamId: teamId || null,
      actorId: currentUserId,
    });
  };

  const handleLeadChange = (projectId: string, leadId: string) => {
    if (!currentUserId) return;
    changeLeadMutation.mutate({
      projectId,
      leadId: leadId || null,
      actorId: currentUserId,
    });
  };

  const handleDelete = (projectId: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    deleteMutation.mutate({ projectId });
  };

  // Transform data - convert string dates to Date objects
  const projects: ProjectRowData[] = (pagedQuery.data?.projects || []).map(
    (project) => ({
      ...project,
      updatedAt: new Date(project.updatedAt),
      createdAt: new Date(project.createdAt),
    }),
  );

  // Filter projects based on active filter
  const filteredProjects = projects.filter((project) => {
    if (activeFilter === "all") return true;
    return project.statusType === activeFilter;
  });

  const statuses = statusesQuery.data || [];
  const teams = teamsQuery.data || [];
  const members = (membersQuery.data || []).map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
  }));

  // Compute counts for each status type
  const statusCounts: Record<StatusType, number> = projects.reduce(
    (acc, proj) => {
      acc[proj.statusType as StatusType] =
        (acc[proj.statusType as StatusType] || 0) + 1;
      return acc;
    },
    {} as Record<StatusType, number>,
  );

  // Use counts from backend if available, fallback to computed
  const backendCounts: Record<string, number> = pagedQuery.data?.counts ?? {};

  const updatedTabs = filterTabs.map((tab) => ({
    ...tab,
    count:
      tab.key === "all"
        ? (pagedQuery.data?.total ?? 0)
        : (backendCounts[tab.key as string] ??
          statusCounts[tab.key as StatusType] ??
          0),
  }));

  const visibleTabs = updatedTabs.filter((t) => t.key === "all" || t.count > 0);

  const isLoading =
    pagedQuery.isLoading ||
    statusesQuery.isLoading ||
    teamsQuery.isLoading ||
    membersQuery.isLoading;

  const total = pagedQuery.data?.total ?? projects.length;

  if (isLoading) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={visibleTabs.length || 6}
        showCreateButton={true}
        tableRows={8}
        tableColumns={6}
      />
    );
  }

  return (
    <div className="bg-background h-full">
      <div className="flex flex-col">
        {/* Header with tabs and create button */}
        <div className="flex items-center justify-between border-b p-1">
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

          <CreateProjectButton className="h-6" orgSlug={orgSlug} size="sm" />
        </div>

        {/* Projects Table */}
        <div className="flex-1 overflow-y-auto">
          <ProjectsTable
            orgSlug={orgSlug}
            projects={filteredProjects}
            statuses={statuses}
            teams={teams}
            members={members}
            onStatusChange={handleStatusChange}
            onTeamChange={handleTeamChange}
            onLeadChange={handleLeadChange}
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
    </div>
  );
}

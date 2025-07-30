"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "../../../convex/_generated/dataModel";
import { ProjectsTable } from "./projects-table";
import type { ProjectRowData } from "./projects-table";
import { CreateProjectButton } from "./create-project-button";

import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/table-skeleton";

// Define project status types based on Convex schema
type StatusType =
  | "backlog"
  | "planned"
  | "in_progress"
  | "completed"
  | "canceled";
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

const statusValues: StatusType[] = [
  "backlog",
  "planned",
  "in_progress",
  "completed",
  "canceled",
];

const filterTabs = [
  ...BASE_TABS,
  ...statusValues.map((value) => ({
    key: value as FilterType,
    label: TAB_LABELS[value],
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

  // Queries
  const projectsData = useQuery(api.projects.list, { orgSlug });
  const statusesData = useQuery(api.organizations.listProjectStatuses, {
    orgSlug,
  });
  const teamsData = useQuery(api.organizations.listTeams, { orgSlug });
  const membersData = useQuery(api.organizations.listMembers, { orgSlug });

  // Transform data to match expected interfaces
  const projects: ProjectRowData[] = (projectsData ?? []).map((project) => ({
    id: project._id,
    name: project.name,
    description: project.description,
    key: project.key,
    updatedAt: new Date(project._creationTime), // Using creation time as update time for now
    createdAt: new Date(project._creationTime),
    icon: project.icon,
    color: project.color,
    statusId: project.status?._id,
    statusName: project.status?.name,
    statusColor: project.status?.color,
    statusIcon: project.status?.icon,
    statusType: project.status?.type,
    teamId: project.teamId,
    teamName: undefined, // Will need to be populated from teams data
    teamKey: undefined, // Will need to be populated from teams data
    leadId: project.lead?._id,
    leadName: project.lead?.name,
    leadEmail: project.lead?.email,
  }));

  const statuses = (statusesData ?? []).map((status) => ({
    _id: status._id,
    name: status.name,
    color: status.color,
    icon: status.icon,
    type: status.type,
  }));

  const teams = (teamsData ?? []).map((team) => ({
    id: team._id,
    name: team.name,
    key: team.key,
    color: team.color,
    icon: team.icon,
  }));

  // Mutations
  const changeStatusMutation = useMutation(api.projects.update);
  const changeTeamMutation = useMutation(api.projects.update);
  const changeLeadMutation = useMutation(api.projects.update);
  const deleteMutation = useMutation(api.projects.deleteProject);

  // Event handlers
  const handleStatusChange = (projectId: string, statusId: string) => {
    if (statusId) {
      changeStatusMutation({
        projectId: projectId as Id<"projects">,
        data: { statusId: statusId as Id<"projectStatuses"> },
      });
    }
  };

  const handleTeamChange = (projectId: string, teamId: string) => {
    if (teamId) {
      changeTeamMutation({
        projectId: projectId as Id<"projects">,
        data: { teamId: teamId as Id<"teams"> },
      });
    }
  };

  const handleLeadChange = (projectId: string, leadId: string) => {
    if (leadId) {
      changeLeadMutation({
        projectId: projectId as Id<"projects">,
        data: { leadId: leadId as Id<"users"> },
      });
    }
  };

  const handleDelete = (projectId: string) => {
    deleteMutation({
      projectId: projectId as Id<"projects">,
    });
  };

  // Filter projects based on active filter
  const filteredProjects = projects.filter((project) => {
    if (activeFilter === "all") return true;
    const status = statuses.find((s) => s._id === project.statusId);
    return status?.type === activeFilter;
  });

  // Calculate counts for each status
  const statusCounts = statusValues.reduce(
    (acc, statusType) => {
      const count = projects.filter((project) => {
        const status = statuses.find((s) => s._id === project.statusId);
        return status?.type === statusType;
      }).length;
      acc[statusType] = count;
      return acc;
    },
    {} as Record<StatusType, number>,
  );

  // Update tabs with counts
  const updatedTabs = filterTabs.map((tab) => {
    if (tab.key === "all") {
      return { ...tab, count: projects.length };
    }
    return { ...tab, count: statusCounts[tab.key as StatusType] || 0 };
  });

  const visibleTabs = updatedTabs.filter((t) => t.key === "all" || t.count > 0);

  const isLoading =
    projectsData === undefined ||
    statusesData === undefined ||
    teamsData === undefined ||
    membersData === undefined;

  const total = projects.length;

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
            onStatusChange={handleStatusChange}
            onTeamChange={handleTeamChange}
            onLeadChange={handleLeadChange}
            onDelete={handleDelete}
            deletePending={false} // TODO: Add proper mutation loading state
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

"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { useParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IssuesTable } from "@/components/issues/issues-table";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import {
  ProjectSelector,
  TeamSelector,
} from "@/components/issues/issue-selectors";
import { ISSUE_STATE_DEFAULTS } from "@/lib/defaults";
import type { Id } from "@/convex/_generated/dataModel";
import { PermissionAware } from "@/components/ui/permission-aware";
import { PERMISSIONS } from "@/convex/_shared/permissions";

type StateType = (typeof ISSUE_STATE_DEFAULTS)[number]["type"];
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
];
const filterTabs = [
  ...BASE_TABS,
  ...ISSUE_STATE_DEFAULTS.map((value) => ({
    key: value.type as FilterType,
    label: TAB_LABELS[value.type as StateType],
    count: 0,
  })),
];

export default function IssuesPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const user = useQuery(api.users.currentUser);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingAssignees, setIsUpdatingAssignees] = useState(false);
  const [isUpdatingAssignmentStates, setIsUpdatingAssignmentStates] =
    useState(false);

  const deleteMutation = useMutation(api.issues.deleteIssue);
  const changePriorityMutation = useMutation(api.issues.changePriority);
  const updateAssigneesMutation = useMutation(api.issues.updateAssignees);
  const changeTeamMutation = useMutation(api.issues.changeTeam);
  const changeProjectMutation = useMutation(api.issues.changeProject);
  const changeAssignmentStateMutation = useMutation(
    api.issues.changeAssignmentState,
  );

  const states = useQuery(api.organizations.listIssueStates, { orgSlug });
  const priorities = useQuery(api.organizations.listIssuePriorities, {
    orgSlug,
  });
  const teams = useQuery(api.organizations.listTeams, { orgSlug });
  const projects = useQuery(api.organizations.listProjects, { orgSlug });

  const { issues, total, counts } = useQuery(api.issues.listIssues, {
    orgSlug,
    projectId: selectedProject || undefined,
    teamId: selectedTeam || undefined,
  }) ?? { issues: [], total: 0, counts: {} };

  const handlePriorityChange = (issueId: string, priorityId: string) => {
    if (!user || !priorityId) return;
    changePriorityMutation({
      issueId: issueId as Id<"issues">,
      priorityId: priorityId as Id<"issuePriorities">,
    });
  };

  const handleAssigneesChange = async (
    issueId: string,
    assigneeIds: string[],
  ) => {
    if (!user) return;
    setIsUpdatingAssignees(true);
    try {
      await updateAssigneesMutation({
        issueId: issueId as Id<"issues">,
        assigneeIds: assigneeIds as Id<"users">[],
      });
    } finally {
      setIsUpdatingAssignees(false);
    }
  };

  const handleTeamChange = (issueId: string, teamId: string) => {
    if (!user) return;
    changeTeamMutation({
      issueId: issueId as Id<"issues">,
      teamId: (teamId as Id<"teams">) || null,
    });
  };

  const handleProjectChange = (issueId: string, projectId: string) => {
    if (!user) return;
    changeProjectMutation({
      issueId: issueId as Id<"issues">,
      projectId: (projectId as Id<"projects">) || null,
    });
  };

  const handleAssignmentStateChange = async (
    assignmentId: string,
    stateId: string,
  ) => {
    if (!user || !assignmentId || !stateId) return;
    setIsUpdatingAssignmentStates(true);
    try {
      await changeAssignmentStateMutation({
        assignmentId: assignmentId as Id<"issueAssignees">,
        stateId: stateId as Id<"issueStates">,
      });
    } finally {
      setIsUpdatingAssignmentStates(false);
    }
  };

  const handleDelete = async (issueId: string) => {
    if (!confirm("Delete this issue? This action cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteMutation({ issueId: issueId as Id<"issues"> });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentUserId = user?._id || "";
  const canChangeAll = user?.role === "admin";

  const updatedTabs = filterTabs.map((tab) => ({
    ...tab,
    count:
      tab.key === "all"
        ? total
        : ((counts as Record<string, number>)[tab.key as string] ?? 0),
  }));

  const visibleTabs = updatedTabs.filter((t) => t.key === "all" || t.count > 0);

  if (user === undefined && issues.length === 0) {
    return (
      <PageSkeleton
        showTabs={true}
        tabCount={5}
        showCreateButton={true}
        tableRows={8}
        tableColumns={6}
      />
    );
  }

  const mappedTeams = teams ?? [];
  const mappedProjects = projects ?? [];

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

          {/* Global filters and create button */}
          <div className="flex items-center gap-1">
            {/* Team filter */}
            <PermissionAware
              orgSlug={orgSlug}
              permission={PERMISSIONS.TEAM_VIEW}
              fallbackMessage="You don't have permission to view teams"
              showTooltip={true}
            >
              <TeamSelector
                teams={mappedTeams}
                selectedTeam={selectedTeam}
                onTeamSelect={setSelectedTeam}
                displayMode="iconWhenUnselected"
                className="h-6 text-xs"
              />
            </PermissionAware>

            {/* Project filter */}
            <PermissionAware
              orgSlug={orgSlug}
              permission={PERMISSIONS.PROJECT_VIEW}
              fallbackMessage="You don't have permission to view projects"
              showTooltip={true}
            >
              <ProjectSelector
                projects={mappedProjects}
                selectedProject={selectedProject}
                onProjectSelect={setSelectedProject}
                displayMode="iconWhenUnselected"
                className="h-6 text-xs"
              />
            </PermissionAware>

            <CreateIssueDialog className="h-6" orgSlug={orgSlug} />
          </div>
        </div>
      </div>

      {/* Issues list */}
      <div className="flex-1">
        <IssuesTable
          orgSlug={orgSlug}
          issues={issues}
          states={states ?? []}
          priorities={priorities ?? []}
          teams={teams ?? []}
          projects={projects ?? []}
          onPriorityChange={handlePriorityChange}
          onAssigneesChange={handleAssigneesChange}
          onTeamChange={handleTeamChange}
          onProjectChange={handleProjectChange}
          onDelete={handleDelete}
          deletePending={isDeleting}
          isUpdatingAssignees={isUpdatingAssignees}
          onAssignmentStateChange={handleAssignmentStateChange}
          isUpdatingAssignmentStates={isUpdatingAssignmentStates}
          currentUserId={currentUserId}
          canChangeAll={canChangeAll}
          activeFilter={activeFilter}
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

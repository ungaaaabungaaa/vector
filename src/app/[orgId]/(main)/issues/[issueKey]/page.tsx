"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Circle, Save, X, Pencil } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { formatDateHuman } from "@/lib/date";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { issueState } from "@/db/schema/issue-config";
import { InferSelectModel } from "drizzle-orm";
import type { Issue } from "@/entities/issues/issue.service";

// Re-use shared issue selectors
import { IssueAssignments } from "@/components/issues/issue-assignments";
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
} from "@/components/issues/issue-selectors";
import { getDynamicIcon } from "@/lib/dynamic-icons";

type IssueState = InferSelectModel<typeof issueState>;

interface IssueViewPageProps {
  params: Promise<{ orgId: string; issueKey: string }>;
}

// Loading skeleton component that matches the actual layout
function IssueLoadingSkeleton() {
  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="h-full">
        <div>
          {/* Header Skeleton */}
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
            <div className="flex h-8 flex-wrap items-center gap-2">
              <div className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors">
                <ArrowLeft className="size-3" />
                Issues
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16" />
                <div className="bg-muted-foreground/20 h-4 w-px" />
                <Skeleton className="h-6 w-20" />
              </div>
              <span className="text-muted-foreground text-sm">/</span>
              <Skeleton className="h-4 w-12" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20" />
              <div className="bg-muted-foreground/20 h-4 w-px" />
              <Skeleton className="h-6 w-16" />
              <div className="bg-muted-foreground/20 h-4 w-px" />
              <Skeleton className="h-6 w-8 rounded-full" />
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="mx-auto max-w-5xl px-4 py-4">
            {/* Issue Header Skeleton */}
            <div className="mb-2 max-w-4xl space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16" />
                <span>•</span>
                <Skeleton className="h-3 w-24" />
              </div>

              {/* Title Skeleton */}
              <Skeleton className="h-9 w-3/4" />
            </div>

            {/* Description Skeleton */}
            <div className="mb-8 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Activity Section Skeleton */}
            <div>
              <Skeleton className="mb-2 h-5 w-16" />
              <div className="rounded-lg border p-8">
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssueViewPage({ params }: IssueViewPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{
    orgId: string;
    issueKey: string;
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [editingEstimates, setEditingEstimates] = useState<
    Record<string, boolean>
  >({});
  const [estimatesValue, setEstimatesValue] = useState<Record<string, number>>(
    {},
  );
  // Track the primary workflow state for this issue (derived from first assignment)
  const [currentStateId, setCurrentStateId] = useState<string>("");

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Get current user session
  const { data: session } = authClient.useSession();

  // tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  // Fetch issue data
  const {
    data: issue,
    isLoading: issueLoading,
    refetch: refetchIssue,
  } = trpc.issue.getByKey.useQuery(
    {
      orgSlug: resolvedParams?.orgId || "",
      issueKey: resolvedParams?.issueKey || "",
    },
    { enabled: !!resolvedParams },
  ) as { data: Issue | undefined; isLoading: boolean; refetch: () => void };

  // Fetch states and priorities
  const { data: states } = trpc.organization.listIssueStates.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  ) as { data: IssueState[] | undefined };

  const { data: members } = trpc.organization.listMembers.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: teams = [] } = trpc.organization.listTeams.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: projects = [] } = trpc.organization.listProjects.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: priorities = [] } =
    trpc.organization.listIssuePriorities.useQuery(
      { orgSlug: resolvedParams?.orgId || "" },
      { enabled: !!resolvedParams },
    );

  // Mutations
  const updateTitleMutation = trpc.issue.updateTitle.useMutation({
    onSuccess: () => {
      refetchIssue();
      setEditingTitle(false);
    },
  });

  const updateDescriptionMutation = trpc.issue.updateDescription.useMutation({
    onSuccess: () => {
      refetchIssue();
      setEditingDescription(false);
    },
  });

  const updateEstimatesMutation = trpc.issue.updateEstimatedTimes.useMutation({
    onSuccess: () => {
      refetchIssue();
      setEditingEstimates({});
    },
  });

  const changeTeamMutation = trpc.issue.changeTeam.useMutation({
    onSuccess: () => {
      refetchIssue();
    },
  });

  const changeProjectMutation = trpc.issue.changeProject.useMutation({
    onSuccess: () => {
      refetchIssue();
    },
  });

  const changePriorityMutation = trpc.issue.changePriority.useMutation({
    onSuccess: () => {
      refetchIssue();
    },
  });

  const changeAssignmentStateMutation =
    trpc.issue.changeAssignmentState.useMutation({
      onSuccess: () => {
        // Refetch assignments to update the UI immediately
        utils.issue.getAssignments
          .invalidate({ issueId: issue?.id || "" })
          .catch(() => {});
        refetchIssue();
      },
    });

  // -----------------------------------------------------------------
  //  Fetch assignments to derive the current main state of the issue
  // -----------------------------------------------------------------
  const { data: assignments } = trpc.issue.getAssignments.useQuery(
    { issueId: issue?.id || "" },
    { enabled: !!issue?.id },
  );

  // Check if current user is assigned to this issue
  const currentUserAssignment = assignments?.find(
    (assignment) => assignment.assigneeId === session?.user?.id,
  );

  // Whenever assignments are fetched, derive currentStateId from the
  // first assignment (fallback to TODO/default state if none).
  useEffect(() => {
    if (assignments && assignments.length > 0) {
      setCurrentStateId(assignments[0].stateId);
    }
  }, [assignments]);

  // Initialize editing values when issue loads
  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title);
      setDescriptionValue(issue.description || "");
    }
  }, [issue]);

  // Initialize estimates form when editing starts
  useEffect(() => {
    if (Object.keys(editingEstimates).length > 0 && issue?.estimatedTimes) {
      setEstimatesValue(issue.estimatedTimes as Record<string, number>);
    }
  }, [editingEstimates, issue?.estimatedTimes]);

  // Filter states for time estimates (only done)
  const estimateStates =
    states?.filter((state) => ["done"].includes(state.type)) || [];

  // Show skeleton while loading or missing data
  if (!resolvedParams || issueLoading || !issue || !states) {
    return <IssueLoadingSkeleton />;
  }

  const handleTitleSave = () => {
    if (!session?.user?.id) return;
    updateTitleMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      title: titleValue.trim(),
    });
  };

  const handleDescriptionSave = () => {
    if (!session?.user?.id) return;
    updateDescriptionMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      description: descriptionValue.trim() || null,
    });
  };

  const handleEstimatesSave = () => {
    if (!issue || !session) return;
    updateEstimatesMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      estimatedTimes:
        Object.keys(estimatesValue).length > 0 ? estimatesValue : null,
    });
  };

  const handleTeamChange = (teamId: string) => {
    if (!issue || !session?.user?.id) return;
    changeTeamMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      teamId: teamId || null,
    });
  };

  const handleProjectChange = (projectId: string) => {
    if (!issue || !session?.user?.id) return;
    changeProjectMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      projectId: projectId || null,
    });
  };

  const handlePriorityChange = (priorityId: string) => {
    if (!issue || !session?.user?.id) return;
    if (priorityId === "") return; // no-op if nothing selected

    changePriorityMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      priorityId,
    });
  };

  return (
    <div className="bg-background h-full overflow-y-auto">
      {/* Page Grid: main area + sidebar */}
      <div className="flex h-full">
        {/* LEFT COLUMN - Main Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
            <div className="flex h-8 flex-wrap items-center gap-2">
              <Link
                href={`/${resolvedParams.orgId}/issues`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
              >
                <ArrowLeft className="size-3" />
                Issues
              </Link>
              <div className="flex items-center">
                {/* Team & Project selectors */}
                <TeamSelector
                  teams={teams}
                  selectedTeam={issue.teamId || ""}
                  onTeamSelect={handleTeamChange}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent shadow-none"
                />
                <ProjectSelector
                  projects={projects}
                  selectedProject={issue.projectId || ""}
                  onProjectSelect={handleProjectChange}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent shadow-none"
                />
              </div>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm font-medium">{issue.key}</span>
            </div>

            <div className="flex items-center">
              {/* Only show state selector if current user is assigned */}
              {currentUserAssignment && (
                <>
                  <StateSelector
                    states={states}
                    selectedState={currentUserAssignment.stateId}
                    onStateSelect={(stateId) => {
                      if (!issue || !session?.user?.id) return;
                      // Update the specific assignment state for this user
                      changeAssignmentStateMutation.mutate({
                        assignmentId: currentUserAssignment.id,
                        stateId,
                      });
                    }}
                    className="border-none bg-transparent shadow-none"
                  />
                  <div className="bg-muted-foreground/20 h-4 w-px" />
                </>
              )}

              <PrioritySelector
                priorities={priorities}
                selectedPriority={issue.priorityId || ""}
                onPrioritySelect={handlePriorityChange}
                className="border-none bg-transparent shadow-none"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="mx-auto max-w-5xl px-4 py-4">
            {/* Issue Header */}
            <div className="mb-2 max-w-4xl space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="font-mono">{issue.key}</span>
                <span>•</span>
                <span>Updated {formatDateHuman(issue.updatedAt)}</span>
              </div>

              {/* Title */}
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    className="h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0"
                    style={{ fontFamily: "var(--font-title)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") {
                        setTitleValue(issue.title);
                        setEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={handleTitleSave}
                      disabled={
                        updateTitleMutation.isPending || !titleValue.trim()
                      }
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTitleValue(issue.title);
                        setEditingTitle(false);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <h1
                  className={cn(
                    "hover:text-muted-foreground cursor-pointer text-3xl leading-tight font-semibold transition-colors",
                  )}
                  onClick={() => setEditingTitle(true)}
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Schedule Info */}
            <div className="flex items-center gap-4">
              {(issue.startDate || issue.dueDate) && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>Schedule:</span>
                  {issue.startDate && (
                    <span>From {formatDateHuman(issue.startDate)}</span>
                  )}
                  {issue.startDate && issue.dueDate && <span>→</span>}
                  {issue.dueDate && (
                    <span
                      className={cn(
                        "font-medium",
                        new Date(issue.dueDate) < new Date() &&
                          states &&
                          !["done"].includes(
                            states.find((s) => s.id === currentStateId)?.type ||
                              "",
                          )
                          ? "text-red-500 dark:text-red-400"
                          : "",
                      )}
                    >
                      Due {formatDateHuman(issue.dueDate)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              {editingDescription ? (
                <div className="space-y-4">
                  <Textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    placeholder="Add a description..."
                    className="min-h-[120px] resize-none text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDescriptionValue(issue.description || "");
                        setEditingDescription(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleDescriptionSave}
                      disabled={updateDescriptionMutation.isPending}
                    >
                      <Save className="mr-2 size-4" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDescriptionValue(issue.description || "");
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {issue.description ? (
                    <div
                      className={cn(
                        "prose prose-sm text-muted-foreground hover:text-foreground max-w-none cursor-pointer transition-colors",
                      )}
                      onClick={() => setEditingDescription(true)}
                    >
                      <p className="whitespace-pre-wrap">{issue.description}</p>
                    </div>
                  ) : (
                    <button
                      className="text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base"
                      onClick={() => setEditingDescription(true)}
                    >
                      Add a description...
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div>
              <h2 className="mb-2 text-sm font-semibold">Activity</h2>
              <div className="text-muted-foreground rounded-lg border p-8 text-center">
                Activity feed coming soon...
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR - Assignments */}
        <div className="bg-background w-80 overflow-y-auto border-l">
          <div className="flex h-full flex-col">
            {/* Assignments Section with max height */}
            <div className="max-h-96 overflow-y-auto">
              {states && members && (
                <IssueAssignments
                  orgSlug={resolvedParams.orgId}
                  issueId={issue.id}
                  states={states ?? []}
                  members={members ?? []}
                  defaultStateId={
                    states?.find((s) => s.type === "todo")?.id ||
                    states?.[0]?.id ||
                    ""
                  }
                />
              )}
            </div>

            {/* Time Estimates Section */}
            {estimateStates.length > 0 && (
              <div className="border-t">
                <div className="flex items-center justify-between border-b px-1 py-1 pl-2">
                  <h4 className="text-sm">Time Estimates</h4>
                </div>

                <div className="divide-y">
                  {estimateStates.map((state) => {
                    const StateIcon = getDynamicIcon(state.icon) || Circle;
                    const hours = (
                      issue?.estimatedTimes as Record<string, number>
                    )?.[state.id];
                    const isEditing = editingEstimates[state.id];

                    return (
                      <div key={state.id}>
                        <div className="flex h-10 items-center justify-between px-2 py-2">
                          {/* State icon and name - consistent across both states */}
                          <div className="flex items-center gap-2">
                            <StateIcon
                              className="size-4"
                              style={{
                                color: state.color || "currentColor",
                              }}
                            />
                            <span className="text-sm">{state.name}</span>
                          </div>

                          {/* Right side - changes based on edit state */}
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="Hours"
                                className="h-7 w-20 text-sm"
                                value={estimatesValue[state.id] || ""}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  setEstimatesValue((prev) => ({
                                    ...prev,
                                    [state.id]: isNaN(value) ? 0 : value,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleEstimatesSave();
                                  }
                                  if (e.key === "Escape") {
                                    setEstimatesValue(
                                      (issue?.estimatedTimes as Record<
                                        string,
                                        number
                                      >) || {},
                                    );
                                    setEditingEstimates((prev) => ({
                                      ...prev,
                                      [state.id]: false,
                                    }));
                                  }
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                className="h-7 w-7 cursor-pointer p-0"
                                onClick={handleEstimatesSave}
                                disabled={updateEstimatesMutation.isPending}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 cursor-pointer p-0"
                                onClick={() => {
                                  setEstimatesValue(
                                    (issue?.estimatedTimes as Record<
                                      string,
                                      number
                                    >) || {},
                                  );
                                  setEditingEstimates((prev) => ({
                                    ...prev,
                                    [state.id]: false,
                                  }));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 transition-colors"
                              onClick={() => {
                                setEstimatesValue(
                                  (issue?.estimatedTimes as Record<
                                    string,
                                    number
                                  >) || {},
                                );
                                setEditingEstimates((prev) => ({
                                  ...prev,
                                  [state.id]: true,
                                }));
                              }}
                            >
                              <span className="text-muted-foreground text-sm">
                                {hours ? `${hours}h` : "—"}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 cursor-pointer p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEstimatesValue(
                                    (issue?.estimatedTimes as Record<
                                      string,
                                      number
                                    >) || {},
                                  );
                                  setEditingEstimates((prev) => ({
                                    ...prev,
                                    [state.id]: true,
                                  }));
                                }}
                              >
                                <Pencil className="size-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!issue?.estimatedTimes ||
                    Object.keys(issue.estimatedTimes).length === 0) && (
                    <div className="text-muted-foreground py-4 text-center text-sm">
                      No estimates yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

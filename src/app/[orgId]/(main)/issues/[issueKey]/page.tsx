"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, X, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { formatDateHuman } from "@/lib/date";
import Link from "next/link";

// Re-use shared issue selectors
import {
  PrioritySelector,
  TeamSelector,
  ProjectSelector,
} from "@/components/issues/issue-selectors";
import { IssueAssignments } from "@/components/issues/issue-assignments";

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
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Get current user session
  const { data: session } = authClient.useSession();

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
  );

  // Fetch states and priorities
  const { data: states } = trpc.organization.listIssueStates.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: priorities } = trpc.organization.listIssuePriorities.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: members } = trpc.organization.listMembers.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: teams } = trpc.organization.listTeams.useQuery(
    { orgSlug: resolvedParams?.orgId || "" },
    { enabled: !!resolvedParams },
  );

  const { data: projects } = trpc.organization.listProjects.useQuery(
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

  const changePriorityMutation = trpc.issue.changePriority.useMutation({
    onSuccess: () => refetchIssue(),
  });

  const changeTeamMutation = trpc.issue.changeTeam.useMutation({
    onSuccess: () => refetchIssue(),
  });

  const changeProjectMutation = trpc.issue.changeProject.useMutation({
    onSuccess: () => refetchIssue(),
  });

  // Initialize editing values when issue loads
  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title);
      setDescriptionValue(issue.description || "");
    }
  }, [issue]);

  if (!resolvedParams) return <IssueLoadingSkeleton />;
  if (issueLoading) return <IssueLoadingSkeleton />;
  if (!issue) return notFound();

  const handleTitleSave = () => {
    if (!session?.user?.id || !titleValue.trim()) return;
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

  const handlePriorityChange = (priorityId: string) => {
    if (!session?.user?.id) return;
    changePriorityMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      priorityId,
    });
  };

  const handleTeamChange = (teamId: string) => {
    if (!session?.user?.id) return;
    changeTeamMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      teamId: teamId || null,
    });
  };

  const handleProjectChange = (projectId: string) => {
    if (!session?.user?.id) return;
    changeProjectMutation.mutate({
      issueId: issue.id,
      actorId: session.user.id,
      projectId: projectId || null,
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
                  teams={teams || []}
                  selectedTeam={issue.teamId || ""}
                  onTeamSelect={handleTeamChange}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent shadow-none"
                />
                <div className="bg-muted-foreground/20 h-4 w-px" />
                <ProjectSelector
                  projects={projects || []}
                  selectedProject={issue.projectId || ""}
                  onProjectSelect={handleProjectChange}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent shadow-none"
                />
              </div>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm font-medium">
                {resolvedParams.issueKey}
              </span>
            </div>

            <div className="flex items-center">
              {/* Priority */}
              <PrioritySelector
                priorities={priorities || []}
                selectedPriority={issue.priorityId || ""}
                onPrioritySelect={handlePriorityChange}
                className="border-none bg-transparent shadow-none"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="px-4 py-4">
            {/* Issue Header */}
            <div className="mb-2 space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="font-mono">{resolvedParams.issueKey}</span>
                <span>•</span>
                <span>Updated {formatDateHuman(issue.updatedAt)}</span>
              </div>

              {/* Title */}
              {editingTitle ? (
                <div className="flex items-center gap-3">
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
                      disabled={updateTitleMutation.isPending}
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
                  className="hover:text-muted-foreground cursor-pointer text-3xl leading-tight font-semibold transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              {/* <h2 className="mb-6 text-lg font-semibold">Description</h2> */}
              {editingDescription ? (
                <div className="space-y-4">
                  <Textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    placeholder="Add a description..."
                    className="min-h-[200px] resize-none text-base"
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
                      className="prose prose-sm text-muted-foreground hover:text-foreground max-w-none cursor-pointer transition-colors"
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
          <div className="space-y-2">
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
        </div>
      </div>
    </div>
  );
}

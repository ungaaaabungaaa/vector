"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateHuman } from "@/lib/date";
import {
  StatusSelector,
  LeadSelector,
} from "@/components/projects/project-selectors";
import { TeamSelector } from "@/components/teams/team-selector";
import { toast } from "sonner";
import { ProjectMembersSection } from "@/components/projects/project-members";

interface ProjectViewClientProps {
  params: { orgId: string; projectKey: string };
}

export default function ProjectViewClient({ params }: ProjectViewClientProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");

  const router = useRouter();

  // Queries
  const projectQuery = trpc.project.getByKey.useQuery(
    {
      orgSlug: params.orgId,
      projectKey: params.projectKey,
    },
    { retry: false },
  );

  const statusesQuery = trpc.organization.listProjectStatuses.useQuery({
    orgSlug: params.orgId,
  });

  const teamsQuery = trpc.organization.listTeams.useQuery({
    orgSlug: params.orgId,
  });

  const membersQuery = trpc.organization.listMembers.useQuery({
    orgSlug: params.orgId,
  });

  // Mutations
  const updateTitleMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      setEditingTitle(false);
      toast.success("Project title updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update title: ${error.message}`);
    },
  });

  const updateDescriptionMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      setEditingDescription(false);
      toast.success("Project description updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update description: ${error.message}`);
    },
  });

  const changeStatusMutation = trpc.project.changeStatus.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      toast.success("Project status updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const changeTeamMutation = trpc.project.changeTeam.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      toast.success("Project team updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update team: ${error.message}`);
    },
  });

  const changeLeadMutation = trpc.project.changeLead.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      toast.success("Project lead updated");
    },
    onError: (error: any) => {
      toast.error(`Failed to update lead: ${error.message}`);
    },
  });

  // Event handlers
  const handleTitleSave = () => {
    if (!project) return;
    updateTitleMutation.mutate({
      id: project.id,
      data: { name: titleValue },
    });
  };

  const handleDescriptionSave = () => {
    if (!project) return;
    updateDescriptionMutation.mutate({
      id: project.id,
      data: { description: descriptionValue },
    });
  };

  const handleStatusChange = (statusId: string) => {
    if (!project) return;
    changeStatusMutation.mutate({
      projectId: project.id,
      statusId: statusId || null,
      actorId: "current-user", // TODO: get actual user ID
    });
  };

  const handleTeamChange = (teamId: string) => {
    if (!project) return;
    changeTeamMutation.mutate({
      projectId: project.id,
      teamId: teamId || null,
      actorId: "current-user", // TODO: get actual user ID
    });
  };

  const handleLeadChange = (leadId: string) => {
    if (!project) return;
    changeLeadMutation.mutate({
      projectId: project.id,
      leadId: leadId || null,
      actorId: "current-user", // TODO: get actual user ID
    });
  };

  const project = projectQuery.data;
  const statuses = statusesQuery.data || [];
  const teams = teamsQuery.data || [];
  const members = (membersQuery.data || []).map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
  }));

  useEffect(() => {
    if (
      projectQuery.error?.data?.code === "FORBIDDEN" ||
      projectQuery.error?.data?.code === "UNAUTHORIZED"
    ) {
      router.replace("/403");
    }
  }, [projectQuery.error, router]);

  if (projectQuery.isLoading) {
    return (
      <div className="bg-background h-full overflow-y-auto">
        <div className="h-full">
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
            <div className="flex h-8 items-center gap-2">
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            </div>
          </div>
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="space-y-4">
              <div className="bg-muted h-8 w-3/4 animate-pulse rounded" />
              <div className="bg-muted h-20 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (projectQuery.error?.data?.code === "FORBIDDEN") {
    return null; // redirected
  }

  if (!project) {
    notFound();
  }

  // Initialize editing values when starting to edit
  if (editingTitle && titleValue === "") {
    setTitleValue(project.name);
  }
  if (editingDescription && descriptionValue === "") {
    setDescriptionValue(project.description || "");
  }

  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="h-full">
        {/* Header */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
          <div className="flex h-8 flex-wrap items-center gap-2">
            <Link
              href={`/${params.orgId}/projects`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="size-3" />
              Projects
            </Link>
            <div className="flex items-center">
              {/* Team & Status selectors */}
              <TeamSelector
                teams={teams}
                selectedTeam={project.teamId || ""}
                onTeamSelect={handleTeamChange}
                displayMode="iconWhenUnselected"
                className="border-none bg-transparent shadow-none"
              />
              {/* <div className="bg-muted-foreground/20 h-4 w-px" /> */}
              {/* <StatusSelector
                statuses={statuses}
                selectedStatus={project.statusId || ""}
                onStatusSelect={handleStatusChange}
                displayMode="iconWhenUnselected"
                className="border-none bg-transparent shadow-none"
              /> */}
            </div>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm font-medium">{params.projectKey}</span>
          </div>

          <div className="flex items-center">
            <StatusSelector
              statuses={statuses}
              selectedStatus={project.statusId || ""}
              onStatusSelect={handleStatusChange}
              className="border-none bg-transparent shadow-none"
            />

            <div className="bg-muted-foreground/20 h-4 w-px" />

            {/* Lead */}
            <LeadSelector
              members={members}
              selectedLead={project.leadId || ""}
              onLeadSelect={handleLeadChange}
              className="border-none bg-transparent shadow-none"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/* Project Header */}
          <div className="mb-2 max-w-4xl space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="font-mono">{params.projectKey}</span>
              <span>•</span>
              <span>
                Updated {formatDateHuman(new Date(project.updatedAt))}
              </span>
            </div>

            {/* Title */}
            {editingTitle ? (
              <div className="flex items-center gap-3">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="h-auto border-none p-0 text-3xl font-semibold shadow-none focus-visible:ring-0"
                  style={{ fontSize: "1.875rem", lineHeight: "2.25rem" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") {
                      setTitleValue(project.name);
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
                      setTitleValue(project.name);
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
                {project.name}
              </h1>
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
                  className="min-h-[200px] resize-none text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDescriptionValue(project.description || "");
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
                      setDescriptionValue(project.description || "");
                      setEditingDescription(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {project.description ? (
                  <div
                    className="prose prose-sm text-muted-foreground hover:text-foreground max-w-none cursor-pointer transition-colors"
                    onClick={() => setEditingDescription(true)}
                  >
                    <p className="whitespace-pre-wrap">{project.description}</p>
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

          {/* Project Details */}
          <div className="space-y-6">
            {/* Dates Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  Start Date
                </h3>
                <p className="text-sm">
                  {project.startDate
                    ? formatDateHuman(new Date(project.startDate))
                    : "Not set"}
                </p>
              </div>
              <div>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  Due Date
                </h3>
                <p className="text-sm">
                  {project.dueDate
                    ? formatDateHuman(new Date(project.dueDate))
                    : "Not set"}
                </p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  Created
                </h3>
                <p className="text-sm">
                  {formatDateHuman(new Date(project.createdAt))}
                </p>
              </div>
              <div>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  Updated
                </h3>
                <p className="text-sm">
                  {formatDateHuman(new Date(project.updatedAt))}
                </p>
              </div>
            </div>

            {/* Activity Feed placeholder */}
            <div>
              <h2 className="mb-2 text-sm font-semibold">Activity</h2>
              <div className="text-muted-foreground rounded-lg border p-8 text-center">
                Activity feed coming soon...
              </div>
            </div>

            {/* Members */}
            <div>
              <ProjectMembersSection
                orgSlug={params.orgId}
                projectId={project.id}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

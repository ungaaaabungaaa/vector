"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Save, X, Plus, FolderOpen } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateHuman } from "@/lib/date";
import { StatusSelector } from "@/components/projects/project-selectors";
import { ProjectLeadSelector } from "@/components/projects/project-lead-selector";
import { TeamSelector } from "@/components/teams/team-selector";
import { ProjectMembersSection } from "@/components/projects/project-members";
import { PERMISSIONS } from "@/convex/_shared/permissions";
import {
  usePermissionCheck,
  PermissionAware,
} from "@/components/ui/permission-aware";
import { cn } from "@/lib/utils";
import { IconPicker } from "@/components/ui/icon-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { UsersIcon, CalendarIcon, ClockIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  VisibilitySelector,
  type VisibilityState,
} from "@/components/ui/visibility-selector";

interface ProjectViewClientProps {
  params: { orgSlug: string; projectKey: string };
}

// Default colors for project customization
const DEFAULT_COLORS = [
  "#94a3b8", // slate-400
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#6b7280", // gray-500
];

export default function ProjectViewClient({ params }: ProjectViewClientProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [iconValue, setIconValue] = useState<string | null>(null);
  const [colorValue, setColorValue] = useState<string | null>(null);

  const user = useQuery(api.users.currentUser);

  const project = useQuery(api.projects.getByKey, {
    orgSlug: params.orgSlug,
    projectKey: params.projectKey,
  });

  // Use useMemo to stabilize the scope object and prevent hook rerenders
  const permissionScope = useMemo(() => {
    return project?._id
      ? { orgSlug: params.orgSlug, projectId: project._id }
      : { orgSlug: params.orgSlug };
  }, [params.orgSlug, project?._id]);

  const { isAllowed: canEditProject } = usePermissionCheck(
    params.orgSlug,
    PERMISSIONS.PROJECT_EDIT,
    permissionScope,
  );

  const canEdit = !!(
    user &&
    project &&
    (project.leadId === user._id || canEditProject)
  );

  const statuses = useQuery(api.organizations.listProjectStatuses, {
    orgSlug: params.orgSlug,
  });

  const teams = useQuery(api.organizations.listTeams, {
    orgSlug: params.orgSlug,
  });

  const updateMutation = useMutation(api.projects.update);
  const changeStatusMutation = useMutation(api.projects.changeStatus);
  const changeTeamMutation = useMutation(api.projects.changeTeam);
  const changeLeadMutation = useMutation(api.projects.changeLead);
  const changeVisibilityMutation = useMutation(api.projects.changeVisibility);

  const handleTitleSave = () => {
    if (!project) return;
    updateMutation({
      projectId: project._id,
      data: { name: titleValue },
    });
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (!project) return;
    updateMutation({
      projectId: project._id,
      data: { description: descriptionValue },
    });
    setEditingDescription(false);
  };

  const handleStatusChange = (statusId: string) => {
    if (!project) return;
    changeStatusMutation({
      projectId: project._id,
      statusId: (statusId as Id<"projectStatuses">) || null,
    });
  };

  const handleTeamChange = (teamId: string) => {
    if (!project) return;
    changeTeamMutation({
      projectId: project._id,
      teamId: (teamId as Id<"teams">) || null,
    });
  };

  const handleLeadChange = (leadId: string) => {
    if (!project) return;
    changeLeadMutation({
      projectId: project._id,
      leadId: (leadId as Id<"users">) || null,
    });
  };

  const handleIconChange = (iconName: string | null) => {
    if (!project) return;
    setIconValue(iconName);
    updateMutation({
      projectId: project._id,
      data: { icon: iconName || undefined },
    });
  };

  const handleColorChange = (color: string) => {
    if (!project) return;
    setColorValue(color);
    updateMutation({
      projectId: project._id,
      data: { color },
    });
  };

  const handleVisibilityChange = async (visibility: VisibilityState) => {
    if (!project) return;
    await changeVisibilityMutation({
      projectId: project._id,
      visibility,
    });
  };

  useEffect(() => {
    if (project) {
      setIconValue(project.icon || null);
      setColorValue(project.color || null);
    }
  }, [project]);

  if (!project) {
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
              href={`/${params.orgSlug}/projects`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="size-3" />
              Projects
            </Link>
            <div className="flex items-center">
              {/* Team & Status selectors */}
              <PermissionAware
                orgSlug={params.orgSlug}
                permission={PERMISSIONS.PROJECT_EDIT}
                scope={permissionScope}
                fallbackMessage="You don't have permission to change project team"
              >
                <TeamSelector
                  teams={teams || []}
                  selectedTeam={project.teamId || ""}
                  onTeamSelect={handleTeamChange}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent shadow-none"
                />
              </PermissionAware>
            </div>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm font-medium">{params.projectKey}</span>
          </div>

          <div className="flex items-center">
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project visibility"
            >
              <VisibilitySelector
                value={project.visibility as VisibilityState}
                onValueChange={handleVisibilityChange}
                displayMode="iconWhenUnselected"
                className="border-none bg-transparent shadow-none"
              />
            </PermissionAware>
            <div className="bg-muted-foreground/20 h-4 w-px" />
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project status"
            >
              <StatusSelector
                statuses={statuses || []}
                selectedStatus={project.statusId || ""}
                onStatusSelect={handleStatusChange}
                className="border-none bg-transparent shadow-none"
              />
            </PermissionAware>

            <div className="bg-muted-foreground/20 h-4 w-px" />

            {/* Lead */}
            <PermissionAware
              orgSlug={params.orgSlug}
              permission={PERMISSIONS.PROJECT_EDIT}
              scope={permissionScope}
              fallbackMessage="You don't have permission to change project lead"
            >
              <ProjectLeadSelector
                orgSlug={params.orgSlug}
                projectKey={params.projectKey}
                selectedLead={project.leadId || ""}
                onLeadSelect={handleLeadChange}
                className="border-none bg-transparent shadow-none"
              />
            </PermissionAware>
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
                Updated {formatDateHuman(new Date(project._creationTime))}
              </span>
            </div>

            {/* Title */}
            {editingTitle ? (
              <div className="flex items-center gap-2">
                {/* Icon that stays visible during editing */}
                {canEdit ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-0 transition-opacity hover:opacity-80">
                        {iconValue ? (
                          (() => {
                            const IconComp = getDynamicIcon(iconValue);
                            if (!IconComp)
                              return (
                                <FolderOpen className="text-muted-foreground size-6" />
                              );
                            return (
                              <IconComp
                                className="size-6"
                                style={{ color: colorValue || undefined }}
                              />
                            );
                          })()
                        ) : (
                          <div className="border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed">
                            <Plus className="text-muted-foreground size-3" />
                          </div>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-2 text-sm font-medium">
                            Project Icon
                          </h4>
                          <IconPicker
                            value={iconValue}
                            onValueChange={handleIconChange}
                            placeholder="Select project icon"
                            className="h-8 w-full"
                          />
                        </div>
                        <div>
                          <h4 className="mb-2 text-sm font-medium">
                            Project Color
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {DEFAULT_COLORS.map((colorOption) => (
                              <button
                                key={colorOption}
                                type="button"
                                className={`size-8 rounded-md border-2 transition-all ${
                                  colorValue === colorOption
                                    ? "border-foreground scale-110"
                                    : "border-border hover:scale-105"
                                }`}
                                style={{ backgroundColor: colorOption }}
                                onClick={() => handleColorChange(colorOption)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  iconValue &&
                  (() => {
                    const IconComp = getDynamicIcon(iconValue);
                    if (!IconComp) return null;
                    return (
                      <IconComp
                        className="size-6"
                        style={{ color: colorValue || undefined }}
                      />
                    );
                  })()
                )}
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0"
                  style={{ fontFamily: "var(--font-title)" }}
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
                  <Button size="sm" onClick={handleTitleSave}>
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
              <h1 className="flex items-center gap-2 text-3xl leading-tight font-semibold">
                {/* Clickable Icon with Color */}
                {canEdit ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-0 transition-opacity hover:opacity-80">
                        {iconValue ? (
                          (() => {
                            const IconComp = getDynamicIcon(iconValue);
                            if (!IconComp)
                              return (
                                <FolderOpen className="text-muted-foreground size-6" />
                              );
                            return (
                              <IconComp
                                className="size-6"
                                style={{ color: colorValue || undefined }}
                              />
                            );
                          })()
                        ) : (
                          <div className="border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed">
                            <Plus className="text-muted-foreground size-3" />
                          </div>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-2 text-sm font-medium">
                            Project Icon
                          </h4>
                          <IconPicker
                            value={iconValue}
                            onValueChange={handleIconChange}
                            placeholder="Select project icon"
                            className="h-8 w-full"
                          />
                        </div>
                        <div>
                          <h4 className="mb-2 text-sm font-medium">
                            Project Color
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {DEFAULT_COLORS.map((colorOption) => (
                              <button
                                key={colorOption}
                                type="button"
                                className={`size-8 rounded-md border-2 transition-all ${
                                  colorValue === colorOption
                                    ? "border-foreground scale-110"
                                    : "border-border hover:scale-105"
                                }`}
                                style={{ backgroundColor: colorOption }}
                                onClick={() => handleColorChange(colorOption)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  iconValue &&
                  (() => {
                    const IconComp = getDynamicIcon(iconValue);
                    if (!IconComp) return null;
                    return (
                      <IconComp
                        className="size-6"
                        style={{ color: colorValue || undefined }}
                      />
                    );
                  })()
                )}
                <span
                  className={cn(
                    "transition-colors",
                    canEdit && "hover:text-muted-foreground cursor-pointer",
                  )}
                  onClick={() => canEdit && setEditingTitle(true)}
                >
                  {project.name}
                </span>
              </h1>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
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
                  <Button onClick={handleDescriptionSave}>
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
                    className={cn(
                      "prose prose-sm text-muted-foreground max-w-none transition-colors",
                      canEdit && "hover:text-foreground cursor-pointer",
                    )}
                    onClick={() => canEdit && setEditingDescription(true)}
                  >
                    <p className="whitespace-pre-wrap">{project.description}</p>
                  </div>
                ) : canEdit ? (
                  <button
                    className="text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base"
                    onClick={() => setEditingDescription(true)}
                  >
                    Add a description...
                  </button>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No description provided.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Properties Bar */}
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {/* Status */}
            <div className="flex min-w-[120px] items-center gap-1">
              <span className="text-muted-foreground">
                <PermissionAware
                  orgSlug={params.orgSlug}
                  permission={PERMISSIONS.PROJECT_EDIT}
                  scope={permissionScope}
                  fallbackMessage="You don't have permission to change status"
                >
                  <StatusSelector
                    statuses={statuses || []}
                    selectedStatus={project.statusId || ""}
                    onStatusSelect={handleStatusChange}
                    className="h-5 w-5 border-none bg-transparent p-0 shadow-none"
                    displayMode="iconOnly"
                  />
                </PermissionAware>
              </span>
              <span className="text-muted-foreground text-xs">Status</span>
              <span className="ml-1 font-medium">
                {statuses?.find((s) => s._id === project.statusId)?.name || "—"}
              </span>
            </div>
            {/* Lead */}
            <div className="flex min-w-[120px] items-center gap-1">
              <span className="text-muted-foreground">
                <PermissionAware
                  orgSlug={params.orgSlug}
                  permission={PERMISSIONS.PROJECT_EDIT}
                  scope={permissionScope}
                  fallbackMessage="You don't have permission to change lead"
                >
                  <ProjectLeadSelector
                    orgSlug={params.orgSlug}
                    projectKey={params.projectKey}
                    selectedLead={project.leadId || ""}
                    onLeadSelect={handleLeadChange}
                    className="h-5 w-5 border-none bg-transparent p-0 shadow-none"
                    displayMode="iconOnly"
                  />
                </PermissionAware>
              </span>
              <span className="text-muted-foreground text-xs">Lead</span>
              <span className="ml-1 font-medium">
                {project.lead?.name || "—"}
              </span>
            </div>
            {/* Team */}
            <div className="flex min-w-[120px] items-center gap-1">
              <span className="text-muted-foreground">
                <UsersIcon className="size-4" />
              </span>
              <span className="text-muted-foreground text-xs">Team</span>
              <span className="ml-1 font-medium">
                {teams?.find((t) => t._id === project.teamId)?.name || "—"}
              </span>
            </div>
            {/* Dates */}
            <div className="flex min-w-[180px] items-center gap-1">
              <span className="text-muted-foreground">
                <CalendarIcon className="size-4" />
              </span>
              <span className="text-muted-foreground text-xs">Dates</span>
              <span className="ml-1">
                {project.startDate
                  ? formatDateHuman(new Date(project.startDate))
                  : "—"}
                {project.dueDate
                  ? ` → ${formatDateHuman(new Date(project.dueDate))}`
                  : ""}
              </span>
            </div>
            {/* Created/Updated */}
            <div className="flex min-w-[160px] items-center gap-1">
              <span className="text-muted-foreground">
                <ClockIcon className="size-4" />
              </span>
              <span className="text-muted-foreground text-xs">Created</span>
              <span className="ml-1">
                {formatDateHuman(new Date(project._creationTime))}
              </span>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-6">
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
                orgSlug={params.orgSlug}
                projectKey={params.projectKey}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

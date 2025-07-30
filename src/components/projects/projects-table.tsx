"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { MoreHorizontal, Trash2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateHuman } from "@/lib/date";
import { StatusSelector } from "./project-selectors";
import type { Status, Team, Member } from "./project-selectors";
import { ProjectLeadSelector } from "./project-lead-selector";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { TeamSelector } from "@/components/teams/team-selector";

// Permission system
import { PermissionAware } from "@/components/ui/permission-aware";
import { PERMISSIONS } from "@/convex/_shared/permissions";

// Type for project data with all the rich details
export interface ProjectRowData {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  updatedAt: Date;
  createdAt: Date;
  startDate?: string | null;
  dueDate?: string | null;
  // Project details
  icon?: string | null;
  color?: string | null;
  // Status details
  statusId?: string | null;
  statusName?: string | null;
  statusColor?: string | null;
  statusIcon?: string | null;
  statusType?: string | null;
  // Team details
  teamId?: string | null;
  teamName?: string | null;
  teamKey?: string | null;
  // Lead details
  leadId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
}

function getLeadInitials(name?: string | null, email?: string | null): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface ProjectsTableProps {
  orgSlug: string;
  projects: ReadonlyArray<ProjectRowData>;
  statuses: ReadonlyArray<Status>;
  teams: ReadonlyArray<Team>;
  onStatusChange: (projectId: string, statusId: string) => void;
  onTeamChange: (projectId: string, teamId: string) => void;
  onLeadChange: (projectId: string, leadId: string) => void;
  onDelete: (projectId: string) => void;
  deletePending?: boolean;
}

export function ProjectsTable({
  orgSlug,
  projects,
  statuses,
  teams,
  onStatusChange,
  onTeamChange,
  onLeadChange,
  onDelete,
  deletePending = false,
}: ProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">📁</div>
          <h3 className="mb-2 text-lg font-semibold">No projects found</h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {projects.map((project) => {
          // Project icon / color
          const ProjectIcon = project.icon
            ? getDynamicIcon(project.icon) || Circle
            : Circle;
          const projectColor = project.color || "#94a3b8";

          // Status icon / color
          const StatusIcon = project.statusIcon
            ? getDynamicIcon(project.statusIcon) || Circle
            : Circle;
          const statusColor = project.statusColor || "#94a3b8";

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              key={project.id}
              className="hover:bg-muted/50 flex items-center gap-2 px-3 py-1.5 transition-colors"
            >
              {/* Project Icon */}
              <div className="flex-shrink-0">
                <ProjectIcon
                  className="size-4"
                  style={{ color: projectColor }}
                />
              </div>

              {/* Title */}
              <Link
                href={`/${orgSlug}/projects/${project.key}`}
                className="hover:text-primary flex min-w-0 flex-1 items-center gap-2 transition-colors"
              >
                <span className="block truncate text-sm font-medium">
                  {project.name}
                </span>
                <div className="bg-muted h-4 w-px" />
                {project.description && (
                  <p className="text-muted-foreground max-w-xs truncate text-xs">
                    {project.description}
                  </p>
                )}
              </Link>

              {/* Date Info - Moved to be first on the right section */}
              <div className="text-muted-foreground flex flex-col text-xs">
                {project.startDate && (
                  <span>
                    Start: {formatDateHuman(new Date(project.startDate))}
                  </span>
                )}
                {project.dueDate && (
                  <span>Due: {formatDateHuman(new Date(project.dueDate))}</span>
                )}
                {!project.startDate && !project.dueDate && (
                  <span>Updated {formatDateHuman(project.updatedAt)}</span>
                )}
              </div>

              {/* Status Selector */}
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.PROJECT_EDIT}
                fallbackMessage="You don't have permission to change project status"
              >
                <StatusSelector
                  statuses={statuses}
                  selectedStatus={project.statusId || ""}
                  onStatusSelect={(sid) => onStatusChange(project.id, sid)}
                  displayMode="iconWhenUnselected"
                  className="border-none bg-transparent p-0 shadow-none"
                />
              </PermissionAware>

              {/* Team Selector */}
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.PROJECT_EDIT}
                fallbackMessage="You don't have permission to change project team"
              >
                <div className="flex-shrink-0">
                  <TeamSelector
                    teams={teams}
                    selectedTeam={project.teamId || ""}
                    onTeamSelect={(tid) => onTeamChange(project.id, tid)}
                    displayMode="iconWhenUnselected"
                    className="border-none bg-transparent p-0 shadow-none"
                  />
                </div>
              </PermissionAware>

              {/* Lead Selector */}
              <PermissionAware
                orgSlug={orgSlug}
                permission={PERMISSIONS.PROJECT_LEAD_UPDATE}
                fallbackMessage="You don't have permission to change project lead"
              >
                <ProjectLeadSelector
                  orgSlug={orgSlug}
                  projectKey={project.key}
                  selectedLead={project.leadId || ""}
                  onLeadSelect={(leadId: string) =>
                    onLeadChange(project.id, leadId)
                  }
                  displayMode="iconOnly"
                  className="border-none bg-transparent p-0 shadow-none"
                />
              </PermissionAware>

              {/* Actions */}
              <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Open project actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletePending}
                      onClick={() => onDelete(project.id)}
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

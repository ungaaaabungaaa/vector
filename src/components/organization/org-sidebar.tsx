"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, CheckSquare, FolderOpen, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { CreateTeamButton } from "@/components/teams/create-team-button";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { PermissionGate } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/auth/permission-constants";
import { trpc } from "@/lib/trpc";
import type { ReactNode } from "react";
import type { Team, Project } from "@/components/issues/issue-selectors";
import { getDynamicIcon } from "@/lib/dynamic-icons";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional create button element shown at the end of the row */
  createElement?: ReactNode;
}

interface OrgSidebarProps {
  orgId: string;
}

export function OrgSidebar({ orgId }: OrgSidebarProps) {
  const pathname = usePathname();

  // Fetch user's teams and projects
  const { data: userTeams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug: orgId,
  });

  const { data: userProjects = [] } = trpc.organization.listProjects.useQuery({
    orgSlug: orgId,
  });

  const navItems: NavItem[] = [
    {
      label: "My Issues",
      href: `/${orgId}/issues`,
      icon: CheckSquare,
      createElement: (
        <PermissionGate orgSlug={orgId} permission={PERMISSIONS.ISSUE_CREATE}>
          <CreateIssueDialog orgSlug={orgId} className="h-6" />
        </PermissionGate>
      ),
    },
  ];

  return (
    <nav className="space-y-4 p-2 pt-0">
      {/* Main navigation items */}
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <div
              key={item.href}
              className={cn(
                "group flex h-8 items-center justify-between gap-2 rounded-md px-2 py-1 pr-1 text-sm font-medium transition-colors",
                "hover:bg-foreground/10 hover:text-foreground",
                isActive
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {/* Clickable area */}
              <Link
                href={item.href}
                className="flex flex-1 items-center gap-2 outline-none"
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>

              {/* Create button (if any) */}
              {item.createElement && (
                <div
                  className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    // Prevent row hover click-through
                    e.stopPropagation();
                  }}
                >
                  {item.createElement}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Teams Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-muted-foreground text-xs font-normal tracking-wider uppercase">
            My Teams
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={`/${orgId}/teams`}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View All
            </Link>
            <CreateTeamButton orgSlug={orgId} size="sm" className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-1">
          {userTeams.length > 0 ? (
            userTeams.slice(0, 3).map((team: Team) => {
              const teamHref = `/${orgId}/teams/${team.key}`;
              const isActive =
                pathname === teamHref || pathname.startsWith(teamHref + "/");

              return (
                <Link
                  key={team.id}
                  href={teamHref}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    "hover:bg-foreground/10 hover:text-foreground",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {(() => {
                    const TeamIcon = team.icon
                      ? getDynamicIcon(team.icon)
                      : null;
                    return TeamIcon ? (
                      <TeamIcon
                        className="size-3 flex-shrink-0"
                        style={{ color: team.color || "#6b7280" }}
                      />
                    ) : (
                      <Circle
                        className="size-3 flex-shrink-0"
                        style={{ color: team.color || "#6b7280" }}
                      />
                    );
                  })()}
                  <span className="truncate">{team.name}</span>
                </Link>
              );
            })
          ) : (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              No teams yet
            </div>
          )}

          {userTeams.length > 3 && (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              +{userTeams.length - 3} more teams
            </div>
          )}
        </div>
      </div>

      {/* Projects Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-muted-foreground text-xs font-normal tracking-wider uppercase">
            My Projects
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={`/${orgId}/projects`}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              View All
            </Link>
            <CreateProjectButton
              orgSlug={orgId}
              size="sm"
              className="h-5 w-5"
            />
          </div>
        </div>

        <div className="space-y-1">
          {userProjects.length > 0 ? (
            userProjects.slice(0, 3).map((project: Project) => {
              const projectHref = `/${orgId}/projects/${project.key}`;
              const isActive =
                pathname === projectHref ||
                pathname.startsWith(projectHref + "/");

              return (
                <Link
                  key={project.id}
                  href={projectHref}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    "hover:bg-foreground/10 hover:text-foreground",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {(() => {
                    // Priority: project custom icon > status icon > default folder
                    const CustomIcon = project.icon
                      ? getDynamicIcon(project.icon)
                      : null;
                    const CustomColor =
                      project.color || project.statusColor || "#6b7280";
                    const StatusIcon = project.statusIcon
                      ? getDynamicIcon(project.statusIcon)
                      : null;

                    if (CustomIcon) {
                      return (
                        <CustomIcon
                          className="size-3 flex-shrink-0"
                          style={{ color: CustomColor }}
                        />
                      );
                    } else if (StatusIcon) {
                      return (
                        <StatusIcon
                          className="size-3 flex-shrink-0"
                          style={{ color: project.statusColor || "#6b7280" }}
                        />
                      );
                    } else {
                      return (
                        <FolderOpen
                          className="size-3 flex-shrink-0"
                          style={{ color: project.statusColor || "#6b7280" }}
                        />
                      );
                    }
                  })()}
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })
          ) : (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              No projects yet
            </div>
          )}

          {userProjects.length > 3 && (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              +{userProjects.length - 3} more projects
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

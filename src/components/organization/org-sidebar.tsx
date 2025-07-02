"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  FolderKanban,
  type LucideIcon,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";
import { CreateTeamButton } from "@/components/teams/create-team-button";
import { CreateProjectButton } from "@/components/projects/create-project-button";
import { PermissionGate } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/auth/permission-constants";
import type { ReactNode } from "react";

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

  const navItems: NavItem[] = [
    {
      label: "Issues",
      href: `/${orgId}/issues`,
      icon: CheckSquare,
      createElement: (
        <PermissionGate orgSlug={orgId} permission={PERMISSIONS.ISSUE_CREATE}>
          <CreateIssueDialog orgSlug={orgId} className="h-6" />
        </PermissionGate>
      ),
    },
    {
      label: "Teams",
      href: `/${orgId}/teams`,
      icon: Users,
      createElement: (
        <CreateTeamButton orgSlug={orgId} size="sm" className="h-6" />
      ),
    },
    {
      label: "Projects",
      href: `/${orgId}/projects`,
      icon: FolderKanban,
      createElement: (
        <CreateProjectButton orgSlug={orgId} size="sm" className="h-6" />
      ),
    },
  ];

  return (
    <nav className="space-y-1 p-2 pt-0">
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
    </nav>
  );
}

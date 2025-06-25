"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  FolderKanban,
  Bug,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface OrgSidebarProps {
  orgId: string;
}

export function OrgSidebar({ orgId }: OrgSidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/${orgId}/dashboard`,
      icon: Home,
    },
    {
      label: "Teams",
      href: `/${orgId}/teams`,
      icon: Users,
    },
    {
      label: "Projects",
      href: `/${orgId}/projects`,
      icon: FolderKanban,
    },
    {
      label: "Issues",
      href: `/${orgId}/issues`,
      icon: Bug,
    },
    {
      label: "Settings",
      href: `/${orgId}/settings`,
      icon: Settings,
    },
  ];

  return (
    <nav className="space-y-1 p-3">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

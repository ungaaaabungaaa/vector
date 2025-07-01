"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export function UserSettingsSidebar() {
  const [pathname, setPathname] = useState<string>("");

  // Update pathname on client after mount to avoid SSR context issues
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  const settingsItems: SettingsNavItem[] = [
    {
      label: "Profile",
      href: "/settings/profile",
      icon: User,
      description: "Personal information and preferences",
    },
    {
      label: "Invites",
      href: "/settings/invites",
      icon: Mail,
      description: "Pending organization invitations",
    },
  ];

  return (
    <nav className="space-y-1 p-2 pt-0">
      {settingsItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "hover:bg-foreground/10 hover:text-foreground",
              isActive
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

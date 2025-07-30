"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Settings, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Doc } from "@/convex/_generated/dataModel";

type Organization = Doc<"organizations">;

interface OrgOptionsDropdownProps {
  currentOrgSlug: string;
  currentOrgName: string;
  currentOrgLogo?: string | null;
  organizations?: Organization[];
}

export function OrgOptionsDropdown({
  currentOrgSlug,
  currentOrgName,
  currentOrgLogo,
  organizations = [],
}: OrgOptionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Check if we're currently in settings
  const isInSettings = pathname.includes("/settings");

  const handleOrgSwitch = (orgSlug: string) => {
    if (orgSlug !== currentOrgSlug) {
      // Redirect to the selected organization's issues page
      window.location.href = `/${orgSlug}/issues`;
    }
    setIsOpen(false);
  };

  const handleCreateOrg = () => {
    window.location.href = "/org-setup";
  };

  const handleSettingsClick = () => {
    window.location.href = `/${currentOrgSlug}/settings`;
    setIsOpen(false);
  };

  const handleDashboardClick = () => {
    window.location.href = `/${currentOrgSlug}/issues`;
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="hover:bg-accent/50 group bg-background flex w-full items-center justify-between rounded-md border p-1 text-left transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {currentOrgLogo ? (
              <img
                src={`/api/files/${currentOrgLogo}`}
                alt="Logo"
                className="size-5 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold">
                {currentOrgName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate text-sm font-medium">
              {currentOrgName}
            </span>
          </div>
          <ChevronsUpDown className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="start" sideOffset={4}>
        {/* Current Organization Actions */}
        <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs font-medium">
          {currentOrgName}
        </DropdownMenuLabel>

        {isInSettings ? (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
            onSelect={handleDashboardClick}
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm">Back to {currentOrgName}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
            onSelect={handleSettingsClick}
          >
            <Settings className="size-4" />
            <span className="text-sm">Organization settings</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Organization Switcher */}
        <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs font-medium">
          Switch Organizations
        </DropdownMenuLabel>

        {/* Current Organization */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
          onSelect={() => handleOrgSwitch(currentOrgSlug)}
        >
          {currentOrgLogo ? (
            <img
              src={`/api/files/${currentOrgLogo}`}
              alt="Logo"
              className="size-4 rounded object-cover"
            />
          ) : (
            <div className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded text-xs font-semibold">
              {currentOrgName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="flex-1 truncate text-sm">{currentOrgName}</span>
          <Check className="text-primary size-3" />
        </DropdownMenuItem>

        {/* Other Organizations */}
        {organizations
          .filter((org) => org.slug !== currentOrgSlug)
          .map((org) => (
            <DropdownMenuItem
              key={org._id}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
              onSelect={() => handleOrgSwitch(org.slug)}
            >
              {org.logo ? (
                <img
                  src={`/api/files/${org.logo}`}
                  alt="Logo"
                  className="size-4 rounded object-cover"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-4 items-center justify-center rounded text-xs font-semibold">
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-sm">{org.name}</span>
            </DropdownMenuItem>
          ))}

        <DropdownMenuSeparator />

        {/* Create New Organization */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
          onSelect={handleCreateOrg}
        >
          <div className="border-muted-foreground/60 flex size-4 items-center justify-center rounded border border-dashed">
            <Plus className="size-2.5" />
          </div>
          <span className="text-sm">Create organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgSwitcherProps {
  currentOrgId: string;
  currentOrgName: string;
  organizations?: Organization[];
}

export function OrgSwitcher({
  currentOrgId,
  currentOrgName,
  organizations = [],
}: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOrgSwitch = (orgId: string) => {
    if (orgId !== currentOrgId) {
      // Redirect to the selected organization's dashboard
      window.location.href = `/${orgId}/dashboard`;
    }
    setIsOpen(false);
  };

  const handleCreateOrg = () => {
    window.location.href = "/org-setup";
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="hover:bg-accent/50 group flex w-full items-center justify-between rounded-md p-1 text-left transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold">
              {currentOrgName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">
              {currentOrgName}
            </span>
          </div>
          <ChevronsUpDown className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-48" align="start" sideOffset={4}>
        <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-xs font-medium">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Current Organization */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
          onSelect={() => handleOrgSwitch(currentOrgId)}
        >
          <div className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded text-xs font-semibold">
            {currentOrgName.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-sm">{currentOrgName}</span>
          <Check className="text-primary size-3" />
        </DropdownMenuItem>

        {/* Other Organizations */}
        {organizations
          .filter((org) => org.id !== currentOrgId)
          .map((org) => (
            <DropdownMenuItem
              key={org.id}
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
              onSelect={() => handleOrgSwitch(org.id)}
            >
              <div className="bg-muted text-muted-foreground flex size-4 items-center justify-center rounded text-xs font-semibold">
                {org.name.charAt(0).toUpperCase()}
              </div>
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

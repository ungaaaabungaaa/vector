"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check, User } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useAccess } from "@/components/ui/permission-aware";

type ProjectMember = FunctionReturnType<
  typeof api.projects.listMembers
>[number];
type OrgMember = {
  userId: string;
  name?: string;
  email?: string;
};

interface ProjectLeadSelectorProps {
  orgSlug: string;
  projectKey?: string; // Optional - if provided, we're editing an existing project
  selectedLead: string;
  onLeadSelect: (leadId: string) => void;
  displayMode?: "full" | "iconOnly" | "iconWhenUnselected";
  trigger?: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}

function getInitials(name: string | null, email: string | undefined): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Type guard to check if member is a project member (has .user)
function isProjectMember(
  member: ProjectMember | OrgMember,
): member is ProjectMember {
  return (member as ProjectMember).user !== undefined;
}

export function ProjectLeadSelector({
  orgSlug,
  projectKey,
  selectedLead,
  onLeadSelect,
  displayMode = "full",
  trigger,
  className,
  align = "start",
}: ProjectLeadSelectorProps) {
  const [open, setOpen] = useState(false);

  const { viewOnly } = useAccess();
  const currentUser = useQuery(api.users.getCurrentUser);
  const currentUserId = currentUser?._id;

  // Fetch organization members (for project creation)
  const orgMembers: OrgMember[] =
    useQuery(api.organizations.listMembers, { orgSlug }) ?? [];
  const project = useQuery(
    api.projects.getByKey,
    projectKey ? { orgSlug, projectKey } : "skip",
  );

  // Fetch project members if projectKey and project ID are available
  const projectMembers: ProjectMember[] =
    useQuery(
      api.projects.listMembers,
      projectKey && project?._id ? { projectId: project._id } : "skip",
    ) ?? [];

  // For existing projects, we need to include the project lead even if they're not explicitly added as project members
  const members: (ProjectMember | OrgMember)[] = projectKey
    ? (() => {
        const leadId = project?.leadId;

        if (leadId && !projectMembers.some((m) => m.userId === leadId)) {
          // Find the lead in org members and add them to the list
          const leadFromOrg = orgMembers.find((m) => m.userId === leadId);
          if (leadFromOrg) {
            return [...projectMembers, leadFromOrg];
          }
        }

        return projectMembers;
      })()
    : orgMembers;

  // Sort members: current user first, then alphabetically by name
  const sortedMembers = [...members].sort((a, b) => {
    // Current user always comes first
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;

    // Then sort by name
    const nameA = isProjectMember(a)
      ? a.user?.name || a.user?.email || ""
      : a.name || a.email || "";
    const nameB = isProjectMember(b)
      ? b.user?.name || b.user?.email || ""
      : b.name || b.email || "";
    return nameA.localeCompare(nameB);
  });

  const selectedLeadObj = sortedMembers.find((m) => m.userId === selectedLead);

  const hasSelection = selectedLead !== "";
  const showIcon =
    displayMode === "iconOnly" ||
    (displayMode === "iconWhenUnselected" && !hasSelection);
  const showLabel =
    displayMode === "full" ||
    (displayMode === "iconWhenUnselected" && hasSelection);

  const defaultTrigger =
    selectedLead && selectedLeadObj ? (
      <Button
        variant="outline"
        size="sm"
        className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
      >
        <Avatar className="size-5">
          <AvatarFallback className="text-xs">
            {selectedLeadObj
              ? isProjectMember(selectedLeadObj)
                ? getInitials(
                    selectedLeadObj.user?.name ?? null,
                    selectedLeadObj.user?.email,
                  )
                : getInitials(
                    selectedLeadObj.name ?? null,
                    selectedLeadObj.email,
                  )
              : "?"}
          </AvatarFallback>
        </Avatar>
        {showLabel && selectedLeadObj && (
          <span className="text-sm">
            {isProjectMember(selectedLeadObj)
              ? selectedLeadObj.user?.name || selectedLeadObj.user?.email
              : selectedLeadObj.name || selectedLeadObj.email}
          </span>
        )}
      </Button>
    ) : displayMode === "iconWhenUnselected" ? (
      <Button
        variant="outline"
        size="sm"
        className={cn("bg-muted/30 hover:bg-muted/50 h-8 w-8 p-0", className)}
      >
        <User className="text-muted-foreground h-3 w-3" />
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
      >
        {showIcon && <User className="text-muted-foreground h-3 w-3" />}
        {showLabel && <span className="text-sm">Lead</span>}
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder={
              projectKey ? "Search project members..." : "Search members..."
            }
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {projectKey ? "No project members found." : "No members found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  if (!viewOnly) {
                    onLeadSelect("");
                    setOpen(false);
                  }
                }}
                disabled={viewOnly}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedLead === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                No lead
                {viewOnly && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    (view only)
                  </span>
                )}
              </CommandItem>
              {sortedMembers.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={
                    isProjectMember(member)
                      ? member.user?.name || member.user?.email
                      : member.name || member.email
                  }
                  onSelect={() => {
                    if (!viewOnly) {
                      onLeadSelect(member.userId);
                      setOpen(false);
                    }
                  }}
                  disabled={viewOnly}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedLead === member.userId
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <Avatar className="mr-2 size-5">
                    <AvatarFallback className="text-xs">
                      {isProjectMember(member)
                        ? getInitials(
                            member.user?.name ?? null,
                            member.user?.email,
                          )
                        : getInitials(member.name ?? null, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">
                      {isProjectMember(member)
                        ? member.user?.name || member.user?.email
                        : member.name || member.email}
                      {member.userId === currentUserId && (
                        <span className="text-muted-foreground ml-1">
                          (you)
                        </span>
                      )}
                    </span>
                    {(isProjectMember(member)
                      ? member.user?.name
                      : member.name) && (
                      <span className="text-muted-foreground text-xs">
                        {isProjectMember(member)
                          ? member.user?.email
                          : member.email}
                      </span>
                    )}
                  </div>
                  {viewOnly && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      (view only)
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

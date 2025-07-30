"use client";

import React, { useState } from "react";
// UI primitives
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// Utils
import { cn } from "@/lib/utils";
import { getDynamicIcon } from "@/lib/dynamic-icons";

// Icons
import { Check, Circle, Users } from "lucide-react";
import { useAccess } from "@/components/ui/permission-aware";

// Types
interface TeamData {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
  key?: string;
  // Optional fields that may or may not be present
  lead?: {
    _id: string;
    name?: string;
    email?: string;
  } | null;
  memberCount?: number;
  leadId?: string;
}

// Type for Convex team data
type ConvexTeamData = {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
  key: string;
  lead?: {
    _id: string;
    name?: string;
    email?: string;
  } | null;
  memberCount?: number;
  leadId?: string;
};

// Type for legacy team data (used in project selectors)
type LegacyTeamData = {
  id: string;
  name: string;
  key: string;
  icon?: string | null;
  color?: string | null;
};

interface TeamSelectorProps {
  teams:
    | readonly TeamData[]
    | readonly ConvexTeamData[]
    | readonly LegacyTeamData[];
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

// Display modes for controlling visibility of icon and label - matching issue selectors
export type SelectorDisplayMode =
  | "default" // icon + label
  | "labelOnly" // label only (no icon)
  | "iconOnly" // icon only (no label, always)
  | "iconWhenUnselected"; // icon when unselected, icon+label once a value selected

// Helper function to resolve what to show based on display mode and selection state
function resolveVisibility(
  displayMode: SelectorDisplayMode | undefined,
  hasSelection: boolean,
) {
  switch (displayMode) {
    case "labelOnly":
      return { showIcon: false, showLabel: true };
    case "iconOnly":
      return { showIcon: true, showLabel: false };
    case "iconWhenUnselected":
      return { showIcon: true, showLabel: hasSelection };
    case "default":
    default:
      return { showIcon: true, showLabel: true };
  }
}

// Helper function to get team ID that works with both _id and id properties
function getTeamId(team: TeamData | ConvexTeamData | LegacyTeamData): string {
  return "_id" in team ? team._id : team.id;
}

/**
 * Shared TeamSelector used across Issues & Projects.
 * Accepts a list of teams and shows a searchable combobox drop-down.
 *
 * Features:
 * - Supports team icons and colors from the database
 * - Falls back to Circle icon and grey color (#94a3b8) when none are set
 * - Uses the same pattern as status selectors for consistency
 */
export function TeamSelector({
  teams,
  selectedTeam,
  onTeamSelect,
  displayMode,
  trigger,
  className,
  align = "start",
}: TeamSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();

  const hasSelection = selectedTeam !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  // Get selected team data
  const selectedTeamObj = teams.find((t) => getTeamId(t) === selectedTeam);
  const currentColor = selectedTeamObj?.color || "#94a3b8"; // Default grey
  const currentName = selectedTeamObj?.name || "Team";
  const currentIconName = selectedTeamObj?.icon;
  const CurrentIcon = currentIconName
    ? getDynamicIcon(currentIconName) || Users
    : Users;

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon &&
        (selectedTeam ? (
          CurrentIcon ? (
            <CurrentIcon className="h-3 w-3" style={{ color: currentColor }} />
          ) : (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )
        ) : (
          <Users className="h-3 w-3" />
        ))}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search teams..." className="h-9" />
          <CommandList>
            <CommandEmpty>No team found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  if (!viewOnly) {
                    onTeamSelect("");
                    setOpen(false);
                  }
                }}
                disabled={viewOnly}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedTeam === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                None
                {viewOnly && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    (view only)
                  </span>
                )}
              </CommandItem>
              {teams.map((team) => {
                const Icon = team.icon
                  ? getDynamicIcon(team.icon) || Circle
                  : Circle;
                const teamId = getTeamId(team);
                return (
                  <CommandItem
                    key={teamId}
                    value={team.name}
                    onSelect={() => {
                      if (!viewOnly) {
                        onTeamSelect(teamId);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTeam === teamId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon
                      className="mr-2 h-3 w-3"
                      style={{ color: team.color || "#94a3b8" }}
                    />
                    {team.name}
                    {viewOnly && (
                      <span className="text-muted-foreground ml-auto text-xs">
                        (view only)
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

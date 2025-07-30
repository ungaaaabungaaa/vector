"use client";

import { useState } from "react";

// UI primitives
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Utils & helpers
import { cn } from "@/lib/utils";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FunctionReturnType } from "convex/server";

// Icons
import { FolderOpen, User, Check, Circle, Calendar, Clock } from "lucide-react";

// Calendar component
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Permission hooks
import { useAccess } from "@/components/ui/permission-aware";

// ---------------------------------------------------------------------------
// 🧩 Type inference – derive types directly from Convex query outputs
// ---------------------------------------------------------------------------
import { Input } from "../ui/input";

// Infer types from Convex query outputs
export type Team = FunctionReturnType<
  typeof api.organizations.listTeams
>[number];
export type Project = FunctionReturnType<
  typeof api.organizations.listProjects
>[number];
export type State = FunctionReturnType<
  typeof api.organizations.listIssueStates
>[number];
export type Member = FunctionReturnType<
  typeof api.organizations.listMembers
>[number];
export type Priority = FunctionReturnType<
  typeof api.organizations.listIssuePriorities
>[number];

// ---------------------------------------------------------------------------
// Display variant for how the button shows icon/label
// ---------------------------------------------------------------------------
export type SelectorDisplayMode =
  | "default" // icon + label
  | "labelOnly" // label only (no icon)
  | "iconOnly" // icon only (no label, always)
  | "iconWhenUnselected"; // icon when unselected, icon+label once a value selected

function resolveVisibility(
  mode: SelectorDisplayMode | undefined,
  hasSelection: boolean,
): { showIcon: boolean; showLabel: boolean } {
  switch (mode) {
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

// ---------------------------------------------------------------------------
// Selector components
// ---------------------------------------------------------------------------

// Re-export shared TeamSelector implementation
export { TeamSelector } from "@/components/teams/team-selector";

// Project Selector -----------------------------------------------------------
interface ProjectSelectorProps {
  projects: readonly Project[];
  selectedProject: string;
  onProjectSelect: (projectId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function ProjectSelector({
  projects,
  selectedProject,
  onProjectSelect,
  displayMode,
  trigger,
  className,
  align = "start",
}: ProjectSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();

  // Always render selector even when no projects to make the control discoverable.

  const hasSelection = selectedProject !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  // Get selected project data
  const selectedProjectObj = projects.find((p) => p._id === selectedProject);
  const currentColor = selectedProjectObj?.color || "#94a3b8"; // Default grey
  const currentName = selectedProjectObj?.name || "Project";
  const currentIconName = selectedProjectObj?.icon;
  const CurrentIcon = currentIconName
    ? getDynamicIcon(currentIconName) || FolderOpen
    : FolderOpen;

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon &&
        (selectedProject ? (
          CurrentIcon ? (
            <CurrentIcon className="h-3 w-3" style={{ color: currentColor }} />
          ) : (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )
        ) : (
          <FolderOpen className="h-3 w-3" />
        ))}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search project..." className="h-9" />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  if (!viewOnly) {
                    onProjectSelect("");
                    setOpen(false);
                  }
                }}
                disabled={viewOnly}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedProject === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                None
                {viewOnly && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    (view only)
                  </span>
                )}
              </CommandItem>
              {projects.map((project) => {
                const Icon = project.icon
                  ? getDynamicIcon(project.icon) || FolderOpen
                  : FolderOpen;
                return (
                  <CommandItem
                    key={project._id}
                    value={project.name}
                    onSelect={() => {
                      if (!viewOnly) {
                        onProjectSelect(project._id);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedProject === project._id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <Icon
                      className="mr-2 h-3 w-3"
                      style={{ color: project.color || "#94a3b8" }}
                    />
                    {project.name}
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

// State Selector -------------------------------------------------------------
interface StateSelectorProps {
  states: readonly State[] | State[];
  selectedState: string;
  onStateSelect: (stateId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function StateSelector({
  states,
  selectedState,
  onStateSelect,
  displayMode,
  trigger,
  className,
  align = "start",
}: StateSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();

  // Transform states from API into combobox-friendly structure
  const stateOptions = states.map((s) => ({
    value: s._id,
    label: s.name,
    color: s.color || "#94a3b8", // fallback to default gray
  }));

  // Helper: currently selected state data
  const getSelectedStateData = () => {
    if (!selectedState) {
      const defaultState = states.find((s) => s.type === "todo") || states[0];
      return {
        color: defaultState?.color || "#94a3b8",
        name: defaultState?.name || "Select state...",
        icon: defaultState?.icon,
      };
    }
    const state = states.find((s) => s._id === selectedState);
    return {
      color: state?.color || "#94a3b8",
      name: state?.name || "Select state...",
      icon: state?.icon,
    };
  };

  const selectedStateData = getSelectedStateData();
  const SelectedStateIcon = selectedStateData.icon
    ? getDynamicIcon(selectedStateData.icon)
    : null;

  const hasSelection = selectedState !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon &&
        (SelectedStateIcon ? (
          <SelectedStateIcon
            className="h-3 w-3"
            style={{ color: selectedStateData.color }}
          />
        ) : (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: selectedStateData.color }}
          />
        ))}
      {showLabel && selectedStateData.name}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search state..." className="h-9" />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup>
              {stateOptions.map((state) => {
                const stateData = states.find((s) => s._id === state.value);
                const StateIcon = stateData?.icon
                  ? getDynamicIcon(stateData.icon)
                  : null;

                return (
                  <CommandItem
                    key={state.value}
                    value={state.label}
                    onSelect={() => {
                      if (!viewOnly) {
                        onStateSelect(state.value);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedState === state.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {StateIcon ? (
                      <StateIcon
                        className="mr-2 h-3 w-3"
                        style={{ color: state.color }}
                      />
                    ) : (
                      <div
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: state.color }}
                      />
                    )}
                    {state.label}
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

// Priority Selector ----------------------------------------------------------
interface PrioritySelectorProps {
  priorities: Priority[];
  selectedPriority: string;
  onPrioritySelect: (priorityId: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function PrioritySelector({
  priorities,
  selectedPriority,
  onPrioritySelect,
  displayMode,
  trigger,
  className,
  align = "start",
}: PrioritySelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);
  const { viewOnly } = useAccess();

  if (priorities.length === 0) return null;

  const hasSelection = selectedPriority !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  const current = priorities.find((p) => p._id === selectedPriority);
  const currentColor = current?.color || "#94a3b8";
  const currentName = current?.name || "Priority";
  const currentIconName = current?.icon;
  const CurrentIcon = currentIconName ? getDynamicIcon(currentIconName) : null;

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon &&
        (CurrentIcon ? (
          <CurrentIcon className="h-3 w-3" style={{ color: currentColor }} />
        ) : (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentColor }}
          />
        ))}
      {showLabel && currentName}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search priority..." className="h-9" />
          <CommandList>
            <CommandEmpty>No priority found.</CommandEmpty>
            <CommandGroup>
              {priorities.map((priority) => {
                const PriorityIcon = priority.icon
                  ? getDynamicIcon(priority.icon)
                  : null;

                return (
                  <CommandItem
                    key={priority._id}
                    value={priority.name}
                    onSelect={() => {
                      if (!viewOnly) {
                        onPrioritySelect(priority._id);
                        setOpen(false);
                      }
                    }}
                    disabled={viewOnly}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPriority === priority._id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {PriorityIcon ? (
                      <PriorityIcon
                        className="mr-2 h-3 w-3"
                        style={{ color: priority.color || "#94a3b8" }}
                      />
                    ) : (
                      <div
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: priority.color || "#94a3b8" }}
                      />
                    )}
                    {priority.name}
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

// Assignee Selector ----------------------------------------------------------
interface AssigneeSelectorProps {
  members: Member[];
  selectedAssignee?: string;
  onAssigneeSelect?: (assigneeId: string) => void;
  selectedAssignees?: string[];
  onAssigneesSelect?: (assigneeIds: string[]) => void;
  multiple?: boolean;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  currentUserId?: string;
  canManageAll?: boolean;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function AssigneeSelector({
  members,
  selectedAssignee,
  onAssigneeSelect,
  selectedAssignees = [],
  onAssigneesSelect,
  multiple = false,
  displayMode,
  trigger,
  className,
  currentUserId = "",
  canManageAll = false,
  align = "start",
}: AssigneeSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);

  if (members.length === 0) return null;

  const hasSelection = multiple
    ? selectedAssignees.length > 0
    : (selectedAssignee || "") !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  const handleSelect = (userId: string) => {
    if (multiple && onAssigneesSelect) {
      const isSelected = selectedAssignees.includes(userId);
      if (isSelected) {
        onAssigneesSelect(selectedAssignees.filter((id) => id !== userId));
      } else {
        onAssigneesSelect([...selectedAssignees, userId]);
      }
      // Keep popover open for multiple selection
    } else if (onAssigneeSelect) {
      onAssigneeSelect(userId);
      setOpen(false);
    }
  };

  const getDisplayText = () => {
    if (multiple) {
      if (selectedAssignees.length === 0) return "Assignees";
      if (selectedAssignees.length === 1) {
        const member = members.find((m) => m.userId === selectedAssignees[0]);
        return member?.user?.name || "1 assignee";
      }
      return `${selectedAssignees.length} assignees`;
    } else {
      if (!selectedAssignee) return "Assignee";
      return (
        members.find((m) => m.userId === selectedAssignee)?.user?.name ||
        "Assignee"
      );
    }
  };

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon && <User className="h-3 w-3" />}
      {showLabel && getDisplayText()}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search assignee..." className="h-9" />
          <CommandList>
            <CommandEmpty>No member found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  if (!canManageAll && currentUserId !== "") return; // cannot unassign others
                  if (multiple && onAssigneesSelect) {
                    onAssigneesSelect([]);
                    setOpen(false);
                  } else {
                    handleSelect("");
                  }
                }}
                disabled={!canManageAll && currentUserId !== ""}
                className={cn(
                  !canManageAll &&
                    currentUserId !== "" &&
                    "pointer-events-none opacity-50",
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    multiple
                      ? selectedAssignees.length === 0
                        ? "opacity-100"
                        : "opacity-0"
                      : (selectedAssignee || "") === ""
                        ? "opacity-100"
                        : "opacity-0",
                  )}
                />
                Unassign all
              </CommandItem>
              {members.map((member) => (
                <CommandItem
                  key={member.userId}
                  value={member.user?.name || member.user?.email}
                  onSelect={() => {
                    handleSelect(member.userId);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      multiple
                        ? selectedAssignees.includes(member.userId)
                          ? "opacity-100"
                          : "opacity-0"
                        : (selectedAssignee || "") === member.userId
                          ? "opacity-100"
                          : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{member.user?.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {member.user?.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Date Selectors ----------------------------------------------------------------
interface DateSelectorProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  tooltipText?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function DateSelector({
  selectedDate,
  onDateSelect,
  displayMode,
  trigger,
  className,
  placeholder = "Select date",
  icon: Icon = Calendar,
  title,
  tooltipText,
  align = "start",
}: DateSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);

  const hasSelection = selectedDate !== "";
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasSelection);

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const buttonContent = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {showLabel && (selectedDate ? formatDate(selectedDate) : placeholder)}
    </Button>
  );

  const DefaultBtn =
    displayMode === "iconWhenUnselected" && !hasSelection && tooltipText ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      buttonContent
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-3">
        <div className="space-y-3">
          {title && (
            <div className="text-center text-sm font-medium">{title}</div>
          )}
          <CalendarComponent
            mode="single"
            selected={selectedDate ? new Date(selectedDate) : undefined}
            onSelect={(date) => {
              if (date) {
                onDateSelect(date.toISOString().split("T")[0]);
              }
              setOpen(false);
            }}
            initialFocus
          />
          {selectedDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDateSelect("");
                setOpen(false);
              }}
              className="w-full"
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Time Estimates Selector ----------------------------------------------------
interface TimeEstimatesSelectorProps {
  estimatedTimes: { [key: string]: number };
  onEstimatedTimesChange: (times: { [key: string]: number }) => void;
  states: readonly State[] | State[];
  displayMode?: SelectorDisplayMode;
  trigger?: React.ReactElement;
  className?: string;
  /** Position of the popover relative to its trigger. */
  align?: "start" | "center" | "end";
}

export function TimeEstimatesSelector({
  estimatedTimes,
  onEstimatedTimesChange,
  states,
  displayMode,
  trigger,
  className,
  align = "start",
}: TimeEstimatesSelectorProps & { align?: "start" | "center" | "end" }) {
  const [open, setOpen] = useState(false);

  // Filter states to only show "done" type states
  const doneStates = states.filter((state) => state.type === "done");

  const totalHours = Object.values(estimatedTimes).reduce(
    (sum, hours) => sum + (hours || 0),
    0,
  );
  const hasEstimates = totalHours > 0;
  const { showIcon, showLabel } = resolveVisibility(displayMode, hasEstimates);

  const formatHours = (hours: number) => {
    if (hours === 0) return "";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours % 1 === 0) return `${hours}h`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getDisplayContent = () => {
    if (!hasEstimates) {
      return "Estimates";
    }

    // Get states that have estimates
    const statesWithEstimates = doneStates.filter(
      (state) => estimatedTimes[state._id] && estimatedTimes[state._id] > 0,
    );

    if (statesWithEstimates.length === 0) {
      return `${formatHours(totalHours)} total`;
    }

    // If only one state has estimates, show it with icon
    if (statesWithEstimates.length === 1) {
      const state = statesWithEstimates[0];
      const StateIcon = state.icon ? getDynamicIcon(state.icon) : null;
      const hours = estimatedTimes[state._id];

      return (
        <div className="flex items-center gap-1">
          {StateIcon && (
            <StateIcon
              className="h-3 w-3"
              style={{ color: state.color || "#94a3b8" }}
            />
          )}
          <span>{formatHours(hours)}</span>
        </div>
      );
    }

    // If multiple states have estimates, show total with count
    return `${formatHours(totalHours)} (${statesWithEstimates.length} states)`;
  };

  const DefaultBtn = (
    <Button
      variant="outline"
      size="sm"
      className={cn("bg-muted/30 hover:bg-muted/50 h-8 gap-2", className)}
    >
      {showIcon && !hasEstimates && <Clock className="h-3 w-3" />}
      {showLabel && getDisplayContent()}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? DefaultBtn}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-3">
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Time Estimates by Done States
          </div>
          <div className="text-muted-foreground text-xs">
            Estimate how long the issue will spend in each completed state
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {doneStates.map((state) => {
              const StateIcon = state.icon ? getDynamicIcon(state.icon) : null;
              return (
                <div key={state._id} className="my-1 flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {StateIcon ? (
                      <StateIcon
                        className="h-3 w-3 flex-shrink-0"
                        style={{ color: state.color || "#94a3b8" }}
                      />
                    ) : (
                      <div
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: state.color || "#94a3b8" }}
                      />
                    )}
                    <span className="truncate text-sm">{state.name}</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring h-8 w-20 rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={estimatedTimes[state._id] || ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      onEstimatedTimesChange({
                        ...estimatedTimes,
                        [state._id]: isNaN(value) ? 0 : value,
                      });
                    }}
                  />
                  <span className="text-muted-foreground w-8 text-xs">hrs</span>
                </div>
              );
            })}
          </div>
          {hasEstimates && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">
                Total: {formatHours(totalHours)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEstimatedTimesChange({});
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Multi-Assignee Selector for Issue Table Rows --------------------------------
interface MultiAssigneeSelectorProps {
  orgSlug: string;
  selectedAssigneeIds: string[];
  onAssigneesChange: (assigneeIds: string[]) => void;
  className?: string;
  trigger?: React.ReactElement;
  isLoading?: boolean;
  highlightAssigneeId?: string | null;
  assignments?: AssignmentInfo[];
  activeFilter?: string;
  currentUserId?: string;
  canManageAll?: boolean;
}

export function MultiAssigneeSelector({
  orgSlug,
  selectedAssigneeIds,
  onAssigneesChange,
  trigger,
  isLoading = false,
  highlightAssigneeId = null,
  assignments = [],
  activeFilter = "all",
  currentUserId = "",
  canManageAll = false,
}: MultiAssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Search members with debouncing
  const searchResults = useQuery(api.organizations.searchMembers, {
    orgSlug,
    query: searchQuery,
    limit: 10,
  });

  // Get organization members for display purposes (when we have selections but they're not in search)
  const allMembers = useQuery(api.organizations.listMembers, {
    orgSlug,
  });

  const handleToggleAssignee = (userId: string) => {
    if (isLoading) return;
    if (!canManageAll && userId !== currentUserId) return; // permission guard
    const isSelected = selectedAssigneeIds.includes(userId);
    if (isSelected) {
      onAssigneesChange(selectedAssigneeIds.filter((id) => id !== userId));
    } else {
      onAssigneesChange([...selectedAssigneeIds, userId]);
    }
  };

  const handleUnassignAll = () => {
    if (isLoading) return;
    onAssigneesChange([]);
  };

  const matchCount =
    activeFilter === "all"
      ? selectedAssigneeIds.length
      : assignments.filter(
          (a) =>
            a.stateType === activeFilter &&
            a.assigneeId &&
            selectedAssigneeIds.includes(a.assigneeId),
        ).length;

  const getDisplayContent = () => {
    if (selectedAssigneeIds.length === 0) {
      return (
        <div
          className={cn(
            "flex size-6 cursor-pointer items-center justify-center",
            isLoading && "pointer-events-none opacity-50",
          )}
        >
          {isLoading ? (
            <div className="size-3 animate-spin rounded-full border border-gray-300 border-t-transparent" />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      );
    }

    if (selectedAssigneeIds.length === 1) {
      const assignee = allMembers?.find(
        (m) => m.userId === selectedAssigneeIds[0],
      );
      return (
        <Avatar
          className={cn(
            "size-6",
            isLoading && "pointer-events-none opacity-50",
            highlightAssigneeId === selectedAssigneeIds[0] &&
              "ring-primary ring-offset-background ring-2",
          )}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-3 animate-spin rounded-full border border-gray-300 border-t-transparent" />
            </div>
          )}
          <AvatarFallback className="text-xs">
            {getAssigneeInitials(assignee?.user?.name, assignee?.user?.email)}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Multiple assignees - show all avatars with highlighting
    return (
      <div
        className={cn(
          "flex items-center gap-1",
          isLoading && "pointer-events-none opacity-50",
        )}
      >
        {selectedAssigneeIds.slice(0, 3).map((assigneeId, idx) => {
          const assignee = allMembers?.find((m) => m.userId === assigneeId);
          return (
            <Avatar
              key={assigneeId}
              className={cn(
                "size-6",
                idx > 0 && "-ml-2", // Overlap subsequent avatars
                highlightAssigneeId === assigneeId &&
                  "ring-primary ring-offset-background z-10 ring-2",
              )}
            >
              {isLoading && idx === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-3 animate-spin rounded-full border border-gray-300 border-t-transparent" />
                </div>
              )}
              <AvatarFallback className="text-xs">
                {getAssigneeInitials(
                  assignee?.user?.name,
                  assignee?.user?.email,
                )}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {selectedAssigneeIds.length > 3 && (
          <span className="text-muted-foreground ml-1 text-xs">
            +{selectedAssigneeIds.length - 3}
          </span>
        )}
        {/* status match counter */}
        {activeFilter !== "all" && (
          <span className="text-muted-foreground ml-2 text-xs">
            {matchCount}/{selectedAssigneeIds.length}
          </span>
        )}
      </div>
    );
  };

  // Helper function for initials (moved to top of file)
  const getAssigneeInitials = (
    name?: string | null,
    email?: string | null,
  ): string => {
    const displayName = name || email;
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Popover
      open={open && !isLoading}
      onOpenChange={(newOpen) => {
        if (!isLoading) setOpen(newOpen);
      }}
    >
      <PopoverTrigger asChild>
        {trigger || (
          <div
            className={cn(
              "flex cursor-pointer items-center gap-1",
              isLoading && "pointer-events-none",
            )}
          >
            {getDisplayContent()}
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        onOpenAutoFocus={(e) => {
          if (isLoading) e.preventDefault();
        }}
      >
        <Command>
          <CommandInput
            placeholder="Search members…"
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
            disabled={isLoading}
          />
          <CommandList className="p-1">
            {/* Unassign option */}
            {selectedAssigneeIds.length > 0 && (
              <CommandItem
                value="unassign"
                onSelect={handleUnassignAll}
                disabled={isLoading}
              >
                <div className="flex w-full items-center gap-2">
                  <div className="ml-6">
                    {" "}
                    {/* Offset to align with other items that have checkboxes */}
                    <span className="text-muted-foreground">Unassign all</span>
                  </div>
                </div>
              </CommandItem>
            )}

            {/* Members List */}
            {searchResults?.map((member) => {
              const isSelected = selectedAssigneeIds.includes(member.userId);
              const assignment = assignments.find(
                (a) => a.assigneeId === member.userId,
              );
              const StateIcon = assignment?.stateIcon
                ? getDynamicIcon(assignment.stateIcon) || Circle
                : Circle;
              return (
                <CommandItem
                  key={member.userId}
                  value={member.user?.name || member.user?.email}
                  onSelect={() => handleToggleAssignee(member.userId)}
                  disabled={isLoading}
                  className={cn(
                    !canManageAll &&
                      member.userId !== currentUserId &&
                      "pointer-events-none opacity-50",
                  )}
                >
                  <div className="flex w-full items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        handleToggleAssignee(member.userId)
                      }
                      disabled={isLoading}
                    />
                    <Avatar
                      className={cn(
                        "size-6",
                        isLoading && "opacity-50",
                        highlightAssigneeId === member.userId &&
                          "ring-primary ring-offset-background ring-2",
                      )}
                    >
                      <AvatarFallback className="text-xs">
                        {getAssigneeInitials(
                          member.user?.name,
                          member.user?.email,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("flex-1", isLoading && "opacity-50")}>
                      <div className="font-medium">{member.user?.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {member.user?.email}
                      </div>
                    </div>
                    {assignment && (
                      <StateIcon
                        className="size-4"
                        style={{ color: assignment.stateColor || "#94a3b8" }}
                      />
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Multi-Assignment State Selector -------------------------------------------
interface AssignmentInfo {
  assignmentId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  stateId: string | null;
  stateIcon: string | null;
  stateColor: string | null;
  stateName: string | null;
  stateType: string | null;
}

interface MultiAssignmentStateSelectorProps {
  assignments: AssignmentInfo[];
  states: readonly State[] | State[];
  onStateChange: (assignmentId: string, stateId: string) => void;
  isLoading?: boolean;
  trigger?: React.ReactElement;
  currentUserId: string;
  canChangeAll?: boolean;
  activeFilter?: string;
}

export function MultiAssignmentStateSelector({
  assignments,
  states,
  onStateChange,
  isLoading = false,
  trigger,
  currentUserId,
  canChangeAll = false,
  activeFilter,
}: MultiAssignmentStateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeAssignments = assignments.filter((a) => a.assigneeId);

  // Find current user's assignment
  const currentUserAssignment = activeAssignments.find(
    (a) => a.assigneeId === currentUserId,
  );

  // Other assignments (not current user)
  const otherAssignments = activeAssignments.filter(
    (a) => a.assigneeId !== currentUserId,
  );

  // Helper to render trigger content with improved highlighting for active filter
  const renderTriggerContent = (): React.ReactNode => {
    if (assignments.length === 0) {
      return <Circle className="text-muted-foreground size-4" />;
    }

    if (activeAssignments.length === 1) {
      const assignment = activeAssignments[0];
      const StateIcon = assignment.stateIcon
        ? getDynamicIcon(assignment.stateIcon) || Circle
        : Circle;
      const stateColor = assignment.stateColor || "#94a3b8";

      return <StateIcon className="size-4" style={{ color: stateColor }} />;
    }

    // Multiple assignments – show highlighted state prominently if filtering
    const activeFilterAssignments =
      activeFilter !== "all"
        ? activeAssignments.filter((a) => a.stateType === activeFilter)
        : [];

    if (activeFilter !== "all" && activeFilterAssignments.length > 0) {
      // Show the active filter state prominently, with other states as dots
      const primaryAssignment = activeFilterAssignments[0];
      const StateIcon = primaryAssignment.stateIcon
        ? getDynamicIcon(primaryAssignment.stateIcon) || Circle
        : Circle;

      const otherAssignments = activeAssignments.filter(
        (a) => a.stateType !== activeFilter,
      );

      return (
        <div className="flex items-center gap-0.5">
          <StateIcon
            className="size-4"
            style={{ color: primaryAssignment.stateColor || "#94a3b8" }}
          />
          {activeFilterAssignments.length > 1 && (
            <span className="text-primary text-xs font-medium">
              {activeFilterAssignments.length}
            </span>
          )}
          {otherAssignments.slice(0, 2).map((assignment, idx) => (
            <Circle
              key={idx}
              className="size-2 opacity-60"
              style={{ color: assignment.stateColor || "#94a3b8" }}
            />
          ))}
          {otherAssignments.length > 2 && (
            <span className="text-muted-foreground text-xs">
              +{otherAssignments.length - 2}
            </span>
          )}
        </div>
      );
    }

    // Default view for "all" filter or no matching assignments
    const distribution: Record<
      string,
      { color: string; count: number; icon: string | null }
    > = {};
    activeAssignments.forEach((a) => {
      const key = a.stateId || "unknown";
      if (!distribution[key]) {
        distribution[key] = {
          color: a.stateColor || "#94a3b8",
          count: 0,
          icon: a.stateIcon,
        };
      }
      distribution[key].count += 1;
    });

    const entries = Object.values(distribution);

    return (
      <div className="flex items-center gap-0.5">
        {entries.slice(0, 3).map((entry, idx) => {
          const StateIcon = entry.icon
            ? getDynamicIcon(entry.icon) || Circle
            : Circle;
          return (
            <div key={idx} className="flex items-center">
              <StateIcon className="size-3" style={{ color: entry.color }} />
              {entry.count > 1 && (
                <span className="text-muted-foreground ml-0.5 text-xs">
                  {entry.count}
                </span>
              )}
            </div>
          );
        })}
        {entries.length > 3 && (
          <span className="text-muted-foreground text-xs">
            +{entries.length - 3}
          </span>
        )}
      </div>
    );
  };

  const getAssigneeInitials = (
    name?: string | null,
    email?: string | null,
  ): string => {
    const displayName = name || email;
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStateSelect = (assignmentId: string, stateId: string) => {
    onStateChange(assignmentId, stateId);
    setOpen(false);
  };

  return (
    <Popover
      open={open && !isLoading}
      onOpenChange={(o) => !isLoading && setOpen(o)}
    >
      <PopoverTrigger asChild>
        {trigger || (
          <div
            className={cn(
              "flex-shrink-0 cursor-pointer",
              isLoading && "pointer-events-none opacity-50",
            )}
          >
            {renderTriggerContent()}
          </div>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 overflow-visible p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search assignees…"
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
            disabled={isLoading}
          />
          <CommandList>
            {/* Current User Section - Show states directly if they have an assignment */}
            {currentUserAssignment && (
              <CommandGroup heading="Your status">
                {states.map((state) => {
                  const isSelected =
                    state._id === currentUserAssignment.stateId;
                  const StateIcon = state.icon
                    ? getDynamicIcon(state.icon) || Circle
                    : Circle;

                  return (
                    <CommandItem
                      key={state._id}
                      onSelect={() =>
                        handleStateSelect(
                          currentUserAssignment.assignmentId,
                          state._id,
                        )
                      }
                      disabled={isLoading}
                      className="py-2"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <StateIcon
                        className="mr-2 size-4"
                        style={{ color: state.color || "#94a3b8" }}
                      />
                      <span>{state.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Other Assignments Section - Show with hover submenu */}
            {otherAssignments.length > 0 && (
              <CommandGroup heading="Other assignments">
                {otherAssignments
                  .slice()
                  .sort((a, b) => {
                    // Then active filter matches
                    if (activeFilter !== "all") {
                      const aMatches = a.stateType === activeFilter;
                      const bMatches = b.stateType === activeFilter;
                      if (aMatches && !bMatches) return -1;
                      if (bMatches && !aMatches) return 1;
                    }

                    // Then alphabetical
                    const aName = a.assigneeName || a.assigneeEmail || "";
                    const bName = b.assigneeName || b.assigneeEmail || "";
                    return aName.localeCompare(bName);
                  })
                  .map((assignment) => {
                    const displayName =
                      assignment.assigneeName ||
                      assignment.assigneeEmail ||
                      "User";

                    const StateIcon = assignment.stateIcon
                      ? getDynamicIcon(assignment.stateIcon) || Circle
                      : Circle;

                    const canChange = canChangeAll;

                    return (
                      <div key={assignment.assignmentId} className="relative">
                        {canChange ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <CommandItem
                                value={displayName}
                                className="cursor-pointer py-2"
                              >
                                {/* User Avatar */}
                                <div className="bg-muted mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium">
                                  {getAssigneeInitials(
                                    assignment.assigneeName,
                                    assignment.assigneeEmail,
                                  )}
                                </div>

                                {/* User Name */}
                                <span className="flex-1 truncate text-sm font-medium">
                                  {displayName}
                                </span>

                                {/* Current Status */}
                                <div className="ml-2 flex items-center gap-1.5">
                                  <StateIcon
                                    className="size-4"
                                    style={{
                                      color: assignment.stateColor || "#94a3b8",
                                    }}
                                  />
                                  <span className="text-muted-foreground text-sm">
                                    {assignment.stateName}
                                  </span>
                                </div>
                              </CommandItem>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              side="right"
                              align="start"
                              className="w-56"
                            >
                              {states.map((state) => {
                                const isSelected =
                                  state._id === assignment.stateId;
                                const StateIconDM = state.icon
                                  ? getDynamicIcon(state.icon) || Circle
                                  : Circle;

                                return (
                                  <DropdownMenuItem
                                    key={state._id}
                                    disabled={isLoading}
                                    onSelect={() =>
                                      handleStateSelect(
                                        assignment.assignmentId,
                                        state._id,
                                      )
                                    }
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-3 w-3",
                                        isSelected
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    <StateIconDM
                                      className="mr-2 size-4"
                                      style={{
                                        color: state.color || "#94a3b8",
                                      }}
                                    />
                                    {state.name}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <CommandItem
                            value={displayName}
                            disabled
                            className="cursor-default py-2 opacity-60"
                          >
                            {/* User Avatar */}
                            <div className="bg-muted mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium">
                              {getAssigneeInitials(
                                assignment.assigneeName,
                                assignment.assigneeEmail,
                              )}
                            </div>

                            <span className="flex-1 truncate text-sm font-medium">
                              {displayName}
                            </span>

                            <div className="ml-2 flex items-center gap-1.5">
                              <StateIcon
                                className="size-4"
                                style={{
                                  color: assignment.stateColor || "#94a3b8",
                                }}
                              />
                              <span className="text-muted-foreground text-sm">
                                {assignment.stateName}
                              </span>
                              <span className="text-muted-foreground ml-1 text-xs">
                                (view only)
                              </span>
                            </div>
                          </CommandItem>
                        )}
                      </div>
                    );
                  })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Users,
  FolderOpen,
  Check,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";

// Extracted selector components
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
  AssigneeSelector,
  DateSelector,
  TimeEstimatesSelector,
} from "./issue-selectors";

// ---------------------------------------------------------------------------
// 🧩 Type inference – derive types directly from tRPC router outputs
// ---------------------------------------------------------------------------

// Key Format Selector Component
interface KeyFormatSelectorProps {
  manualFormatOverride: "team" | "project" | "org" | null;
  setManualFormatOverride: (value: "team" | "project" | "org" | null) => void;
  preview: string;
}

function KeyFormatSelector({
  manualFormatOverride,
  setManualFormatOverride,
  preview,
}: KeyFormatSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-muted/50 h-6 w-6 rounded-md p-0"
          >
            <MoreHorizontal className="text-muted-foreground h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1">
          <DropdownMenuItem
            onClick={() => setManualFormatOverride(null)}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {!manualFormatOverride && (
                    <Check className="text-primary h-3 w-3" />
                  )}
                </div>
                Auto-detect format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("org")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "org" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <Building2 className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                Org format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("team")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "team" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <Users className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                Team format
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setManualFormatOverride("project")}
            className="cursor-pointer rounded-sm px-3 py-2 text-sm"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center">
                  {manualFormatOverride === "project" ? (
                    <Check className="text-primary h-3 w-3" />
                  ) : (
                    <FolderOpen className="text-muted-foreground h-3 w-3" />
                  )}
                </div>
                Project format
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {manualFormatOverride && (
        <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
          <div className="h-1 w-1 rounded-full bg-orange-500" />
          forced
        </span>
      )}
      <code className="bg-muted flex h-8 items-center rounded-md px-2.5 font-mono text-sm">
        {preview}
      </code>
    </div>
  );
}

interface CreateIssueDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (issueId: string) => void;
}

function CreateIssueDialogContent({
  orgSlug,
  onClose,
  onSuccess,
}: CreateIssueDialogContentProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [manualFormatOverride, setManualFormatOverride] = useState<
    "team" | "project" | "org" | null
  >(null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedTimes, setEstimatedTimes] = useState<{
    [key: string]: number;
  }>({});

  const utils = trpc.useUtils();

  // ---------------------------------------------
  //   Fetch data (teams, projects, states)
  // ---------------------------------------------
  // Get teams and projects data
  const { data: teams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });
  const { data: projects = [] } = trpc.organization.listProjects.useQuery({
    orgSlug,
  });
  const { data: states = [] } = trpc.organization.listIssueStates.useQuery({
    orgSlug,
  });
  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });
  const { data: priorities = [] } =
    trpc.organization.listIssuePriorities.useQuery({ orgSlug });

  // Auto-infer the format based on selections
  const getEffectiveFormat = (): "team" | "project" | "org" => {
    // Manual override takes precedence
    if (manualFormatOverride) {
      return manualFormatOverride;
    }

    // Auto-infer: Project > Team > Org
    if (selectedProject) {
      return "project";
    }
    if (selectedTeam) {
      return "team";
    }
    return "org";
  };

  const effectiveFormat = getEffectiveFormat();

  // Auto-select the first "todo" state as default
  useEffect(() => {
    if (states.length > 0 && !selectedState) {
      const defaultState =
        states.find((state) => state.type === "todo") || states[0];
      setSelectedState(defaultState.id);
    }
  }, [states, selectedState]);

  // Auto-select default priority (weight === 0) once priorities load
  useEffect(() => {
    if (priorities.length > 0 && !selectedPriority) {
      const defaultPriority =
        priorities.find((p) => p.weight === 0) || priorities[0];
      if (defaultPriority) {
        setSelectedPriority(defaultPriority.id);
      }
    }
  }, [priorities, selectedPriority]);

  const createMutation = trpc.issue.create.useMutation({
    onSuccess: (result) => {
      // Refresh only issue-related queries so the UI updates without nuking
      // unrelated cache entries.
      Promise.all([
        utils.organization.listIssues.invalidate({ orgSlug }),
        utils.organization.listIssuesPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
      onSuccess?.(result.id);
      onClose();
    },
    onError: (e) => console.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Validate required selections based on effective format
    if (effectiveFormat === "team" && !selectedTeam) {
      alert("Please select a team for team-based issue keys");
      return;
    }
    if (effectiveFormat === "project" && !selectedProject) {
      alert("Please select a project for project-based issue keys");
      return;
    }

    createMutation.mutate({
      orgSlug,
      title: title.trim(),
      description: description.trim() || undefined,
      teamId: selectedTeam || undefined,
      projectId: selectedProject || undefined,
      stateId: selectedState,
      priorityId: selectedPriority || undefined,
      assigneeId:
        selectedAssignees.length > 0 ? selectedAssignees[0] : undefined,
      issueKeyFormat: effectiveFormat,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      estimatedTimes:
        Object.keys(estimatedTimes).length > 0 ? estimatedTimes : undefined,
    });
  };

  const getIssueKeyPreview = () => {
    const nextNumber = 1; // Placeholder for preview

    // Show different examples based on manual override
    if (manualFormatOverride === "team") {
      const team = teams.find((t) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (manualFormatOverride === "project") {
      const project = projects.find((p) => p.id === selectedProject);
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    if (manualFormatOverride === "org") {
      return `${orgSlug.toUpperCase()}-${nextNumber}`;
    }

    // Auto-detect logic (original behavior)
    if (effectiveFormat === "team" && selectedTeam) {
      const team = teams.find((t) => t.id === selectedTeam);
      return team ? `${team.key}-${nextNumber}` : `TEAM-${nextNumber}`;
    }
    if (effectiveFormat === "project" && selectedProject) {
      const project = projects.find((p) => p.id === selectedProject);
      return project ? `${project.key}-${nextNumber}` : `PROJ-${nextNumber}`;
    }
    // Org default
    return `${orgSlug.toUpperCase()}-${nextNumber}`;
  };

  const isDateRangeValid =
    !startDate || !dueDate || new Date(startDate) <= new Date(dueDate);

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-2xl">
        <DialogHeader className="">
          <DialogTitle className="flex items-center">
            <div className="text-muted-foreground flex w-full items-center gap-2 text-sm">
              {/* Properties Row */}
              <div className="flex flex-wrap gap-2">
                <TeamSelector
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onTeamSelect={setSelectedTeam}
                  displayMode="iconWhenUnselected"
                />

                <AssigneeSelector
                  members={members}
                  selectedAssignees={selectedAssignees}
                  onAssigneesSelect={setSelectedAssignees}
                  displayMode="iconWhenUnselected"
                  multiple={true}
                />

                <ProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />

                <StateSelector
                  states={states}
                  selectedState={selectedState}
                  onStateSelect={setSelectedState}
                />

                <PrioritySelector
                  priorities={priorities}
                  selectedPriority={selectedPriority}
                  onPrioritySelect={setSelectedPriority}
                />

                <DateSelector
                  selectedDate={startDate}
                  onDateSelect={setStartDate}
                  placeholder="Start date"
                  displayMode="iconWhenUnselected"
                />

                <DateSelector
                  selectedDate={dueDate}
                  onDateSelect={setDueDate}
                  placeholder="Due date"
                  displayMode="iconWhenUnselected"
                />

                <TimeEstimatesSelector
                  estimatedTimes={estimatedTimes}
                  onEstimatedTimesChange={setEstimatedTimes}
                  states={states}
                  displayMode="iconWhenUnselected"
                />
              </div>
              <div className="ml-auto">
                <KeyFormatSelector
                  manualFormatOverride={manualFormatOverride}
                  setManualFormatOverride={setManualFormatOverride}
                  preview={getIssueKeyPreview()}
                />
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <Input
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base"
            autoFocus
          />

          {/* Description */}
          <Textarea
            placeholder="Add description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        </form>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              !title.trim() ||
              createMutation.isPending ||
              (effectiveFormat === "team" && !selectedTeam) ||
              (effectiveFormat === "project" && !selectedProject) ||
              !isDateRangeValid
            }
            title={
              !title.trim()
                ? "Title is required"
                : !selectedState
                  ? "State is required"
                  : !isDateRangeValid
                    ? "Start date must be before or equal to due date"
                    : ""
            }
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Creating…" : "Create issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 🖱️ Public wrapper — handles trigger button + open state
// ---------------------------------------------------------------------------

export interface CreateIssueDialogProps {
  /** Organization slug the issue belongs to */
  orgSlug: string;
  /** Optional callback fired after the issue is successfully created */
  onIssueCreated?: () => void;
  /** Visual style of trigger button */
  variant?: "default" | "floating";
  /** Additional classes for the trigger button */
  className?: string;
}

export function CreateIssueDialog({
  orgSlug,
  onIssueCreated,
  variant = "default",
  className,
}: CreateIssueDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onIssueCreated?.();
    setIsDialogOpen(false);
  };

  const trigger =
    variant === "floating" ? (
      <Button
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          "h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl",
          className,
        )}
        size="icon"
      >
        <Plus className="h-5 w-5" />
      </Button>
    ) : (
      <Button
        size="sm"
        onClick={() => setIsDialogOpen(true)}
        className={cn("gap-1 rounded-sm text-sm", className)}
        variant="outline"
      >
        <Plus className="size-4" />
      </Button>
    );

  return (
    <>
      {trigger}
      {isDialogOpen && (
        <CreateIssueDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

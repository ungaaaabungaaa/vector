"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Simplified selector components for teams, leads, and status
import {
  TeamSelector,
  AssigneeSelector,
} from "@/components/issues/issue-selectors";
import { StatusSelector } from "@/components/projects/project-selectors";

interface CreateProjectDialogContentProps {
  orgSlug: string;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

function CreateProjectDialogContent({
  orgSlug,
  onClose,
  onSuccess,
}: CreateProjectDialogContentProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const utils = trpc.useUtils();

  // Get teams and organization members
  const { data: teams = [] } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });
  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  // Get project statuses from organization
  const { data: statuses = [] } =
    trpc.organization.listProjectStatuses.useQuery({
      orgSlug,
    });

  // Auto-select default status (type "planned" or first)
  useEffect(() => {
    if (statuses.length > 0 && !selectedStatus) {
      const defaultStatus =
        statuses.find((s) => s.type === "planned") || statuses[0];
      setSelectedStatus(defaultStatus.id);
    }
  }, [statuses, selectedStatus]);

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (result) => {
      Promise.all([
        utils.organization.listProjects.invalidate({ orgSlug }),
        utils.organization.listProjectsPaged.invalidate({ orgSlug }),
      ]).catch(() => {});
      onSuccess?.(result.id);
      onClose();
    },
    onError: (e) => console.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    createMutation.mutate({
      orgSlug,
      name: name.trim(),
      key: key.trim(),
      description: description.trim() || undefined,
      teamId: selectedTeam || undefined,
      leadId: selectedLead || undefined,
      statusId: selectedStatus || undefined,
    });
  };

  // Auto-generate key from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate key similar to team dialog
    setKey(
      value
        .replace(/\s+/g, "-") // replace spaces with hyphens
        .replace(/[^A-Z0-9-]/gi, "") // allow only alphanumeric and hyphens
        .slice(0, 20) // max 20 chars for projects
        .toLowerCase(), // projects use lowercase
    );
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Project Name */}
          <div className="relative">
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="pr-20 text-base"
              autoFocus
            />
            <span className="text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs">
              Name
            </span>
          </div>

          {/* Project Key */}
          <div className="relative">
            <Input
              placeholder="project-key"
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toLowerCase().slice(0, 20))
              }
              maxLength={20}
              className="h-9 pr-20 text-base"
            />
            <span className="text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs">
              Key
            </span>
          </div>

          {/* Properties Row */}
          <div className="flex flex-wrap gap-2 py-2">
            <TeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              onTeamSelect={setSelectedTeam}
              displayMode="iconWhenUnselected"
            />

            <AssigneeSelector
              members={members}
              selectedAssignee={selectedLead}
              onAssigneeSelect={setSelectedLead}
              displayMode="iconWhenUnselected"
            />

            <StatusSelector
              statuses={statuses}
              selectedStatus={selectedStatus}
              onStatusSelect={setSelectedStatus}
              displayMode="iconWhenUnselected"
            />
          </div>

          {/* Description */}
          <div className="relative">
            <Textarea
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[120px] w-full resize-none rounded-md border px-3 py-2 pr-20 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <span className="text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs">
              Description
            </span>
          </div>
        </form>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || !key.trim() || createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Public wrapper component
export interface CreateProjectDialogProps {
  /** Organization slug the project belongs to */
  orgSlug: string;
  /** Optional callback fired after the project is successfully created */
  onProjectCreated?: () => void;
  /** Visual style of trigger button */
  variant?: "default" | "floating";
  /** Additional classes for the trigger button */
  className?: string;
}

export function CreateProjectDialog({
  orgSlug,
  onProjectCreated,
  variant = "default",
  className,
}: CreateProjectDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSuccess = () => {
    onProjectCreated?.();
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
        <CreateProjectDialogContent
          orgSlug={orgSlug}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

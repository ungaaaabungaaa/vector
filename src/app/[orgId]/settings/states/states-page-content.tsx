"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2, Plus, Clock, Pencil } from "lucide-react";
import {
  StatesManagementDialog,
  StatesManagementPopover,
} from "@/components/organization";
import {
  PrioritiesManagementDialog,
  PrioritiesManagementPopover,
} from "@/components/organization";
import { issueStateTypeEnum } from "@/db/schema/issue-config";
import { projectStatusTypeEnum } from "@/db/schema/projects";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getDynamicIcon } from "@/lib/dynamic-icons";

interface WorkflowState {
  id: string;
  name: string;
  position: number;
  color: string | null;
  icon: string | null;
  type: string;
}

interface Priority {
  id: string;
  name: string;
  weight: number;
  color: string | null;
  icon: string | null;
}

interface StatesPageContentProps {
  orgSlug: string;
}

// Extract enum values from schema
const ISSUE_STATE_TYPES = issueStateTypeEnum.enumValues;
const PROJECT_STATUS_TYPES = projectStatusTypeEnum.enumValues;

// Helper function to get type label from enum value
const getTypeLabel = (type: string) => {
  // Convert snake_case to Title Case
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Group states by type
const groupStatesByType = (
  states: readonly WorkflowState[],
  isIssue: boolean,
) => {
  const types = isIssue ? ISSUE_STATE_TYPES : PROJECT_STATUS_TYPES;
  return types.map((type) => ({
    type,
    label: getTypeLabel(type),
    states: states.filter((state) => state.type === type),
  }));
};

export function StatesPageContent({ orgSlug }: StatesPageContentProps) {
  const utils = trpc.useUtils();

  const { data: issueStates = [] } = trpc.organization.listIssueStates.useQuery(
    {
      orgSlug,
    },
  );
  const { data: projectStatuses = [] } =
    trpc.organization.listProjectStatuses.useQuery({ orgSlug });

  const { data: priorities = [] } =
    trpc.organization.listIssuePriorities.useQuery({ orgSlug });

  const createIssueState = trpc.organization.createIssueState.useMutation({
    onSuccess: () => {
      utils.organization.listIssueStates
        .invalidate({ orgSlug })
        .catch(() => {});
    },
  });

  const updateIssueState = trpc.organization.updateIssueState.useMutation({
    onSuccess: () => {
      utils.organization.listIssueStates
        .invalidate({ orgSlug })
        .catch(() => {});
    },
  });

  const createProjectStatus = trpc.organization.createProjectStatus.useMutation(
    {
      onSuccess: () => {
        utils.organization.listProjectStatuses
          .invalidate({ orgSlug })
          .catch(() => {});
      },
    },
  );

  const updateProjectStatus = trpc.organization.updateProjectStatus.useMutation(
    {
      onSuccess: () => {
        utils.organization.listProjectStatuses
          .invalidate({ orgSlug })
          .catch(() => {});
      },
    },
  );

  const resetIssueMutation = trpc.organization.resetIssueStates.useMutation({
    onSuccess: () => {
      utils.organization.listIssueStates
        .invalidate({ orgSlug })
        .catch(() => {});
      toast.success("Issue states reset to defaults");
    },
  });

  const resetStatusMutation =
    trpc.organization.resetProjectStatuses.useMutation({
      onSuccess: () => {
        utils.organization.listProjectStatuses
          .invalidate({ orgSlug })
          .catch(() => {});
        toast.success("Project statuses reset to defaults");
      },
    });

  const createPriority = trpc.organization.createIssuePriority.useMutation({
    onSuccess: () => {
      utils.organization.listIssuePriorities
        .invalidate({ orgSlug })
        .catch(() => {});
    },
  });

  const updatePriority = trpc.organization.updateIssuePriority.useMutation({
    onSuccess: () => {
      utils.organization.listIssuePriorities
        .invalidate({ orgSlug })
        .catch(() => {});
    },
  });

  const resetPriorities = trpc.organization.resetIssuePriorities.useMutation({
    onSuccess: () => {
      utils.organization.listIssuePriorities
        .invalidate({ orgSlug })
        .catch(() => {});
      toast.success("Priorities reset to defaults");
    },
  });

  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: "issue" | "project";
    editingState?: WorkflowState;
  }>({
    isOpen: false,
    type: "issue",
  });

  const [priorityDialogState, setPriorityDialogState] = useState<{
    isOpen: boolean;
    editingPriority?: Priority;
  }>({
    isOpen: false,
  });

  const handleAddState = (type: "issue" | "project") => {
    // For adding new states, we'll still use the dialog
    setDialogState({
      isOpen: true,
      type,
      editingState: undefined,
    });
  };

  const handleSaveState = (
    newStateData: Omit<WorkflowState, "id">,
    editingState?: WorkflowState,
    type?: "issue" | "project",
  ) => {
    const isEditing = !!editingState;
    const stateType = type || dialogState.type;

    if (isEditing) {
      // Update existing
      if (stateType === "issue") {
        updateIssueState.mutate({
          orgSlug,
          stateId: editingState!.id,
          name: newStateData.name,
          position: newStateData.position,
          color: newStateData.color ?? "#94a3b8",
          icon: newStateData.icon,
          type: newStateData.type,
        });
      } else {
        updateProjectStatus.mutate({
          orgSlug,
          statusId: editingState!.id,
          name: newStateData.name,
          position: newStateData.position,
          color: newStateData.color ?? "#94a3b8",
          icon: newStateData.icon,
          type: newStateData.type,
        });
      }
    } else {
      // Create new
      if (stateType === "issue") {
        createIssueState.mutate({
          orgSlug,
          name: newStateData.name,
          position: newStateData.position,
          color: newStateData.color ?? "#94a3b8",
          icon: newStateData.icon,
          type: newStateData.type,
        });
      } else {
        createProjectStatus.mutate({
          orgSlug,
          name: newStateData.name,
          position: newStateData.position,
          color: newStateData.color ?? "#94a3b8",
          icon: newStateData.icon,
          type: newStateData.type,
        });
      }
    }

    // Only close dialog if we're in dialog mode
    if (!editingState && !type) {
      setDialogState({ isOpen: false, type: "issue" });
    }
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: "issue" });
  };

  const handleAddPriority = () => {
    setPriorityDialogState({ isOpen: true });
  };

  const handleSavePriority = (data: Omit<Priority, "id">) => {
    if (priorityDialogState.editingPriority) {
      updatePriority.mutate({
        orgSlug,
        priorityId: priorityDialogState.editingPriority.id,
        name: data.name,
        weight: data.weight,
        color: data.color ?? "#94a3b8",
        icon: data.icon,
      });
    } else {
      createPriority.mutate({
        orgSlug,
        name: data.name,
        weight: data.weight,
        color: data.color ?? "#94a3b8",
        icon: data.icon,
      });
    }

    setPriorityDialogState({ isOpen: false });
  };

  const closePriorityDialog = () => setPriorityDialogState({ isOpen: false });

  const issueGroups = groupStatesByType(issueStates as WorkflowState[], true);
  const projectGroups = groupStatesByType(
    projectStatuses as WorkflowState[],
    false,
  );

  return (
    <div className="p-4">
      {/* Issue States Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="text-muted-foreground size-5" />
            <h2 className="text-lg font-semibold">Issue States</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetIssueMutation.mutate({ orgSlug })}
              className="h-7 text-xs"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => handleAddState("issue")}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 size-3" />
              Add State
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {issueGroups.map((group) => (
            <div key={group.type} className="space-y-1">
              <div>
                <h3 className="text-foreground text-sm font-medium">
                  {group.label}
                </h3>
              </div>

              <div className="space-y-1">
                {group.states.map((state) => (
                  <StatesManagementPopover
                    key={state.id}
                    type="issue"
                    state={state}
                    existingStates={issueStates as WorkflowState[]}
                    orgSlug={orgSlug}
                    onClose={() => {}}
                    onSave={(data) => handleSaveState(data, state, "issue")}
                  >
                    <button className="bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors">
                      {state.icon ? (
                        (() => {
                          const IconComponent =
                            getDynamicIcon(state.icon) ?? null;
                          return IconComponent ? (
                            <IconComponent
                              className="size-3 flex-shrink-0"
                              style={{ color: state.color || "#94a3b8" }}
                            />
                          ) : (
                            <div
                              className="size-2.5 flex-shrink-0 rounded-full"
                              style={{
                                backgroundColor: state.color || "#94a3b8",
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div
                          className="size-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: state.color || "#94a3b8" }}
                        />
                      )}
                      <span className="flex-1 truncate text-xs font-medium">
                        {state.name}
                      </span>
                      <Pencil className="text-muted-foreground group-hover:text-foreground size-3 opacity-0 transition-colors group-hover:opacity-100" />
                    </button>
                  </StatesManagementPopover>
                ))}
                {group.states.length === 0 && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs italic">
                    No states configured
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Statuses Section */}
      <div className="mt-20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-5" />
            <h2 className="text-lg font-semibold">Project Statuses</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetStatusMutation.mutate({ orgSlug })}
              className="h-7 text-xs"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => handleAddState("project")}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 size-3" />
              Add Status
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {projectGroups.map((group) => (
            <div key={group.type} className="space-y-1">
              <div>
                <h3 className="text-foreground text-sm font-medium">
                  {group.label}
                </h3>
              </div>

              <div className="space-y-1">
                {group.states.map((status) => (
                  <StatesManagementPopover
                    key={status.id}
                    type="project"
                    state={status}
                    existingStates={projectStatuses as WorkflowState[]}
                    orgSlug={orgSlug}
                    onClose={() => {}}
                    onSave={(data) => handleSaveState(data, status, "project")}
                  >
                    <button className="bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors">
                      {status.icon ? (
                        (() => {
                          const IconComponent =
                            getDynamicIcon(status.icon) ?? null;
                          return IconComponent ? (
                            <IconComponent
                              className="size-3 flex-shrink-0"
                              style={{ color: status.color || "#94a3b8" }}
                            />
                          ) : (
                            <div
                              className="size-2.5 flex-shrink-0 rounded-full"
                              style={{
                                backgroundColor: status.color || "#94a3b8",
                              }}
                            />
                          );
                        })()
                      ) : (
                        <div
                          className="size-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: status.color || "#94a3b8" }}
                        />
                      )}
                      <span className="flex-1 truncate text-xs font-medium">
                        {status.name}
                      </span>
                      <Pencil className="text-muted-foreground group-hover:text-foreground size-3 opacity-0 transition-colors group-hover:opacity-100" />
                    </button>
                  </StatesManagementPopover>
                ))}
                {group.states.length === 0 && (
                  <div className="text-muted-foreground px-2 py-1.5 text-xs italic">
                    No statuses configured
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issue Priorities Section */}
      <div className="mt-20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="text-muted-foreground size-5" />
            <h2 className="text-lg font-semibold">Issue Priorities</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetPriorities.mutate({ orgSlug })}
              className="h-7 text-xs"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleAddPriority}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 size-3" />
              Add Priority
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {priorities.map((priority) => (
            <PrioritiesManagementPopover
              key={priority.id}
              priority={priority as Priority}
              existingPriorities={priorities as Priority[]}
              orgSlug={orgSlug}
              onClose={() => {}}
              onSave={(data) => handleSavePriority(data)}
            >
              <button className="bg-background hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors">
                {priority.icon ? (
                  (() => {
                    const IconComponent = getDynamicIcon(priority.icon) ?? null;
                    return IconComponent ? (
                      <IconComponent
                        className="size-3 flex-shrink-0"
                        style={{ color: priority.color || "#94a3b8" }}
                      />
                    ) : (
                      <span
                        className="size-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: priority.color || "#94a3b8" }}
                      />
                    );
                  })()
                ) : (
                  <span
                    className="size-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: priority.color || "#94a3b8" }}
                  />
                )}
                <span className="truncate text-sm font-medium">
                  {priority.name}
                </span>

                <span className="text-muted-foreground ml-auto text-xs">
                  {priority.weight}
                </span>
              </button>
            </PrioritiesManagementPopover>
          ))}
          {priorities.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-xs italic">
              No priorities configured
            </div>
          )}
        </div>
      </div>

      {dialogState.isOpen && (
        <StatesManagementDialog
          type={dialogState.type}
          state={dialogState.editingState}
          existingStates={
            (dialogState.type === "issue"
              ? issueStates
              : projectStatuses) as WorkflowState[]
          }
          orgSlug={orgSlug}
          onClose={closeDialog}
          onSave={(data) => handleSaveState(data)}
        />
      )}

      {/* Priorities Dialog */}
      {priorityDialogState.isOpen && (
        <PrioritiesManagementDialog
          priority={priorityDialogState.editingPriority}
          existingPriorities={priorities as Priority[]}
          onClose={closePriorityDialog}
          onSave={handleSavePriority}
          orgSlug={orgSlug}
        />
      )}
    </div>
  );
}

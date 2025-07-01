"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, User } from "lucide-react";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { cn } from "@/lib/utils";
import { StateSelector, AssigneeSelector } from "./issue-selectors";
import type { Member, State } from "./issue-selectors";

// Helper to derive initials from a name/email
function getAssigneeInitials(
  name?: string | null,
  email?: string | null,
): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface IssueAssignmentsProps {
  issueId: string;
  states: State[];
  members: Member[];
  defaultStateId: string;
}

export function IssueAssignments({
  issueId,
  states,
  members,
  defaultStateId,
}: IssueAssignmentsProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch assignments for this issue
  const { data: assignments = [], refetch } =
    trpc.issue.getAssignments.useQuery({ issueId });

  // Mutations
  const addAssigneeMutation = trpc.issue.addAssignee.useMutation({
    onSuccess: () => {
      refetch();
      setAddDialogOpen(false);
    },
  });

  const changeAssignmentStateMutation =
    trpc.issue.changeAssignmentState.useMutation({
      onSuccess: () => refetch(),
    });

  const updateAssignmentAssigneeMutation =
    trpc.issue.updateAssignmentAssignee.useMutation({
      onSuccess: () => refetch(),
    });

  const removeAssignmentMutation =
    trpc.issue.updateAssignmentAssignee.useMutation({
      onSuccess: () => refetch(),
    });

  // Helper to filter members so the same user cannot be assigned twice
  const assignedUserIds = assignments
    .map((a) => a.assigneeId)
    .filter((id): id is string => !!id);

  const availableMembers = members.filter(
    (m) => !assignedUserIds.includes(m.userId),
  );

  const handleAddAssignee = (assigneeId: string) => {
    addAssigneeMutation.mutate({
      issueId,
      assigneeId: assigneeId || undefined,
      stateId: defaultStateId,
    });
  };

  const handleStateChange = (assignmentId: string, stateId: string) => {
    changeAssignmentStateMutation.mutate({
      assignmentId,
      stateId,
    });
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    removeAssignmentMutation.mutate({
      assignmentId,
      assigneeId: null,
    });
  };

  const handleUpdateAssignee = (assignmentId: string, assigneeId: string) => {
    updateAssignmentAssigneeMutation.mutate({
      assignmentId,
      assigneeId: assigneeId || null,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b px-1 py-1 pl-2">
        <h4 className="text-sm">Assignees</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="h-6 gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Assignments list - matching issues table design */}
      <div className="divide-y">
        {assignments.map((assignment) => {
          const StateIcon = assignment.stateIcon
            ? getDynamicIcon(assignment.stateIcon)
            : null;
          const stateColor = assignment.stateColor || "#94a3b8";

          return (
            <div
              key={assignment.id}
              className="hover:bg-muted/50 flex items-center gap-3 p-2 transition-colors"
            >
              {/* Assignee - clickable like issues table */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <AssigneeSelector
                  members={members.filter(
                    (m) =>
                      m.userId === assignment.assigneeId ||
                      !assignedUserIds.includes(m.userId),
                  )}
                  selectedAssignee={assignment.assigneeId || ""}
                  onAssigneeSelect={(userId) =>
                    handleUpdateAssignee(assignment.id, userId)
                  }
                  displayMode="labelOnly"
                  trigger={
                    <div className="hover:bg-muted/30 -m-1 flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors">
                      {assignment.assigneeId ? (
                        <>
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {getAssigneeInitials(
                                assignment.assigneeName,
                                assignment.assigneeEmail,
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm">
                            {assignment.assigneeName}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="bg-muted flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full">
                            <User className="text-muted-foreground h-3 w-3" />
                          </div>
                          <span className="text-muted-foreground text-sm">
                            Unassigned
                          </span>
                        </>
                      )}
                    </div>
                  }
                />
              </div>

              {/* State badge - clickable like issues table */}
              <StateSelector
                states={states}
                selectedState={assignment.stateId}
                onStateSelect={(stateId) =>
                  handleStateChange(assignment.id, stateId)
                }
                align="end"
                className="border-none bg-transparent p-0 shadow-none"
              />

              {/* Remove button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAssignment(assignment.id)}
                className="text-muted-foreground hover:text-destructive h-6 w-6 flex-shrink-0 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="text-muted-foreground py-6 text-center">
          <User className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No assignees yet</p>
          <p className="text-xs">Click "Add" to assign someone to this issue</p>
        </div>
      )}

      {/* Add assignee dialog - matching create-issue-dialog style */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="gap-2 p-2 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Assignee</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {availableMembers.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center">
                <User className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">All members already assigned</p>
                <p className="text-xs">
                  Everyone in your team is already working on this issue
                </p>
              </div>
            ) : (
              <AssigneeSelector
                members={availableMembers}
                selectedAssignee=""
                onAssigneeSelect={handleAddAssignee}
                displayMode="default"
                trigger={
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-start"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Select assignee
                  </Button>
                }
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

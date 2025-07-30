"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Check,
  ChevronsUpDown,
  UserPlus,
  MoreHorizontal,
  Trash2,
  Users,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { FunctionReturnType } from "convex/server";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Section component that renders the list of project members and allows adding/removing members.
 * Uses Convex queries and mutations.
 */
export function ProjectMembersSection({
  orgSlug,
  projectKey,
  canEdit = true,
}: {
  orgSlug: string;
  projectKey: string;
  canEdit?: boolean;
}) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  const project = useQuery(api.projects.getByKey, { orgSlug, projectKey });
  const projectId = project?._id;

  // Fetch members for this project
  const members =
    useQuery(api.projects.listMembers, projectId ? { projectId } : "skip") ??
    [];

  // Fetch organization members for filtering
  const orgMembers =
    useQuery(api.organizations.listMembers, {
      orgSlug,
    }) ?? [];

  const removeMemberMutation = useMutation(api.projects.removeMember);

  const handleRemoveMember = (membershipId: Id<"projectMembers">) => {
    if (!confirm("Remove this member from the project?")) return;
    removeMemberMutation({ membershipId });
  };

  if (members === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground text-sm">Loading members...</div>
      </div>
    );
  }

  const hasMembers = members.length > 0;

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4" />
          Members ({members.length})
          {canEdit && (
            <Button
              onClick={() => setShowAddMemberDialog(true)}
              className="h-5 gap-1 px-0 text-xs"
              variant="outline"
              disabled={
                orgMembers.filter(
                  (member) =>
                    !members.some(
                      (projectMember) => projectMember.userId === member.userId,
                    ),
                ).length === 0
              }
              title={
                orgMembers.filter(
                  (member) =>
                    !members.some(
                      (projectMember) => projectMember.userId === member.userId,
                    ),
                ).length === 0
                  ? "All organization members are already in this project"
                  : ""
              }
            >
              <Plus className="size-3" />
            </Button>
          )}
        </h2>
      </div>

      {hasMembers ? (
        <div className="rounded-lg border">
          <MembersList
            members={members}
            canEdit={canEdit}
            onRemoveMember={handleRemoveMember}
            removePending={false}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <Users className="text-muted-foreground/50 h-16 w-16" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No members yet</h3>
            <p className="text-muted-foreground mb-6">
              Add project members to get started.
            </p>
            {canEdit && (
              <Button
                onClick={() => setShowAddMemberDialog(true)}
                disabled={
                  orgMembers.filter(
                    (member) =>
                      !members.some(
                        (projectMember) =>
                          projectMember.userId === member.userId,
                      ),
                  ).length === 0
                }
                title={
                  orgMembers.filter(
                    (member) =>
                      !members.some(
                        (projectMember) =>
                          projectMember.userId === member.userId,
                      ),
                  ).length === 0
                    ? "All organization members are already in this project"
                    : ""
                }
              >
                <Plus className="mr-2 size-3" />
                Add member
              </Button>
            )}
          </div>
        </div>
      )}

      {showAddMemberDialog && (
        <AddMemberDialog
          orgSlug={orgSlug}
          projectKey={projectKey}
          onClose={() => setShowAddMemberDialog(false)}
        />
      )}
    </div>
  );
}

// ------------------------------
// Add Member Dialog
// ------------------------------
function AddMemberDialog({
  orgSlug,
  projectKey,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  onClose: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [memberComboboxOpen, setMemberComboboxOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const orgMembers =
    useQuery(api.organizations.listMembers, {
      orgSlug,
    }) ?? [];

  const project = useQuery(api.projects.getByKey, { orgSlug, projectKey });
  const projectId = project?._id;

  // Fetch current project members to filter them out
  const projectMembers =
    useQuery(api.projects.listMembers, projectId ? { projectId } : "skip") ??
    [];

  const addMemberMutation = useMutation(api.projects.addMember);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setIsAddingMember(true);
    try {
      await addMemberMutation({
        projectId: projectId!,
        userId: selectedMember as Id<"users">,
        role: "member",
      });
      onClose();
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogHeader className="sr-only">
        <DialogTitle>Add project member</DialogTitle>
      </DialogHeader>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Member Selection */}
          <div className="relative">
            <Popover
              open={memberComboboxOpen}
              onOpenChange={setMemberComboboxOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={memberComboboxOpen}
                  className="h-9 w-full justify-between pr-20 text-base"
                >
                  {selectedMember
                    ? orgMembers.find((m) => m.userId === selectedMember)?.user
                        ?.name
                    : "Select member..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-h-[200px] w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search member..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {orgMembers.filter(
                        (member) =>
                          !projectMembers.some(
                            (projectMember) =>
                              projectMember.userId === member.userId,
                          ),
                      ).length === 0
                        ? "All organization members are already in this project"
                        : "No member found"}
                    </CommandEmpty>
                    <CommandGroup>
                      {orgMembers
                        .filter(
                          (member) =>
                            !projectMembers.some(
                              (projectMember) =>
                                projectMember.userId === member.userId,
                            ),
                        )
                        .map((member) => (
                          <CommandItem
                            key={member.userId}
                            value={member.user?.name ?? ""}
                            onSelect={() => {
                              setSelectedMember(member.userId);
                              setMemberComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMember === member.userId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {member.user?.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs">
              Member
            </span>
          </div>
        </form>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              !selectedMember ||
              isAddingMember ||
              orgMembers.filter(
                (member) =>
                  !projectMembers.some(
                    (projectMember) => projectMember.userId === member.userId,
                  ),
              ).length === 0
            }
            onClick={handleSubmit}
            title={
              orgMembers.filter(
                (member) =>
                  !projectMembers.some(
                    (projectMember) => projectMember.userId === member.userId,
                  ),
              ).length === 0
                ? "All organization members are already in this project"
                : ""
            }
          >
            {isAddingMember ? "Adding…" : "Add member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------
// Members List Component
// ------------------------------
type ProjectMember = FunctionReturnType<
  typeof api.projects.listMembers
>[number];

function MembersList({
  members,
  onRemoveMember,
  removePending,
  canEdit,
}: {
  members: ProjectMember[];
  onRemoveMember?: (membershipId: Id<"projectMembers">) => void;
  removePending?: boolean;
  canEdit: boolean;
}) {
  const user = useQuery(api.users.currentUser);
  const currentUserId = user?._id;

  const getInitials = (name?: string, email?: string): string => {
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
    <div className="divide-y">
      <AnimatePresence initial={false}>
        {members.map((member) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            key={member.userId}
            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
          >
            {/* Avatar */}
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {getInitials(member.user?.name, member.user?.email)}
              </AvatarFallback>
            </Avatar>

            {/* Member info */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {member.user?.name || "Unknown User"}
              </div>
              <div className="text-muted-foreground text-xs">
                {member.user?.email || ""}
              </div>
            </div>

            {/* Role */}
            <div className="flex-shrink-0 text-xs capitalize">
              {member.role || "member"}
            </div>

            {/* Actions */}
            {(() => {
              const totalMembers = members.length;
              const leadCount = members.filter((m) => m.role === "lead").length;
              const isSelf = member.userId === currentUserId;

              let canShow = false;

              if (canEdit && onRemoveMember) {
                if (!isSelf) {
                  canShow = true; // managing others
                } else {
                  if (totalMembers > 1) {
                    if (member.role === "lead") {
                      canShow = leadCount > 1;
                    } else {
                      canShow = true;
                    }
                  }
                }
              }

              if (!canShow) return null;

              return (
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label="Open member actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={removePending}
                        onClick={() => onRemoveMember?.(member._id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

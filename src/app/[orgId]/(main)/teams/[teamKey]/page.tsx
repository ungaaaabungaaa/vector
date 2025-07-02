"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Save,
  X,
  ArrowLeft,
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronsUpDown,
} from "lucide-react";
import { IconPicker } from "@/components/ui/icon-picker";
import { notFound } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { formatDateHuman } from "@/lib/date";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getDynamicIcon } from "@/lib/dynamic-icons";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/auth/permission-constants";
import { toast } from "sonner";

interface TeamViewPageProps {
  params: Promise<{ orgId: string; teamKey: string }>;
}

// Loading skeleton component
function TeamLoadingSkeleton({}: {
  resolvedParams: { orgId: string; teamKey: string } | null;
}) {
  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="h-full">
        <div>
          {/* Header Skeleton */}
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
            <div className="flex h-8 flex-wrap items-center gap-2">
              <div className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors">
                <ArrowLeft className="size-3" />
                Teams
              </div>
              <span className="text-muted-foreground text-sm">/</span>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20" />
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="mb-2 max-w-4xl space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16" />
                <span>•</span>
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-1/2" />
            </div>
            <div className="mb-8 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Member Dialog
function AddMemberDialog({
  orgSlug,
  teamId,
  onClose,
  onSuccess,
}: {
  orgSlug: string;
  teamId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [memberComboboxOpen, setMemberComboboxOpen] = useState(false);

  const { data: orgMembers = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  const utils = trpc.useUtils();

  const addMemberMutation = trpc.team.addMember.useMutation({
    onSuccess: () => {
      // Invalidate team members query to refresh list
      utils.team.listMembers.invalidate({ teamId }).catch(() => {});
      onSuccess?.();
      onClose();
      toast.success("Member added to team");
    },
    onError: (error) => {
      console.error(error.message);
      toast.error(`Failed to add member: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    addMemberMutation.mutate({
      teamId,
      userId: selectedMember,
      role: "member",
    });
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogHeader className="sr-only">
        <DialogTitle>Add team member</DialogTitle>
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
                    ? orgMembers.find(
                        (member) => member.userId === selectedMember,
                      )?.name
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
                    <CommandEmpty>No member found.</CommandEmpty>
                    <CommandGroup>
                      {orgMembers.map((member) => (
                        <CommandItem
                          key={member.userId}
                          value={member.name}
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
                          {member.name}
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
            disabled={!selectedMember || addMemberMutation.isPending}
            onClick={handleSubmit}
          >
            {addMemberMutation.isPending ? "Adding…" : "Add member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Members List Component
function MembersList({
  members,
  onRemoveMember,
  removePending,
  canEdit,
}: {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: string | null;
    joinedAt: string;
  }>;
  onRemoveMember?: (userId: string) => void;
  removePending?: boolean;
  canEdit: boolean;
}) {
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

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">��</div>
          <h3 className="mb-2 text-lg font-semibold">No members yet</h3>
          <p className="text-muted-foreground mb-6">
            Add team members to get started.
          </p>
        </div>
      </div>
    );
  }

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
                {getInitials(member.name, member.email)}
              </AvatarFallback>
            </Avatar>

            {/* Member info */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{member.name}</div>
              <div className="text-muted-foreground text-xs">
                {member.email}
              </div>
            </div>

            {/* Role */}
            <div className="flex-shrink-0 text-xs capitalize">
              {member.role || "member"}
            </div>

            {/* Actions */}
            {canEdit && onRemoveMember && (
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
                      onClick={() => {
                        if (confirm("Remove this member from the team?")) {
                          onRemoveMember(member.userId);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Add the DEFAULT_COLORS constant from states settings
const DEFAULT_COLORS = [
  "#94a3b8", // slate-400
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#6b7280", // gray-500
];

export default function TeamViewPage({ params }: TeamViewPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{
    orgId: string;
    teamKey: string;
  } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [iconValue, setIconValue] = useState<string | null>(null);
  const [colorValue, setColorValue] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Check user permissions for team management
  const { data: currentUser } = authClient.useSession();
  const { hasPermission: canUpdateTeam } = usePermission(
    resolvedParams?.orgId || "",
    PERMISSIONS.TEAM_UPDATE,
  );

  // Fetch team data
  const {
    data: team,
    isLoading: teamLoading,
    refetch: refetchTeam,
  } = trpc.team.getByKey.useQuery(
    {
      orgSlug: resolvedParams?.orgId || "",
      teamKey: resolvedParams?.teamKey || "",
    },
    { enabled: !!resolvedParams },
  );

  // Fetch team members
  const { data: teamMembers = [] } = trpc.team.listMembers.useQuery(
    { teamId: team?.id || "" },
    { enabled: !!team },
  );

  // Determine if user can edit team (team lead or has permission)
  const canEdit = !!(
    currentUser &&
    team &&
    (team.leadId === currentUser.user.id || canUpdateTeam)
  );

  // Mutations with toast error handling
  const updateTeamMutation = trpc.team.update.useMutation({
    onSuccess: () => {
      refetchTeam();
      setEditingName(false);
      setEditingDescription(false);
      setEditingKey(false);
      toast.success("Team updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update team: ${error.message}`);
    },
  });

  const utils = trpc.useUtils();

  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      // Invalidate members list to refresh data immediately
      if (team) {
        utils.team.listMembers.invalidate({ teamId: team.id }).catch(() => {});
      }
      toast.success("Member removed from team");
    },
    onError: (error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });

  // Initialize editing values when team loads
  useEffect(() => {
    if (team) {
      setNameValue(team.name);
      setDescriptionValue(team.description || "");
      setKeyValue(team.key);
      setIconValue(team.icon || null);
      setColorValue(team.color || null);
    }
  }, [team]);

  if (!resolvedParams) return <TeamLoadingSkeleton resolvedParams={null} />;
  if (teamLoading)
    return <TeamLoadingSkeleton resolvedParams={resolvedParams} />;
  if (!team) return notFound();

  const handleNameSave = () => {
    if (!nameValue.trim()) return;
    updateTeamMutation.mutate({
      id: team.id,
      data: { name: nameValue.trim() },
    });
  };

  const handleDescriptionSave = () => {
    updateTeamMutation.mutate({
      id: team.id,
      data: { description: descriptionValue.trim() || undefined },
    });
  };

  const handleKeySave = () => {
    if (!keyValue.trim()) return;
    updateTeamMutation.mutate({
      id: team.id,
      data: { key: keyValue.trim().toUpperCase() },
    });
  };

  const handleIconChange = (iconName: string | null) => {
    setIconValue(iconName);
    updateTeamMutation.mutate({ id: team.id, data: { icon: iconName } });
  };

  const handleColorChange = (color: string) => {
    setColorValue(color);
    updateTeamMutation.mutate({ id: team.id, data: { color } });
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate({
      teamId: team.id,
      userId,
    });
  };

  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="h-full">
        <div>
          {/* Header */}
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex items-center justify-between border-b px-2 backdrop-blur">
            <div className="flex h-8 flex-wrap items-center gap-2">
              <Link
                href={`/${resolvedParams.orgId}/teams`}
                className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
              >
                <ArrowLeft className="size-3" />
                Teams
              </Link>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-sm font-medium">
                {resolvedParams.teamKey}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {editingKey ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={keyValue}
                    onChange={(e) =>
                      setKeyValue(e.target.value.toUpperCase().slice(0, 10))
                    }
                    className="h-6 w-24 font-mono text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleKeySave();
                      if (e.key === "Escape") {
                        setKeyValue(team.key);
                        setEditingKey(false);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-6 px-1"
                    onClick={handleKeySave}
                  >
                    <Save className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1"
                    onClick={() => {
                      setKeyValue(team.key);
                      setEditingKey(false);
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <Badge
                  variant="secondary"
                  className={cn(
                    "font-mono text-xs",
                    canEdit && "cursor-pointer",
                  )}
                  onClick={() => canEdit && setEditingKey(true)}
                >
                  {team.key}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="mx-auto max-w-5xl px-4 py-4">
            {/* Team Header */}
            <div className="mb-2 max-w-4xl space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="font-mono">{team.key}</span>
                <span>•</span>
                <span>Updated {formatDateHuman(team.updatedAt)}</span>
              </div>

              {/* Name */}
              {editingName ? (
                <div className="flex items-center gap-2">
                  {/* Icon that stays visible during editing */}
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-0 transition-opacity hover:opacity-80">
                          {iconValue ? (
                            (() => {
                              const IconComp = getDynamicIcon(iconValue);
                              if (!IconComp)
                                return (
                                  <Users className="text-muted-foreground size-6" />
                                );
                              return (
                                <IconComp
                                  className="size-6"
                                  style={{ color: colorValue || undefined }}
                                />
                              );
                            })()
                          ) : (
                            <div className="border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed">
                              <Plus className="text-muted-foreground size-3" />
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-4">
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Team Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder="Select team icon"
                              className="h-8 w-full"
                            />
                          </div>
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Team Color
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {DEFAULT_COLORS.map((colorOption) => (
                                <button
                                  key={colorOption}
                                  type="button"
                                  className={`size-8 rounded-md border-2 transition-all ${
                                    colorValue === colorOption
                                      ? "border-foreground scale-110"
                                      : "border-border hover:scale-105"
                                  }`}
                                  style={{ backgroundColor: colorOption }}
                                  onClick={() => handleColorChange(colorOption)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    iconValue &&
                    (() => {
                      const IconComp = getDynamicIcon(iconValue);
                      if (!IconComp) return null;
                      return (
                        <IconComp
                          className="size-6"
                          style={{ color: colorValue || undefined }}
                        />
                      );
                    })()
                  )}
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="h-auto border-none p-0 !text-3xl !leading-tight font-semibold shadow-none focus-visible:ring-0"
                    style={{ fontFamily: "var(--font-title)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNameSave();
                      if (e.key === "Escape") {
                        setNameValue(team.name);
                        setEditingName(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={handleNameSave}
                      disabled={updateTeamMutation.isPending}
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNameValue(team.name);
                        setEditingName(false);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <h1 className="flex items-center gap-2 text-3xl leading-tight font-semibold">
                  {/* Clickable Icon with Color */}
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-0 transition-opacity hover:opacity-80">
                          {iconValue ? (
                            (() => {
                              const IconComp = getDynamicIcon(iconValue);
                              if (!IconComp)
                                return (
                                  <Users className="text-muted-foreground size-6" />
                                );
                              return (
                                <IconComp
                                  className="size-6"
                                  style={{ color: colorValue || undefined }}
                                />
                              );
                            })()
                          ) : (
                            <div className="border-muted-foreground/50 flex size-6 items-center justify-center rounded border-2 border-dashed">
                              <Plus className="text-muted-foreground size-3" />
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-4">
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Team Icon
                            </h4>
                            <IconPicker
                              value={iconValue}
                              onValueChange={handleIconChange}
                              placeholder="Select team icon"
                              className="h-8 w-full"
                            />
                          </div>
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Team Color
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {DEFAULT_COLORS.map((colorOption) => (
                                <button
                                  key={colorOption}
                                  type="button"
                                  className={`size-8 rounded-md border-2 transition-all ${
                                    colorValue === colorOption
                                      ? "border-foreground scale-110"
                                      : "border-border hover:scale-105"
                                  }`}
                                  style={{ backgroundColor: colorOption }}
                                  onClick={() => handleColorChange(colorOption)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    iconValue &&
                    (() => {
                      const IconComp = getDynamicIcon(iconValue);
                      if (!IconComp) return null;
                      return (
                        <IconComp
                          className="size-6"
                          style={{ color: colorValue || undefined }}
                        />
                      );
                    })()
                  )}
                  <span
                    className={cn(
                      "transition-colors",
                      canEdit && "hover:text-muted-foreground cursor-pointer",
                    )}
                    onClick={() => canEdit && setEditingName(true)}
                  >
                    {team.name}
                  </span>
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-8">
              {editingDescription ? (
                <div className="space-y-4">
                  <Textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    placeholder="Add a description..."
                    className="min-h-[120px] resize-none text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDescriptionValue(team.description || "");
                        setEditingDescription(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleDescriptionSave}
                      disabled={updateTeamMutation.isPending}
                    >
                      <Save className="mr-2 size-4" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDescriptionValue(team.description || "");
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {team.description ? (
                    <div
                      className={cn(
                        "prose prose-sm text-muted-foreground max-w-none transition-colors",
                        canEdit && "hover:text-foreground cursor-pointer",
                      )}
                      onClick={() => canEdit && setEditingDescription(true)}
                    >
                      <p className="whitespace-pre-wrap">{team.description}</p>
                    </div>
                  ) : canEdit ? (
                    <button
                      className="text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40 w-full rounded-lg border-2 border-dashed bg-transparent p-4 text-left text-base"
                      onClick={() => setEditingDescription(true)}
                    >
                      Add a description...
                    </button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No description provided.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Team Members */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4" />
                  Members ({teamMembers.length})
                </h2>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddMemberDialog(true)}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    Add member
                  </Button>
                )}
              </div>

              <div className="rounded-lg border">
                <MembersList
                  members={teamMembers}
                  onRemoveMember={canEdit ? handleRemoveMember : undefined}
                  removePending={removeMemberMutation.isPending}
                  canEdit={canEdit}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {showAddMemberDialog && (
        <AddMemberDialog
          orgSlug={resolvedParams.orgId}
          teamId={team.id}
          onClose={() => setShowAddMemberDialog(false)}
          onSuccess={() => refetchTeam()}
        />
      )}
    </div>
  );
}

"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Mail, Trash2, MoreHorizontal, Send } from "lucide-react";
import { OrgRoleBadge } from "@/components/organization/role-badge";
import { RoleSelector } from "@/components/organization/role-selector";
import { InviteDialog } from "@/components/organization/invite-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDateHuman } from "@/lib/date";
import { CustomRolesManager } from "@/components/organization/custom-roles-manager";

interface Invite {
  id: string;
  email: string;
  role: string | null;
  createdAt: string;
}

function getInitials(name?: string, email?: string): string {
  const displayName = name || email;
  if (!displayName) return "?";
  return displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MembersList({
  orgSlug,
  isAdmin,
  currentUserId,
  memberCount,
}: {
  orgSlug: string;
  isAdmin: boolean;
  currentUserId: string;
  memberCount: number;
}) {
  const utils = trpc.useUtils();
  const { data: members, isLoading } =
    trpc.organization.listMembersWithRoles.useQuery({
      orgSlug,
    });
  const { data: invites } = trpc.organization.listInvites.useQuery(
    { orgSlug },
    { enabled: isAdmin },
  );
  const [showInvite, setShowInvite] = useState(false);

  const removeMemberMutation = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      utils.organization.listMembersWithRoles.invalidate({ orgSlug });
    },
  });

  const revokeInviteMutation = trpc.organization.revokeInvite.useMutation({
    onSuccess: () => {
      utils.organization.listInvites.invalidate({ orgSlug });
    },
  });

  const resendInviteMutation = trpc.organization.resendInvite.useMutation({
    onSuccess: () => {
      utils.organization.listInvites.invalidate({ orgSlug });
    },
  });

  const handleRoleChange = () => {
    utils.organization.listMembersWithRoles.invalidate({ orgSlug });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground text-sm">Loading members...</div>
      </div>
    );
  }

  const hasMembers = members && members.length > 0;
  const hasInvites = invites && invites.length > 0;

  if (!hasMembers && !hasInvites) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">👥</div>
          <h3 className="mb-2 text-lg font-semibold">No members yet</h3>
          <p className="text-muted-foreground mb-6">
            Get started by inviting your first team member.
          </p>
          {isAdmin && (
            <Button onClick={() => setShowInvite(true)}>
              <Plus className="mr-2 size-4" />
              Invite Member
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Members */}
      {hasMembers && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Members ({members.length})
            </h3>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInvite(true)}
              >
                <Plus className="mr-1 size-3" />
                Invite
              </Button>
            )}
          </div>

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
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Member Info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Mail className="size-3" />
                      {member.email}
                    </div>
                  </div>

                  {/* Role Badge / Selector */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {isAdmin ? (
                      <>
                        <RoleSelector
                          orgSlug={orgSlug}
                          userId={member.userId}
                          currentRole={member.role as "member" | "admin"}
                        />
                        <CustomRolesManager
                          orgSlug={orgSlug}
                          userId={member.userId}
                          assignedRoles={member.customRoles}
                          onRoleChange={handleRoleChange}
                        />
                      </>
                    ) : (
                      <>
                        <OrgRoleBadge role={member.role} />
                        <CustomRolesManager
                          orgSlug={orgSlug}
                          userId={member.userId}
                          assignedRoles={member.customRoles}
                          disabled={true}
                        />
                      </>
                    )}
                  </div>

                  {/* Join Date */}
                  <div className="text-muted-foreground flex-shrink-0 text-xs">
                    {formatDateHuman(new Date(member.joinedAt))}
                  </div>

                  {/* Actions */}
                  {isAdmin && member.userId !== currentUserId && (
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
                            disabled={removeMemberMutation.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove ${member.name || member.email} from organization?`,
                                )
                              ) {
                                removeMemberMutation.mutate({
                                  orgSlug,
                                  userId: member.userId,
                                });
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {isAdmin && hasInvites && (
        <div>
          <h4 className="text-muted-foreground mb-4 flex items-center gap-2 text-sm font-semibold">
            Pending Invitations ({invites.length})
          </h4>
          <div className="divide-y">
            <AnimatePresence initial={false}>
              {invites.map((invite: Invite) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  key={invite.id}
                  className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2 transition-colors"
                >
                  {/* Avatar Placeholder */}
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs opacity-60">
                      {getInitials("", invite.email)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Invite Info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{invite.email}</div>
                    <div className="text-muted-foreground text-xs">
                      Invitation pending
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="flex-shrink-0">
                    <OrgRoleBadge role={invite.role || "member"} />
                  </div>

                  {/* Invite Date */}
                  <div className="text-muted-foreground flex-shrink-0 text-xs">
                    {formatDateHuman(new Date(invite.createdAt))}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label="Open invite actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={resendInviteMutation.isPending}
                          onClick={() => {
                            resendInviteMutation.mutate({
                              token: invite.id,
                              orgSlug,
                            });
                          }}
                        >
                          <Send className="size-4" />
                          Resend Invitation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={revokeInviteMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(`Revoke invitation for ${invite.email}?`)
                            ) {
                              revokeInviteMutation.mutate({
                                token: invite.id,
                              });
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          Revoke Invitation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteDialog orgSlug={orgSlug} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

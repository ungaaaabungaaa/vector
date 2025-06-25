"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { OrgRoleBadge } from "@/components/role-badge";
import { InviteDialog } from "@/components/invite-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MembersList({
  orgSlug,
  isAdmin,
}: {
  orgSlug: string;
  isAdmin: boolean;
}) {
  const { data: members, isLoading } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });
  const { data: invites } = trpc.organization.listInvites.useQuery(
    { orgSlug },
    { enabled: isAdmin },
  );
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Members</h3>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInvite(true)}
          >
            <Plus className="mr-1 size-3" /> Invite
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading members...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead className="w-[70px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    <OrgRoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Change Role</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(!members || members.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 5 : 4}
                    className="text-muted-foreground text-center"
                  >
                    No members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {isAdmin && invites && invites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">
            Pending Invitations
          </h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      {invite.email}
                    </TableCell>
                    <TableCell>
                      <OrgRoleBadge role={invite.role || "member"} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Resend</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteDialog orgSlug={orgSlug} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

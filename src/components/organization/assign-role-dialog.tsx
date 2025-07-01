"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";

interface AssignRoleDialogProps {
  orgSlug: string;
  roleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignRoleDialog({
  orgSlug,
  roleId,
  onClose,
  onSuccess,
}: AssignRoleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });
  const assignMutation = trpc.role.assign.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    await assignMutation.mutateAsync({
      orgSlug,
      roleId,
      userId: selectedUserId,
    });
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Role to Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Member</Label>
              <p className="text-muted-foreground text-sm">
                Choose a member to assign this role to
              </p>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-4">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className={`hover:bg-muted flex cursor-pointer items-center justify-between rounded-md p-3 transition-colors ${
                    selectedUserId === member.userId ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedUserId(member.userId)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <div className="bg-primary text-primary-foreground flex size-full items-center justify-center text-xs font-medium">
                        {member.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{member.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {member.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {member.role}
                    </Badge>
                    {selectedUserId === member.userId && (
                      <div className="bg-primary size-4 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedUserId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

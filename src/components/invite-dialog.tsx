"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InviteDialog({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const inviteMutation = trpc.organization.invite.useMutation({
    onSuccess: () => {
      console.log("Invitation sent");
      onClose();
    },
    onError: (e) => console.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-card w-96 space-y-4 rounded-md p-4 shadow-xl">
        <h3 className="text-base font-semibold">Invite Member</h3>
        <Input
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        <div className="flex gap-2">
          <Button
            variant={role === "member" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setRole("member")}
          >
            Member
          </Button>
          <Button
            variant={role === "admin" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setRole("admin")}
          >
            Admin
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => inviteMutation.mutate({ orgSlug, email, role })}
            disabled={!email || inviteMutation.isPending}
          >
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
}

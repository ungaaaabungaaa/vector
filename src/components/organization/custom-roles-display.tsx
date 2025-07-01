import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
}

interface CustomRolesDisplayProps {
  orgSlug: string;
  userId: string;
  roles: CustomRole[];
  isAdmin: boolean;
  onRoleRemoved?: () => void;
}

export function CustomRolesDisplay({
  orgSlug,
  userId,
  roles,
  isAdmin,
  onRoleRemoved,
}: CustomRolesDisplayProps) {
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  const removeRoleMutation = trpc.role.removeAssignment.useMutation({
    onSuccess: () => {
      setRemovingRoleId(null);
      onRoleRemoved?.();
    },
  });

  const handleRemoveRole = (roleId: string) => {
    setRemovingRoleId(roleId);
    removeRoleMutation.mutate({ orgSlug, roleId, userId });
  };

  if (roles.length === 0) {
    return (
      <span className="text-muted-foreground text-xs italic">
        No custom roles
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge
          key={role.id}
          variant="secondary"
          className="flex items-center gap-1 text-xs"
          title={role.description || undefined}
        >
          {role.name}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-destructive hover:text-destructive-foreground ml-1 h-3 w-3 p-0"
              onClick={() => handleRemoveRole(role.id)}
              disabled={removingRoleId === role.id}
              aria-label={`Remove ${role.name} role`}
            >
              <X className="h-2 w-2" />
            </Button>
          )}
        </Badge>
      ))}
    </div>
  );
}

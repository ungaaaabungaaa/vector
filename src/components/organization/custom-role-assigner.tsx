import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";

interface CustomRoleAssignerProps {
  orgSlug: string;
  userId: Id<"users">;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
}

export function CustomRoleAssigner({
  orgSlug,
  userId,
  disabled = false,
  className,
  onSuccess,
}: CustomRoleAssignerProps) {
  const [open, setOpen] = useState(false);

  // Fetch custom (non-system) roles for this organization
  const roles = useQuery(api.roles.list, { orgSlug }) || [];
  const assignMutation = useMutation(api.roles.assign);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async (roleId: Id<"orgRoles">) => {
    setIsAssigning(true);
    try {
      await assignMutation({ orgSlug, roleId, userId });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to assign role:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  const customRoles = roles.filter((r: { system: boolean }) => !r.system);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0", className)}
          disabled={disabled || isAssigning}
          aria-label="Assign custom role"
        >
          <Plus className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2">
          {customRoles.map((role) => (
            <Button
              key={role._id}
              onClick={() => handleAssign(role._id)}
              disabled={isAssigning}
              className="mb-1 w-full"
            >
              {role.name}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

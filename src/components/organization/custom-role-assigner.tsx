import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface CustomRoleAssignerProps {
  orgSlug: string;
  userId: string;
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
  const { data: roles = [] } = trpc.role.list.useQuery(
    { orgSlug },
    {
      enabled: !disabled && open, // fetch when popover opens
      staleTime: 5 * 60 * 1000,
    },
  );

  const assignMutation = trpc.role.assign.useMutation({
    onSuccess: () => {
      setOpen(false);
      onSuccess?.();
    },
  });

  const handleAssign = (roleId: string) => {
    assignMutation.mutate({ orgSlug, roleId, userId });
  };

  const customRoles = roles.filter((r: { system: boolean }) => !r.system);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0", className)}
          disabled={disabled || assignMutation.isPending}
          aria-label="Assign custom role"
        >
          <Plus className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search role…" className="h-9" />
          <CommandList>
            <CommandEmpty>No custom roles.</CommandEmpty>
            <CommandGroup>
              {customRoles.map((role: any) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => handleAssign(role.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      assignMutation.isPending &&
                        assignMutation.variables?.roleId === role.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

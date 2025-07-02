"use client";

import { useState } from "react";
import { OrgRoleBadge } from "@/components/organization/role-badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
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
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

interface RoleSelectorProps {
  orgSlug: string;
  userId: string;
  currentRole: RoleValue;
  disabled?: boolean;
  className?: string;
}

export function RoleSelector({
  orgSlug,
  userId,
  currentRole,
  disabled = false,
  className,
}: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const mutation = trpc.organization.updateRole.useMutation({
    onSuccess: () => {
      router.refresh();
      setOpen(false);
    },
  });

  const handleSelect = (role: RoleValue) => {
    if (role === currentRole) return;
    mutation.mutate({ orgSlug, userId, role });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || mutation.isPending}
          className={cn("cursor-pointer", className)}
        >
          <OrgRoleBadge role={currentRole} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search role..." className="h-9" />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {ROLE_OPTIONS.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => handleSelect(opt.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentRole === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

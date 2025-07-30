"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "@/convex/_generated/dataModel";

import { ALL_PERMISSIONS_WITH_GROUP } from "@/lib/permission-groups";

interface EditRoleDialogProps {
  orgSlug: string;
  roleId: Id<"orgRoles">;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditRoleDialog({
  orgSlug,
  roleId,
  onClose,
  onSuccess,
}: EditRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const role = useQuery(api.roles.get, {
    orgSlug: orgSlug,
    roleId,
  });

  const rolePermissionsQuery = useQuery(api.roles.getPermissions, {
    roleId,
  });

  // Populate state when the role data is loaded
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description ?? "");
    }
    if (rolePermissionsQuery) {
      setSelectedPermissions(rolePermissionsQuery.map((p) => p.permission));
    }
  }, [role, rolePermissionsQuery]);

  const updateMutation = useMutation(api.roles.update);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateMutation({
        orgSlug,
        roleId,
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selectedPermissions,
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to update role:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId],
    );
  };

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className="gap-2 p-2 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Edit Role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Role Name */}
          <div className="relative">
            <Input
              placeholder="e.g., Content Editor, Project Lead"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pr-20 text-base"
              autoFocus
            />
            <span className="text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs">
              Name
            </span>
          </div>

          {/* Description */}
          <div className="relative">
            <Textarea
              placeholder="What does this role do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full resize-none rounded-md border px-3 py-2 pr-20 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <span className="text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs">
              Description
            </span>
          </div>

          {/* Permissions */}
          <div className="space-y-1">
            <p className="text-muted-foreground px-1 text-sm">
              Select what this role can do in your organization
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border p-3">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {ALL_PERMISSIONS_WITH_GROUP.map((group) => (
                  <div key={group.group} className="space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-foreground text-sm font-medium">
                        {group.group}
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        {group.permissions.map((p) => p.label).join(", ")}
                      </p>
                    </div>
                    <div className="space-y-2 pl-2">
                      {group.permissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-start space-x-3 py-1"
                        >
                          <Checkbox
                            id={permission.id}
                            checked={selectedPermissions.includes(
                              permission.id,
                            )}
                            onCheckedChange={() =>
                              handlePermissionToggle(permission.id)
                            }
                            className="mt-0.5"
                          />
                          <div className="grid gap-1 leading-none">
                            <Label
                              htmlFor={permission.id}
                              className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {permission.label}
                            </Label>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {/* No description for now, as it's not in the new structure */}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="flex w-full flex-row items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Updating…" : "Update Role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

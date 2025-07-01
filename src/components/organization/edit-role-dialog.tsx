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
import { trpc } from "@/lib/trpc";
import { PERMISSIONS } from "@/auth/permission-constants";

interface EditRoleDialogProps {
  orgSlug: string;
  roleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PERMISSION_CATEGORIES = [
  {
    name: "Organization",
    description: "Manage organization settings and members",
    permissions: [
      {
        id: PERMISSIONS.ORG_MANAGE,
        label: "Manage Organization",
        description: "Edit org settings and branding",
      },
      {
        id: PERMISSIONS.ORG_INVITE,
        label: "Invite Members",
        description: "Send organization invitations",
      },
    ],
  },
  {
    name: "Roles & Permissions",
    description: "Manage user roles and permissions",
    permissions: [
      {
        id: PERMISSIONS.ROLE_CREATE,
        label: "Create Roles",
        description: "Create new custom roles",
      },
      {
        id: PERMISSIONS.ROLE_UPDATE,
        label: "Update Roles",
        description: "Edit existing roles",
      },
      {
        id: PERMISSIONS.ROLE_DELETE,
        label: "Delete Roles",
        description: "Remove custom roles",
      },
      {
        id: PERMISSIONS.ROLE_ASSIGN,
        label: "Assign Roles",
        description: "Assign roles to users",
      },
    ],
  },
  {
    name: "Projects",
    description: "Manage project creation and settings",
    permissions: [
      {
        id: PERMISSIONS.PROJECT_CREATE,
        label: "Create Projects",
        description: "Create new projects",
      },
      {
        id: PERMISSIONS.PROJECT_UPDATE,
        label: "Update Projects",
        description: "Edit project details",
      },
      {
        id: PERMISSIONS.PROJECT_DELETE,
        label: "Delete Projects",
        description: "Remove projects",
      },
    ],
  },
  {
    name: "Teams",
    description: "Manage team creation and settings",
    permissions: [
      {
        id: PERMISSIONS.TEAM_CREATE,
        label: "Create Teams",
        description: "Create new teams",
      },
      {
        id: PERMISSIONS.TEAM_UPDATE,
        label: "Update Teams",
        description: "Edit team details",
      },
      {
        id: PERMISSIONS.TEAM_DELETE,
        label: "Delete Teams",
        description: "Remove teams",
      },
    ],
  },
  {
    name: "Issues",
    description: "Manage issue creation and updates",
    permissions: [
      {
        id: PERMISSIONS.ISSUE_CREATE,
        label: "Create Issues",
        description: "Create new issues",
      },
      {
        id: PERMISSIONS.ISSUE_UPDATE,
        label: "Update Issues",
        description: "Edit issue details",
      },
      {
        id: PERMISSIONS.ISSUE_DELETE,
        label: "Delete Issues",
        description: "Remove issues",
      },
    ],
  },
];

export function EditRoleDialog({
  orgSlug,
  roleId,
  onClose,
  onSuccess,
}: EditRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Fetch the role details from the API
  const { data: roleData } = trpc.role.get.useQuery({ orgSlug, roleId });

  // Populate state when the role data is loaded
  useEffect(() => {
    if (roleData) {
      setName(roleData.name ?? "");
      setDescription(roleData.description ?? "");
      setSelectedPermissions(roleData.permissions ?? []);
    }
  }, [roleData]);

  const updateMutation = trpc.role.update.useMutation({
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updateMutation.mutateAsync({
      orgSlug,
      roleId,
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: selectedPermissions,
    });
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
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-foreground text-sm font-medium">
                        {category.name}
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        {category.description}
                      </p>
                    </div>
                    <div className="space-y-2 pl-2">
                      {category.permissions.map((permission) => (
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
                              {permission.description}
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
            disabled={!name.trim() || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {updateMutation.isPending ? "Updating…" : "Update Role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Plus, Shield, Users, Crown, Settings, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { CreateRoleDialog } from "./create-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import { AssignRoleDialog } from "./assign-role-dialog";
import { CustomRolesTable } from "./custom-roles-table";
import { useScopedPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/convex/_shared/permissions";
import type { Id } from "@/convex/_generated/dataModel";

interface RolesPageContentProps {
  orgSlug: string;
}

// Mapping from permission identifiers to human-readable labels (keep in sync with dialogs)
const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.ORG_VIEW]: "View Organization",
  [PERMISSIONS.ORG_MANAGE_SETTINGS]: "Manage Organization Settings",
  [PERMISSIONS.ORG_MANAGE_BILLING]: "Manage Billing",
  [PERMISSIONS.ORG_MANAGE_MEMBERS]: "Manage Members",
  [PERMISSIONS.ORG_MANAGE_ROLES]: "Manage Roles",

  [PERMISSIONS.PROJECT_CREATE]: "Create Projects",
  [PERMISSIONS.PROJECT_VIEW]: "View Projects",
  [PERMISSIONS.PROJECT_EDIT]: "Edit Projects",
  [PERMISSIONS.PROJECT_DELETE]: "Delete Projects",

  [PERMISSIONS.TEAM_CREATE]: "Create Teams",
  [PERMISSIONS.TEAM_VIEW]: "View Teams",
  [PERMISSIONS.TEAM_EDIT]: "Edit Teams",
  [PERMISSIONS.TEAM_DELETE]: "Delete Teams",

  [PERMISSIONS.ISSUE_CREATE]: "Create Issues",
  [PERMISSIONS.ISSUE_VIEW]: "View Issues",
  [PERMISSIONS.ISSUE_EDIT]: "Edit Issues",
  [PERMISSIONS.ISSUE_DELETE]: "Delete Issues",
  [PERMISSIONS.ISSUE_ASSIGN]: "Assign Issues",
};

export function RolesPageContent({ orgSlug }: RolesPageContentProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Id<"orgRoles"> | null>(null);
  const [assigningRole, setAssigningRole] = useState<Id<"orgRoles"> | null>(
    null,
  );

  const { hasPermission: canCreateRoles } = useScopedPermission(
    { orgSlug },
    PERMISSIONS.ORG_MANAGE_ROLES,
  );
  const { hasPermission: canUpdateRoles } = useScopedPermission(
    { orgSlug },
    PERMISSIONS.ORG_MANAGE_ROLES,
  );
  const { hasPermission: canDeleteRoles } = useScopedPermission(
    { orgSlug },
    PERMISSIONS.ORG_MANAGE_ROLES,
  );
  const { hasPermission: canAssignRoles } = useScopedPermission(
    { orgSlug },
    PERMISSIONS.ORG_MANAGE_ROLES,
  );

  // Fetch members to compute real counts for system roles
  const members = useQuery(api.organizations.listMembers, { orgSlug }) || [];

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, admin: 0, member: 0 };
    members.forEach((m: { role: string }) => {
      if (counts[m.role] !== undefined) counts[m.role]++;
    });
    return counts;
  }, [members]);

  // Note: Custom roles functionality has been moved to team/project scoped roles
  // This page now focuses on organization-level role management
  const roles: Array<{
    _id: Id<"orgRoles">;
    name: string;
    description: string | undefined;
    permissions: string[];
    createdAt: number;
  }> = []; // Empty for now - custom org roles can be added later

  const handleDeleteRole = async (roleId: Id<"orgRoles">) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        // Placeholder - implement when custom org roles are added
        console.log("Delete role:", roleId);
      } catch (error) {
        console.error("Failed to delete role:", error);
      }
    }
  };

  // Built-in roles for display with new permission system
  const builtInRoles = [
    {
      name: "Owner",
      description:
        "Complete control over the organization including billing, deletion, and member management",
      system: true,
      icon: Crown,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      permissions: ["All permissions"],
      memberCount: roleCounts.owner.toString(),
    },
    {
      name: "Admin",
      description:
        "Full management capabilities except billing and organization deletion",
      system: true,
      icon: Settings,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      permissions: [
        "Manage Organization Settings",
        "Manage Members",
        "Manage Roles",
        "Create Teams",
        "Create Projects",
        "Manage Issues",
      ],
      memberCount: roleCounts.admin.toString(),
    },
    {
      name: "Member",
      description:
        "Standard access to view and contribute to projects and issues",
      system: true,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      permissions: [
        "View Organization",
        "Create Issues",
        "View Issues",
        "View Teams",
        "View Projects",
      ],
      memberCount: roleCounts.member.toString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Built-in Roles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Default Roles</h2>
            <p className="text-muted-foreground text-sm">
              System roles that are automatically available to all organizations
            </p>
          </div>
          <Badge variant="outline" className="bg-gray-50">
            <Shield className="mr-1 size-3" />
            System Managed
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {builtInRoles.map((role) => {
            const IconComponent = role.icon;
            return (
              <Card
                key={role.name}
                className={`${role.bgColor} ${role.borderColor} border-2`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className={`size-5 ${role.color}`} />
                      <CardTitle className="text-base">{role.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="text-muted-foreground size-3" />
                      <span className="text-muted-foreground text-xs">
                        {role.memberCount}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-xs font-medium">
                      Key Permissions
                    </div>
                    <div className="space-y-1">
                      {role.permissions.map((permission: string) => (
                        <div
                          key={permission}
                          className="flex items-center gap-2"
                        >
                          <div className="size-1 rounded-full bg-current opacity-60" />
                          <span className="text-xs">{permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Custom Roles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Custom Roles</h2>
            <p className="text-muted-foreground text-sm">
              Create specialized roles with specific permissions for your team
            </p>
          </div>
          {canCreateRoles && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 size-4" />
              Create Custom Role
            </Button>
          )}
        </div>

        {roles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="bg-muted mb-4 rounded-full p-3">
                <Shield className="text-muted-foreground size-6" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No custom roles yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
                Custom roles let you create specific permission sets for
                different types of users in your organization.
              </p>
              {canCreateRoles && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  variant="outline"
                >
                  <Plus className="mr-2 size-4" />
                  Create Your First Custom Role
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <CustomRolesTable
            roles={roles}
            canAssign={canAssignRoles}
            canEdit={canUpdateRoles}
            canDelete={canDeleteRoles}
            onAssign={(id) => setAssigningRole(id)}
            onEdit={(id) => setEditingRole(id)}
            onDelete={(id) => handleDeleteRole(id)}
          />
        )}
      </div>

      {/* Dialogs */}
      {showCreateDialog && (
        <CreateRoleDialog
          orgSlug={orgSlug}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
          }}
        />
      )}

      {editingRole && (
        <EditRoleDialog
          orgSlug={orgSlug}
          roleId={editingRole}
          onClose={() => setEditingRole(null)}
          onSuccess={() => {
            setEditingRole(null);
          }}
        />
      )}

      {assigningRole && (
        <AssignRoleDialog
          orgSlug={orgSlug}
          roleId={assigningRole}
          onClose={() => setAssigningRole(null)}
          onSuccess={() => {
            setAssigningRole(null);
          }}
        />
      )}
    </div>
  );
}

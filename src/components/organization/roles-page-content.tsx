"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Shield,
  Users,
  Edit,
  Trash2,
  Crown,
  Settings,
  UserCheck,
} from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { CreateRoleDialog } from "./create-role-dialog";
import { EditRoleDialog } from "./edit-role-dialog";
import { AssignRoleDialog } from "./assign-role-dialog";
import { CustomRolesTable } from "./custom-roles-table";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/auth/permission-constants";
import { BUILTIN_ROLE_PERMISSIONS } from "@/auth/builtin-role-permissions";

interface RolesPageContentProps {
  orgSlug: string;
}

// Mapping from permission identifiers to human-readable labels (keep in sync with dialogs)
const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.ORG_VIEW]: "View Organization",
  [PERMISSIONS.ORG_MANAGE]: "Manage Organization",
  [PERMISSIONS.ORG_INVITE]: "Invite Members",

  [PERMISSIONS.ROLE_CREATE]: "Create Roles",
  [PERMISSIONS.ROLE_UPDATE]: "Update Roles",
  [PERMISSIONS.ROLE_DELETE]: "Delete Roles",
  [PERMISSIONS.ROLE_ASSIGN]: "Assign Roles",

  [PERMISSIONS.PROJECT_CREATE]: "Create Projects",
  [PERMISSIONS.PROJECT_UPDATE]: "Update Projects",
  [PERMISSIONS.PROJECT_DELETE]: "Delete Projects",

  [PERMISSIONS.TEAM_CREATE]: "Create Teams",
  [PERMISSIONS.TEAM_UPDATE]: "Update Teams",
  [PERMISSIONS.TEAM_DELETE]: "Delete Teams",

  [PERMISSIONS.ISSUE_CREATE]: "Create Issues",
  [PERMISSIONS.ISSUE_UPDATE]: "Update Issues",
  [PERMISSIONS.ISSUE_DELETE]: "Delete Issues",
};

export function RolesPageContent({ orgSlug }: RolesPageContentProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [assigningRole, setAssigningRole] = useState<string | null>(null);

  const { hasPermission: canCreateRoles } = usePermission(
    orgSlug,
    PERMISSIONS.ROLE_CREATE,
  );
  const { hasPermission: canUpdateRoles } = usePermission(
    orgSlug,
    PERMISSIONS.ROLE_UPDATE,
  );
  const { hasPermission: canDeleteRoles } = usePermission(
    orgSlug,
    PERMISSIONS.ROLE_DELETE,
  );
  const { hasPermission: canAssignRoles } = usePermission(
    orgSlug,
    PERMISSIONS.ROLE_ASSIGN,
  );

  // Fetch members to compute real counts for system roles
  const { data: members = [] } = trpc.organization.listMembers.useQuery({
    orgSlug,
  });

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, admin: 0, member: 0 };
    members.forEach((m: { role: string }) => {
      if (counts[m.role] !== undefined) counts[m.role]++;
    });
    return counts;
  }, [members]);

  const { data: roles = [], refetch } = trpc.role.list.useQuery({ orgSlug });
  const deleteMutation = trpc.role.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDeleteRole = async (roleId: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      await deleteMutation.mutateAsync({ orgSlug, roleId });
    }
  };

  // Built-in roles for display (permissions derived from source of truth)
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
      permissions: BUILTIN_ROLE_PERMISSIONS.admin
        .filter((p) => p !== "*")
        .slice(0, 6) // show up to 6 key permissions
        .map((p) => PERMISSION_LABELS[p] ?? p),
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
      permissions: BUILTIN_ROLE_PERMISSIONS.member
        .filter((p) => p !== "*")
        .slice(0, 6)
        .map((p) => PERMISSION_LABELS[p] ?? p),
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
                      {role.permissions.map((permission) => (
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
            refetch();
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
            refetch();
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
            refetch();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { Shield } from "lucide-react";
import { RolesPageContent } from "@/components/organization/roles-page-content";
import { useParams } from "next/navigation";
import { PermissionBoundary } from "@/hooks/use-permission-boundary";
import { PERMISSIONS } from "@/convex/_shared/permissions";

interface RolesSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function RolesSettingsPage({}: RolesSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  return (
    <PermissionBoundary
      orgSlug={orgSlug}
      permission={PERMISSIONS.ORG_MANAGE_ROLES}
    >
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Shield className="size-5" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground text-sm">
            Create custom roles and configure permissions for your organization
          </p>
        </div>

        {/* Roles Management */}
        <RolesPageContent orgSlug={orgSlug} />
      </div>
    </PermissionBoundary>
  );
}

"use client";

import { Users } from "lucide-react";
import { MembersList } from "@/components/organization";
import { useParams } from "next/navigation";
import { useRequirePermission } from "@/hooks/use-permission-boundary";
import { PERMISSIONS } from "@/convex/_shared/permissions";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

interface MembersSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function MembersSettingsPage({}: MembersSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  // Require permission to manage members - will redirect to 403 if denied
  const { isLoading: permissionLoading } = useRequirePermission(
    orgSlug,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
  );

  const members = useQuery(api.organizations.listMembersWithRoles, { orgSlug });

  // Show loading state while checking permissions
  if (permissionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-2xl font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="size-5" />
          Members & Access
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage organization members, roles, and invitations
        </p>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        <MembersList orgSlug={orgSlug} memberCount={members?.length || 0} />
      </div>
    </div>
  );
}

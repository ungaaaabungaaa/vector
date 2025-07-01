import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Shield } from "lucide-react";
import { RolesPageContent } from "@/components/organization/roles-page-content";

interface RolesSettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function RolesSettingsPage({
  params,
}: RolesSettingsPageProps) {
  const { orgId: orgSlug } = await params;

  // Verify user access
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    notFound();
  }

  // Get organization details and verify membership
  const org = await OrganizationService.verifyUserOrganizationAccess(
    session.user.id,
    orgSlug,
  );

  if (!org) {
    notFound();
  }

  const isOwner = org.role === "owner";
  const isAdmin = org.role === "admin" || isOwner;

  // Only admins can access role management
  if (!isAdmin) {
    notFound();
  }

  return (
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
  );
}

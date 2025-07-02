import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Building } from "lucide-react";
import {
  OrgNameEditor,
  OrgSlugEditor,
  OrgLogoEditor,
} from "@/components/organization";

interface OrgSettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function OrgSettingsPage({
  params,
}: OrgSettingsPageProps) {
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Building className="size-5" />
          Organization Information
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your organization&apos;s basic information and branding
        </p>
      </div>

      {/* Organization Settings */}
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Organization Name</label>
            {isAdmin ? (
              <OrgNameEditor
                orgSlug={orgSlug}
                initialValue={org.organizationName}
              />
            ) : (
              <div className="rounded-md border px-3 py-2 text-sm">
                {org.organizationName}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              This is your organization&apos;s display name
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Organization Slug</label>
            {isAdmin ? (
              <OrgSlugEditor orgSlug={orgSlug} initialValue={orgSlug} />
            ) : (
              <div className="bg-muted rounded-md px-3 py-2 font-mono text-sm">
                {orgSlug}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Used in your organization&apos;s URL (example.com/{orgSlug})
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Organization Logo</label>
            {isAdmin ? (
              <OrgLogoEditor
                orgSlug={orgSlug}
                initialValue={org.organizationLogo}
              />
            ) : org.organizationLogo ? (
              <Image
                src={`/api/files/${org.organizationLogo}`}
                alt="Org logo"
                width={64}
                height={64}
                className="size-16 rounded border object-cover"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded border text-sm">
                No logo
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Upload a square image (PNG, JPG, or SVG). Max 1MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

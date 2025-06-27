import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building } from "lucide-react";
import { OrgNameEditor, OrgSlugEditor } from "@/components/organization";

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
        <h1 className="text-2xl font-semibold tracking-tight">
          General Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Basic organization information and settings
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="size-4" />
            Organization Information
          </CardTitle>
          <CardDescription className="text-sm">
            Manage your organization's basic information and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">
                Organization Name
              </label>
              {isAdmin ? (
                <OrgNameEditor
                  orgSlug={orgSlug}
                  initialValue={org.organizationName}
                />
              ) : (
                <span className="text-sm">{org.organizationName}</span>
              )}
              <p className="text-muted-foreground text-xs">
                This is your organization's display name
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">
                Organization Slug
              </label>
              {isAdmin ? (
                <OrgSlugEditor orgSlug={orgSlug} initialValue={orgSlug} />
              ) : (
                <span className="bg-muted rounded px-2 py-1 font-mono text-sm">
                  {orgSlug}
                </span>
              )}
              <p className="text-muted-foreground text-xs">
                Used in your organization's URL (example.com/{orgSlug})
              </p>
            </div>
          </div>

          <div className="space-y-1 border-t pt-4">
            <label className="text-muted-foreground text-xs font-medium">
              Organization ID
            </label>
            <span className="bg-muted rounded px-2 py-1 font-mono text-sm">
              {orgSlug}
            </span>
            <p className="text-muted-foreground text-xs">
              Your organization's unique identifier
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

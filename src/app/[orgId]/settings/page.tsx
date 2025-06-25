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
import {
  Settings,
  Users,
  Shield,
  Building,
  Key,
  Trash2,
  Edit,
  Plus,
} from "lucide-react";
import { OrgNameEditor, OrgSlugEditor } from "@/components/org-editors";
import { MembersList } from "@/components/members-list";

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

  // Non-admins can view, but some actions will be disabled/hidden

  // Get organization stats for member count
  const stats = await OrganizationService.getOrganizationStats(orgSlug);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage settings and preferences for {org.organizationName}
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="size-4" />
            General
          </CardTitle>
          <CardDescription className="text-sm">
            Basic organization information and settings
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
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">
                Slug
              </label>
              {isAdmin ? (
                <OrgSlugEditor orgSlug={orgSlug} initialValue={orgSlug} />
              ) : (
                <span className="bg-muted rounded px-2 py-1 font-mono text-sm">
                  {orgSlug}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members & Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Members & Access
          </CardTitle>
          <CardDescription className="text-sm">
            Manage organization members, roles, and invitations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Organization Members
                </span>
                <Badge variant="secondary" className="text-xs">
                  {stats.memberCount}{" "}
                  {stats.memberCount === 1 ? "member" : "members"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                View and manage all organization members and their roles
              </p>
            </div>
          </div>

          {/* Members list */}
          <div className="border-t pt-4">
            <MembersList orgSlug={orgSlug} isAdmin={isAdmin} />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4" />
            Security & Authentication
          </CardTitle>
          <CardDescription className="text-sm">
            Security settings and access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">Single Sign-On (SSO)</span>
              <p className="text-muted-foreground text-xs">
                Configure SAML or OAuth for secure authentication
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Not configured
              </Badge>
              {isAdmin && (
                <Button variant="outline" size="sm">
                  <Key className="mr-1 size-3" />
                  Configure
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">
                Two-Factor Authentication
              </span>
              <p className="text-muted-foreground text-xs">
                Require 2FA for all organization members
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
              {isAdmin && (
                <Button variant="outline" size="sm">
                  Require 2FA
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">API Keys & Webhooks</span>
              <p className="text-muted-foreground text-xs">
                Manage API access and webhook configurations
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm">
                Manage API Access
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <Trash2 className="size-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-sm">
              Irreversible actions that affect your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">Delete Organization</span>
                <p className="text-muted-foreground text-xs">
                  Permanently delete this organization and all associated data
                </p>
              </div>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-1 size-3" />
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

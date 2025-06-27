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
import { Shield, Key } from "lucide-react";

interface SecuritySettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function SecuritySettingsPage({
  params,
}: SecuritySettingsPageProps) {
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

  // Only admins can access security settings
  if (!isAdmin) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Security & Authentication
        </h1>
        <p className="text-muted-foreground text-sm">
          Security settings and access controls for your organization
        </p>
      </div>

      {/* Authentication Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4" />
            Authentication Methods
          </CardTitle>
          <CardDescription className="text-sm">
            Configure how members sign in to your organization
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
              <Button variant="outline" size="sm">
                <Key className="mr-1 size-3" />
                Configure
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
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
              <Button variant="outline" size="sm">
                Require 2FA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="size-4" />
            API Access & Webhooks
          </CardTitle>
          <CardDescription className="text-sm">
            Manage API keys and webhook configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-medium">API Keys</span>
              <p className="text-muted-foreground text-xs">
                Manage API access for external integrations
              </p>
            </div>
            <Button variant="outline" size="sm">
              Manage API Keys
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-1">
              <span className="text-sm font-medium">Webhooks</span>
              <p className="text-muted-foreground text-xs">
                Configure webhook endpoints for real-time notifications
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure Webhooks
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

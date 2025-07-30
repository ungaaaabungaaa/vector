"use client";

import { Building } from "lucide-react";
import Image from "next/image";
import {
  OrgLogoEditor,
  OrgNameEditor,
  OrgSlugEditor,
} from "@/components/organization";
import { api } from "@/lib/convex";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
interface OrgSettingsPageClientProps {
  orgSlug: string;
}

export default function OrgSettingsPageClient({
  orgSlug,
}: OrgSettingsPageClientProps) {
  const params = useParams();
  const orgSlugParam = params.orgSlug as string;
  const org = useQuery(api.organizations.getBySlug, { orgSlug: orgSlugParam });
  const members = useQuery(api.organizations.listMembersWithRoles, {
    orgSlug: orgSlugParam,
  });
  const user = useQuery(api.users.currentUser);

  const userRole =
    members?.find((m) => m.userId === user?._id)?.role || "member";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || isOwner;

  if (org === undefined) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Building className="size-5" />
            Organization Information
          </h1>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (org === null) {
    return <div>Organization not found</div>;
  }

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
              <OrgNameEditor orgSlug={orgSlug} initialValue={org.name} />
            ) : (
              <div className="rounded-md border px-3 py-2 text-sm">
                {org.name}
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
              <OrgLogoEditor orgSlug={orgSlug} initialValue={org.logo} />
            ) : org.logo ? (
              <Image
                src={`/api/files/${org.logo}`}
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

"use client";

import { Settings2 } from "lucide-react";
import { PrioritiesPageContent } from "./priorities-page-content";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";

interface PrioritiesSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function PrioritiesSettingsPage({}: PrioritiesSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  const user = useQuery(api.users.currentUser);
  const members = useQuery(api.organizations.listMembersWithRoles, { orgSlug });

  const userRole =
    members?.find((m) => m.userId === user?._id)?.role || "member";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || isOwner;

  // Only admins can access priorities management
  if (user !== undefined && members !== undefined && !isAdmin) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings2 className="size-5" />
          Issue Priorities
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure issue priorities for your organization
        </p>
      </div>

      {/* Priorities Management */}
      <PrioritiesPageContent orgSlug={orgSlug} />
    </div>
  );
}

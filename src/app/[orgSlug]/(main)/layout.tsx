"use client";

import { OrgSidebar, OrgOptionsDropdown } from "@/components/organization";
import { UserMenu } from "@/components/user-menu";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useParams } from "next/navigation";
import { Doc } from "@/convex/_generated/dataModel";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  // Fetch current user and organization data
  const user = useQuery(api.users.currentUser);
  const organization = useQuery(api.organizations.getBySlug, { orgSlug });
  const userOrganizations = useQuery(api.users.getOrganizations);

  // Don't render until we have the data
  if (user === undefined || organization === undefined) {
    return (
      <div className="bg-secondary flex h-screen">
        <aside className="hidden w-56 lg:block">
          <div className="flex h-full flex-col">
            <div className="p-2">
              <div className="bg-background flex w-full items-center justify-between rounded-md border p-1">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold">
                    ...
                  </div>
                  <span className="truncate text-sm font-medium">
                    Loading...
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 p-2 pt-0">
                <div className="space-y-1">
                  <div className="flex h-8 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium">
                    <span>Loading...</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-border border-t p-2">
              <div className="flex w-full justify-start gap-2 p-2">
                <div className="bg-muted size-8 rounded-full"></div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border">
          {children}
        </main>
      </div>
    );
  }

  const organizations =
    userOrganizations?.filter(
      (org): org is Doc<"organizations"> => org !== null,
    ) || [];

  return (
    <div className="bg-secondary flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 lg:block">
        <div className="flex h-full flex-col">
          {/* Organization Options Dropdown */}
          <div className="p-2">
            <OrgOptionsDropdown
              currentOrgSlug={orgSlug}
              currentOrgName={organization?.name ?? "Organization"}
              currentOrgLogo={organization?.logo}
              organizations={organizations}
            />
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <OrgSidebar orgSlug={orgSlug} />
          </div>

          {/* User menu at bottom */}
          <div className="border-border border-t p-2">
            <UserMenu />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border">
        {children}
      </main>
    </div>
  );
}

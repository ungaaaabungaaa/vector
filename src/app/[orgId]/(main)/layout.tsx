import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { OrgSidebar, OrgOptionsDropdown } from "@/components/organization";
import { UserMenu } from "@/components/user-menu";

interface MainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}

export default async function MainLayout({
  children,
  params,
}: MainLayoutProps) {
  const { orgId: orgSlug } = await params;

  // Verify user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    notFound();
  }

  // Verify organization exists and user has access
  const currentOrg = await OrganizationService.verifyUserOrganizationAccess(
    session.user.id,
    orgSlug,
  );

  if (!currentOrg) {
    notFound();
  }

  // Fetch all organizations the user belongs to for the switcher
  const userOrganizations = await OrganizationService.getUserOrganizations(
    session.user.id,
  );

  // Map organizations so that 'id' aligns with slug for routing
  const orgOptions = userOrganizations
    .filter((org) => org.slug) // ensure slug exists
    .map((org) => ({
      id: org.slug as string, // use slug for routing / filter matching
      name: org.name,
      slug: org.slug as string,
    }));

  return (
    <div className="bg-secondary flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 lg:block">
        <div className="flex h-full flex-col">
          {/* Organization Options Dropdown */}
          <div className="p-2">
            <OrgOptionsDropdown
              currentOrgId={orgSlug}
              currentOrgName={currentOrg.organizationName}
              organizations={orgOptions}
            />
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <OrgSidebar orgId={orgSlug} />
          </div>

          {/* User menu at bottom */}
          <div className="border-border border-t p-2">
            <UserMenu user={session.user} />
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

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { OrgSidebar } from "@/components/org-sidebar";
import { OrgSwitcher } from "@/components/org-switcher";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: { orgId: string };
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
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
    <div className="bg-background flex h-screen">
      {/* Sidebar */}
      <aside className="border-border bg-card hidden w-56 border-r lg:block">
        <div className="flex h-full flex-col">
          {/* Organization Switcher */}
          <div className="border-border border-b px-3 py-2">
            <OrgSwitcher
              currentOrgId={orgSlug}
              currentOrgName={currentOrg.organizationName}
              organizations={orgOptions}
            />
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <OrgSidebar orgId={orgSlug} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

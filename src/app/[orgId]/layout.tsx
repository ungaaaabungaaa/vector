import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
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

  // Just pass through children - no UI here
  return <>{children}</>;
}

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";

interface TeamsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
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

  const isAdmin = org.role === "admin";

  // Get all teams in the organization
  const teams = await OrganizationService.getOrganizationTeams(orgSlug);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">
            Manage teams and members in {org.organizationName}
          </p>
        </div>

        {isAdmin && (
          <Button asChild>
            <Link href={`/${orgSlug}/teams/new`}>
              <Plus className="mr-2 size-4" />
              Create Team
            </Link>
          </Button>
        )}
      </div>

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            return (
              <Card key={team.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="size-5" />
                        {team.name}
                      </CardTitle>
                      {team.description && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {team.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Users className="size-4" />
                      <span>Team management</span>
                    </div>

                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${orgSlug}/teams/${team.id}`}>
                        View Team
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="text-muted-foreground mx-auto mb-4 size-16" />
            <h3 className="mb-2 text-lg font-semibold">No teams yet</h3>
            <p className="text-muted-foreground mb-6">
              Teams help you organize members and manage project access within
              your organization.
            </p>
            {isAdmin && (
              <Button asChild>
                <Link href={`/${orgSlug}/teams/new`}>
                  <Plus className="mr-2 size-4" />
                  Create Team
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

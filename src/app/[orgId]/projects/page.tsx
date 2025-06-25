import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus, Clock } from "lucide-react";

interface ProjectsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
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

  // Get all projects - using a larger limit for the projects page
  const projects = await OrganizationService.getRecentProjects(orgSlug, 50);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage projects and workflows in {org.organizationName}
          </p>
        </div>

        {isAdmin && (
          <Button asChild>
            <Link href={`/${orgSlug}/projects/new`}>
              <Plus className="mr-2 size-4" />
              Create Project
            </Link>
          </Button>
        )}
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="size-5" />
                  {project.name}
                </CardTitle>
                {project.description && (
                  <p className="text-muted-foreground text-sm">
                    {project.description}
                  </p>
                )}
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="size-4" />
                    <span>
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${orgSlug}/projects/${project.id}`}>
                      Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="text-muted-foreground mx-auto mb-4 size-16" />
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="text-muted-foreground mb-6">
              Projects help you organize work into manageable workflows and
              track progress.
            </p>
            {isAdmin && (
              <Button asChild>
                <Link href={`/${orgSlug}/projects/new`}>
                  <Plus className="mr-2 size-4" />
                  Create Your First Project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

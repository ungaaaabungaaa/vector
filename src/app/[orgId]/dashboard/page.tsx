import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  FolderKanban,
  Bug,
  Plus,
  TrendingUp,
  Clock,
} from "lucide-react";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
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

  // Get dashboard data
  const [stats, recentProjects, recentIssues] = await Promise.all([
    OrganizationService.getOrganizationStats(orgSlug),
    OrganizationService.getRecentProjects(orgSlug),
    OrganizationService.getRecentIssues(orgSlug),
  ]);

  const isAdmin = org.role === "admin";

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back to {org.organizationName}
          </p>
        </div>

        {isAdmin && (
          <Button asChild>
            <Link href={`/${orgSlug}/projects/new`}>
              <Plus className="mr-2 size-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <FolderKanban className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.projectCount}</div>
            <p className="text-muted-foreground text-xs">
              Active project workspaces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <Bug className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.issueCount}</div>
            <p className="text-muted-foreground text-xs">Across all projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.memberCount}</div>
            <p className="text-muted-foreground text-xs">
              Organization members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-muted-foreground text-xs">Updates this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-5" />
              Recent Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentProjects.length > 0 ? (
              <>
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/${orgSlug}/projects/${project.id}`}
                    className="hover:bg-accent flex items-center justify-between rounded p-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-muted-foreground truncate text-sm">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Clock className="size-3" />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/${orgSlug}/projects`}>View All Projects</Link>
                </Button>
              </>
            ) : (
              <div className="py-6 text-center">
                <FolderKanban className="text-muted-foreground mx-auto mb-2 size-12" />
                <p className="text-muted-foreground">No projects yet</p>
                {isAdmin && (
                  <Button size="sm" asChild className="mt-2">
                    <Link href={`/${orgSlug}/projects/new`}>
                      Create First Project
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="size-5" />
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentIssues.length > 0 ? (
              <>
                {recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/${orgSlug}/issues/${issue.id}`}
                    className="hover:bg-accent flex items-center justify-between rounded p-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{issue.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {issue.projectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          issue.stateId === "open"
                            ? "bg-green-100 text-green-800"
                            : issue.stateId === "in-progress"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {issue.stateId}
                      </span>
                      <Clock className="text-muted-foreground size-3" />
                      <span className="text-muted-foreground">
                        {new Date(issue.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/${orgSlug}/issues`}>View All Issues</Link>
                </Button>
              </>
            ) : (
              <div className="py-6 text-center">
                <Bug className="text-muted-foreground mx-auto mb-2 size-12" />
                <p className="text-muted-foreground">No issues yet</p>
                <p className="text-muted-foreground text-sm">
                  Issues will appear when you create projects
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

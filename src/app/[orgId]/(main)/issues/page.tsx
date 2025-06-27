import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug, Clock, ExternalLink } from "lucide-react";

interface IssuesPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function IssuesPage({ params }: IssuesPageProps) {
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

  // Get all issues - using a larger limit for the issues page
  const issues = await OrganizationService.getRecentIssues(orgSlug, 50);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground">
            Organization-wide issue tracking for {org.organizationName}
          </p>
        </div>

        <Button asChild>
          <Link href={`/${orgSlug}/projects`}>
            <ExternalLink className="mr-2 size-4" />
            Go to Projects
          </Link>
        </Button>
      </div>

      {/* Issues List */}
      {issues.length > 0 ? (
        <div className="space-y-4">
          {issues.map((issue) => (
            <Card key={issue.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <Bug className="text-muted-foreground size-5" />
                      <Link
                        href={`/${orgSlug}/issues/${issue.id}`}
                        className="hover:text-primary truncate text-lg font-semibold transition-colors"
                      >
                        {issue.title}
                      </Link>
                    </div>

                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <span>Project: {issue.projectName}</span>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3" />
                        <span>
                          Updated{" "}
                          {new Date(issue.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {issue.stateId && (
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          issue.stateId === "open"
                            ? "bg-green-100 text-green-800"
                            : issue.stateId === "in-progress"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {issue.stateId}
                      </span>
                    )}

                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${orgSlug}/issues/${issue.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bug className="text-muted-foreground mx-auto mb-4 size-16" />
            <h3 className="mb-2 text-lg font-semibold">No issues yet</h3>
            <p className="text-muted-foreground mb-6">
              Issues will appear here when they are created in your projects.
            </p>
            <Button asChild>
              <Link href={`/${orgSlug}/projects`}>
                <ExternalLink className="mr-2 size-4" />
                Go to Projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

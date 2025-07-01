import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { db } from "@/db";
import { invitation, organization } from "@/db/schema/users-and-auth";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Mail } from "lucide-react";
import { OrganizationService } from "@/entities/organizations/organization.service";

// -----------------------------------------------------------------------------
// Server Actions
// -----------------------------------------------------------------------------

export async function acceptInviteAction(formData: FormData) {
  "use server";
  const token = formData.get("token") as string | undefined;
  if (!token) return;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }

  try {
    await OrganizationService.acceptInvitation(token, session.user.id);
  } catch (err) {
    console.error("Failed to accept invite", err);
  }

  redirect("/settings/invites");
}

export async function declineInviteAction(formData: FormData) {
  "use server";
  const token = formData.get("token") as string | undefined;
  if (!token) return;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }

  try {
    await OrganizationService.revokeInvitation(token);
  } catch (err) {
    console.error("Failed to decline invite", err);
  }

  redirect("/settings/invites");
}

// -----------------------------------------------------------------------------

export default async function InvitesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }

  const invites = await db
    .select({
      token: invitation.id,
      organizationName: organization.name,
      role: invitation.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.email, session.user.email),
        eq(invitation.status, "pending"),
      ),
    );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Mail className="size-5" />
          Pending Invitations
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your organization invitations and join new teams
        </p>
      </div>

      {/* Invitation Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Pending Invites</span>
          <Badge variant="secondary" className="text-xs">
            {invites.length} {invites.length === 1 ? "invite" : "invites"}
          </Badge>
        </div>
        {invites.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Accept invitations to join organizations and start collaborating
          </p>
        )}
      </div>

      {/* Invitations List */}
      <div className="space-y-4">
        {invites.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center rounded-md border border-dashed text-sm">
            You have no pending invitations.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    Organization
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    Role
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    Invited
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    Expires
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wider uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {invites.map((inv) => (
                  <tr key={inv.token} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {inv.organizationName}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline" className="capitalize">
                        {inv.role}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">
                      {format(new Date(inv.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-sm">
                      {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <form action={acceptInviteAction}>
                          <input type="hidden" name="token" value={inv.token} />
                          <Button size="sm">Accept</Button>
                        </form>
                        <form action={declineInviteAction}>
                          <input type="hidden" name="token" value={inv.token} />
                          <Button size="sm" variant="outline">
                            Decline
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

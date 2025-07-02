import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatDateHuman } from "@/lib/date";

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function acceptInviteAction(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect(`/auth/login?redirectTo=/invite/${token}`);
  }

  try {
    await OrganizationService.acceptInvitation(token, session.user.id);

    // Get the organization details to redirect to it
    const inviteDetails = await OrganizationService.getInvitationDetails(token);
    if (inviteDetails?.organizationSlug) {
      redirect(`/${inviteDetails.organizationSlug}/issues`);
    } else {
      redirect("/");
    }
  } catch (error) {
    // Redirect back with error state
    redirect(
      `/invite/${token}?error=${encodeURIComponent((error as Error).message)}`,
    );
  }
}

async function declineInviteAction(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;

  try {
    await OrganizationService.revokeInvitation(token);
    redirect("/?message=Invitation+declined");
  } catch (error) {
    redirect(
      `/invite/${token}?error=${encodeURIComponent((error as Error).message)}`,
    );
  }
}

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const { error: errorMessage } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  const inviteDetails = await OrganizationService.getInvitationDetails(token);

  if (!inviteDetails) {
    notFound();
  }

  const {
    email,
    role,
    status,
    expiresAt,
    createdAt,
    organizationName,
    inviterName,
  } = inviteDetails;

  // Check if invitation is expired
  const isExpired = new Date(expiresAt) < new Date();
  const isAlreadyUsed = status !== "pending";

  return (
    <div className="bg-secondary flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-2 p-4">
            <div className="flex items-center justify-center">
              <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full">
                <Users className="size-6" />
              </div>
            </div>
            <CardTitle className="text-center text-lg">
              Organization Invitation
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 p-4 pt-0">
            {/* Error State */}
            {errorMessage && (
              <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3">
                <AlertCircle className="size-4 flex-shrink-0" />
                <span className="text-xs">{errorMessage}</span>
              </div>
            )}

            {/* Expired State */}
            {isExpired && (
              <div className="flex items-center gap-2 rounded-md bg-orange-50 p-3 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                <Clock className="size-4 flex-shrink-0" />
                <span className="text-xs">This invitation has expired</span>
              </div>
            )}

            {/* Already Used State */}
            {isAlreadyUsed && status === "accepted" && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-950/50 dark:text-green-400">
                <CheckCircle2 className="size-4 flex-shrink-0" />
                <span className="text-xs">
                  This invitation has already been accepted
                </span>
              </div>
            )}

            {isAlreadyUsed && status === "revoked" && (
              <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3">
                <AlertCircle className="size-4 flex-shrink-0" />
                <span className="text-xs">
                  This invitation has been revoked
                </span>
              </div>
            )}

            {/* Invitation Details */}
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm">
                  <span className="font-medium">{inviterName}</span> invited you
                  to join
                </p>
                <p className="text-lg font-semibold">{organizationName}</p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className="text-muted-foreground text-xs">as</span>
                <Badge variant="secondary" className="capitalize">
                  {role}
                </Badge>
              </div>

              <div className="bg-muted/50 space-y-2 rounded-md p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Invited to:</span>
                  <span className="font-medium">{email}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Invited on:</span>
                  <span>{formatDateHuman(new Date(createdAt))}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Expires:</span>
                  <span
                    className={isExpired ? "text-destructive font-medium" : ""}
                  >
                    {formatDateHuman(new Date(expiresAt))}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Mismatch Warning */}
            {session?.user && session.user.email !== email && (
              <div className="flex items-center gap-2 rounded-md bg-orange-50 p-3 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                <AlertCircle className="size-4 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-medium">Email mismatch</p>
                  <p>
                    This invitation was sent to {email}, but you&apos;re signed
                    in as {session.user.email}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {session?.user && !isExpired && !isAlreadyUsed && (
              <div className="flex gap-2">
                <form action={declineInviteAction} className="flex-1">
                  <input type="hidden" name="token" value={token} />
                  <Button variant="outline" size="sm" className="w-full">
                    Decline
                  </Button>
                </form>
                <form action={acceptInviteAction} className="flex-1">
                  <input type="hidden" name="token" value={token} />
                  <Button size="sm" className="w-full">
                    Accept Invitation
                  </Button>
                </form>
              </div>
            )}

            {/* Already signed in but can't accept */}
            {session?.user && (isExpired || isAlreadyUsed) && (
              <div className="text-center">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/">Go to Dashboard</Link>
                </Button>
              </div>
            )}

            {/* Authentication Required */}
            {!session?.user && (
              <div className="text-center">
                <p className="text-muted-foreground mb-3 text-xs">
                  Sign in to accept this invitation
                </p>
                <Button
                  asChild
                  className="w-full"
                  disabled={isExpired || isAlreadyUsed}
                >
                  <Link href={`/auth/login?redirectTo=/invite/${token}`}>
                    Sign In
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

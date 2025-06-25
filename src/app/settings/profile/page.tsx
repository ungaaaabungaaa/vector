import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  // Verify user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border bg-card border-b">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 size-4" />
                Back to App
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Profile Settings</h1>
              <p className="text-muted-foreground">
                Manage your account settings and preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Sidebar Navigation */}
          <div className="space-y-4">
            <nav className="space-y-1">
              <Button variant="secondary" className="w-full justify-start">
                Profile
              </Button>
              <Button variant="ghost" className="w-full justify-start" disabled>
                Account
              </Button>
              <Button variant="ghost" className="w-full justify-start" disabled>
                Security
              </Button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Update your profile information and how others see you across
                  organizations.
                </p>
              </CardHeader>
              <CardContent>
                <ProfileForm user={session.user} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

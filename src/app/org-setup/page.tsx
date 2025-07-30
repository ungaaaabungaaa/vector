import { OrgSetupForm } from "@/components/organization";

export default async function OrgSetupPage() {
  // This page is for first-time setup only. A check in a layout or middleware
  // would be more robust. Since we can't know the user's organizations without
  // authentication on the server, we'll rely on client-side redirects from
  // the main page to handle users who already have organizations.

  return (
    <div className="from-muted/50 via-muted/25 to-background flex min-h-screen items-center justify-center bg-gradient-to-b px-4">
      <div className="mx-auto w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Your Organization
          </h1>
          <p className="text-muted-foreground mt-2">
            Get started by setting up your workspace
          </p>
        </div>

        {/* Form Card */}
        <div className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/80 rounded-xl border p-8 shadow-xl backdrop-blur">
          <OrgSetupForm />
        </div>

        {/* Footer */}
        <p className="text-muted-foreground text-center text-sm">
          You can invite team members and create projects after setting up your
          organization.
        </p>
      </div>
    </div>
  );
}

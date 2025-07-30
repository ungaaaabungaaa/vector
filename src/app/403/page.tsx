import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center p-4">
      <div className="max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="bg-destructive/10 rounded-full p-4">
            <ShieldX className="text-destructive size-12" />
          </div>
        </div>

        {/* Error Code and Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">403</h1>
          <h2 className="text-foreground text-xl font-semibold">
            Access Denied
          </h2>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed">
          You don&apos;t have permission to access this page. Please contact
          your administrator if you believe this is an error.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            <ArrowLeft className="size-4" />
            Go to Dashboard
          </Link>

          <button
            onClick={() => window.history.back()}
            className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-ring inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

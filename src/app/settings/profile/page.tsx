import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { ProfileForm } from "@/components/profile-form";
import { User } from "lucide-react";

export default async function ProfilePage() {
  // Verify user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <User className="size-5" />
          Profile Information
        </h1>
        <p className="text-muted-foreground text-sm">
          Update your profile information and how others see you across
          organizations
        </p>
      </div>

      {/* Profile Settings */}
      <div className="space-y-6">
        <ProfileForm user={session.user} />
      </div>
    </div>
  );
}

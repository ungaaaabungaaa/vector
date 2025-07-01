import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { auth } from "@/auth/auth";
import { UserSettingsSidebar } from "@/components/settings/user-settings-sidebar";
import { UserMenu } from "@/components/user-menu";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default async function SettingsLayout({
  children,
}: SettingsLayoutProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="bg-secondary flex h-screen">
      {/* Settings Sidebar */}
      <aside className="hidden w-56 lg:block">
        <div className="flex h-full flex-col">
          {/* User Info Section */}
          <div className="p-2">
            <div className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
              Account Settings
            </div>
          </div>

          {/* Settings Navigation */}
          <div className="flex-1 overflow-y-auto">
            <UserSettingsSidebar />
          </div>

          {/* User menu at bottom */}
          <div className="border-border border-t p-2">
            <UserMenu user={session.user} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="bg-background m-2 ml-0 flex-1 overflow-y-auto rounded-md border">
        {children}
      </main>
    </div>
  );
}

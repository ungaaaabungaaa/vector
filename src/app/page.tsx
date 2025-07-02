import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import { UserService } from "@/entities/users/user.service";

// --- Post-login redirect logic -----------------------------------------------------------
export default async function Home() {
  console.log("[HomePage] Starting redirect logic");

  try {
    // First-run check: If no users exist, redirect to admin setup
    const hasUsers = await UserService.hasAnyUsers();
    if (!hasUsers) {
      console.log("[HomePage] No users found, redirecting to setup-admin");
      redirect("/setup-admin");
    }

    // Check if user is authenticated by using server-side auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      // User is not authenticated, redirect to login
      console.log("[HomePage] No session found, redirecting to login");
      redirect("/auth/login");
    }

    console.log("[HomePage] User authenticated:", session.user.id);

    // User is authenticated, determine their active organization
    const activeOrgSlug = await UserService.getUserActiveOrganization(
      session.user.id,
      session.session.activeOrganizationId,
    );

    console.log("[HomePage] Active org slug:", activeOrgSlug);

    if (activeOrgSlug) {
      // Redirect to organization's issues page
      console.log(
        "[HomePage] Redirecting to org issues:",
        `/${activeOrgSlug}/issues`,
      );
      redirect(`/${activeOrgSlug}/issues`);
    } else {
      // User has no organization memberships, redirect to create organization
      console.log("[HomePage] No org found, redirecting to org-setup");
      redirect("/org-setup");
    }
  } catch (error) {
    // Check if this is a NEXT_REDIRECT error (expected behavior)
    const errorObj = error as Error;
    if (errorObj.message === "NEXT_REDIRECT") {
      // This is an expected redirect, re-throw it to let Next.js handle it
      throw error;
    }

    console.error("Error during platform setup check:", error);
    // If we can't check, assume setup is needed (fail safe)
    console.error("Platform setup check failed:", errorObj.message);
    // Redirect to setup page on error
    redirect("/setup-admin");
  }

  // This should never be reached, but just in case
  return null;
}

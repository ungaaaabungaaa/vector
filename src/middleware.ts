import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// --- Middleware entry (runs on every request) ---
export default async function middleware(request: NextRequest) {
  // Small debug helper during dev – remove or comment out in prod if noisy
  // console.log("[middleware] ⇢", request.nextUrl.pathname);

  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Auth pages - separate login/signup from org-setup
  const setupPages = [/^\/setup-admin$/, /^\/org-setup$/];

  // Organization-scoped routes pattern: /<orgId>/...
  const orgScopedRoutes =
    /^\/[a-zA-Z0-9_-]+\/(dashboard|teams|projects|issues|settings)/;

  // Global user routes that don't require organization context
  const globalUserRoutes = [/^\/settings\/profile$/];

  const isSetupPage = setupPages.some((re) => re.test(pathname));
  const isOrgScopedRoute = orgScopedRoutes.test(pathname);
  const isGlobalUserRoute = globalUserRoutes.some((re) => re.test(pathname));

  const requiresAuth = isOrgScopedRoute || isGlobalUserRoute || isSetupPage;

  // ---------------------------------------------------------------------
  // 0️⃣  First-run bootstrap: if there are no users in the system, any
  // unauthenticated request (except to /setup-admin itself) should go to
  // the admin bootstrap page instead of /auth/login.
  // ---------------------------------------------------------------------

  // Specific flag for the initial admin bootstrap page to avoid self-redirects
  const isAdminBootstrapPage = /^\/setup-admin$/.test(pathname);

  if (!sessionCookie && !isAdminBootstrapPage) {
    // Cheap cache – we only call the API once per request but it's fast.
    const res = await fetch(new URL("/api/system/has-admin", request.url), {
      headers: { "x-internal": "true" },
      next: { revalidate: 60 }, // cache for a minute at edge
    });

    if (res.ok) {
      const data: { hasAdmin: boolean } = await res.json();
      if (!data.hasAdmin) {
        return NextResponse.redirect(new URL("/setup-admin", request.url));
      }
    }
  }

  // Redirect unauthenticated users away from protected pages (normal flow)
  if (!sessionCookie && requiresAuth && !isSetupPage) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Let the client-side handle redirect when a valid session exists to avoid loops

  return NextResponse.next();
}

// Exclude Next.js internals and static assets from running this middleware.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

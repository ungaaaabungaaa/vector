import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// --- Middleware entry (runs on every request) ---
export default function middleware(request: NextRequest) {
  console.log("[middleware] ⇢", request.nextUrl.pathname);

  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Define routes that never require auth (root, assets etc.)
  const alwaysPublic = [/^\/$/];

  // Auth pages - separate login/signup from org-setup
  const loginPages = [/^\/auth(\/.*)?$/];
  const setupPages = [/^\/setup-admin$/, /^\/org-setup$/];

  // Organization-scoped routes pattern: /<orgId>/...
  const orgScopedRoutes =
    /^\/[a-zA-Z0-9_-]+\/(dashboard|teams|projects|issues|settings)/;

  // Global user routes that don't require organization context
  const globalUserRoutes = [/^\/settings\/profile$/];

  const isAlwaysPublic = alwaysPublic.some((re) => re.test(pathname));
  const isLoginPage = loginPages.some((re) => re.test(pathname));
  const isSetupPage = setupPages.some((re) => re.test(pathname));
  const isOrgScopedRoute = orgScopedRoutes.test(pathname);
  const isGlobalUserRoute = globalUserRoutes.some((re) => re.test(pathname));

  const isPublic = isAlwaysPublic || isLoginPage || isSetupPage;
  const requiresAuth = isOrgScopedRoute || isGlobalUserRoute || isSetupPage;

  // Redirect unauthenticated users away from protected pages
  if (!sessionCookie && requiresAuth && !isSetupPage) {
    console.log("[middleware] unauthenticated ⇢ redirect to /auth/login");
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect unauthenticated users from setup pages to login
  if (!sessionCookie && isSetupPage) {
    console.log("[middleware] unauthenticated setup ⇢ redirect to /auth/login");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Only redirect authenticated users from login pages, NOT from setup pages
  if (sessionCookie && isLoginPage) {
    console.log("[middleware] authenticated ⇢ redirect home");
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Exclude Next.js internals and static assets from running this middleware.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

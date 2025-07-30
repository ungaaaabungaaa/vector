// Convex handles auth via HTTP routes in convex/http.ts
// This file should be removed or redirected to Convex auth endpoints
export function GET() {
  return new Response("Auth handled by Convex", { status: 404 });
}

export function POST() {
  return new Response("Auth handled by Convex", { status: 404 });
}

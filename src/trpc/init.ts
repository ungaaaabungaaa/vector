import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/auth/auth";
import { db } from "@/db";

/**
 * Build the tRPC context for every request.
 * We fetch the BetterAuth session (if any) once per request and reuse it across
 * all resolvers (thanks to `react/cache`).  You can extend this with
 * additional per-request data — e.g. Prisma/Drizzle transaction, headers, etc.
 */
export const createTRPCContext = async (opts: { req: Request }) => {
  // Better Auth needs the request headers to resolve the session
  const session = await auth.api.getSession({ headers: opts.req.headers });

  return {
    db,
    session,
  };
};

// ---------------------------------------------------------------------------
// tRPC bootstrap — wire the Context to the router/procedure helpers
// ---------------------------------------------------------------------------
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
const t = initTRPC.context<Context>().create();

/**
 * Helper factories re-exported for router/procedure creation.
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ next, ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

export function getUserId(ctx: Context): string {
  // Better Auth returns session.user.id
  return (ctx.session as any).user.id;
}

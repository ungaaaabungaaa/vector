import { createTRPCRouter } from "@/trpc/init";
import { userRouter } from "./user.router";
import { teamRouter } from "./team.router";
import { projectRouter } from "./project.router";
import { issueRouter } from "./issue.router";
import { organizationRouter } from "./organization.router";

export const appRouter = createTRPCRouter({
  user: userRouter,
  team: teamRouter,
  project: projectRouter,
  issue: issueRouter,
  organization: organizationRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;

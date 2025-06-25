import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { createAdminUser } from "@/entities/users/user.service";
import { z } from "zod";

export const userRouter = createTRPCRouter({
  /**
   * Bootstrap the very first administrator.
   *
   * 1. Accepts credentials + profile for the admin account.
   * 2. Checks if an admin already exists; if not, creates one (user + account rows).
   * 3. Subsequent calls will throw to prevent multiple bootstrap actions.
   */
  bootstrapAdmin: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        username: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { name, email, password, username } = input;

      const { id } = await createAdminUser({
        name,
        email,
        password,
        username,
      });

      return { id } as const;
    }),
});

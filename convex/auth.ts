import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { username } from 'better-auth/plugins';
import { v } from 'convex/values';
import { components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { DataModel } from './_generated/dataModel';
import { internalMutation, query } from './_generated/server';
import authConfig from './auth.config';
import authSchema from './betterAuth/schema';

const betterAuthSecret =
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'dev-only-better-auth-secret-change-me';

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const getTrustedOrigins = () => [getBaseUrl()];

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    authFunctions,
    local: {
      schema: authSchema,
    },
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          const userId = await ctx.db.insert('users', {
            name: authUser.name,
            email: authUser.email,
            image: authUser.image ?? undefined,
            emailVerificationTime: authUser.emailVerified
              ? authUser.updatedAt
              : undefined,
            username: authUser.username ?? undefined,
          });

          await authComponent.setUserId(ctx, authUser._id, userId);
        },
        onUpdate: async (ctx, newAuthUser) => {
          if (!newAuthUser.userId) {
            return;
          }

          await ctx.db.patch('users', newAuthUser.userId as Id<'users'>, {
            name: newAuthUser.name,
            email: newAuthUser.email,
            image: newAuthUser.image ?? undefined,
            emailVerificationTime: newAuthUser.emailVerified
              ? newAuthUser.updatedAt
              : undefined,
            username: newAuthUser.username ?? undefined,
          });
        },
        onDelete: async (ctx, authUser) => {
          if (!authUser.userId) {
            return;
          }

          await ctx.db.delete('users', authUser.userId as Id<'users'>);
        },
      },
    },
  },
);

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const getCurrentAuthUser = query({
  args: {},
  handler: async ctx => {
    return await authComponent.safeGetAuthUser(ctx);
  },
});

export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
): BetterAuthOptions => ({
  baseURL: getBaseUrl(),
  trustedOrigins: getTrustedOrigins(),
  secret: betterAuthSecret,
  database: authComponent.adapter(ctx),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      userId: {
        type: 'string',
        required: false,
      },
    },
  },
  plugins: [
    username(),
    convex({
      authConfig,
      jwksRotateOnTokenGenerationError: true,
    }),
  ],
  logger: { disabled: false },
});

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

export const setBootstrapAdminRole = internalMutation({
  args: {
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAnyUserById(ctx, args.authUserId);

    if (!authUser?.userId) {
      throw new Error('Failed to locate bootstrap admin user');
    }

    const userId = authUser.userId as Id<'users'>;

    await ctx.db.patch('users', userId, {
      role: 'admin',
    });

    return userId;
  },
});

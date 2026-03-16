import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { APIError, betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { username, emailOTP } from 'better-auth/plugins';
import type { GenericActionCtx, GenericMutationCtx } from 'convex/server';
import { v } from 'convex/values';
import { api, components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { DataModel } from './_generated/dataModel';
import { internalMutation, query } from './_generated/server';
import authConfig from './auth.config';
import authSchema from './betterAuth/schema';
import {
  evaluateSignupEmailAddress,
  hasPlatformAdminUsers,
  PLATFORM_ADMIN_ROLE,
} from './platformAdmin/lib';

const betterAuthSecret =
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'dev-only-better-auth-secret-change-me';

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const getTrustedOrigins = () => {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([getBaseUrl(), 'https://vector.imai.studio', ...configuredOrigins]),
  );
};

const authFunctions: AuthFunctions = internal.auth;

const hasScheduler = (
  ctx: GenericCtx<DataModel>,
): ctx is GenericActionCtx<DataModel> | GenericMutationCtx<DataModel> =>
  'scheduler' in ctx;

function normalizeUserId(
  ctx: Pick<GenericMutationCtx<DataModel>, 'db'>,
  userId: string | null | undefined,
): Id<'users'> | null {
  return userId ? ctx.db.normalizeId('users', userId) : null;
}

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
          const userId = normalizeUserId(ctx, newAuthUser.userId);
          if (!userId) {
            return;
          }

          await ctx.db.patch('users', userId, {
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
          const userId = normalizeUserId(ctx, authUser.userId);
          if (!userId) {
            return;
          }

          await ctx.db.delete('users', userId);
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
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
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
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (context?.path !== '/sign-up/email') {
            return { data: user };
          }

          const hasPlatformAdmins =
            'db' in ctx
              ? await hasPlatformAdminUsers(ctx.db)
              : await ctx.runQuery(api.users.adminExists, {});
          if (!hasPlatformAdmins) {
            return { data: user };
          }

          const restriction =
            'db' in ctx
              ? await evaluateSignupEmailAddress(ctx.db, user.email)
              : await ctx.runQuery(
                  internal.platformAdmin.queries.getSignupRestrictionPreview,
                  {
                    email: user.email,
                  },
                );

          if (!restriction.blocked) {
            return { data: user };
          }

          throw new APIError('FORBIDDEN', {
            message:
              restriction.reason === 'not_allowed'
                ? 'Sign up is limited to approved email domains for this instance.'
                : 'Temporary or blocked email domains cannot sign up to this instance.',
          });
        },
      },
    },
  },
  plugins: [
    username(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[otp] ${type} for ${email}: ${otp}`);
        if (hasScheduler(ctx)) {
          await ctx.scheduler.runAfter(0, internal.email.otp.sendOtpEmail, {
            to: email,
            otp,
            type,
          });
        }
      },
      otpLength: 4,
      expiresIn: 900,
      allowedAttempts: 5,
    }),
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

    const userId = normalizeUserId(ctx, authUser?.userId);
    if (!userId) {
      throw new Error('Failed to locate bootstrap admin user');
    }

    await ctx.db.patch('users', userId, {
      role: PLATFORM_ADMIN_ROLE,
    });

    return userId;
  },
});

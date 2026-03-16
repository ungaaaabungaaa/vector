import { ConvexError, v } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server';
import {
  ensureSiteSettings,
  MAX_DOMAIN_RULE_BATCH_SIZE,
  MAX_MANUAL_SIGNUP_DOMAIN_RULES,
  normalizeDomainList,
  requirePlatformAdminUser,
} from './lib';

type DisposableDomainSyncStats = {
  lastStartedAt?: number;
  lastSyncedAt?: number;
  lastFailureAt?: number;
  lastFailureMessage?: string;
  totalRulesCount: number;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
  skippedCount: number;
};

async function upsertSyncStats(
  ctx: MutationCtx,
  sync: DisposableDomainSyncStats,
): Promise<void> {
  const settingsId = await ensureSiteSettings(ctx.db);
  await ctx.db.patch('siteSettings', settingsId, {
    signupDisposableDomainSync: sync,
  });
}

export const saveGitHubAppInstallation = internalMutation({
  args: {
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settingsId = await ensureSiteSettings(ctx.db);
    await ctx.db.patch('siteSettings', settingsId, {
      githubAppInstallationId: args.installationId,
      githubAppAccountLogin: args.accountLogin,
      githubAppAccountType: args.accountType,
      githubAppConnectedAt: Date.now(),
      githubAppUpdatedAt: Date.now(),
    });
  },
});

export const setGitHubAppEncryptedToken = internalMutation({
  args: {
    encryptedToken: v.optional(v.string()),
    tokenFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settingsId = await ensureSiteSettings(ctx.db);
    await ctx.db.patch('siteSettings', settingsId, {
      githubAppEncryptedToken: args.encryptedToken,
      githubAppTokenFingerprint: args.tokenFingerprint,
      githubAppUpdatedAt: Date.now(),
    });
  },
});

export const removeGitHubAppToken = internalMutation({
  args: {},
  handler: async ctx => {
    const settingsId = await ensureSiteSettings(ctx.db);
    await ctx.db.patch('siteSettings', settingsId, {
      githubAppEncryptedToken: undefined,
      githubAppTokenFingerprint: undefined,
      githubAppUpdatedAt: Date.now(),
    });
  },
});

export const saveGitHubAppCredentials = internalMutation({
  args: {
    appId: v.optional(v.string()),
    encryptedPrivateKey: v.optional(v.string()),
    encryptedWebhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settingsId = await ensureSiteSettings(ctx.db);
    await ctx.db.patch('siteSettings', settingsId, {
      githubAppId: args.appId,
      githubAppEncryptedPrivateKey: args.encryptedPrivateKey,
      githubAppEncryptedWebhookSecret: args.encryptedWebhookSecret,
      githubAppUpdatedAt: Date.now(),
    });
  },
});

export const updateSignupEmailDomainPolicy = mutation({
  args: {
    blockedDomains: v.array(v.string()),
    allowedDomains: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    await requirePlatformAdminUser(ctx.db, userId);

    const normalizedBlocked = normalizeDomainList(args.blockedDomains);
    const normalizedAllowed = normalizeDomainList(args.allowedDomains);

    if (normalizedBlocked.invalid.length > 0) {
      throw new ConvexError(
        `Invalid blocked domains: ${normalizedBlocked.invalid.slice(0, 10).join(', ')}`,
      );
    }

    if (normalizedAllowed.invalid.length > 0) {
      throw new ConvexError(
        `Invalid allowed domains: ${normalizedAllowed.invalid.slice(0, 10).join(', ')}`,
      );
    }

    if (normalizedBlocked.domains.length > MAX_MANUAL_SIGNUP_DOMAIN_RULES) {
      throw new ConvexError(
        `Blocked domains exceed limit (${MAX_MANUAL_SIGNUP_DOMAIN_RULES}). Use upstream sync for large disposable lists.`,
      );
    }

    if (normalizedAllowed.domains.length > MAX_MANUAL_SIGNUP_DOMAIN_RULES) {
      throw new ConvexError(
        `Allowed domains exceed limit (${MAX_MANUAL_SIGNUP_DOMAIN_RULES}).`,
      );
    }

    const settingsId = await ensureSiteSettings(ctx.db);
    await ctx.db.patch('siteSettings', settingsId, {
      signupBlockedEmailDomains: normalizedBlocked.domains,
      signupAllowedEmailDomains: normalizedAllowed.domains,
    });

    return null;
  },
});

export const updateBranding = mutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logoStorageId: v.optional(v.id('_storage')),
    removeLogo: v.optional(v.boolean()),
    themeColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    await requirePlatformAdminUser(ctx.db, userId);

    const settingsId = await ensureSiteSettings(ctx.db);
    const settings = await ctx.db.get('siteSettings', settingsId);

    const patch: Record<string, unknown> = {};

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (trimmed.length === 0 || trimmed.length > 50) {
        throw new ConvexError(
          'Brand name must be between 1 and 50 characters.',
        );
      }
      patch.brandName = trimmed;
    }

    if (args.description !== undefined) {
      patch.brandDescription = args.description.trim().slice(0, 200);
    }

    if (args.removeLogo) {
      if (settings?.brandLogo) {
        await ctx.storage.delete(settings.brandLogo);
      }
      patch.brandLogo = undefined;
    } else if (args.logoStorageId !== undefined) {
      // Delete old logo if replacing
      if (settings?.brandLogo) {
        await ctx.storage.delete(settings.brandLogo);
      }
      patch.brandLogo = args.logoStorageId;
    }

    if (args.themeColor !== undefined) {
      patch.brandThemeColor = args.themeColor;
    }

    if (args.accentColor !== undefined) {
      patch.brandAccentColor = args.accentColor;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch('siteSettings', settingsId, patch);
    }

    return null;
  },
});

export const generateBrandLogoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    await requirePlatformAdminUser(ctx.db, userId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const upsertSignupEmailDomainRulesBatch = internalMutation({
  args: {
    domains: v.array(v.string()),
    type: v.union(v.literal('blocked'), v.literal('allowed')),
    source: v.union(v.literal('manual'), v.literal('upstream_disposable')),
  },
  returns: v.object({
    totalProcessed: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.domains.length > MAX_DOMAIN_RULE_BATCH_SIZE) {
      throw new ConvexError(
        `Batch too large. Max ${MAX_DOMAIN_RULE_BATCH_SIZE} domains per batch.`,
      );
    }

    const normalized = normalizeDomainList(args.domains);
    const now = Date.now();
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const domain of normalized.domains) {
      const existing = await ctx.db
        .query('signupEmailDomainRules')
        .withIndex('by_type_domain', q =>
          q.eq('type', args.type).eq('domain', domain),
        )
        .first();

      if (!existing) {
        await ctx.db.insert('signupEmailDomainRules', {
          domain,
          type: args.type,
          source: args.source,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount += 1;
        continue;
      }

      if (existing.source === 'manual' && args.source !== 'manual') {
        skippedCount += 1;
        continue;
      }

      await ctx.db.patch('signupEmailDomainRules', existing._id, {
        source: args.source,
        updatedAt: now,
      });
      updatedCount += 1;
    }

    return {
      totalProcessed: normalized.domains.length,
      insertedCount,
      updatedCount,
      skippedCount,
    };
  },
});

export const deleteSignupEmailDomainRulesBatch = internalMutation({
  args: {
    domains: v.array(v.string()),
    type: v.union(v.literal('blocked'), v.literal('allowed')),
    source: v.union(v.literal('manual'), v.literal('upstream_disposable')),
  },
  returns: v.object({
    deletedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.domains.length > MAX_DOMAIN_RULE_BATCH_SIZE) {
      throw new ConvexError(
        `Batch too large. Max ${MAX_DOMAIN_RULE_BATCH_SIZE} domains per batch.`,
      );
    }

    const normalized = normalizeDomainList(args.domains);
    let deletedCount = 0;
    let skippedCount = 0;

    for (const domain of normalized.domains) {
      while (true) {
        const existing = await ctx.db
          .query('signupEmailDomainRules')
          .withIndex('by_type_domain', q =>
            q.eq('type', args.type).eq('domain', domain),
          )
          .first();

        if (!existing) {
          break;
        }

        if (existing.source !== args.source) {
          skippedCount += 1;
          break;
        }

        await ctx.db.delete('signupEmailDomainRules', existing._id);
        deletedCount += 1;
      }
    }

    return {
      deletedCount,
      skippedCount,
    };
  },
});

export const setDisposableDomainSyncStarted = internalMutation({
  args: {
    startedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settingsId = await ensureSiteSettings(ctx.db);
    const settings = await ctx.db.get('siteSettings', settingsId);

    const previous = settings?.signupDisposableDomainSync;
    await ctx.db.patch('siteSettings', settingsId, {
      signupDisposableDomainSync: {
        totalRulesCount: previous?.totalRulesCount ?? 0,
        fetchedCount: previous?.fetchedCount ?? 0,
        insertedCount: previous?.insertedCount ?? 0,
        updatedCount: previous?.updatedCount ?? 0,
        deletedCount: previous?.deletedCount ?? 0,
        skippedCount: previous?.skippedCount ?? 0,
        lastStartedAt: args.startedAt,
        lastSyncedAt: previous?.lastSyncedAt,
        lastFailureAt: previous?.lastFailureAt,
        lastFailureMessage: previous?.lastFailureMessage,
      },
    });

    return null;
  },
});

export const completeDisposableDomainSync = internalMutation({
  args: {
    startedAt: v.number(),
    completedAt: v.number(),
    fetchedCount: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
    skippedCount: v.number(),
    totalRulesCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertSyncStats(ctx, {
      totalRulesCount: args.totalRulesCount,
      fetchedCount: args.fetchedCount,
      insertedCount: args.insertedCount,
      updatedCount: args.updatedCount,
      deletedCount: args.deletedCount,
      skippedCount: args.skippedCount,
      lastStartedAt: args.startedAt,
      lastSyncedAt: args.completedAt,
      lastFailureAt: undefined,
      lastFailureMessage: undefined,
    });

    return null;
  },
});

export const failDisposableDomainSync = internalMutation({
  args: {
    startedAt: v.number(),
    failedAt: v.number(),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settingsId = await ensureSiteSettings(ctx.db);
    const settings = await ctx.db.get('siteSettings', settingsId);
    const previous = settings?.signupDisposableDomainSync;

    await ctx.db.patch('siteSettings', settingsId, {
      signupDisposableDomainSync: {
        totalRulesCount: previous?.totalRulesCount ?? 0,
        fetchedCount: previous?.fetchedCount ?? 0,
        insertedCount: previous?.insertedCount ?? 0,
        updatedCount: previous?.updatedCount ?? 0,
        deletedCount: previous?.deletedCount ?? 0,
        skippedCount: previous?.skippedCount ?? 0,
        lastStartedAt: args.startedAt,
        lastSyncedAt: previous?.lastSyncedAt,
        lastFailureAt: args.failedAt,
        lastFailureMessage: args.message,
      },
    });

    return null;
  },
});

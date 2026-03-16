'use node';

import { ConvexError, v } from 'convex/values';
import { api, internal } from '../_generated/api';
import { action, internalAction } from '../_generated/server';
import { MAX_DOMAIN_RULE_BATCH_SIZE, normalizeDomainList } from './lib';
import { encryptSecret, fingerprintSecret } from '../github/node';

const DISPOSABLE_DOMAINS_FEED_URL =
  'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt';
const FEED_REQUEST_TIMEOUT_MS = 30_000;

type DisposableDomainSyncResult = {
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
  skippedCount: number;
  totalRulesCount: number;
};

function parseDisposableDomainFeed(rawText: string): string[] {
  const candidates = rawText
    .split(/\r?\n/)
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0 && !line.startsWith('#'));

  const normalized = normalizeDomainList(candidates);
  return normalized.domains;
}

export const saveGitHubAppConnection = action({
  args: {
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runQuery(api.platformAdmin.queries.assertPlatformAdmin, {});
    } catch {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.runMutation(
      internal.platformAdmin.mutations.saveGitHubAppInstallation,
      {
        installationId: args.installationId,
        accountLogin: args.accountLogin,
        accountType: args.accountType,
      },
    );

    return { success: true } as const;
  },
});

export const saveGitHubAppToken = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runQuery(api.platformAdmin.queries.assertPlatformAdmin, {});
    } catch {
      throw new ConvexError('FORBIDDEN');
    }

    const trimmed = args.token.trim();
    await ctx.runMutation(
      internal.platformAdmin.mutations.setGitHubAppEncryptedToken,
      {
        encryptedToken: encryptSecret(trimmed),
        tokenFingerprint: fingerprintSecret(trimmed),
      },
    );

    return { success: true } as const;
  },
});

export const removeGitHubAppToken = action({
  args: {},
  handler: async ctx => {
    try {
      await ctx.runQuery(api.platformAdmin.queries.assertPlatformAdmin, {});
    } catch {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.runMutation(
      internal.platformAdmin.mutations.removeGitHubAppToken,
      {},
    );

    return { success: true } as const;
  },
});

export const saveGitHubAppCredentials = action({
  args: {
    appId: v.optional(v.string()),
    privateKey: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runQuery(api.platformAdmin.queries.assertPlatformAdmin, {});
    } catch {
      throw new ConvexError('FORBIDDEN');
    }

    const encryptedPrivateKey = args.privateKey
      ? encryptSecret(args.privateKey)
      : undefined;
    const encryptedWebhookSecret = args.webhookSecret
      ? encryptSecret(args.webhookSecret)
      : undefined;

    await ctx.runMutation(
      internal.platformAdmin.mutations.saveGitHubAppCredentials,
      {
        appId: args.appId,
        encryptedPrivateKey,
        encryptedWebhookSecret,
      },
    );

    return { success: true } as const;
  },
});

export const syncDisposableEmailDomains = internalAction({
  args: {},
  returns: v.object({
    fetchedCount: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
    skippedCount: v.number(),
    totalRulesCount: v.number(),
  }),
  handler: async ctx => {
    const startedAt = Date.now();

    await ctx.runMutation(
      internal.platformAdmin.mutations.setDisposableDomainSyncStarted,
      {
        startedAt,
      },
    );

    try {
      const existingUpstreamDomains = new Set<string>();
      let cursor: string | undefined;

      while (true) {
        const page = await ctx.runQuery(
          internal.platformAdmin.queries.listSignupEmailDomainRulesPageBySource,
          {
            source: 'upstream_disposable',
            cursor,
            limit: 1_000,
          },
        );

        for (const domain of page.domains) {
          existingUpstreamDomains.add(domain);
        }

        if (page.isDone || !page.continueCursor) {
          break;
        }

        cursor = page.continueCursor;
      }

      const response = await fetch(DISPOSABLE_DOMAINS_FEED_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(FEED_REQUEST_TIMEOUT_MS),
        headers: {
          'User-Agent': 'vector-disposable-domain-sync/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch disposable email domains feed: HTTP ${response.status}`,
        );
      }

      const rawFeed = await response.text();
      const fetchedDomains = parseDisposableDomainFeed(rawFeed);
      const fetchedDomainSet = new Set(fetchedDomains);
      const missingDomains = fetchedDomains.filter(
        domain => !existingUpstreamDomains.has(domain),
      );
      const staleDomains = Array.from(existingUpstreamDomains).filter(
        domain => !fetchedDomainSet.has(domain),
      );

      let insertedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let skippedCount = fetchedDomains.length - missingDomains.length;

      for (
        let index = 0;
        index < missingDomains.length;
        index += MAX_DOMAIN_RULE_BATCH_SIZE
      ) {
        const chunk = missingDomains.slice(
          index,
          index + MAX_DOMAIN_RULE_BATCH_SIZE,
        );

        if (chunk.length === 0) {
          continue;
        }

        const result = await ctx.runMutation(
          internal.platformAdmin.mutations.upsertSignupEmailDomainRulesBatch,
          {
            domains: chunk,
            type: 'blocked',
            source: 'upstream_disposable',
          },
        );

        insertedCount += result.insertedCount;
        updatedCount += result.updatedCount;
        skippedCount += result.skippedCount;
      }

      for (
        let index = 0;
        index < staleDomains.length;
        index += MAX_DOMAIN_RULE_BATCH_SIZE
      ) {
        const chunk = staleDomains.slice(
          index,
          index + MAX_DOMAIN_RULE_BATCH_SIZE,
        );

        if (chunk.length === 0) {
          continue;
        }

        const result = await ctx.runMutation(
          internal.platformAdmin.mutations.deleteSignupEmailDomainRulesBatch,
          {
            domains: chunk,
            type: 'blocked',
            source: 'upstream_disposable',
          },
        );

        deletedCount += result.deletedCount;
        skippedCount += result.skippedCount;
      }

      const completedAt = Date.now();

      await ctx.runMutation(
        internal.platformAdmin.mutations.completeDisposableDomainSync,
        {
          startedAt,
          completedAt,
          fetchedCount: fetchedDomains.length,
          insertedCount,
          updatedCount,
          deletedCount,
          skippedCount,
          totalRulesCount: fetchedDomains.length,
        },
      );

      return {
        fetchedCount: fetchedDomains.length,
        insertedCount,
        updatedCount,
        deletedCount,
        skippedCount,
        totalRulesCount: fetchedDomains.length,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Disposable domain sync failed';

      await ctx.runMutation(
        internal.platformAdmin.mutations.failDisposableDomainSync,
        {
          startedAt,
          failedAt: Date.now(),
          message,
        },
      );

      throw error;
    }
  },
});

export const runDisposableDomainSyncNow = action({
  args: {},
  returns: v.object({
    fetchedCount: v.number(),
    insertedCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
    skippedCount: v.number(),
    totalRulesCount: v.number(),
  }),
  handler: async (ctx): Promise<DisposableDomainSyncResult> => {
    try {
      await ctx.runQuery(api.platformAdmin.queries.assertPlatformAdmin, {});
    } catch {
      throw new ConvexError('FORBIDDEN');
    }

    return await ctx.runAction(
      internal.platformAdmin.actions.syncDisposableEmailDomains,
      {},
    );
  },
});

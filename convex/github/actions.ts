'use node';

import { ConvexError, v } from 'convex/values';
import { action, internalAction } from '../_generated/server';
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { PERMISSIONS } from '../_shared/permissions';
import {
  decryptSecret,
  encryptSecret,
  fetchCommit,
  fetchIssue,
  fetchPullRequest,
  fingerprintSecret,
  generateGitHubWebhookSecret,
  listInstallationRepositories,
  listRecentCommits,
  listRecentIssues,
  listRecentPullRequests,
  parseGitHubUrl,
  verifyGitHubWebhookSignature,
  withGitHubToken,
} from './node';
import { extractIssueKeysFromText } from './shared';

async function requireOrgSettingsAccess(ctx: any, orgSlug: string) {
  const allowed = await ctx.runQuery(api.permissions.queries.has, {
    orgSlug,
    permission: PERMISSIONS.ORG_MANAGE_SETTINGS,
  });
  if (!allowed) {
    throw new ConvexError('FORBIDDEN');
  }

  return await ctx.runQuery(api.organizations.queries.getBySlug, { orgSlug });
}

async function requireIssueEditAccess(
  ctx: any,
  orgSlug: string,
  issueKey: string,
) {
  const allowed = await ctx.runQuery(api.permissions.queries.has, {
    orgSlug,
    permission: PERMISSIONS.ISSUE_EDIT,
  });
  if (!allowed) {
    throw new ConvexError('FORBIDDEN');
  }

  const issue = await ctx.runQuery(api.issues.queries.getByKey, {
    orgSlug,
    issueKey,
  });

  if (!issue) {
    throw new ConvexError('ISSUE_NOT_FOUND');
  }

  return issue;
}

async function loadGitHubAuth(
  ctx: any,
  organizationId: Id<'organizations'>,
): Promise<{
  integration: any;
  repositories: any[];
  fallbackToken: string | null;
  appCredentials?: { appId: string; privateKey: string };
}> {
  const platformCreds = await ctx.runQuery(
    internal.platformAdmin.queries.getGitHubAppCredentials,
    {},
  );

  const result: {
    integration: any;
    repositories: any[];
  } = await ctx.runQuery(
    internal.github.queries.getIntegrationForOrganization,
    {
      organizationId,
    },
  );
  const { integration, repositories } = result;

  const encryptedToken = integration?.encryptedToken ?? null;
  const fallbackToken = encryptedToken ? decryptSecret(encryptedToken) : null;

  // WIP: platform app credentials are still plumbed through for the
  // installation-token path, but workspace GitHub connectivity itself should be
  // modeled as org-owned. Avoid adding new product flows that depend on
  // platform-level GitHub auth here without revisiting that design.
  const appCredentials =
    platformCreds.appId && platformCreds.encryptedPrivateKey
      ? {
          appId: platformCreds.appId,
          privateKey: decryptSecret(platformCreds.encryptedPrivateKey),
        }
      : undefined;

  return {
    integration,
    repositories,
    fallbackToken,
    appCredentials,
  };
}

async function syncRepositoriesForOrganization(
  ctx: any,
  organizationId: Id<'organizations'>,
) {
  const { integration, fallbackToken, appCredentials } = await loadGitHubAuth(
    ctx,
    organizationId,
  );

  const repositories: any[] = await withGitHubToken({
    installationId: integration?.installationId,
    fallbackToken,
    appCredentials,
    run: async token => {
      const result = await listInstallationRepositories(token);
      return result.repositories;
    },
  });

  await ctx.runMutation(internal.github.mutations.replaceRepositories, {
    organizationId,
    repositories: repositories.map(repo => ({
      githubRepoId: repo.id,
      nodeId: repo.node_id ?? undefined,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch ?? undefined,
      private: repo.private,
      installationAccessible: true,
      lastPushedAt: repo.pushed_at ? Date.parse(repo.pushed_at) : undefined,
    })),
  });

  await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
    organizationId,
    lastReconciledAt: Date.now(),
    clearFailure: true,
  });

  return repositories.length;
}

async function ensureRepository(
  ctx: any,
  organizationId: Id<'organizations'>,
  repo: {
    id: number;
    node_id?: string | null;
    name: string;
    full_name: string;
    private: boolean;
    default_branch?: string | null;
    pushed_at?: string | null;
    owner: { login: string };
  },
) {
  const repositoryId = await ctx.runMutation(
    internal.github.mutations.upsertWebhookRepository,
    {
      organizationId,
      githubRepoId: repo.id,
      nodeId: repo.node_id ?? undefined,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch ?? undefined,
      private: repo.private,
      lastPushedAt: repo.pushed_at ? Date.parse(repo.pushed_at) : undefined,
    },
  );

  const repository = await ctx.runQuery(
    internal.github.queries.getRepositoryByFullName,
    {
      organizationId,
      fullName: repo.full_name,
    },
  );

  if (!repository) {
    throw new Error(`Failed to persist repository ${repo.full_name}`);
  }

  if (String(repository._id) !== String(repositoryId)) {
    const ensuredRepository = await ctx.runQuery(
      internal.github.queries.getRepositoryByFullName,
      {
        organizationId,
        fullName: repo.full_name,
      },
    );
    if (ensuredRepository) {
      return ensuredRepository;
    }
  }

  return repository;
}

async function persistPullRequestPayload(
  ctx: any,
  args: {
    organizationId: Id<'organizations'>;
    repository: any;
    payload: any;
  },
) {
  const state = args.payload.merged_at
    ? 'merged'
    : args.payload.state === 'closed'
      ? 'closed'
      : args.payload.draft
        ? 'draft'
        : 'open';

  const pullRequestId = await ctx.runMutation(
    internal.github.mutations.upsertPullRequest,
    {
      organizationId: args.organizationId,
      repositoryId: args.repository._id,
      githubPullRequestId: args.payload.id,
      nodeId: args.payload.node_id ?? undefined,
      number: args.payload.number,
      title: args.payload.title,
      body: args.payload.body ?? undefined,
      url: args.payload.html_url,
      state,
      isDraft: Boolean(args.payload.draft),
      headRefName: args.payload.head?.ref ?? undefined,
      baseRefName: args.payload.base?.ref ?? undefined,
      authorLogin: args.payload.user?.login ?? undefined,
      authorAvatarUrl: args.payload.user?.avatar_url ?? undefined,
      assigneeLogins: Array.isArray(args.payload.assignees)
        ? args.payload.assignees
            .map((a: any) => a?.login)
            .filter((l: unknown): l is string => typeof l === 'string')
        : undefined,
      mergedAt: args.payload.merged_at
        ? Date.parse(args.payload.merged_at)
        : undefined,
      closedAt: args.payload.closed_at
        ? Date.parse(args.payload.closed_at)
        : undefined,
      lastActivityAt: Date.parse(
        args.payload.updated_at ??
          args.payload.created_at ??
          new Date().toISOString(),
      ),
    },
  );

  const issueKeys = extractIssueKeysFromText(
    args.payload.title,
    args.payload.body,
    args.payload.head?.ref,
  );

  await ctx.runMutation(internal.github.mutations.syncPullRequestLinks, {
    organizationId: args.organizationId,
    pullRequestId,
    repoFullName: args.repository.fullName,
    number: args.payload.number,
    issueKeys,
  });

  return pullRequestId;
}

async function persistGitHubIssuePayload(
  ctx: any,
  args: {
    organizationId: Id<'organizations'>;
    repository: any;
    payload: any;
  },
) {
  if (args.payload.pull_request) {
    return null;
  }

  const githubIssueId = await ctx.runMutation(
    internal.github.mutations.upsertGitHubIssue,
    {
      organizationId: args.organizationId,
      repositoryId: args.repository._id,
      githubIssueId: args.payload.id,
      nodeId: args.payload.node_id ?? undefined,
      number: args.payload.number,
      title: args.payload.title,
      body: args.payload.body ?? undefined,
      url: args.payload.html_url,
      state: args.payload.state,
      authorLogin: args.payload.user?.login ?? undefined,
      authorAvatarUrl: args.payload.user?.avatar_url ?? undefined,
      closedAt: args.payload.closed_at
        ? Date.parse(args.payload.closed_at)
        : undefined,
      lastActivityAt: Date.parse(
        args.payload.updated_at ??
          args.payload.created_at ??
          new Date().toISOString(),
      ),
    },
  );

  const issueKeys = extractIssueKeysFromText(
    args.payload.title,
    args.payload.body,
  );

  await ctx.runMutation(internal.github.mutations.syncGitHubIssueLinks, {
    organizationId: args.organizationId,
    githubIssueId,
    repoFullName: args.repository.fullName,
    number: args.payload.number,
    issueKeys,
  });

  return githubIssueId;
}

async function persistCommitPayload(
  ctx: any,
  args: {
    organizationId: Id<'organizations'>;
    repository: any;
    payload: any;
  },
) {
  const commitMessage: string =
    args.payload.commit?.message ?? args.payload.message ?? '';
  const [headline, ...bodyLines] = commitMessage.split('\n');
  const commitId = await ctx.runMutation(
    internal.github.mutations.upsertCommit,
    {
      organizationId: args.organizationId,
      repositoryId: args.repository._id,
      sha: args.payload.sha,
      shortSha: String(args.payload.sha).slice(0, 7),
      messageHeadline: headline || String(args.payload.sha).slice(0, 7),
      messageBody: bodyLines.join('\n').trim() || undefined,
      url: args.payload.html_url ?? args.payload.url,
      authorName:
        args.payload.commit?.author?.name ??
        args.payload.author?.login ??
        undefined,
      authorEmail: args.payload.commit?.author?.email ?? undefined,
      committedAt: args.payload.commit?.committer?.date
        ? Date.parse(args.payload.commit.committer.date)
        : undefined,
      authoredAt: args.payload.commit?.author?.date
        ? Date.parse(args.payload.commit.author.date)
        : undefined,
    },
  );

  const issueKeys = extractIssueKeysFromText(commitMessage);
  await ctx.runMutation(internal.github.mutations.syncCommitLinks, {
    organizationId: args.organizationId,
    commitId,
    repoFullName: args.repository.fullName,
    sha: args.payload.sha,
    issueKeys,
  });

  return commitId;
}

export const saveInstallationConnection = action({
  args: {
    orgSlug: v.string(),
    installationId: v.number(),
    installationAccountLogin: v.optional(v.string()),
    installationAccountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgSettingsAccess(ctx, args.orgSlug);
    await ctx.runMutation(
      internal.github.mutations.upsertInstallationConnection,
      {
        organizationId: org._id,
        connectionMode: 'app',
        installationId: args.installationId,
        installationAccountLogin: args.installationAccountLogin,
        installationAccountType: args.installationAccountType,
      },
    );
    return { success: true } as const;
  },
});

export const saveTokenFallback = action({
  args: {
    orgSlug: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgSettingsAccess(ctx, args.orgSlug);
    await ctx.runMutation(internal.github.mutations.setEncryptedToken, {
      organizationId: org._id,
      encryptedToken: encryptSecret(args.token.trim()),
      tokenFingerprint: fingerprintSecret(args.token.trim()),
    });
    return { success: true } as const;
  },
});

export const removeTokenFallback = action({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgSettingsAccess(ctx, args.orgSlug);
    await ctx.runMutation(internal.github.mutations.setEncryptedToken, {
      organizationId: org._id,
      encryptedToken: undefined,
      tokenFingerprint: undefined,
    });
    return { success: true } as const;
  },
});

export const rotateWebhookSecret = action({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await requireOrgSettingsAccess(ctx, args.orgSlug);
    const webhookSecret = generateGitHubWebhookSecret();

    await ctx.runMutation(internal.github.mutations.setWebhookSecret, {
      organizationId: org._id,
      encryptedWebhookSecret: encryptSecret(webhookSecret),
      webhookSecretFingerprint: fingerprintSecret(webhookSecret),
    });

    return {
      success: true,
      webhookSecret,
      webhookSecretFingerprint: fingerprintSecret(webhookSecret),
    } as const;
  },
});

export const syncRepositories = action({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: true; count: number }> => {
    const org = await requireOrgSettingsAccess(ctx, args.orgSlug);
    const count = await syncRepositoriesForOrganization(ctx, org._id);
    return { success: true, count } as const;
  },
});

export const linkArtifactByUrl = action({
  args: {
    orgSlug: v.string(),
    issueKey: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const issue = await requireIssueEditAccess(
      ctx,
      args.orgSlug,
      args.issueKey,
    );
    const parsed = parseGitHubUrl(args.url.trim());
    if (!parsed) {
      throw new ConvexError('INVALID_GITHUB_URL');
    }

    const { integration, fallbackToken, appCredentials } = await loadGitHubAuth(
      ctx,
      issue.organizationId,
    );
    const existingRepository = await ctx.runQuery(
      internal.github.queries.getRepositoryByFullName,
      {
        organizationId: issue.organizationId,
        fullName: `${parsed.owner}/${parsed.repo}`,
      },
    );

    if (!existingRepository?.selected) {
      throw new ConvexError('REPOSITORY_NOT_CONNECTED');
    }

    const artifactResult = await withGitHubToken({
      installationId: integration?.installationId,
      fallbackToken,
      appCredentials,
      run: async token => {
        if (parsed.type === 'pull_request') {
          return {
            type: parsed.type,
            payload: await fetchPullRequest(
              token,
              parsed.owner,
              parsed.repo,
              parsed.number,
            ),
          };
        }
        if (parsed.type === 'issue') {
          return {
            type: parsed.type,
            payload: await fetchIssue(
              token,
              parsed.owner,
              parsed.repo,
              parsed.number,
            ),
          };
        }
        return {
          type: parsed.type,
          payload: await fetchCommit(
            token,
            parsed.owner,
            parsed.repo,
            parsed.sha,
          ),
        };
      },
    });
    const repository = existingRepository;

    const viewer = await ctx.runQuery(api.users.currentUser, {});
    if (!viewer?._id) {
      throw new ConvexError('UNAUTHORIZED');
    }

    if (artifactResult.type === 'pull_request') {
      const pullRequestId = await persistPullRequestPayload(ctx, {
        organizationId: issue.organizationId,
        repository,
        payload: artifactResult.payload,
      });
      await ctx.runMutation(internal.github.mutations.linkPullRequestManually, {
        organizationId: issue.organizationId,
        issueId: issue._id,
        pullRequestId,
        repoFullName: repository.fullName,
        number: artifactResult.payload.number,
        actorId: viewer._id,
      });
    } else if (artifactResult.type === 'issue') {
      const githubIssueId = await persistGitHubIssuePayload(ctx, {
        organizationId: issue.organizationId,
        repository,
        payload: artifactResult.payload,
      });
      if (!githubIssueId) {
        throw new ConvexError('INVALID_GITHUB_ISSUE');
      }
      await ctx.runMutation(internal.github.mutations.linkGitHubIssueManually, {
        organizationId: issue.organizationId,
        issueId: issue._id,
        githubIssueId,
        repoFullName: repository.fullName,
        number: artifactResult.payload.number,
        actorId: viewer._id,
      });
    } else {
      const commitId = await persistCommitPayload(ctx, {
        organizationId: issue.organizationId,
        repository,
        payload: artifactResult.payload,
      });
      await ctx.runMutation(internal.github.mutations.linkCommitManually, {
        organizationId: issue.organizationId,
        issueId: issue._id,
        commitId,
        repoFullName: repository.fullName,
        sha: artifactResult.payload.sha,
        actorId: viewer._id,
      });
    }

    return { success: true } as const;
  },
});

export const refreshIssueDevelopment = action({
  args: {
    issueId: v.id('issues'),
  },
  handler: async (ctx, args): Promise<{ success: true; refreshed: number }> => {
    const development: any = await ctx.runQuery(
      api.github.queries.getIssueDevelopment,
      {
        issueId: args.issueId,
      },
    );

    const links: Array<
      | { type: 'pull_request'; repo: any; number: number }
      | { type: 'issue'; repo: any; number: number }
      | { type: 'commit'; repo: any; sha: string }
    > = [
      ...development.pullRequests.map((item: any) => ({
        type: 'pull_request' as const,
        repo: item.repository,
        number: item.number,
      })),
      ...development.githubIssues.map((item: any) => ({
        type: 'issue' as const,
        repo: item.repository,
        number: item.number,
      })),
      ...development.commits.map((item: any) => ({
        type: 'commit' as const,
        repo: item.repository,
        sha: item.sha,
      })),
    ];

    if (links.length === 0) {
      return { success: true, refreshed: 0 } as const;
    }

    const organizationId = development.organizationId;

    const { integration, fallbackToken, appCredentials } = await loadGitHubAuth(
      ctx,
      organizationId,
    );

    await withGitHubToken({
      installationId: integration?.installationId,
      fallbackToken,
      appCredentials,
      run: async token => {
        for (const link of links) {
          if (!link.repo) continue;
          if (link.type === 'pull_request') {
            const payload = await fetchPullRequest(
              token,
              link.repo.owner,
              link.repo.name,
              link.number,
            );
            await persistPullRequestPayload(ctx, {
              organizationId,
              repository: link.repo,
              payload,
            });
          } else if (link.type === 'issue') {
            const payload = await fetchIssue(
              token,
              link.repo.owner,
              link.repo.name,
              link.number,
            );
            await persistGitHubIssuePayload(ctx, {
              organizationId,
              repository: link.repo,
              payload,
            });
          } else {
            const payload = await fetchCommit(
              token,
              link.repo.owner,
              link.repo.name,
              link.sha,
            );
            await persistCommitPayload(ctx, {
              organizationId,
              repository: link.repo,
              payload,
            });
          }
        }
      },
    });

    await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
      organizationId,
      lastReconciledAt: Date.now(),
      clearFailure: true,
    });

    return { success: true, refreshed: links.length } as const;
  },
});

export const processWebhook = internalAction({
  args: {
    body: v.string(),
    event: v.string(),
    deliveryId: v.optional(v.string()),
    orgSlug: v.optional(v.string()),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payload = JSON.parse(args.body);
    const repoPayload = payload.repository;

    if (args.orgSlug) {
      const integration = await ctx.runQuery(
        internal.github.queries.getIntegrationByOrgSlug,
        { orgSlug: args.orgSlug },
      );

      if (!integration) {
        return { ignored: true } as const;
      }

      const encryptedWebhookSecret =
        integration.integration?.encryptedWebhookSecret ?? null;
      const webhookSecret = encryptedWebhookSecret
        ? decryptSecret(encryptedWebhookSecret)
        : undefined;

      if (
        !integration.integration ||
        !verifyGitHubWebhookSignature(
          args.body,
          args.signature ?? null,
          webhookSecret,
        )
      ) {
        return { ignored: true } as const;
      }

      await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
        organizationId: integration.organizationId,
        lastWebhookAt: Date.now(),
        lastWebhookEvent: args.event,
      });

      const ensuredRepository = repoPayload
        ? await ensureRepository(ctx, integration.organizationId, {
            id: repoPayload.id,
            node_id: repoPayload.node_id,
            name: repoPayload.name,
            full_name: repoPayload.full_name,
            private: repoPayload.private,
            default_branch: repoPayload.default_branch,
            pushed_at: repoPayload.pushed_at,
            owner: { login: repoPayload.owner?.login ?? '' },
          })
        : null;

      if (
        args.event === 'pull_request' &&
        payload.pull_request &&
        ensuredRepository
      ) {
        await persistPullRequestPayload(ctx, {
          organizationId: integration.organizationId,
          repository: ensuredRepository,
          payload: payload.pull_request,
        });
        return { success: true } as const;
      }

      if (args.event === 'issues' && payload.issue && ensuredRepository) {
        await persistGitHubIssuePayload(ctx, {
          organizationId: integration.organizationId,
          repository: ensuredRepository,
          payload: payload.issue,
        });
        return { success: true } as const;
      }

      if (
        args.event === 'push' &&
        Array.isArray(payload.commits) &&
        ensuredRepository
      ) {
        for (const commit of payload.commits) {
          await persistCommitPayload(ctx, {
            organizationId: integration.organizationId,
            repository: ensuredRepository,
            payload: {
              ...commit,
              repository: repoPayload,
            },
          });
        }
        return { success: true } as const;
      }

      if (
        args.event === 'installation' ||
        args.event === 'installation_repositories'
      ) {
        return { success: true } as const;
      }

      return { ignored: true } as const;
    }

    const platformCreds = await ctx.runQuery(
      internal.platformAdmin.queries.getGitHubAppCredentials,
      {},
    );
    const webhookSecret = platformCreds.encryptedWebhookSecret
      ? decryptSecret(platformCreds.encryptedWebhookSecret)
      : undefined;

    if (
      !verifyGitHubWebhookSignature(
        args.body,
        args.signature ?? null,
        webhookSecret,
      )
    ) {
      throw new Error('Invalid GitHub webhook signature');
    }

    const installationId =
      typeof payload.installation?.id === 'number'
        ? payload.installation.id
        : null;

    if (
      (args.event === 'installation' ||
        args.event === 'installation_repositories') &&
      installationId
    ) {
      const integration = await ctx.runQuery(
        internal.github.queries.getIntegrationByInstallationId,
        { installationId },
      );

      if (!integration) {
        return { ignored: true } as const;
      }

      const shouldSyncRepositories =
        args.event === 'installation_repositories' ||
        payload.action === 'created' ||
        payload.action === 'new_permissions_accepted' ||
        payload.action === 'unsuspend';

      await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
        organizationId: integration.organizationId,
        lastWebhookAt: Date.now(),
        lastWebhookEvent: args.event,
      });

      if (shouldSyncRepositories) {
        try {
          await syncRepositoriesForOrganization(
            ctx,
            integration.organizationId,
          );
        } catch (error) {
          await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
            organizationId: integration.organizationId,
            lastSyncFailureAt: Date.now(),
            lastSyncFailureMessage:
              error instanceof Error
                ? error.message
                : 'GitHub installation sync failed',
          });
          throw error;
        }
      }

      return { success: true } as const;
    }

    const repoFullName: string | undefined = repoPayload?.full_name;

    let repository = null;
    if (repoFullName) {
      const integrations = await ctx.runQuery(
        internal.github.queries.listIntegrationsForReconcile,
        {},
      );
      for (const candidate of integrations) {
        repository =
          candidate.repositories.find(repo => repo.fullName === repoFullName) ??
          null;
        if (repository) break;
      }
    }

    const organizationId = repository?.organizationId;
    if (!organizationId) {
      return { ignored: true } as const;
    }

    await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
      organizationId,
      lastWebhookAt: Date.now(),
      lastWebhookEvent: args.event,
    });

    const ensuredRepository = repoPayload
      ? await ensureRepository(ctx, organizationId, {
          id: repoPayload.id,
          node_id: repoPayload.node_id,
          name: repoPayload.name,
          full_name: repoPayload.full_name,
          private: repoPayload.private,
          default_branch: repoPayload.default_branch,
          pushed_at: repoPayload.pushed_at,
          owner: { login: repoPayload.owner?.login ?? '' },
        })
      : repository;

    if (!ensuredRepository) {
      return { ignored: true } as const;
    }

    if (args.event === 'pull_request' && payload.pull_request) {
      await persistPullRequestPayload(ctx, {
        organizationId,
        repository: ensuredRepository,
        payload: payload.pull_request,
      });
      return { success: true } as const;
    }

    if (args.event === 'issues' && payload.issue) {
      await persistGitHubIssuePayload(ctx, {
        organizationId,
        repository: ensuredRepository,
        payload: payload.issue,
      });
      return { success: true } as const;
    }

    if (args.event === 'push' && Array.isArray(payload.commits)) {
      for (const commit of payload.commits) {
        await persistCommitPayload(ctx, {
          organizationId,
          repository: ensuredRepository,
          payload: {
            ...commit,
            repository: repoPayload,
          },
        });
      }
      return { success: true } as const;
    }

    if (
      args.event === 'installation' ||
      args.event === 'installation_repositories'
    ) {
      await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
        organizationId,
        lastWebhookAt: Date.now(),
        lastWebhookEvent: args.event,
      });
      return { success: true } as const;
    }

    return { ignored: true } as const;
  },
});

export const reconcileRecentArtifacts = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: true; organizations: number }> => {
    const integrations: Array<{ integration: any; repositories: any[] }> =
      await ctx.runQuery(
        internal.github.queries.listIntegrationsForReconcile,
        {},
      );

    const platformCreds = await ctx.runQuery(
      internal.platformAdmin.queries.getGitHubAppCredentials,
      {},
    );
    const appCredentials =
      platformCreds.appId && platformCreds.encryptedPrivateKey
        ? {
            appId: platformCreds.appId,
            privateKey: decryptSecret(platformCreds.encryptedPrivateKey),
          }
        : undefined;

    const sinceIso = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    for (const item of integrations) {
      const fallbackToken = item.integration.encryptedToken
        ? decryptSecret(item.integration.encryptedToken)
        : null;
      const installationId = item.integration.installationId ?? null;

      try {
        await withGitHubToken({
          installationId,
          fallbackToken,
          appCredentials,
          run: async token => {
            for (const repository of item.repositories) {
              const [pullRequests, githubIssues, commits] = await Promise.all([
                listRecentPullRequests(
                  token,
                  repository.owner,
                  repository.name,
                ),
                listRecentIssues(token, repository.owner, repository.name),
                listRecentCommits(
                  token,
                  repository.owner,
                  repository.name,
                  sinceIso,
                ),
              ]);

              for (const pr of pullRequests) {
                await persistPullRequestPayload(ctx, {
                  organizationId: repository.organizationId,
                  repository,
                  payload: pr,
                });
              }

              for (const ghIssue of githubIssues) {
                await persistGitHubIssuePayload(ctx, {
                  organizationId: repository.organizationId,
                  repository,
                  payload: ghIssue,
                });
              }

              for (const commit of commits) {
                await persistCommitPayload(ctx, {
                  organizationId: repository.organizationId,
                  repository,
                  payload: commit,
                });
              }
            }
          },
        });

        await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
          organizationId: item.integration.organizationId,
          lastReconciledAt: Date.now(),
          clearFailure: true,
        });
      } catch (error) {
        await ctx.runMutation(internal.github.mutations.upsertSyncHealth, {
          organizationId: item.integration.organizationId,
          lastSyncFailureAt: Date.now(),
          lastSyncFailureMessage:
            error instanceof Error ? error.message : 'GitHub reconcile failed',
        });
      }
    }

    return { success: true, organizations: integrations.length } as const;
  },
});

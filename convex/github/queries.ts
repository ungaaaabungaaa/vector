import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { internalQuery, query, type QueryCtx } from '../_generated/server';
import { getOrganizationBySlug, hasScopedPermission } from '../authz';
import { getAuthUserId } from '../authUtils';
import { canViewIssue } from '../access';
import { PERMISSIONS } from '../_shared/permissions';
import { getSiteSettings } from '../platformAdmin/lib';

async function loadActiveIntegration(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
) {
  return await ctx.db
    .query('githubIntegrations')
    .withIndex('by_org_provider', q =>
      q.eq('organizationId', organizationId).eq('provider', 'github'),
    )
    .first();
}

function getEffectiveGitHubAuthState(
  integration: Doc<'githubIntegrations'> | null,
  siteSettings: Awaited<ReturnType<typeof getSiteSettings>>,
) {
  const installationId = integration?.installationId ?? null;
  const hasInstallation = Boolean(installationId);
  const hasTokenFallback = Boolean(integration?.encryptedToken);
  const hasWebhookSecret = Boolean(integration?.encryptedWebhookSecret);
  const hasPlatformAppCredentials = Boolean(
    siteSettings?.githubAppId && siteSettings?.githubAppEncryptedPrivateKey,
  );

  return {
    installationId,
    hasInstallation,
    hasTokenFallback,
    hasPlatformAppCredentials,
    hasWebhookSecret,
    hasWebhookIngestion: hasWebhookSecret,
    hasUsableAuth:
      hasTokenFallback || (hasInstallation && hasPlatformAppCredentials),
    hasAnyConfiguration:
      hasWebhookSecret ||
      hasInstallation ||
      hasTokenFallback ||
      hasPlatformAppCredentials,
  };
}

async function hydrateDevelopmentForIssue(
  ctx: QueryCtx,
  issueId: Id<'issues'>,
  includeRollup = true,
) {
  const links = await ctx.db
    .query('githubArtifactLinks')
    .withIndex('by_issue_active', q =>
      q.eq('issueId', issueId).eq('active', true),
    )
    .collect();

  const pullRequestIds = links
    .map(link => link.pullRequestId)
    .filter((id): id is Id<'githubPullRequests'> => Boolean(id));
  const githubIssueIds = links
    .map(link => link.githubIssueId)
    .filter((id): id is Id<'githubIssues'> => Boolean(id));
  const commitIds = links
    .map(link => link.commitId)
    .filter((id): id is Id<'githubCommits'> => Boolean(id));

  const [pullRequests, githubIssues, commits] = await Promise.all([
    Promise.all(pullRequestIds.map(id => ctx.db.get('githubPullRequests', id))),
    Promise.all(githubIssueIds.map(id => ctx.db.get('githubIssues', id))),
    Promise.all(commitIds.map(id => ctx.db.get('githubCommits', id))),
  ]);

  const repositories = new Map<
    Id<'githubRepositories'>,
    Doc<'githubRepositories'>
  >();
  for (const artifact of [...pullRequests, ...githubIssues, ...commits]) {
    if (!artifact) continue;
    if (repositories.has(artifact.repositoryId)) continue;
    const repo = await ctx.db.get('githubRepositories', artifact.repositoryId);
    if (repo) repositories.set(repo._id, repo);
  }

  let childCommitRollup: Array<{
    linkId: Id<'githubArtifactLinks'>;
    issueId: Id<'issues'>;
    issueKey: string;
    issueTitle: string;
    sha: string;
    shortSha: string;
    messageHeadline: string;
    url: string;
    committedAt: number | null;
    repository: string;
  }> = [];

  if (includeRollup) {
    const children = await ctx.db
      .query('issues')
      .withIndex('by_parent', q => q.eq('parentIssueId', issueId))
      .collect();

    for (const child of children) {
      const childCommitLinks = await ctx.db
        .query('githubArtifactLinks')
        .withIndex('by_issue_active', q =>
          q.eq('issueId', child._id).eq('active', true),
        )
        .collect();

      for (const link of childCommitLinks.filter(item => item.commitId)) {
        const commit = await ctx.db.get('githubCommits', link.commitId!);
        if (!commit) continue;
        const repo =
          repositories.get(commit.repositoryId) ??
          (await ctx.db.get('githubRepositories', commit.repositoryId));
        if (!repo) continue;
        childCommitRollup.push({
          linkId: link._id,
          issueId: child._id,
          issueKey: child.key,
          issueTitle: child.title,
          sha: commit.sha,
          shortSha: commit.shortSha,
          messageHeadline: commit.messageHeadline,
          url: commit.url,
          committedAt: commit.committedAt ?? null,
          repository: repo.fullName,
        });
      }
    }

    childCommitRollup = childCommitRollup
      .sort((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0))
      .filter(
        (item, index, items) =>
          items.findIndex(other => other.sha === item.sha) === index,
      );
  }

  return {
    pullRequests: pullRequests
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(pr => ({
        linkId: links.find(link => link.pullRequestId === pr._id)?._id ?? null,
        source:
          links.find(link => link.pullRequestId === pr._id)?.source ?? null,
        matchReason:
          links.find(link => link.pullRequestId === pr._id)?.matchReason ??
          null,
        ...pr,
        repository: repositories.get(pr.repositoryId) ?? null,
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
    githubIssues: githubIssues
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(issue => ({
        linkId:
          links.find(link => link.githubIssueId === issue._id)?._id ?? null,
        source:
          links.find(link => link.githubIssueId === issue._id)?.source ?? null,
        matchReason:
          links.find(link => link.githubIssueId === issue._id)?.matchReason ??
          null,
        ...issue,
        repository: repositories.get(issue.repositoryId) ?? null,
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
    commits: commits
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(commit => ({
        linkId: links.find(link => link.commitId === commit._id)?._id ?? null,
        source:
          links.find(link => link.commitId === commit._id)?.source ?? null,
        matchReason:
          links.find(link => link.commitId === commit._id)?.matchReason ?? null,
        ...commit,
        repository: repositories.get(commit.repositoryId) ?? null,
      }))
      .sort((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0)),
    childCommitRollup,
    activeLinkCount: links.length,
  };
}

export const getIntegrationForOrganization = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const integration = await loadActiveIntegration(ctx, args.organizationId);
    if (!integration) {
      return {
        integration: null,
        repositories: [],
      } as const;
    }

    const repositories = await ctx.db
      .query('githubRepositories')
      .withIndex('by_integration', q => q.eq('integrationId', integration._id))
      .collect();

    return {
      integration,
      repositories: repositories.sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      ),
    } as const;
  },
});

export const listIntegrationsForReconcile = internalQuery({
  args: {},
  handler: async ctx => {
    const integrations = await ctx.db.query('githubIntegrations').collect();
    return await Promise.all(
      integrations.map(async integration => ({
        integration,
        repositories: await ctx.db
          .query('githubRepositories')
          .withIndex('by_integration', q =>
            q.eq('integrationId', integration._id),
          )
          .collect()
          .then(items =>
            items.filter(repo => repo.selected && repo.installationAccessible),
          ),
      })),
    );
  },
});

export const getRepositoryByFullName = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('githubRepositories')
      .withIndex('by_full_name', q => q.eq('fullName', args.fullName))
      .filter(q => q.eq(q.field('organizationId'), args.organizationId))
      .first();
  },
});

export const getIntegrationByInstallationId = internalQuery({
  args: {
    installationId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('githubIntegrations')
      .withIndex('by_installation', q =>
        q.eq('installationId', args.installationId),
      )
      .first();
  },
});

export const getIntegrationByOrgSlug = internalQuery({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) {
      return null;
    }
    return {
      organizationId: org._id,
      integration: await loadActiveIntegration(ctx, org._id),
    } as const;
  },
});

export const isGitHubEnabled = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    const settings = await getSiteSettings(ctx.db);
    const integration = await loadActiveIntegration(ctx, org._id);
    const effectiveAuth = getEffectiveGitHubAuthState(integration, settings);
    return effectiveAuth.hasWebhookIngestion || effectiveAuth.hasUsableAuth;
  },
});

export const getGitHubCapabilities = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    const settings = await getSiteSettings(ctx.db);
    const integration = await loadActiveIntegration(ctx, org._id);
    const effectiveAuth = getEffectiveGitHubAuthState(integration, settings);

    return {
      hasWebhookIngestion: effectiveAuth.hasWebhookIngestion,
      hasApiAccess: effectiveAuth.hasUsableAuth,
      hasAnyConfiguration: effectiveAuth.hasAnyConfiguration,
    };
  },
});

export const isGitHubAppConfigured = query({
  args: {},
  handler: async ctx => {
    const settings = await getSiteSettings(ctx.db);
    return Boolean(
      settings?.githubAppId ||
        settings?.githubAppEncryptedPrivateKey ||
        settings?.githubAppEncryptedWebhookSecret,
    );
  },
});

export const getOrgSettings = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    const member = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', org._id).eq('userId', userId),
      )
      .first();
    if (!member) {
      throw new ConvexError('FORBIDDEN');
    }

    const integration = await loadActiveIntegration(ctx, org._id);
    const siteSettings = await getSiteSettings(ctx.db);
    const effectiveAuth = getEffectiveGitHubAuthState(
      integration,
      siteSettings,
    );
    const repositories = integration
      ? await ctx.db
          .query('githubRepositories')
          .withIndex('by_integration', q =>
            q.eq('integrationId', integration._id),
          )
          .collect()
          .then(items =>
            items.sort((a, b) => a.fullName.localeCompare(b.fullName)),
          )
      : [];

    const canManage = await hasScopedPermission(
      ctx,
      { organizationId: org._id },
      userId,
      PERMISSIONS.ORG_MANAGE_SETTINGS,
    );

    return {
      integration: integration
        ? {
            ...integration,
            hasTokenFallback: Boolean(integration.encryptedToken),
            hasWebhookSecret: Boolean(integration.encryptedWebhookSecret),
          }
        : null,
      effectiveAuth,
      repositories,
      canManage,
    };
  },
});

export const getIssueDevelopment = query({
  args: {
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    return {
      organizationId: issue.organizationId,
      ...(await hydrateDevelopmentForIssue(ctx, issue._id, true)),
    };
  },
});

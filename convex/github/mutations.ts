import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server';
import {
  getOrganizationBySlug,
  requireAuthUser,
  requireOrgPermission,
} from '../authz';
import { canEditIssue } from '../access';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { PERMISSIONS } from '../_shared/permissions';
import {
  buildArtifactExternalKey,
  normalizeIssueKey,
  selectWorkflowTypeFromGitHubIssues,
  selectWorkflowTypeFromPullRequests,
  type GitHubArtifactType,
} from './shared';

async function getOrCreateIntegration(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
) {
  const existing = await ctx.db
    .query('githubIntegrations')
    .withIndex('by_org_provider', q =>
      q.eq('organizationId', organizationId).eq('provider', 'github'),
    )
    .first();

  if (existing) return existing;

  const id = await ctx.db.insert('githubIntegrations', {
    organizationId,
    provider: 'github',
    connectionMode: 'webhook',
    updatedAt: Date.now(),
  });
  return await ctx.db.get('githubIntegrations', id);
}

async function getIssueStateIdByType(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  type: Doc<'issueStates'>['type'],
) {
  return await ctx.db
    .query('issueStates')
    .withIndex('by_org_type', q =>
      q.eq('organizationId', organizationId).eq('type', type),
    )
    .first()
    .then(state => state?._id ?? null);
}

async function recordGithubLinkActivity(
  ctx: MutationCtx,
  issue: Doc<'issues'>,
  actorId: Id<'users'> | undefined,
  eventType:
    | 'issue_github_artifact_linked'
    | 'issue_github_artifact_unlinked'
    | 'issue_github_artifact_suppressed'
    | 'issue_github_artifact_status_changed',
  toLabel: string,
) {
  if (!actorId) return;
  await recordActivity(ctx, {
    scope: resolveIssueScope(issue),
    actorId,
    entityType: 'issue',
    eventType,
    details: {
      toLabel,
    },
    snapshot: snapshotForIssue(issue),
  });
}

async function applyWorkflowAutomationForIssue(
  ctx: MutationCtx,
  issueId: Id<'issues'>,
) {
  const issue = await ctx.db.get('issues', issueId);
  if (!issue) return;

  const links = await ctx.db
    .query('githubArtifactLinks')
    .withIndex('by_issue_active', q =>
      q.eq('issueId', issueId).eq('active', true),
    )
    .collect();

  const pullRequests = await Promise.all(
    links
      .map(link => link.pullRequestId)
      .filter((id): id is Id<'githubPullRequests'> => Boolean(id))
      .map(id => ctx.db.get('githubPullRequests', id)),
  ).then(items =>
    items.filter((item): item is NonNullable<typeof item> => item !== null),
  );
  const githubIssues = await Promise.all(
    links
      .map(link => link.githubIssueId)
      .filter((id): id is Id<'githubIssues'> => Boolean(id))
      .map(id => ctx.db.get('githubIssues', id)),
  ).then(items =>
    items.filter((item): item is NonNullable<typeof item> => item !== null),
  );

  const targetType =
    selectWorkflowTypeFromPullRequests(pullRequests.map(pr => pr.state)) ??
    selectWorkflowTypeFromGitHubIssues(githubIssues.map(pr => pr.state));

  if (!targetType) {
    return;
  }

  const nextStateId = await getIssueStateIdByType(
    ctx,
    issue.organizationId,
    targetType,
  );

  if (!nextStateId || issue.workflowStateId === nextStateId) {
    return;
  }

  const previousState = issue.workflowStateId
    ? await ctx.db.get('issueStates', issue.workflowStateId)
    : null;
  const nextState = await ctx.db.get('issueStates', nextStateId);

  await ctx.db.patch('issues', issueId, {
    workflowStateId: nextStateId,
    closedAt:
      targetType === 'done' || targetType === 'canceled'
        ? Date.now()
        : undefined,
  });

  const actorId = issue.createdBy ?? issue.reporterId ?? undefined;
  if (actorId && nextState) {
    await recordActivity(ctx, {
      scope: resolveIssueScope(issue),
      actorId,
      entityType: 'issue',
      eventType: 'issue_workflow_state_changed',
      details: {
        field: 'workflow_state',
        fromId: issue.workflowStateId,
        fromLabel: previousState?.name,
        toId: nextState._id,
        toLabel: nextState.name,
      },
      snapshot: snapshotForIssue(issue),
    });
  }
}

/**
 * Auto-assign Vector users to an issue based on the linked PR's author and assignees.
 * Only assigns users who have linked their GitHub account and are org members.
 */
async function autoAssignFromPullRequest(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  issueId: Id<'issues'>,
  pullRequestId: Id<'githubPullRequests'>,
) {
  const pr = await ctx.db.get('githubPullRequests', pullRequestId);
  if (!pr) return;

  // Collect GitHub usernames: PR author + PR assignees
  const githubUsernames: string[] = [];
  if (pr.authorLogin) githubUsernames.push(pr.authorLogin);
  if (pr.assigneeLogins) {
    for (const login of pr.assigneeLogins) {
      if (!githubUsernames.includes(login)) githubUsernames.push(login);
    }
  }
  if (githubUsernames.length === 0) return;

  const issue = await ctx.db.get('issues', issueId);
  if (!issue) return;

  // Get a default issue state for new assignments
  const defaultState = await ctx.db
    .query('issueStates')
    .withIndex('by_org_type', q =>
      q.eq('organizationId', organizationId).eq('type', 'in_progress'),
    )
    .first();
  if (!defaultState) return;

  for (const ghUsername of githubUsernames) {
    // Find Vector user by linked GitHub username
    const vectorUser = await ctx.db
      .query('users')
      .withIndex('by_github_username', q => q.eq('githubUsername', ghUsername))
      .first();
    if (!vectorUser) continue;

    // Verify user is an org member
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organizationId).eq('userId', vectorUser._id),
      )
      .first();
    if (!membership) continue;

    // Check not already assigned
    const existingAssignment = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue_assignee', q =>
        q.eq('issueId', issueId).eq('assigneeId', vectorUser._id),
      )
      .first();
    if (existingAssignment) continue;

    // Create the assignment
    await ctx.db.insert('issueAssignees', {
      issueId,
      assigneeId: vectorUser._id,
      stateId: defaultState._id,
    });

    // Record activity
    const actorId = issue.createdBy ?? issue.reporterId ?? undefined;
    if (actorId) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId,
        entityType: 'issue',
        eventType: 'issue_assignees_changed',
        details: {
          addedUserNames: [vectorUser.name ?? ghUsername],
          removedUserNames: [],
        },
        snapshot: snapshotForIssue(issue),
      });
    }
  }
}

async function syncArtifactLinksForIssues(args: {
  ctx: MutationCtx;
  organizationId: Id<'organizations'>;
  artifactType: GitHubArtifactType;
  artifactId:
    | Id<'githubPullRequests'>
    | Id<'githubIssues'>
    | Id<'githubCommits'>;
  repoFullName: string;
  identifier: string | number;
  issueKeys: string[];
  source: 'auto' | 'manual';
  actorId?: Id<'users'>;
}) {
  const {
    ctx,
    organizationId,
    artifactType,
    artifactId,
    repoFullName,
    identifier,
  } = args;
  const externalKey = buildArtifactExternalKey(
    artifactType,
    repoFullName,
    identifier,
  );

  const issueIds = await Promise.all(
    Array.from(new Set(args.issueKeys.map(normalizeIssueKey))).map(
      async key => {
        const issue = await ctx.db
          .query('issues')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', organizationId).eq('key', key),
          )
          .first();
        return issue?._id ?? null;
      },
    ),
  ).then(ids => ids.filter((id): id is Id<'issues'> => id !== null));

  const targetIssueIds: Id<'issues'>[] = [];
  for (const issueId of issueIds) {
    const suppression = await ctx.db
      .query('githubArtifactSuppressions')
      .withIndex('by_issue_external', q =>
        q
          .eq('issueId', issueId)
          .eq('artifactType', artifactType)
          .eq('externalKey', externalKey),
      )
      .first();
    if (!suppression) {
      targetIssueIds.push(issueId);
    }
  }

  const existingLinks = await (artifactType === 'pull_request'
    ? ctx.db
        .query('githubArtifactLinks')
        .withIndex('by_pr', q =>
          q.eq('pullRequestId', artifactId as Id<'githubPullRequests'>),
        )
        .collect()
    : artifactType === 'issue'
      ? ctx.db
          .query('githubArtifactLinks')
          .withIndex('by_gh_issue', q =>
            q.eq('githubIssueId', artifactId as Id<'githubIssues'>),
          )
          .collect()
      : ctx.db
          .query('githubArtifactLinks')
          .withIndex('by_commit', q =>
            q.eq('commitId', artifactId as Id<'githubCommits'>),
          )
          .collect());

  const targetSet = new Set(targetIssueIds.map(String));

  for (const link of existingLinks) {
    if (link.source !== 'auto') continue;
    if (targetSet.has(String(link.issueId))) continue;
    if (link.active) {
      await ctx.db.patch('githubArtifactLinks', link._id, {
        active: false,
        updatedAt: Date.now(),
      });
    }
  }

  for (const issueId of targetIssueIds) {
    const existing = existingLinks.find(link => link.issueId === issueId);
    if (existing) {
      if (!existing.active) {
        await ctx.db.patch('githubArtifactLinks', existing._id, {
          active: true,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert('githubArtifactLinks', {
        organizationId,
        issueId,
        artifactType,
        pullRequestId:
          artifactType === 'pull_request'
            ? (artifactId as Id<'githubPullRequests'>)
            : undefined,
        githubIssueId:
          artifactType === 'issue'
            ? (artifactId as Id<'githubIssues'>)
            : undefined,
        commitId:
          artifactType === 'commit'
            ? (artifactId as Id<'githubCommits'>)
            : undefined,
        source: args.source,
        active: true,
        matchReason: externalKey,
        createdBy: args.actorId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  const affectedIssueIds = new Set([
    ...existingLinks.map(link => link.issueId),
    ...targetIssueIds,
  ]);

  for (const issueId of affectedIssueIds) {
    await applyWorkflowAutomationForIssue(ctx, issueId);
  }

  // Auto-assign users from PR author/assignees when linking pull requests
  if (artifactType === 'pull_request') {
    for (const issueId of targetIssueIds) {
      await autoAssignFromPullRequest(
        ctx,
        organizationId,
        issueId,
        artifactId as Id<'githubPullRequests'>,
      );
    }
  }
}

export const upsertInstallationConnection = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    connectionMode: v.union(
      v.literal('app'),
      v.literal('token'),
      v.literal('hybrid'),
    ),
    installationId: v.optional(v.number()),
    installationAccountLogin: v.optional(v.string()),
    installationAccountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode: args.connectionMode,
      installationId: args.installationId,
      installationAccountLogin: args.installationAccountLogin,
      installationAccountType: args.installationAccountType,
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const setWebhookSecret = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    encryptedWebhookSecret: v.optional(v.string()),
    webhookSecretFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode:
        integration!.installationId || integration!.encryptedToken
          ? integration!.connectionMode
          : 'webhook',
      encryptedWebhookSecret: args.encryptedWebhookSecret,
      webhookSecretFingerprint: args.webhookSecretFingerprint,
      webhookSecretLastUpdatedAt: args.encryptedWebhookSecret
        ? Date.now()
        : undefined,
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const setEncryptedToken = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    encryptedToken: v.optional(v.string()),
    tokenFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode: integration!.installationId ? 'hybrid' : 'token',
      encryptedToken: args.encryptedToken,
      tokenFingerprint: args.tokenFingerprint,
      tokenLastUpdatedAt: args.encryptedToken ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const upsertWebhookRepository = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    githubRepoId: v.number(),
    nodeId: v.optional(v.string()),
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    defaultBranch: v.optional(v.string()),
    private: v.boolean(),
    lastPushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const existing = await ctx.db
      .query('githubRepositories')
      .withIndex('by_org_repo', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubRepoId', args.githubRepoId),
      )
      .first();

    const patch = {
      integrationId: integration!._id,
      nodeId: args.nodeId,
      owner: args.owner,
      name: args.name,
      fullName: args.fullName,
      defaultBranch: args.defaultBranch,
      private: args.private,
      installationAccessible: true,
      selected: true,
      lastPushedAt: args.lastPushedAt,
      lastSyncedAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch('githubRepositories', existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('githubRepositories', {
      organizationId: args.organizationId,
      githubRepoId: args.githubRepoId,
      ...patch,
    });
  },
});

export const replaceRepositories = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositories: v.array(
      v.object({
        githubRepoId: v.number(),
        nodeId: v.optional(v.string()),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        defaultBranch: v.optional(v.string()),
        private: v.boolean(),
        installationAccessible: v.boolean(),
        lastPushedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const existing = await ctx.db
      .query('githubRepositories')
      .withIndex('by_integration', q => q.eq('integrationId', integration!._id))
      .collect();

    for (const repo of args.repositories) {
      const current = existing.find(
        item => item.githubRepoId === repo.githubRepoId,
      );
      if (current) {
        await ctx.db.patch('githubRepositories', current._id, {
          ...repo,
          updatedAt: Date.now(),
          lastSyncedAt: Date.now(),
        });
      } else {
        await ctx.db.insert('githubRepositories', {
          organizationId: args.organizationId,
          integrationId: integration!._id,
          ...repo,
          selected: false,
          updatedAt: Date.now(),
          lastSyncedAt: Date.now(),
        });
      }
    }

    const incomingRepoIds = new Set(
      args.repositories.map(repo => repo.githubRepoId),
    );
    for (const repo of existing) {
      if (incomingRepoIds.has(repo.githubRepoId)) continue;
      await ctx.db.patch('githubRepositories', repo._id, {
        installationAccessible: false,
        selected: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const toggleRepositorySelection = mutation({
  args: {
    orgSlug: v.string(),
    repositoryId: v.id('githubRepositories'),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_SETTINGS);

    const repository = await ctx.db.get(
      'githubRepositories',
      args.repositoryId,
    );
    if (!repository || repository.organizationId !== org._id) {
      throw new ConvexError('REPOSITORY_NOT_FOUND');
    }

    await ctx.db.patch('githubRepositories', repository._id, {
      selected: args.selected,
      updatedAt: Date.now(),
    });

    return { success: true, actorId: userId } as const;
  },
});

export const upsertPullRequest = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    githubPullRequestId: v.number(),
    nodeId: v.optional(v.string()),
    number: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    url: v.string(),
    state: v.union(
      v.literal('draft'),
      v.literal('open'),
      v.literal('closed'),
      v.literal('merged'),
    ),
    isDraft: v.boolean(),
    headRefName: v.optional(v.string()),
    baseRefName: v.optional(v.string()),
    authorLogin: v.optional(v.string()),
    authorAvatarUrl: v.optional(v.string()),
    assigneeLogins: v.optional(v.array(v.string())),
    mergedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubPullRequests')
      .withIndex('by_org_external', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubPullRequestId', args.githubPullRequestId),
      )
      .first();

    if (existing) {
      await ctx.db.patch('githubPullRequests', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('githubPullRequests', {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

export const upsertGitHubIssue = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    githubIssueId: v.number(),
    nodeId: v.optional(v.string()),
    number: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    url: v.string(),
    state: v.union(v.literal('open'), v.literal('closed')),
    authorLogin: v.optional(v.string()),
    authorAvatarUrl: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubIssues')
      .withIndex('by_org_external', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubIssueId', args.githubIssueId),
      )
      .first();

    if (existing) {
      await ctx.db.patch('githubIssues', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('githubIssues', {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

export const upsertCommit = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    sha: v.string(),
    shortSha: v.string(),
    messageHeadline: v.string(),
    messageBody: v.optional(v.string()),
    url: v.string(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    committedAt: v.optional(v.number()),
    authoredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubCommits')
      .withIndex('by_org_sha', q =>
        q.eq('organizationId', args.organizationId).eq('sha', args.sha),
      )
      .first();

    if (existing) {
      await ctx.db.patch('githubCommits', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('githubCommits', {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

export const syncPullRequestLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    pullRequestId: v.id('githubPullRequests'),
    repoFullName: v.string(),
    number: v.number(),
    issueKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'pull_request',
      artifactId: args.pullRequestId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: args.issueKeys,
      source: 'auto',
    });
  },
});

export const syncGitHubIssueLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    githubIssueId: v.id('githubIssues'),
    repoFullName: v.string(),
    number: v.number(),
    issueKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'issue',
      artifactId: args.githubIssueId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: args.issueKeys,
      source: 'auto',
    });
  },
});

export const syncCommitLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    commitId: v.id('githubCommits'),
    repoFullName: v.string(),
    sha: v.string(),
    issueKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'commit',
      artifactId: args.commitId,
      repoFullName: args.repoFullName,
      identifier: args.sha,
      issueKeys: args.issueKeys,
      source: 'auto',
    });
  },
});

export const linkPullRequestManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    pullRequestId: v.id('githubPullRequests'),
    repoFullName: v.string(),
    number: v.number(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'pull_request',
      artifactId: args.pullRequestId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}#${args.number}`,
    );
  },
});

export const linkGitHubIssueManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    githubIssueId: v.id('githubIssues'),
    repoFullName: v.string(),
    number: v.number(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'issue',
      artifactId: args.githubIssueId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}#${args.number}`,
    );
  },
});

export const linkCommitManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    commitId: v.id('githubCommits'),
    repoFullName: v.string(),
    sha: v.string(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'commit',
      artifactId: args.commitId,
      repoFullName: args.repoFullName,
      identifier: args.sha,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}@${args.sha.slice(0, 7)}`,
    );
  },
});

export const upsertSyncHealth = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    lastWebhookAt: v.optional(v.number()),
    lastWebhookEvent: v.optional(v.string()),
    lastReconciledAt: v.optional(v.number()),
    lastSyncFailureAt: v.optional(v.number()),
    lastSyncFailureMessage: v.optional(v.string()),
    clearFailure: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const patch: Partial<Doc<'githubIntegrations'>> = {
      updatedAt: Date.now(),
    };

    if (args.lastWebhookAt !== undefined) {
      patch.lastWebhookAt = args.lastWebhookAt;
    }
    if (args.lastWebhookEvent !== undefined) {
      patch.lastWebhookEvent = args.lastWebhookEvent;
    }
    if (args.lastReconciledAt !== undefined) {
      patch.lastReconciledAt = args.lastReconciledAt;
    }
    if (args.lastSyncFailureAt !== undefined) {
      patch.lastSyncFailureAt = args.lastSyncFailureAt;
      patch.appWebhookStatus = 'failing';
    }
    if (args.lastSyncFailureMessage !== undefined) {
      patch.lastSyncFailureMessage = args.lastSyncFailureMessage;
      patch.appWebhookStatus = 'failing';
    }
    if (args.clearFailure) {
      patch.lastSyncFailureAt = undefined;
      patch.lastSyncFailureMessage = undefined;
      patch.appWebhookStatus = 'active';
    }

    await ctx.db.patch('githubIntegrations', integration!._id, patch);
  },
});

export const unlinkArtifact = mutation({
  args: {
    linkId: v.id('githubArtifactLinks'),
    suppress: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const link = await ctx.db.get('githubArtifactLinks', args.linkId);
    if (!link) {
      throw new ConvexError('LINK_NOT_FOUND');
    }

    const issue = await ctx.db.get('issues', link.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('githubArtifactLinks', link._id, {
      active: false,
      updatedAt: Date.now(),
    });

    let suppressionId: Id<'githubArtifactSuppressions'> | null = null;
    if (args.suppress) {
      let externalKey: string | null = null;
      if (link.pullRequestId) {
        const pr = await ctx.db.get('githubPullRequests', link.pullRequestId);
        const repo = pr
          ? await ctx.db.get('githubRepositories', pr.repositoryId)
          : null;
        if (pr && repo) {
          externalKey = buildArtifactExternalKey(
            'pull_request',
            repo.fullName,
            pr.number,
          );
        }
      } else if (link.githubIssueId) {
        const ghIssue = await ctx.db.get('githubIssues', link.githubIssueId);
        const repo = ghIssue
          ? await ctx.db.get('githubRepositories', ghIssue.repositoryId)
          : null;
        if (ghIssue && repo) {
          externalKey = buildArtifactExternalKey(
            'issue',
            repo.fullName,
            ghIssue.number,
          );
        }
      } else if (link.commitId) {
        const commit = await ctx.db.get('githubCommits', link.commitId);
        const repo = commit
          ? await ctx.db.get('githubRepositories', commit.repositoryId)
          : null;
        if (commit && repo) {
          externalKey = buildArtifactExternalKey(
            'commit',
            repo.fullName,
            commit.sha,
          );
        }
      }

      if (externalKey) {
        const existingSuppression = await ctx.db
          .query('githubArtifactSuppressions')
          .withIndex('by_issue_external', q =>
            q
              .eq('issueId', issue._id)
              .eq('artifactType', link.artifactType)
              .eq('externalKey', externalKey),
          )
          .first();
        suppressionId =
          existingSuppression?._id ??
          (await ctx.db.insert('githubArtifactSuppressions', {
            organizationId: issue.organizationId,
            issueId: issue._id,
            artifactType: link.artifactType,
            externalKey,
            reason: 'manual_suppress',
            createdBy: userId,
            createdAt: Date.now(),
          }));
      }
    }

    await recordGithubLinkActivity(
      ctx,
      issue,
      userId,
      args.suppress
        ? 'issue_github_artifact_suppressed'
        : 'issue_github_artifact_unlinked',
      link.artifactType,
    );
    await applyWorkflowAutomationForIssue(ctx, issue._id);

    return { success: true, suppressionId } as const;
  },
});

import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  NOTIFICATION_CATEGORIES,
  categoryForEvent,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationCategory,
  type NotificationEventType,
} from './shared';

type NotificationPayload = {
  organizationName?: string;
  issueKey?: string;
  issueTitle?: string;
  commentPreview?: string;
  inviterName?: string;
  roleLabel?: string;
  href?: string;
  subjectUserName?: string;
};

type NotificationRecipientInput = {
  userId?: Id<'users'>;
  email?: string;
};

export type NotificationEventWrite = {
  type: NotificationEventType;
  actorId?: Id<'users'>;
  organizationId?: Id<'organizations'>;
  issueId?: Id<'issues'>;
  projectId?: Id<'projects'>;
  teamId?: Id<'teams'>;
  invitationId?: Id<'invitations'>;
  payload: NotificationPayload;
  recipients: NotificationRecipientInput[];
  dedupeKey?: string;
};

export type NotificationPreferenceValue = {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

export function buildNotificationCopy(
  type: NotificationEventType,
  payload: NotificationPayload,
) {
  switch (type) {
    case 'organization_invite':
      return {
        title: `${payload.inviterName ?? 'Someone'} invited you to ${payload.organizationName ?? 'an organization'}`,
        body: `Role: ${payload.roleLabel ?? 'Member'}`,
        href: payload.href,
      };
    case 'issue_assigned':
      return {
        title: `Assigned to ${payload.issueKey ?? 'an issue'}`,
        body: payload.issueTitle ?? 'A new issue needs your attention.',
        href: payload.href,
      };
    case 'issue_reassigned':
      return {
        title: `Reassigned to ${payload.issueKey ?? 'an issue'}`,
        body: payload.issueTitle ?? 'You were reassigned to an issue.',
        href: payload.href,
      };
    case 'issue_mentioned':
      return {
        title: `Mentioned on ${payload.issueKey ?? 'an issue'}`,
        body:
          payload.commentPreview ??
          payload.issueTitle ??
          'You were mentioned in a comment.',
        href: payload.href,
      };
    case 'issue_comment_on_assigned_issue':
      return {
        title: `New comment on ${payload.issueKey ?? 'an assigned issue'}`,
        body:
          payload.commentPreview ??
          payload.issueTitle ??
          'There is a new comment on an issue assigned to you.',
        href: payload.href,
      };
  }
}

export function getDefaultPreference(
  category: NotificationCategory,
): NotificationPreferenceValue {
  return {
    category,
    ...DEFAULT_NOTIFICATION_PREFERENCES[category],
  };
}

export async function getMergedPreferences(
  ctx: Pick<MutationCtx, 'db'>,
  userId: Id<'users'>,
) {
  const rows = await ctx.db
    .query('notificationPreferences')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();

  const map = new Map(rows.map(row => [row.category, row]));

  return NOTIFICATION_CATEGORIES.map(category => {
    const row = map.get(category);
    return row
      ? {
          category,
          inAppEnabled: row.inAppEnabled,
          emailEnabled: row.emailEnabled,
          pushEnabled: row.pushEnabled,
        }
      : getDefaultPreference(category);
  });
}

export async function createNotificationEvent(
  ctx: MutationCtx,
  input: NotificationEventWrite,
) {
  const category = categoryForEvent(input.type);
  const eventId = await ctx.db.insert('notificationEvents', {
    type: input.type,
    category,
    organizationId: input.organizationId,
    actorId: input.actorId,
    issueId: input.issueId,
    projectId: input.projectId,
    teamId: input.teamId,
    invitationId: input.invitationId,
    payload: input.payload,
    dedupeKey: input.dedupeKey,
    createdAt: Date.now(),
  });

  const actor = input.actorId ? await ctx.db.get('users', input.actorId) : null;
  const copy = buildNotificationCopy(input.type, input.payload);
  const uniqueRecipients = new Map<string, NotificationRecipientInput>();

  for (const recipient of input.recipients) {
    if (
      recipient.userId &&
      input.actorId &&
      recipient.userId === input.actorId
    ) {
      continue;
    }

    const key =
      recipient.userId !== undefined
        ? `user:${recipient.userId}`
        : recipient.email
          ? `email:${recipient.email.toLowerCase()}`
          : null;

    if (!key) {
      continue;
    }

    uniqueRecipients.set(key, {
      userId: recipient.userId,
      email: recipient.email?.toLowerCase(),
    });
  }

  for (const recipient of uniqueRecipients.values()) {
    const recipientId = await ctx.db.insert('notificationRecipients', {
      eventId,
      userId: recipient.userId,
      email: recipient.email,
      category,
      eventType: input.type,
      organizationId: input.organizationId,
      title: copy.title,
      body: copy.body,
      href: copy.href,
      actorId: input.actorId,
      actorName:
        actor?.name ??
        actor?.username ??
        actor?.email ??
        input.payload.inviterName,
      actorImage: actor?.image,
      isRead: false,
      isArchived: false,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.actions.deliverRecipient,
      { recipientId },
    );
  }

  return eventId;
}

export function getIssueHref(orgSlug: string, issueKey: string) {
  return `/${orgSlug}/issues/${issueKey}`;
}

function normalizeMentionToken(value: string) {
  return value.trim().toLowerCase().replace(/^@/, '');
}

export function extractMentionTokens(body: string) {
  const matches = body.match(/@([a-zA-Z0-9._-]+)/g) ?? [];
  return Array.from(
    new Set(matches.map(token => normalizeMentionToken(token))),
  );
}

export async function resolveMentionedUsers(
  ctx: Pick<MutationCtx, 'db'>,
  organizationId: Id<'organizations'>,
  body: string,
) {
  const tokens = extractMentionTokens(body);
  if (tokens.length === 0) {
    return [];
  }

  const members = await ctx.db
    .query('members')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .collect();

  const users = await Promise.all(
    members.map(member => ctx.db.get('users', member.userId)),
  );
  const matches = new Map<Id<'users'>, Doc<'users'>>();

  for (const user of users) {
    if (!user) {
      continue;
    }

    const candidates = [user.username, user.name, user.email?.split('@')[0]]
      .filter((value): value is string => Boolean(value))
      .map(value => normalizeMentionToken(String(value).replace(/\s+/g, '-')));

    if (tokens.some(token => candidates.includes(token))) {
      matches.set(user._id, user);
    }
  }

  return Array.from(matches.values());
}

import { paginationOptsValidator } from 'convex/server';
import { query, internalQuery } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import { getDefaultPreference } from './lib';
import {
  NOTIFICATION_CATEGORIES,
  notificationCategoryValidator,
} from './shared';

export const listInbox = query({
  args: {
    filter: v.optional(v.union(v.literal('all'), v.literal('unread'))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const page = await ctx.db
      .query('notificationRecipients')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .paginate(args.paginationOpts);

    const results = page.page.filter(item => {
      if (item.isArchived) {
        return false;
      }
      if (args.filter === 'unread') {
        return !item.isRead;
      }
      return true;
    });

    return {
      ...page,
      page: results,
    };
  },
});

export const unreadCount = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }

    const rows = await ctx.db
      .query('notificationRecipients')
      .withIndex('by_user_read', q =>
        q.eq('userId', userId).eq('isRead', false),
      )
      .collect();

    return rows.filter(row => !row.isArchived).length;
  },
});

export const getPreferences = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

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
  },
});

export const listPushSubscriptions = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

export const getPreferenceByCategory = internalQuery({
  args: {
    userId: v.id('users'),
    category: notificationCategoryValidator,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_user_category', q =>
        q.eq('userId', args.userId).eq('category', args.category),
      )
      .first();

    if (row) {
      return {
        category: args.category,
        inAppEnabled: row.inAppEnabled,
        emailEnabled: row.emailEnabled,
        pushEnabled: row.pushEnabled,
      };
    }

    return getDefaultPreference(args.category);
  },
});

export const getDeliveryContext = internalQuery({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient) {
      return null;
    }

    const event = await ctx.db.get('notificationEvents', recipient.eventId);
    if (!event) {
      return null;
    }

    const user = recipient.userId
      ? await ctx.db.get('users', recipient.userId)
      : null;
    const preference = recipient.userId
      ? ((await ctx.db
          .query('notificationPreferences')
          .withIndex('by_user_category', q =>
            q
              .eq('userId', recipient.userId!)
              .eq('category', recipient.category),
          )
          .first()) ?? getDefaultPreference(recipient.category))
      : getDefaultPreference(recipient.category);

    const pushSubscriptions = recipient.userId
      ? await ctx.db
          .query('pushSubscriptions')
          .withIndex('by_user', q => q.eq('userId', recipient.userId!))
          .collect()
      : [];

    return {
      recipient,
      event,
      user,
      preference: {
        inAppEnabled: preference.inAppEnabled,
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
      },
      pushSubscriptions: pushSubscriptions.filter(sub => !sub.disabledAt),
    };
  },
});

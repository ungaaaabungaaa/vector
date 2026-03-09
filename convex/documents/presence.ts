import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { requireAuthUser } from '../authz';
import { isDefined } from '../_shared/typeGuards';

const PRESENCE_TIMEOUT = 30_000; // 30 seconds

export const heartbeat = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);

    const existing = await ctx.db
      .query('documentPresence')
      .withIndex('by_document_user', q =>
        q.eq('documentId', args.documentId).eq('userId', userId),
      )
      .first();

    if (existing) {
      await ctx.db.patch('documentPresence', existing._id, {
        lastSeen: Date.now(),
      });
    } else {
      await ctx.db.insert('documentPresence', {
        documentId: args.documentId,
        userId,
        lastSeen: Date.now(),
      });
    }
  },
});

export const leave = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);

    const existing = await ctx.db
      .query('documentPresence')
      .withIndex('by_document_user', q =>
        q.eq('documentId', args.documentId).eq('userId', userId),
      )
      .first();

    if (existing) {
      await ctx.db.delete('documentPresence', existing._id);
    }
  },
});

export const getViewers = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query('documentPresence')
      .withIndex('by_document', q => q.eq('documentId', args.documentId))
      .collect();

    const now = Date.now();
    const activeRecords = records.filter(
      r => now - r.lastSeen < PRESENCE_TIMEOUT,
    );

    const viewers = await Promise.all(
      activeRecords.map(async r => {
        const user = await ctx.db.get('users', r.userId);
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      }),
    );

    return viewers.filter(isDefined);
  },
});

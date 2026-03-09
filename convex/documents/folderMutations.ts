import { mutation } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { getOrganizationBySlug, requireAuthUser } from '../authz';
import { PERMISSIONS, requirePermission } from '../permissions/utils';

type DocumentFolderPatch = Partial<
  Pick<Doc<'documentFolders'>, 'name' | 'description' | 'color'>
>;

export const createFolder = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);

    await requirePermission(ctx, org._id, PERMISSIONS.DOCUMENT_CREATE);

    if (!args.data.name.trim()) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.data.name.length > 100) {
      throw new ConvexError('INVALID_INPUT');
    }

    const folderId = await ctx.db.insert('documentFolders', {
      organizationId: org._id,
      name: args.data.name.trim(),
      description: args.data.description?.trim(),
      color: args.data.color,
      createdBy: userId,
    });

    return { folderId } as const;
  },
});

export const updateFolder = mutation({
  args: {
    folderId: v.id('documentFolders'),
    data: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.union(v.string(), v.null())),
      color: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    const folder = await ctx.db.get('documentFolders', args.folderId);
    if (!folder) {
      throw new ConvexError('NOT_FOUND');
    }

    await requirePermission(
      ctx,
      folder.organizationId,
      PERMISSIONS.DOCUMENT_EDIT,
    );

    const patchData: DocumentFolderPatch = {};
    if (args.data.name !== undefined) {
      if (!args.data.name.trim()) throw new ConvexError('INVALID_INPUT');
      patchData.name = args.data.name.trim();
    }
    if (args.data.description !== undefined) {
      patchData.description = args.data.description ?? undefined;
    }
    if (args.data.color !== undefined) {
      patchData.color = args.data.color ?? undefined;
    }

    await ctx.db.patch('documentFolders', folder._id, patchData);
    return { success: true } as const;
  },
});

export const removeFolder = mutation({
  args: {
    folderId: v.id('documentFolders'),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    const folder = await ctx.db.get('documentFolders', args.folderId);
    if (!folder) {
      throw new ConvexError('NOT_FOUND');
    }

    await requirePermission(
      ctx,
      folder.organizationId,
      PERMISSIONS.DOCUMENT_DELETE,
    );

    // Unlink all documents in this folder (don't delete them)
    const docs = await ctx.db
      .query('documents')
      .withIndex('by_folder', q => q.eq('folderId', folder._id))
      .collect();

    for (const doc of docs) {
      await ctx.db.patch('documents', doc._id, { folderId: undefined });
    }

    await ctx.db.delete('documentFolders', folder._id);
    return { success: true } as const;
  },
});

import { mutation } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { getOrganizationBySlug, requireAuthUser } from '../authz';
import { canDeleteDocument, canEditDocument } from '../access';
import {
  recordActivity,
  resolveDocumentScope,
  snapshotForDocument,
  getVisibilityLabel,
} from '../activities/lib';
import { PERMISSIONS, requirePermission } from '../permissions/utils';
import {
  isValidDocumentColor,
  isValidDocumentIconName,
} from '../_shared/document_appearance';

type DocumentUpdatePatch = Partial<
  Pick<
    Doc<'documents'>,
    | 'title'
    | 'content'
    | 'icon'
    | 'color'
    | 'folderId'
    | 'teamId'
    | 'projectId'
    | 'visibility'
    | 'lastEditedBy'
    | 'lastEditedAt'
  >
>;

export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      content: v.optional(v.string()),
      icon: v.optional(v.string()),
      color: v.optional(v.string()),
      folderId: v.optional(v.id('documentFolders')),
      teamId: v.optional(v.id('teams')),
      projectId: v.optional(v.id('projects')),
      visibility: v.optional(
        v.union(
          v.literal('private'),
          v.literal('organization'),
          v.literal('public'),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);

    await requirePermission(ctx, org._id, PERMISSIONS.DOCUMENT_CREATE);

    if (!args.data.title.trim()) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.data.title.length > 200) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.data.content && args.data.content.length > 50000) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (
      args.data.icon !== undefined &&
      !isValidDocumentIconName(args.data.icon)
    ) {
      throw new ConvexError('INVALID_ICON');
    }
    if (
      args.data.color !== undefined &&
      !isValidDocumentColor(args.data.color)
    ) {
      throw new ConvexError('INVALID_COLOR');
    }

    if (args.data.folderId) {
      const folder = await ctx.db.get('documentFolders', args.data.folderId);
      if (!folder || folder.organizationId !== org._id) {
        throw new ConvexError('INVALID_FOLDER');
      }
    }

    if (args.data.teamId) {
      const team = await ctx.db.get('teams', args.data.teamId);
      if (!team || team.organizationId !== org._id) {
        throw new ConvexError('INVALID_TEAM');
      }
    }

    if (args.data.projectId) {
      const project = await ctx.db.get('projects', args.data.projectId);
      if (!project || project.organizationId !== org._id) {
        throw new ConvexError('INVALID_PROJECT');
      }
    }

    const documentId = await ctx.db.insert('documents', {
      organizationId: org._id,
      title: args.data.title.trim(),
      content: args.data.content,
      icon: args.data.icon,
      color: args.data.color,
      folderId: args.data.folderId,
      teamId: args.data.teamId,
      projectId: args.data.projectId,
      createdBy: userId,
      lastEditedBy: userId,
      lastEditedAt: Date.now(),
      visibility: args.data.visibility || 'organization',
    });

    const createdDoc = await ctx.db.get('documents', documentId);
    if (createdDoc) {
      await recordActivity(ctx, {
        scope: resolveDocumentScope(createdDoc),
        entityType: 'document',
        eventType: 'document_created',
        actorId: userId,
        snapshot: snapshotForDocument(createdDoc),
      });
    }

    return { documentId } as const;
  },
});

export const update = mutation({
  args: {
    documentId: v.id('documents'),
    data: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      icon: v.optional(v.union(v.string(), v.null())),
      color: v.optional(v.union(v.string(), v.null())),
      folderId: v.optional(v.union(v.id('documentFolders'), v.null())),
      teamId: v.optional(v.union(v.id('teams'), v.null())),
      projectId: v.optional(v.union(v.id('projects'), v.null())),
      visibility: v.optional(
        v.union(
          v.literal('private'),
          v.literal('organization'),
          v.literal('public'),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const doc = await ctx.db.get('documents', args.documentId);
    if (!doc) {
      throw new ConvexError('DOCUMENT_NOT_FOUND');
    }

    if (!(await canEditDocument(ctx, doc))) {
      throw new ConvexError('FORBIDDEN');
    }

    if (args.data.title !== undefined) {
      if (!args.data.title.trim()) {
        throw new ConvexError('INVALID_INPUT');
      }
      if (args.data.title.length > 200) {
        throw new ConvexError('INVALID_INPUT');
      }
    }

    if (args.data.content !== undefined && args.data.content.length > 50000) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (
      args.data.icon !== undefined &&
      args.data.icon !== null &&
      !isValidDocumentIconName(args.data.icon)
    ) {
      throw new ConvexError('INVALID_ICON');
    }
    if (
      args.data.color !== undefined &&
      args.data.color !== null &&
      !isValidDocumentColor(args.data.color)
    ) {
      throw new ConvexError('INVALID_COLOR');
    }

    if (args.data.teamId !== undefined && args.data.teamId !== null) {
      const team = await ctx.db.get('teams', args.data.teamId);
      if (!team || team.organizationId !== doc.organizationId) {
        throw new ConvexError('INVALID_TEAM');
      }
    }

    if (args.data.projectId !== undefined && args.data.projectId !== null) {
      const project = await ctx.db.get('projects', args.data.projectId);
      if (!project || project.organizationId !== doc.organizationId) {
        throw new ConvexError('INVALID_PROJECT');
      }
    }

    const patchData: DocumentUpdatePatch = {
      lastEditedBy: userId,
      lastEditedAt: Date.now(),
    };

    if (args.data.title !== undefined) patchData.title = args.data.title.trim();
    if (args.data.content !== undefined) patchData.content = args.data.content;
    if (args.data.icon !== undefined)
      patchData.icon = args.data.icon ?? undefined;
    if (args.data.color !== undefined)
      patchData.color = args.data.color ?? undefined;
    if (args.data.folderId !== undefined)
      patchData.folderId = args.data.folderId ?? undefined;
    if (args.data.teamId !== undefined)
      patchData.teamId = args.data.teamId ?? undefined;
    if (args.data.projectId !== undefined)
      patchData.projectId = args.data.projectId ?? undefined;
    if (args.data.visibility !== undefined)
      patchData.visibility = args.data.visibility;

    await ctx.db.patch('documents', doc._id, patchData);

    const scope = resolveDocumentScope({
      ...doc,
      teamId:
        args.data.teamId !== undefined
          ? (args.data.teamId ?? undefined)
          : doc.teamId,
      projectId:
        args.data.projectId !== undefined
          ? (args.data.projectId ?? undefined)
          : doc.projectId,
    });
    const snapshot = snapshotForDocument({
      ...doc,
      title: args.data.title ?? doc.title,
    });

    if (args.data.title !== undefined && args.data.title !== doc.title) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_title_changed',
        actorId: userId,
        details: {
          field: 'title',
          fromLabel: doc.title,
          toLabel: args.data.title,
        },
        snapshot,
      });
    }

    if (args.data.content !== undefined && args.data.content !== doc.content) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_content_changed',
        actorId: userId,
        details: {
          field: 'content',
        },
        snapshot,
      });
    }

    if (args.data.icon !== undefined && args.data.icon !== doc.icon) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_icon_changed',
        actorId: userId,
        snapshot,
      });
    }

    if (args.data.color !== undefined && args.data.color !== doc.color) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_color_changed',
        actorId: userId,
        details: {
          fromLabel: doc.color,
          toLabel: args.data.color ?? undefined,
        },
        snapshot,
      });
    }

    if (args.data.teamId !== undefined && args.data.teamId !== doc.teamId) {
      const previousTeam = doc.teamId
        ? await ctx.db.get('teams', doc.teamId)
        : null;
      const nextTeam = args.data.teamId
        ? await ctx.db.get('teams', args.data.teamId)
        : null;
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_team_changed',
        actorId: userId,
        details: {
          field: 'team',
          fromId: doc.teamId,
          fromLabel: previousTeam?.name,
          toId: args.data.teamId,
          toLabel: nextTeam?.name,
        },
        snapshot,
      });
    }

    if (
      args.data.projectId !== undefined &&
      args.data.projectId !== doc.projectId
    ) {
      const previousProject = doc.projectId
        ? await ctx.db.get('projects', doc.projectId)
        : null;
      const nextProject = args.data.projectId
        ? await ctx.db.get('projects', args.data.projectId)
        : null;
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_project_changed',
        actorId: userId,
        details: {
          field: 'project',
          fromId: doc.projectId,
          fromLabel: previousProject?.name,
          toId: args.data.projectId,
          toLabel: nextProject?.name,
        },
        snapshot,
      });
    }

    if (
      args.data.visibility !== undefined &&
      args.data.visibility !== doc.visibility
    ) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_visibility_changed',
        actorId: userId,
        details: {
          field: 'visibility',
          fromLabel: getVisibilityLabel(doc.visibility),
          toLabel: getVisibilityLabel(args.data.visibility),
        },
        snapshot,
      });
    }

    return { success: true } as const;
  },
});

export const remove = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const doc = await ctx.db.get('documents', args.documentId);
    if (!doc) {
      throw new ConvexError('DOCUMENT_NOT_FOUND');
    }

    if (!(await canDeleteDocument(ctx, doc))) {
      throw new ConvexError('FORBIDDEN');
    }

    await recordActivity(ctx, {
      scope: resolveDocumentScope(doc),
      entityType: 'document',
      eventType: 'document_deleted',
      actorId: userId,
      snapshot: snapshotForDocument(doc),
    });

    await ctx.db.delete('documents', doc._id);

    return { success: true } as const;
  },
});

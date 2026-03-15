'use node';

import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { renderNotificationEmailTemplate } from './emailTemplates';

type MailTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
};

function getMailTransportConfig(): MailTransportConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const config = getMailTransportConfig();
  if (!config) {
    console.info('[notification:email:fallback]', { to, subject });
    return { providerMessageId: 'console-fallback' };
  }

  const transporter = nodemailer.createTransport(config);
  const info = await transporter.sendMail({
    from:
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      'Vector <no-reply@vector.local>',
    to,
    subject,
    html,
  });

  return { providerMessageId: info.messageId };
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export const deliverRecipient = internalAction({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.notifications.queries.getDeliveryContext,
      {
        recipientId: args.recipientId,
      },
    );

    if (!context) {
      return null;
    }

    const { recipient, event, user, preference, pushSubscriptions } = context;
    const mandatoryInviteEmail = event.type === 'organization_invite';
    const emailEnabled = mandatoryInviteEmail || preference.emailEnabled;

    if (!recipient.email && !user?.email) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'email',
          status: 'skipped',
          lastError: 'No email address available',
        },
      );
    } else if (!emailEnabled) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'email',
          status: 'skipped',
          lastError: 'Email disabled by preference',
        },
      );
    } else {
      try {
        // Resolve relative hrefs to absolute URLs for emails
        const baseUrl = (
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        ).replace(/\/$/, '');
        const absoluteHref =
          recipient.href && !recipient.href.startsWith('http')
            ? `${baseUrl}${recipient.href}`
            : recipient.href;

        const html = await render(
          renderNotificationEmailTemplate({
            type: event.type,
            title: recipient.title,
            body: recipient.body,
            href: absoluteHref,
            payload: event.payload,
          }),
        );

        const result = await sendEmail({
          to: recipient.email ?? user?.email ?? '',
          subject: recipient.title,
          html,
        });

        await ctx.runMutation(
          internal.notifications.mutations.setDeliveryResult,
          {
            recipientId: recipient._id,
            channel: 'email',
            status: 'sent',
            providerMessageId: result.providerMessageId,
          },
        );
      } catch (error) {
        await ctx.runMutation(
          internal.notifications.mutations.setDeliveryResult,
          {
            recipientId: recipient._id,
            channel: 'email',
            status: 'failed',
            lastError:
              error instanceof Error ? error.message : 'Unknown email error',
          },
        );
      }
    }

    if (!recipient.userId) {
      return null;
    }

    if (!preference.pushEnabled) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'push',
          status: 'skipped',
          lastError: 'Push disabled by preference',
        },
      );
      return null;
    }

    if (!configureWebPush()) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'push',
          status: 'skipped',
          lastError: 'VAPID keys are not configured',
        },
      );
      return null;
    }

    if (pushSubscriptions.length === 0) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'push',
          status: 'skipped',
          lastError: 'No active push subscriptions',
        },
      );
      return null;
    }

    let sent = false;

    for (const subscription of pushSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: recipient.title,
            body: recipient.body,
            href: recipient.href,
            recipientId: recipient._id,
            category: recipient.category,
          }),
        );
        sent = true;
      } catch (error) {
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof error.statusCode === 'number'
            ? error.statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(
            internal.notifications.mutations.disablePushSubscription,
            {
              subscriptionId: subscription._id,
            },
          );
        }
      }
    }

    await ctx.runMutation(internal.notifications.mutations.setDeliveryResult, {
      recipientId: recipient._id,
      channel: 'push',
      status: sent ? 'sent' : 'failed',
      lastError: sent
        ? undefined
        : 'Push delivery failed for all subscriptions',
    });

    return null;
  },
});

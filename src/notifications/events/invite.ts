import { z } from "zod";
import { defineNotification } from "../core";
import { emailSender } from "../channels/email";

const schema = z.object({
  inviterName: z.string(),
  inviteLink: z.string().url(),
});

export type InvitePayload = z.infer<typeof schema>;

export const sendInviteNotification = defineNotification({
  type: "organization.invite",
  schema,
  channels: {
    email: async ({ to, inviterName, inviteLink }) => {
      await emailSender({
        to,
        subject: `${inviterName} invited you to join their organization`,
        html: inviteEmailTemplate(inviterName, inviteLink),
      });
    },
  },
});

function inviteEmailTemplate(inviter: string, link: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 16px;">You have been invited to join an AIKP organization</h2>
      <p>${inviter} has invited you to collaborate. Click the button below to accept the invitation.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="background: #000; color: #ffffff; padding: 12px 24px; border-radius: 4px; text-decoration: none;">Accept invitation</a>
      </p>
      <p>If the button does not work, copy and paste the following link into your browser:</p>
      <code>${link}</code>
      <p style="margin-top: 32px; font-size: 12px; color: #666;">This invitation will expire in 7 days.</p>
    </div>
  `;
}

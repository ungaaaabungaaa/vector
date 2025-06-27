import nodemailer from "nodemailer";
import { env } from "@/env";

export async function emailSender({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!env.SMTP_HOST) {
    console.info("[email:fallback]", { to, subject, html });
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    secure: Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER ?? "AIKP <no-reply@aikp.local>",
    to,
    subject,
    html,
  });
}

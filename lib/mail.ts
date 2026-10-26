/**
 * Outgoing email over SMTP. For Outlook / Microsoft 365:
 *   SMTP_HOST=smtp.office365.com  SMTP_PORT=587  SMTP_USER=deliveries@...  SMTP_PASS=...
 *   MAIL_FROM="TSS Deliveries <deliveries@trafficsafetyservice.com>"
 *   COMPANY_ROUTES_TO=everyone@trafficsafetyservice.com   (comma separated)
 * Without SMTP settings, emails are recorded in Messages as "dry run" and not sent.
 */
import nodemailer from "nodemailer";

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export type MailResult = { ok: true; id: string } | { ok: false; error: string; dryRun?: boolean };

export async function sendMail(to: string | string[], subject: string, html: string, text?: string): Promise<MailResult> {
  if (!mailConfigured()) return { ok: false, dryRun: true, error: "SMTP is not set up yet." };
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Email could not be sent." };
  }
}

export function companyRecipients(): string[] {
  return (process.env.COMPANY_ROUTES_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

import nodemailer from 'nodemailer';
import * as log from './logger';

/**
 * Shared mail sender — used for ALL platform emails (password reset,
 * appointment notifications, …). The sender is the platform owner (Reza),
 * configured via env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL, SMTP_FROM_NAME
 */

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@reza.ma';
const fromName = process.env.SMTP_FROM_NAME || 'Reza';

const configured = Boolean(host);

let transporter: nodemailer.Transporter | null = null;
if (configured) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    // Fail fast instead of hanging ~2 min (nodemailer's default timeout) when
    // the SMTP server is unreachable, and log the real reason.
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    // Force IPv4: on hosts with broken IPv6 (common on cloud providers) the
    // connect to smtp.gmail.com's AAAA record hangs until timeout.
    // `family` is supported at runtime but missing from @types/nodemailer.
    family: 4,
  } as nodemailer.TransportOptions);
}

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
  if (!configured || !transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM_EMAIL before sending emails in production.'
      );
    }
    // Dev fallback: log the email instead of failing, so flows can be tested
    // without an SMTP server.
    log.log(
      `[Mailer] (dev, SMTP not configured — email NOT sent)\n  to: ${Array.isArray(to) ? to.join(', ') : to}\n  subject: ${subject}\n  html: ${html.slice(0, 400)}`
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text,
    });
    log.log(`[Mailer] ✓ Email sent to ${Array.isArray(to) ? to.join(', ') : to} (id: ${info.messageId})`);
  } catch (error) {
    log.error('[Mailer] Failed to send email:', error);
    // Surface the real SMTP reason (auth failure, connection refused, …) so
    // the API response and logs show exactly why the send failed.
    const detail =
      error instanceof Error && error.message
        ? ` ${error.message}`
        : '';
    throw new Error(
      `Failed to send email via SMTP (${host}). Check the SMTP_* environment variables and the recipient address.${detail}`
    );
  }
}

export const mailer = { sendMail };

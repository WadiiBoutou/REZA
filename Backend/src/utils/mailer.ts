import dns from 'node:dns';
import nodemailer from 'nodemailer';
import * as log from './logger';

/**
 * Shared mail sender — used for ALL platform emails (password reset,
 * appointment notifications, …). The sender is the platform owner (Reza),
 * configured via env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional: SMTP_FROM_EMAIL (defaults to SMTP_USER), SMTP_FROM_NAME
 *
 * IPv6 note: smtp.gmail.com resolves to both A and AAAA records. On hosts with
 * a broken/blocked IPv6 route (common on cloud providers) the resolver can pick
 * the IPv6 address and the connect dies with ENETUNREACH. nodemailer ignores
 * the `family` option, and `dns.setDefaultResultOrder('ipv4first')` is not
 * reliably honored by the socket either. So we resolve the IPv4 address
 * ourselves and connect to that literal IP, keeping the real hostname as the
 * TLS SNI server name so Gmail's certificate still validates.
 */

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@reza.ma';
const fromName = process.env.SMTP_FROM_NAME || 'Reza';

const configured = Boolean(host);

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getTransporter(): Promise<nodemailer.Transporter> {
  if (!configured || !host) {
    return Promise.reject(
      new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS before sending emails in production.'
      )
    );
  }

  if (!transporterPromise) {
    transporterPromise = (async () => {
      let smtpHost = host;
      const servername = host;
      try {
        // Force IPv4: connect to the literal address so a broken IPv6 route can
        // never be chosen by the resolver.
        const { address } = await dns.promises.lookup(host, { family: 4 });
        smtpHost = address;
        log.log(`[Mailer] SMTP ${host}:${port} → IPv4 ${address} (connecting to literal IP, SNI ${servername})`);
      } catch (e) {
        log.log(`[Mailer] IPv4 lookup failed for ${host} (${(e as Error)?.message}), falling back to hostname`);
      }

      return nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
        // Keep the real hostname as SNI so the TLS cert (valid for smtp.gmail.com)
        // validates even though we connect to a literal IP.
        tls: { servername },
        // Fail fast instead of hanging ~2 min (nodemailer's default timeout) when
        // the SMTP server is unreachable, and log the real reason.
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
    })();
  }

  return transporterPromise;
}

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS before sending emails in production.'
      );
    }
    // Dev fallback: log the email instead of failing, so flows can be tested
    // without an SMTP server.
    log.log(
      `[Mailer] (dev, SMTP not configured — email NOT sent)\n  to: ${Array.isArray(to) ? to.join(', ') : to}\n  subject: ${subject}\n  html: ${html.slice(0, 400)}`
    );
    return;
  }

  const transporter = await getTransporter();

  // Transient egress/DNS failures (timeouts, unreachable, resets) are common on
  // cloud hosts — retry a few times with short backoff before surfacing the error.
  const attempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text,
      });
      log.log(`[Mailer] ✓ Email sent to ${Array.isArray(to) ? to.join(', ') : to} (id: ${info.messageId})`);
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const retryable = /timeout|ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|greeting/i.test(
        msg
      );
      if (attempt < attempts && retryable) {
        log.error(`[Mailer] attempt ${attempt}/${attempts} failed, retrying… (${msg})`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      break;
    }
  }

  log.error('[Mailer] Failed to send email:', lastError);
  // Surface the real SMTP reason (auth failure, connection refused, …) so
  // the API response and logs show exactly why the send failed.
  const detail = lastError instanceof Error && lastError.message ? ` ${lastError.message}` : '';
  throw new Error(
    `Failed to send email via SMTP (${host}). Check the SMTP_* environment variables and the recipient address.${detail}`
  );
}

export const mailer = { sendMail };

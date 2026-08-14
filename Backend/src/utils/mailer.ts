import dns from 'node:dns';
import net from 'node:net';
import nodemailer from 'nodemailer';
import * as log from './logger';

/**
 * Shared mail sender — used for ALL platform emails (password reset,
 * appointment notifications, …).
 *
 * Sending paths, chosen at runtime:
 *
 * Sending paths, chosen at runtime:
 *
 * 1) BREVO (best when you have no owned domain — verify your own Gmail as
 *    sender, no DNS needed): if BREVO_API_KEY is set, emails go over Brevo's
 *    HTTPS API (api.brevo.com, port 443). Render free blocks outbound SMTP, so
 *    the HTTP path is the reliable one. 300 emails/day free.
 *      BREVO_API_KEY=…                  (Brevo → SMTP & API → API Keys)
 *      BREVO_SENDER_EMAIL=you@gmail.com (must be verified in Brevo → Senders)
 *      BREVO_SENDER_NAME=Reza
 *
 * 2) SMTP fallback: if BREVO_API_KEY is unset, classic SMTP via
 *    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Because cloud hosts often have
 *    a broken IPv6 route (Gmail's AAAA → ENETUNREACH) and/or block one of the
 *    SMTP ports, we probe {IPv4, hostname} × {587, 465} and send through the
 *    first candidate that accepts a TCP connection. Fast, readable failure.
 */

const host = process.env.SMTP_HOST;
const configuredPort = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@reza.ma';
const fromName = process.env.SMTP_FROM_NAME || 'Reza';

// Brevo HTTP API (port 443 — never blocked by cloud egress firewalls).
// Best option without an owned domain: verify your own email as sender.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || fromEmail;
const brevoSenderName = process.env.BREVO_SENDER_NAME || fromName;
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const configured = Boolean(host) || Boolean(BREVO_API_KEY);

const PROBE_TIMEOUT_MS = 4000;
const CONNECT_TIMEOUT_MS = 8000;

interface Candidate {
  host: string;
  port: number;
  secure: boolean;
  label: string;
}

/** Quick TCP reachability check (no SMTP handshake). */
function probe(hostname: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(PROBE_TIMEOUT_MS);
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.once('timeout', () => done(false));
    sock.connect(port, hostname);
  });
}

/** Build the ordered list of SMTP connection candidates to try. */
async function buildCandidates(): Promise<Candidate[]> {
  const altPort = configuredPort === 465 ? 587 : 465;
  let ip = host!;
  try {
    const { address } = await dns.promises.lookup(host!, { family: 4 });
    ip = address;
  } catch {
    log.log(`[Mailer] ⚠️ IPv4 lookup failed for ${host} — will use hostname only`);
  }

  const candidates: Candidate[] = [
    { host: ip, port: configuredPort, secure: configuredPort === 465, label: `${ip}:${configuredPort}` },
    { host: host!, port: configuredPort, secure: configuredPort === 465, label: `${host}:${configuredPort}` },
    { host: ip, port: altPort, secure: altPort === 465, label: `${ip}:${altPort}` },
    { host: host!, port: altPort, secure: altPort === 465, label: `${host}:${altPort}` },
  ];
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
}

/** Find the first SMTP candidate that accepts a TCP connection. */
async function pickCandidate(candidates: Candidate[]): Promise<{ candidate: Candidate; probeResults: { label: string; ok: boolean }[] }> {
  const probeResults: { label: string; ok: boolean }[] = [];
  for (const c of candidates) {
    const ok = await probe(c.host, c.port);
    probeResults.push({ label: c.label, ok });
    log.log(`[Mailer] probe ${c.label} → ${ok ? '✅ reachable' : '❌ unreachable'}`);
    if (ok) return { candidate: c, probeResults };
  }
  return { candidate: candidates[0], probeResults };
}

function getTransporter(candidate: Candidate): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: candidate.host,
    port: candidate.port,
    secure: candidate.secure,
    auth: user ? { user, pass } : undefined,
    // Keep the real hostname as SNI so the TLS cert (valid for smtp.gmail.com)
    // validates even though we may connect to a literal IP.
    tls: { servername: host! },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 15000,
  });
}

async function sendViaBrevo(to: string[], subject: string, html: string, text?: string): Promise<void> {
  log.log(`[Mailer] Sending via Brevo API (HTTPS) to ${to.join(', ')}`);
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: brevoSenderEmail, name: brevoSenderName },
      to: to.map((email) => ({ email })),
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body: any = await res.json();
      detail = body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '');
    }
    log.error(`[Mailer] Brevo API error ${res.status}: ${detail}`);
    throw new Error(
      `Failed to send email via Brevo (HTTP ${res.status}). Check the BREVO_API_KEY and that the sender "${brevoSenderEmail}" is verified in Brevo (Senders → verify).${detail ? ` ${detail}` : ''}`
    );
  }
  const body: any = await res.json().catch(() => ({}));
  log.log(`[Mailer] ✓ Email sent via Brevo (id: ${body?.messageId || 'unknown'})`);
}

async function sendViaSmtp(to: string, subject: string, html: string, text?: string): Promise<void> {
  if (!host) throw new Error('SMTP_HOST is not set');
  log.log(`[Mailer] Preparing SMTP send to ${to}…`);
  const candidates = await buildCandidates();
  const { candidate, probeResults } = await pickCandidate(candidates);

  const reachable = probeResults.filter((r) => r.ok);
  if (reachable.length === 0) {
    log.error(
      `[Mailer] ❌ No candidate reachable. Tried: ${probeResults.map((r) => `${r.label} (${r.ok ? 'ok' : 'fail'})`).join(', ')}`
    );
    throw new Error(
      `Failed to send email via SMTP (${host}). No SMTP endpoint reachable — tried ` +
        `${probeResults.map((r) => `${r.label}${r.ok ? '' : ' (unreachable)'}`).join(', ')}. ` +
        `Your host blocks outbound SMTP; set BREVO_API_KEY to send via HTTPS instead.`
    );
  }

  log.log(`[Mailer] Using ${candidate.label} (${candidate.secure ? 'SSL' : 'STARTTLS'})`);
  const transporter = getTransporter(candidate);

  const attempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text,
      });
      log.log(`[Mailer] ✓ Email sent to ${to} (id: ${info.messageId})`);
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const retryable = /timeout|ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|greeting/i.test(msg);
      if (attempt < attempts && retryable) {
        log.error(`[Mailer] attempt ${attempt}/${attempts} failed, retrying… (${msg})`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      break;
    }
  }

  log.error('[Mailer] Failed to send email:', lastError);
  const detail = lastError instanceof Error && lastError.message ? ` ${lastError.message}` : '';
  throw new Error(
    `Failed to send email via SMTP (${host}). Check the SMTP_* environment variables and the recipient address.${detail}`
  );
}

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
  const recipients = Array.isArray(to) ? to.join(', ') : to;

  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Email is not configured. Set BREVO_API_KEY (no domain needed) or SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.'
      );
    }
    log.log(
      `[Mailer] (dev, email not configured — email NOT sent)\n  to: ${recipients}\n  subject: ${subject}\n  html: ${html.slice(0, 400)}`
    );
    return;
  }

  if (BREVO_API_KEY) {
    await sendViaBrevo(Array.isArray(to) ? to : [to], subject, html, text);
    return;
  }

  await sendViaSmtp(recipients, subject, html, text);
}

export const mailer = { sendMail };

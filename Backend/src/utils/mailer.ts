import dns from 'node:dns';
import net from 'node:net';
import nodemailer from 'nodemailer';
import * as log from './logger';

/**
 * Shared mail sender — used for ALL platform emails (password reset,
 * appointment notifications, …). The sender is the platform owner (Reza),
 * configured via env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional: SMTP_FROM_EMAIL (defaults to SMTP_USER), SMTP_FROM_NAME
 *
 * Connectivity hardening (cloud hosts are picky):
 *  - smtp.gmail.com resolves to both A (IPv4) and AAAA (IPv6). On hosts with a
 *    broken IPv6 route the resolver can pick IPv6 → ENETUNREACH. So we resolve
 *    IPv4 ourselves and connect to the literal IP.
 *  - Some networks block port 587 (STARTTLS) but allow 465 (SSL), and some
 *    egress proxies require the hostname rather than a literal IP. So we probe
 *    a small set of candidates — {IP, hostname} × {configured port, alt port} —
 *    pick the first one that accepts a TCP connection, and send through it.
 *  - A quick probe (not the full SMTP handshake) keeps failures fast (~seconds)
 *    and produces readable logs instead of a silent ~1 min timeout.
 */

const host = process.env.SMTP_HOST;
const configuredPort = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@reza.ma';
const fromName = process.env.SMTP_FROM_NAME || 'Reza';

const configured = Boolean(host);

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

/** Build the ordered list of connection candidates to try. */
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
  // De-dupe identical labels (when the resolved IP equals the hostname).
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
}

/** Find the first candidate that accepts a TCP connection. */
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

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

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

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
  if (!configured || !host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS before sending emails in production.'
      );
    }
    log.log(
      `[Mailer] (dev, SMTP not configured — email NOT sent)\n  to: ${Array.isArray(to) ? to.join(', ') : to}\n  subject: ${subject}\n  html: ${html.slice(0, 400)}`
    );
    return;
  }

  log.log(`[Mailer] Preparing to send to ${Array.isArray(to) ? to.join(', ') : to}…`);
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
        `This usually means your host blocks outbound SMTP; try SMTP_PORT=465 (SSL).`
    );
  }

  log.log(`[Mailer] Using ${candidate.label} (${candidate.secure ? 'SSL' : 'STARTTLS'})`);
  const transporter = getTransporter(candidate);

  // Transient failures still happen mid-handshake — retry a couple times with
  // short backoff, but keep total time low.
  const attempts = 2;
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

export const mailer = { sendMail };

/**
 * Time-filtered logger for development.
 *
 * - By default, all `log()`, `warn()`, `error()` always output.
 * - Set env `LOG_TIME_WINDOW=true` to only show `log()`/`warn()` between 09:00–12:00 Morocco time.
 * - `error()` always outputs regardless of time window (safety).
 */

const MOROCCO_OFFSET_HOURS = 1;
const TIME_FILTER_ENABLED = process.env.LOG_TIME_WINDOW === 'true';

function moroccoHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return (utcHour + MOROCCO_OFFSET_HOURS) % 24;
}

function timestamp(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const morocco = new Date(utcMs + MOROCCO_OFFSET_HOURS * 3_600_000);
  const h = String(morocco.getHours()).padStart(2, '0');
  const m = String(morocco.getMinutes()).padStart(2, '0');
  const s = String(morocco.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function isInWindow(): boolean {
  if (!TIME_FILTER_ENABLED) return true;
  const h = moroccoHour();
  return h >= 9 && h < 12;
}

export function log(...args: unknown[]): void {
  if (!isInWindow()) return;
  console.log(`[${timestamp()}]`, ...args);
}

export function warn(...args: unknown[]): void {
  if (!isInWindow()) return;
  console.warn(`[${timestamp()}]`, ...args);
}

export function error(...args: unknown[]): void {
  console.error(`[${timestamp()}]`, ...args);
}

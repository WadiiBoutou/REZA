import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize image path for <img src>.
 * - Absolute Unsplash/CDN: unchanged
 * - /uploads/... : same-origin relative (Next rewrite → backend)
 * - absolute API hosts with /uploads/... : strip to relative for rewrite
 * Avoids http://localhost:5000 which CSP img-src blocks (https: + 'self' only).
 */
/**
 * Moroccan phone validation (same rules as the client app).
 * Accepts +212XXXXXXXXX (9 digits after +212) or 0XXXXXXXXX (10 digits),
 * with optional spaces/dashes/parentheses that are stripped before checking.
 */
export function isValidMoroccanPhone(phone: string): boolean {
  if (!phone || phone.trim().length === 0) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+212')) {
    return /^\+212\d{9}$/.test(cleaned);
  }
  if (cleaned.startsWith('0')) {
    return /^0\d{9}$/.test(cleaned);
  }
  return false;
}

/** Returns a French error message if the phone is invalid, empty string if valid. */
export function getMoroccanPhoneError(phone: string): string {
  if (!phone || phone.trim().length === 0) return '';
  if (!isValidMoroccanPhone(phone)) {
    return 'Format invalide. Utilisez: +212XXXXXXXXX ou 0XXXXXXXXX (10 chiffres)';
  }
  return '';
}

/** Strip spaces/dashes/parentheses, keep + and digits. */
export function normalizeMoroccanPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[\s\-()]/g, '');
}

export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return '';

  const imagePathStr = String(imagePath);

  const uploadOnHost = imagePathStr.match(
    /^https?:\/\/(?:localhost:5000|127\.0\.0\.1:5000|api\.wellbe\.ma)(\/uploads\/.+)$/i
  );
  if (uploadOnHost) {
    return uploadOnHost[1];
  }

  if (imagePathStr.startsWith('http://') || imagePathStr.startsWith('https://')) {
    return imagePathStr;
  }

  if (imagePathStr.startsWith('/')) {
    return imagePathStr;
  }

  return imagePathStr;
}

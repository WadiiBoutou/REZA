import { z } from 'zod';

/**
 * Moroccan phone validation shared across the backend.
 * Accepts:
 *  - +212XXXXXXXXX (international: 9 digits after the +212 country code)
 *  - 0XXXXXXXXX    (local: exactly 10 digits starting with 0)
 * Separators (spaces, dashes, parentheses) are tolerated and stripped before validation.
 * Anything else (letters, >10 local digits, missing digits...) is rejected.
 */
export const PHONE_REGEX = /^(\+212\d{9}|0\d{9})$/;

/** Strip separators and whitespace, keeping only digits and a leading +. */
export function normalizePhone(phone: string): string {
  return String(phone || '').replace(/[\s\-()]/g, '').trim();
}

export function isValidPhone(phone: string): boolean {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return false;
  return PHONE_REGEX.test(cleaned);
}

/** User-facing error message (French). */
export function phoneError(): string {
  return 'Format invalide. Utilisez +212XXXXXXXXX ou 0XXXXXXXXX (10 chiffres).';
}

/** Zod schema for a required phone field (validated Moroccan format). */
export const requiredPhoneSchema = z
  .string()
  .min(1, 'Le téléphone est requis')
  .refine((v) => isValidPhone(v), phoneError());

/** Zod schema for an optional phone field (validated when provided, empty allowed). */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .refine((v) => !v || !String(v).trim() || isValidPhone(v), phoneError());

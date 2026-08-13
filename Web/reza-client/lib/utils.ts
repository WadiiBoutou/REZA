import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Morocco timezone utilities - All dates use Africa/Casablanca timezone
 * Morocco uses UTC+1 (with UTC+0 during Ramadan)
 */

const MOROCCO_TIMEZONE = 'Africa/Casablanca';

/**
 * Get current date/time in Morocco timezone
 */
export function getMoroccoDate(): Date {
  const now = new Date();
  // Get Morocco time string
  const moroccoTimeString = now.toLocaleString("en-US", {
    timeZone: MOROCCO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  // Parse: "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = moroccoTimeString.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hours, minutes, seconds] = timePart.split(":");

  // Create date with Morocco time values in local timezone
  const moroccoDate = new Date();
  moroccoDate.setFullYear(parseInt(year));
  moroccoDate.setMonth(parseInt(month) - 1);
  moroccoDate.setDate(parseInt(day));
  moroccoDate.setHours(parseInt(hours));
  moroccoDate.setMinutes(parseInt(minutes));
  moroccoDate.setSeconds(parseInt(seconds));
  moroccoDate.setMilliseconds(0);

  return moroccoDate;
}

/**
 * Get today's date at 00:00:00 in Morocco timezone
 */
export function getMoroccoToday(): Date {
  const moroccoDate = getMoroccoDate();
  moroccoDate.setHours(0, 0, 0, 0);
  return moroccoDate;
}

/**
 * Format date to Morocco timezone locale string
 */
export function formatMoroccoDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Default options for French locale
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: MOROCCO_TIMEZONE,
    ...options
  };

  return dateObj.toLocaleDateString('fr-FR', defaultOptions);
}

/**
 * Format time to Morocco timezone locale string
 */
export function formatMoroccoTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: MOROCCO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return dateObj.toLocaleTimeString('fr-FR', defaultOptions);
}

/**
 * Format datetime to Morocco timezone locale string
 */
export function formatMoroccoDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: MOROCCO_TIMEZONE,
    ...options
  };

  return dateObj.toLocaleString('fr-FR', defaultOptions);
}

/**
 * Convert a date string to Morocco timezone Date object
 */
export function toMoroccoDate(dateString: string): Date {
  // Parse the date string assuming it's in Morocco timezone
  const date = new Date(dateString);
  
  // Get the date components in Morocco timezone
  const moroccoString = date.toLocaleString("en-US", {
    timeZone: MOROCCO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const [datePart, timePart] = moroccoString.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hours, minutes, seconds] = timePart.split(":");

  const moroccoDate = new Date();
  moroccoDate.setFullYear(parseInt(year));
  moroccoDate.setMonth(parseInt(month) - 1);
  moroccoDate.setDate(parseInt(day));
  moroccoDate.setHours(parseInt(hours));
  moroccoDate.setMinutes(parseInt(minutes));
  moroccoDate.setSeconds(parseInt(seconds));
  moroccoDate.setMilliseconds(0);

  return moroccoDate;
}

/**
 * Create a Date object from date string (YYYY-MM-DD) and time string (HH:MM) in Morocco timezone
 * Returns a Date object that represents the UTC time equivalent to the Morocco local time
 * 
 * This function creates a date by interpreting the date/time as being in Morocco timezone,
 * then converts it to UTC. It handles Morocco timezone changes (UTC+1 standard, UTC+0 during Ramadan)
 * by using the browser's timezone database.
 */
export function createDateFromMoroccoDateTime(dateString: string, timeString: string): Date {
  // Create a Date object that represents the given date/time in Morocco timezone
  // We need to find the UTC time that, when converted to Morocco timezone, equals the desired time
  
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Start with a reasonable guess: assume Morocco is UTC+1 (most of the year)
  // Create a UTC date that would represent the desired Morocco time
  // If user wants 13:00 Morocco time, we need 12:00 UTC (13:00 - 1 hour)
  // But we need to account for DST, so we'll use an iterative approach
  
  // Start with UTC time = Morocco time - 1 hour (typical offset)
  let testDate = new Date(Date.UTC(year, month - 1, day, hours - 1, minutes, 0));
  
  // Check what this UTC date represents in Morocco timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MOROCCO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Iteratively adjust until we get the right Morocco time
  // This handles timezone changes correctly (UTC+1 standard, UTC+0 during Ramadan/DST)
  for (let i = 0; i < 10; i++) { // Increased iterations for better accuracy
    const parts = formatter.formatToParts(testDate);
    const moroccoYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const moroccoMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const moroccoDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    const moroccoHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const moroccoMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    // Check if date matches (important for DST transitions)
    if (moroccoYear !== year || moroccoMonth !== month || moroccoDay !== day) {
      // Date doesn't match - adjust by a day if needed
      const dateDiff = (new Date(year, month - 1, day).getTime() - new Date(moroccoYear, moroccoMonth - 1, moroccoDay).getTime()) / (1000 * 60 * 60 * 24);
      testDate = new Date(testDate.getTime() + dateDiff * 24 * 60 * 60 * 1000);
      continue;
    }
    
    const desiredMinutes = hours * 60 + minutes;
    const actualMinutes = moroccoHour * 60 + moroccoMinute;
    const diffMinutes = desiredMinutes - actualMinutes;
    
    if (Math.abs(diffMinutes) < 1) break; // Close enough (within 1 minute)
    
    // Adjust by the difference (subtract because if Morocco time is ahead, we need to go back in UTC)
    testDate = new Date(testDate.getTime() - diffMinutes * 60 * 1000);
  }
  
  return testDate;
}

/**
 * Check if a date is today in Morocco timezone
 */
export function isMoroccoToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = getMoroccoToday();
  
  const checkDate = toMoroccoDate(dateObj.toISOString());
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate.getTime() === today.getTime();
}

/**
 * Check if a date is in the past in Morocco timezone
 */
export function isMoroccoPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = getMoroccoDate();
  const checkDate = toMoroccoDate(dateObj.toISOString());
  
  return checkDate.getTime() < now.getTime();
}

/**
 * Get relative date string in French (Il y a X jours, etc.)
 */
export function getRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = getMoroccoDate();
  
  // Convert both to Morocco timezone for accurate comparison
  const checkDate = toMoroccoDate(dateObj.toISOString());
  
  const diffInMs = now.getTime() - checkDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return "Aujourd'hui";
  if (diffInDays === 1) return "Il y a 1 jour";
  if (diffInDays < 7) return `Il y a ${diffInDays} jours`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? "Il y a 1 semaine" : `Il y a ${weeks} semaines`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? "Il y a 1 mois" : `Il y a ${months} mois`;
  }
  
  // Fallback to formatted date
  return formatMoroccoDate(checkDate, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * List of all Moroccan cities
 * Used across the application for consistency
 */
export const MOROCCAN_CITIES = [
  'Agadir',
  'Aïn Harrouda',
  'Al Hoceima',
  'Azrou',
  'Beni Mellal',
  'Benslimane',
  'Berrechid',
  'Boujdour',
  'Bouskoura',
  'Casablanca',
  'Chefchaouen',
  'Dakhla',
  'El Jadida',
  'Errachidia',
  'Essaouira',
  'Fès',
  'Guelmim',
  'Ifrane',
  'Inezgane',
  'Kénitra',
  'Khémisset',
  'Khouribga',
  'Laâyoune',
  'Larache',
  'Marrakech',
  'Meknès',
  'Mohammedia',
  'Nador',
  'Ouarzazate',
  'Oued Zem',
  'Oujda',
  'Rabat',
  'Safi',
  'Salé',
  'Sefrou',
  'Settat',
  'Sidi Kacem',
  'Sidi Slimane',
  'Skhirat',
  'Tanger',
  'Taza',
  'Témara',
  'Tétouan',
  'Tifelt',
  'Tiznit',
  'Youssoufia',
  'Zagora',
  'Autre'
] as const;

/**
 * Normalize image path for <img src>.
 * - https:// Unsplash/CDN: unchanged
 * - /uploads/... : same-origin relative (Next rewrite → backend)
 * - absolute API hosts with /uploads/... : strip to relative for rewrite
 */
export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return '';

  const imagePathStr = String(imagePath);

  // Absolute URL that points at our upload tree → relative for Next /uploads rewrite
  const uploadOnHost = imagePathStr.match(
    /^https?:\/\/(?:localhost:5000|127\.0\.0\.1:5000|api\.wellbe\.ma)(\/uploads\/.+)$/i
  );
  if (uploadOnHost) {
    return uploadOnHost[1];
  }

  // External absolute URLs (Unsplash, etc.)
  if (imagePathStr.startsWith('http://') || imagePathStr.startsWith('https://')) {
    return imagePathStr;
  }

  // Relative paths — keep same-origin; next.config rewrites /uploads → backend
  if (imagePathStr.startsWith('/')) {
    return imagePathStr;
  }

  return imagePathStr;
}

/**
 * Check if a tenant has completed all required fields for landing page display
 * Required fields (marked with *):
 * - category (Catégorie principale)
 * - shortDescription (Description courte)
 * - coverImage (Image de couverture)
 * - phone (Téléphone)
 * - email (Email)
 * - city (Ville)
 */
export function isTenantComplete(tenant: any): boolean {
  if (!tenant) return false;

  // Only require a name to be displayed in search results
  // All other fields are optional and will be shown if available
  const hasName = (tenant.name || tenant.establishmentName || '').trim().length > 0;

  if (process.env.NODE_ENV === 'development') {
    if (!hasName) {
      console.log(`Tenant ${tenant.id} has no name, skipping`);
    }
  }

  return hasName;
}

/**
 * Filter tenants to only include those with complete information
 */
export function filterCompleteTenants(tenants: any[]): any[] {
  return tenants.filter(tenant => isTenantComplete(tenant));
}

/**
 * Format time value (HH:MM format) to display format (HHhMM) - Morocco format
 */
export function formatTimeForDisplay(time: string): string {
  if (!time) return '';
  // Remove AM/PM if present and normalize
  let normalized = time.trim().toUpperCase().replace(/\s*(AM|PM)\s*/i, '');
  
  // Extract hours and minutes
  const parts = normalized.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1].split(/\s/)[0], 10) : 0;
    
    if (isNaN(hours)) return time;
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  }
  
  return time;
}

/**
 * Validate Moroccan phone number format
 * Accepts:
 * - +212XXXXXXXXX (10 digits after +212)
 * - 0XXXXXXXXX (10 digits starting with 0)
 * - 06XXXXXXXXX, 05XXXXXXXXX, 07XXXXXXXXX (10 digits)
 * 
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidMoroccanPhone(phone: string): boolean {
  if (!phone || phone.trim().length === 0) {
    return false;
  }

  // Remove all spaces, dashes, and parentheses for validation
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Check for +212 format (international format)
  if (cleaned.startsWith('+212')) {
    // Should be +212 followed by exactly 9 digits (total 13 characters)
    // Format: +212XXXXXXXXX (where X is a digit)
    const digitsAfter = cleaned.substring(4);
    return /^\+212\d{9}$/.test(cleaned) && digitsAfter.length === 9;
  }

  // Check for local format starting with 0
  if (cleaned.startsWith('0')) {
    // Should be exactly 10 digits starting with 0
    // Format: 0XXXXXXXXX (where X is a digit)
    return /^0\d{9}$/.test(cleaned) && cleaned.length === 10;
  }

  // If it doesn't match any format, it's invalid
  return false;
}

/**
 * Get validation error message for Moroccan phone number
 * @param phone - Phone number to validate
 * @returns Error message if invalid, empty string if valid
 */
export function getMoroccanPhoneError(phone: string): string {
  if (!phone || phone.trim().length === 0) {
    return '';
  }

  if (!isValidMoroccanPhone(phone)) {
    return 'Format invalide. Utilisez: +212XXXXXXXXX ou 0XXXXXXXXX (10 chiffres)';
  }

  return '';
}

/**
 * Normalize Moroccan phone number by removing spaces, dashes, and parentheses
 * Keeps the original format (+212 or 0)
 * @param phone - Phone number to normalize
 * @returns Normalized phone number
 */
export function normalizeMoroccanPhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces, dashes, and parentheses but keep + and digits
  return phone.replace(/[\s\-()]/g, '');
}

/**
 * Pretty salon URL slug — prefer subdomain over CUID id.
 * Backend public routes accept subdomain | domain | id.
 */
export function getSalonSlug(salon: {
  slug?: string | null;
  subdomain?: string | null;
  domain?: string | null;
  id?: string | null;
} | null | undefined): string {
  if (!salon) return '';
  const slug = salon.slug?.trim();
  if (slug) return slug;
  const sub = salon.subdomain?.trim();
  if (sub) return sub;
  const domain = salon.domain?.trim();
  if (domain) return domain;
  return salon.id?.trim() || '';
}

/** Path for salon detail page, e.g. `/salon/barber-studio` */
export function getSalonHref(salon: {
  slug?: string | null;
  subdomain?: string | null;
  domain?: string | null;
  id?: string | null;
} | null | undefined): string {
  const slug = getSalonSlug(salon);
  return slug ? `/salon/${slug}` : '/search-results';
}


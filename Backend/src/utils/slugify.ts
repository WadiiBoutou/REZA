import crypto from 'crypto';

/**
 * Build a unique, human-readable URL slug for a tenant, e.g.
 * "Beauté & Co" → "beaute-co-8f3a2c". A short hash of the id guarantees
 * uniqueness without collision handling.
 */
export function slugifyName(name: string, id: string): string {
  const base = (name || 'salon')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const hash = crypto.createHash('md5').update(id).digest('hex').slice(0, 6);
  return `${base || 'salon'}-${hash}`;
}

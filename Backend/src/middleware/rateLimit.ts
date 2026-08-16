import rateLimit from 'express-rate-limit';

// Reasonable thresholds for a booking SaaS. All limiters key on the client IP
// (the server sets `trust proxy` for Render/Vercel in server.ts).
//
// - authLimiter (20/15min): a human retyping a password a few times stays well
//   under this; brute-force / credential-stuffing scripts get cut off quickly.
// - bookingLimiter (20/10min): one POST per booking; a family group booking a
//   few appointments in a row still fits, while rapid-fire booking spam is
//   blocked.
// - publicApiLimiter (600/15min): broad ceiling on unauthenticated reads so a
//   scraper can't hammer tenant lookups, while normal browsing is never hit.

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: {
    error: 'Too many requests',
    message: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
  },
  ...base,
});

export const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: {
    error: 'Too many requests',
    message: 'Trop de demandes de réservation. Veuillez réessayer plus tard.',
  },
  ...base,
});

export const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: {
    error: 'Too many requests',
    message: 'Trop de requêtes. Veuillez réessayer plus tard.',
  },
  ...base,
});

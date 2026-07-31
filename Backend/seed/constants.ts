/** Shared demo credentials — safe for local/dev seed only. */
export const PASSWORDS = {
  admin: 'password123',
  rezaAdmin: '123456',
  superadmin: '123456',
  client: '123456',
} as const;

export const SUPERADMIN = {
  email: 'superadmin@gmail.com',
  firstName: 'Super',
  lastName: 'Admin',
} as const;

export const SPA_ROYAL_ADMIN = {
  email: 'admin@spa-royal.ma',
  firstName: 'Admin',
  lastName: 'Spa Royal',
} as const;

export const REZA_ADMIN = {
  email: 'admin@reza.com',
  firstName: 'Admin',
  lastName: 'Reza',
} as const;

// Pre-hashed bcrypt for 123456 (cost 12)
export const REZA_ADMIN_HASHED_PASSWORD = '$2a$12$lf7ornt4nWL67x967ECXeOfFzJO9qWVJQ/PiZVfqIHy3GYvl.QWLC';

export const BASE_PLAN = {
  name: 'Standard',
  priceCents: 80_000,
  currency: 'MAD',
  interval: 'year',
  maxSalons: 3,
} as const;

/** English keys required by schedulingValidation + getAvailableSlots */
export const BUSINESS_HOURS_BY_DAY = {
  monday: { open: '09:00', close: '19:00' },
  tuesday: { open: '09:00', close: '19:00' },
  wednesday: { open: '09:00', close: '19:00' },
  thursday: { open: '09:00', close: '19:00' },
  friday: { open: '09:00', close: '19:00' },
  saturday: { open: '10:00', close: '18:00' },
  sunday: null as null,
};

export const WEEKDAY_SCHEDULES = [
  { day: 'Lundi', isOpen: true, openTime: '09:00', closeTime: '19:00', breaks: [] as { start: string; end: string }[] },
  { day: 'Mardi', isOpen: true, openTime: '09:00', closeTime: '19:00', breaks: [] },
  { day: 'Mercredi', isOpen: true, openTime: '09:00', closeTime: '19:00', breaks: [] },
  { day: 'Jeudi', isOpen: true, openTime: '09:00', closeTime: '19:00', breaks: [] },
  { day: 'Vendredi', isOpen: true, openTime: '09:00', closeTime: '19:00', breaks: [] },
  { day: 'Samedi', isOpen: true, openTime: '10:00', closeTime: '18:00', breaks: [] },
  { day: 'Dimanche', isOpen: false, openTime: '10:00', closeTime: '18:00', breaks: [] },
];

export const TENANT_BUSINESS_HOURS = {
  schedules: WEEKDAY_SCHEDULES,
  ...BUSINESS_HOURS_BY_DAY,
};

export const EMPLOYEE_WORKING_HOURS = [
  { day: 'Lundi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Mardi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Mercredi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Jeudi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Vendredi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Samedi', isWorking: true, startTime: '10:00', endTime: '18:00', breaks: [] },
  { day: 'Dimanche', isWorking: false, startTime: '10:00', endTime: '18:00', breaks: [] },
];

/**
 * Deterministic avatar URL for a demo person.
 *
 * Uses randomuser.me portraits (stable, internet-hosted real-people photos)
 * so avatar fetching can be tested end-to-end. The same name always resolves
 * to the same portrait — safe to re-run the seed or backfill repeatedly.
 */
export function avatarUrlFor(firstName: string, lastName: string, email: string): string {
  const seed = `${firstName}|${lastName}|${email}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  // Explicit overrides for demo names the heuristic would mislabel.
  const feminineNames = new Set([
    'sara', 'nadia', 'salma', 'laila', 'sofia', 'fatima', 'amina', 'nawal',
    'meryem', 'khadija', 'zineb', 'ikram', 'asmae', 'houda', 'samira', 'hanane',
  ]);
  const masculineNames = new Set(['amine', 'yassine', 'mehdi', 'badr', 'anass']);
  const first = (firstName || '').trim().toLowerCase();
  let gender: 'men' | 'women';
  if (feminineNames.has(first)) {
    gender = 'women';
  } else if (masculineNames.has(first)) {
    gender = 'men';
  } else {
    // Fallback heuristic: names ending in a/e/i/y are usually feminine.
    const feminineEndings = ['a', 'e', 'i', 'y'];
    const lastChar = first.slice(-1);
    gender = feminineEndings.includes(lastChar) ? 'women' : 'men';
  }
  const idx = (hash % 96) + 1; // portraits are 0..99
  return `https://randomuser.me/api/portraits/${gender}/${idx}.jpg`;
}

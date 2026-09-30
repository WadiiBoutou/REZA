const portrait = (gender: 'men' | 'women', index: number) =>
  `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;

export const DEMO_CLIENT_PHOTOS: Record<'MALE' | 'FEMALE', string[]> = {
  FEMALE: [2, 9, 12, 17, 21, 31, 40, 47].map((n) => portrait('women', n)),
  MALE: [3, 7, 11, 14, 22, 29, 36, 45].map((n) => portrait('men', n)),
};

export const DEMO_EMPLOYEE_PHOTOS: Record<string, string> = {
  salma: portrait('women', 57),
  youssef: portrait('men', 50),
  lina: portrait('women', 63),
  meryem: portrait('women', 90),
};

export const DEMO_ADMIN_PHOTO = portrait('women', 48);

export const DEMO_SALON_PHOTOS: string[] = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
];

export const demoClientPhoto = (gender: string, ordinal: number): string => {
  const pool = DEMO_CLIENT_PHOTOS[gender === 'MALE' ? 'MALE' : 'FEMALE'];
  return pool[ordinal % pool.length];
};

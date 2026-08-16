import { prisma } from '../lib/prisma';

/**
 * Proche (family-member) avatars live on the `familyMember` record, but the
 * salon-side Client row created when the proche books has no avatar (the
 * booking flow never copies it). So pro/admin UIs (agenda, client list) show
 * initials while the owning client sees the photo — the avatar exists, it's
 * just stored on the familyMember record.
 *
 * This helper matches salon Client rows back to their familyMember record and
 * resolves the missing avatar. Matching mirrors the "proche" attribution used
 * in the client list: normalized first|last name first (always present on both
 * records), then email, then phone as fallbacks.
 */

export type ClientAvatarCandidate = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
};

type FamilyMemberAvatarRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
};

const normalizeName = (a?: string | null, b?: string | null) =>
  `${(a || '').trim().toLowerCase()}|${(b || '').trim().toLowerCase()}`;

const normalizePhone = (phone?: string | null) =>
  (phone || '').replace(/[\s\-()]/g, '');

/**
 * Returns clientId → avatar for the clients that are missing one and match a
 * familyMember record. Clients that already have an avatar are never touched,
 * and a client only gets an avatar when a familyMember matches unambiguously
 * (first match wins, like the existing name-based proche attribution).
 */
export async function buildProcheAvatarMap(
  clients: ClientAvatarCandidate[]
): Promise<Map<string, string>> {
  // Fast path: nothing to resolve when every client already has an avatar.
  const missing = clients.filter((c) => !c.avatar);
  if (missing.length === 0) return new Map();

  const familyMembers = (await (prisma as any).familyMember.findMany({
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
    },
  })) as FamilyMemberAvatarRow[];

  const byName = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const fm of familyMembers) {
    if (!fm.avatar) continue;
    const nameKey = normalizeName(fm.firstName, fm.lastName);
    if (nameKey !== '|' && !byName.has(nameKey)) byName.set(nameKey, fm.avatar);
    if (fm.email) {
      const emailKey = fm.email.trim().toLowerCase();
      if (!byEmail.has(emailKey)) byEmail.set(emailKey, fm.avatar);
    }
    if (fm.phone) {
      const phoneKey = normalizePhone(fm.phone);
      if (phoneKey && !byPhone.has(phoneKey)) byPhone.set(phoneKey, fm.avatar);
    }
  }

  const avatarByClientId = new Map<string, string>();
  for (const c of missing) {
    const nameKey = normalizeName(c.firstName, c.lastName);
    const avatar =
      (nameKey !== '|' ? byName.get(nameKey) : undefined) ??
      (c.email ? byEmail.get(c.email.trim().toLowerCase()) : undefined) ??
      (c.phone ? byPhone.get(normalizePhone(c.phone)) : undefined);
    if (avatar) avatarByClientId.set(c.id, avatar);
  }
  return avatarByClientId;
}

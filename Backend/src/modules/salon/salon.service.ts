import { prisma } from '../../lib/prisma';
import { generateToken } from '../../utils/jwt';
import { slugifyName } from '../../utils/slugify';
import { accountService } from '../account/account.service';

export interface CreateSalonInput {
  name: string;
  email: string;
  phone: string;
  address?: string;
  city: string;
  category: string;
  shortDescription: string;
  coverImage: string;
  latitude: number;
  longitude: number;
}

export type UpdateSalonInput = Partial<CreateSalonInput>;

/** Client-visibility completeness — lat/lng NOT included (distance is optional UX). */
const COMPLETENESS_KEYS: Array<keyof CreateSalonInput> = [
  'name',
  'email',
  'phone',
  'city',
  'category',
  'shortDescription',
  'coverImage',
];

/** Mirrors Web/reza-client/lib/utils.ts isTenantComplete */
function assertSalonComplete(input: CreateSalonInput) {
  const required: Array<[keyof CreateSalonInput, string]> = [
    ['name', 'Le nom du salon est requis'],
    ['email', 'L\'email est requis'],
    ['phone', 'Le téléphone est requis'],
    ['city', 'La ville est requise'],
    ['category', 'La catégorie est requise'],
    ['shortDescription', 'La description courte est requise'],
    ['coverImage', 'L\'image de couverture est requise'],
  ];
  for (const [key, message] of required) {
    const value = input[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw { status: 400, error: 'Validation error', message };
    }
  }
}

function toSalonSummary(tenant: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  shortDescription: string | null;
  coverImage: string | null;
  subscriptionActive: boolean;
  salonCovered: boolean;
  latitude?: number | null;
  longitude?: number | null;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    address: tenant.address,
    city: tenant.city,
    category: tenant.category,
    shortDescription: tenant.shortDescription,
    coverImage: tenant.coverImage,
    subscriptionActive: tenant.subscriptionActive,
    salonCovered: tenant.salonCovered,
    latitude: tenant.latitude ?? null,
    longitude: tenant.longitude ?? null,
  };
}

function assertCoords(latitude: number, longitude: number) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw {
      status: 400,
      error: 'Validation error',
      message: 'Position sur la carte invalide (latitude / longitude)',
    };
  }
}

export class SalonService {
  /** List all active salons of the account owned by the user, with limit info. */
  async listForOwner(userId: string) {
    const ctx = await accountService.getContextForUser(userId);
    return {
      salons: ctx.salons,
      salonLimit: ctx.salonLimit,
      subscription: ctx.subscription,
      account: ctx.account,
    };
  }

  /**
   * Create a new salon for the owner's account.
   * Under the virement model there is no salon-cap limit — salons are paid for
   * one-time each. A new salon is NEVER auto-covered: it stays hidden from
   * clients until the owner pays its one-time fee + employee fees and the
   * superadmin approves the coverage.
   * Completeness fields required so incomplete salons never get created.
   */
  async createForOwner(userId: string, input: CreateSalonInput) {
    assertSalonComplete(input);
    assertCoords(input.latitude, input.longitude);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw {
        status: 403,
        error: 'Forbidden',
        message: 'Only admins can create salons',
      };
    }

    const account = await accountService.ensureAccountForOwner(userId);
    if (!account.isActive) {
      throw {
        status: 403,
        error: 'Account inactive',
        message: 'Your account has been deactivated',
      };
    }

    // New salons are NEVER auto-covered: the one-time salon fee is paid per
    // salon, so a freshly created salon stays hidden from clients until the
    // owner declares + superadmin approves coverage for it specifically.
    const tenant = await prisma.tenant.create({
      data: {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        address: input.address?.trim() || null,
        city: input.city.trim(),
        category: input.category.trim(),
        shortDescription: input.shortDescription.trim(),
        coverImage: input.coverImage.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        isActive: true,
        salonCovered: false,
        subscriptionActive: false,
        accountId: account.id,
      },
    });

    // Public URL slug (pretty, non-CUID client URLs)
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { slug: slugifyName(tenant.name, tenant.id) },
    });

    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        language: 'fr',
        bookingAdvanceDays: 30,
        cancellationHours: 24,
      },
    });

    return { salon: toSalonSummary(tenant) };
  }

  private async requireOwnedActiveSalon(userId: string, salonId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, tenantId: true },
    });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw {
        status: 403,
        error: 'Forbidden',
        message: 'Only admins can manage salons',
      };
    }

    const owns = await accountService.userOwnsTenant(userId, salonId);
    if (!owns) {
      throw {
        status: 403,
        error: 'Forbidden',
        message: 'Ce salon ne fait pas partie de votre compte',
      };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: salonId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        category: true,
        shortDescription: true,
        coverImage: true,
        subscriptionActive: true,
        salonCovered: true,
        isActive: true,
        accountId: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!tenant || !tenant.isActive) {
      throw { status: 404, error: 'Salon not found', message: 'Salon introuvable ou inactif' };
    }

    return { user, tenant };
  }

  /**
   * Partial update. If any completeness field is touched, post-update salon
   * must still satisfy client-visibility completeness rules.
   */
  async updateForOwner(userId: string, salonId: string, input: UpdateSalonInput) {
    const { tenant } = await this.requireOwnedActiveSalon(userId, salonId);

    const touchedPublic = COMPLETENESS_KEYS.some((k) => input[k] !== undefined);
    const nextLatitude =
      input.latitude !== undefined ? input.latitude : (tenant.latitude as number | null);
    const nextLongitude =
      input.longitude !== undefined ? input.longitude : (tenant.longitude as number | null);

    // Full form saves always send coords; reject incomplete / clearing pin
    if (input.latitude !== undefined || input.longitude !== undefined) {
      if (nextLatitude == null || nextLongitude == null) {
        throw {
          status: 400,
          error: 'Validation error',
          message: 'Position sur la carte requise (latitude / longitude)',
        };
      }
      assertCoords(nextLatitude, nextLongitude);
    } else if (touchedPublic && (tenant.latitude == null || tenant.longitude == null)) {
      // Editing public fields on an older salon without coords: require pin now
      throw {
        status: 400,
        error: 'Validation error',
        message: 'Position sur la carte requise (latitude / longitude)',
      };
    }

    const next: CreateSalonInput = {
      name: input.name !== undefined ? input.name : tenant.name,
      email: input.email !== undefined ? input.email : tenant.email,
      phone: input.phone !== undefined ? input.phone : (tenant.phone || ''),
      address: input.address !== undefined ? input.address : (tenant.address || undefined),
      city: input.city !== undefined ? input.city : (tenant.city || ''),
      category: input.category !== undefined ? input.category : (tenant.category || ''),
      shortDescription:
        input.shortDescription !== undefined
          ? input.shortDescription
          : (tenant.shortDescription || ''),
      coverImage:
        input.coverImage !== undefined ? input.coverImage : (tenant.coverImage || ''),
      latitude: nextLatitude ?? 0,
      longitude: nextLongitude ?? 0,
    };

    if (touchedPublic) {
      assertSalonComplete(next);
    }

    const updated = await prisma.tenant.update({
      where: { id: salonId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.address !== undefined
          ? { address: input.address.trim() || null }
          : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription.trim() }
          : {}),
        ...(input.coverImage !== undefined
          ? { coverImage: input.coverImage.trim() }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      },
    });

    return { salon: toSalonSummary(updated) };
  }

  /**
   * Soft-delete: isActive=false + subscriptionActive=false.
   * Hard delete would cascade clients/appointments/services — never.
   * Blocks deleting the last active salon. Reassigns JWT home tenant if needed.
   */
  async deleteForOwner(userId: string, salonId: string, activeTokenTenantId?: string) {
    const { user, tenant } = await this.requireOwnedActiveSalon(userId, salonId);

    const activeCount = await prisma.tenant.count({
      where: {
        accountId: tenant.accountId!,
        isActive: true,
      },
    });

    if (activeCount <= 1) {
      throw {
        status: 400,
        error: 'Last salon',
        message: 'Impossible de supprimer le dernier salon actif de votre compte',
      };
    }

    await prisma.tenant.update({
      where: { id: salonId },
      data: {
        isActive: false,
        subscriptionActive: false,
      },
    });

    const remaining = await prisma.tenant.findMany({
      where: { accountId: tenant.accountId!, isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const nextTenant = remaining[0];
    let token: string | undefined;
    let activeTenantId = activeTokenTenantId || user.tenantId || nextTenant.id;

    const needRetarget =
      user.tenantId === salonId || activeTokenTenantId === salonId;

    if (needRetarget && nextTenant) {
      if (user.tenantId === salonId) {
        await prisma.user.update({
          where: { id: userId },
          data: { tenantId: nextTenant.id },
        });
      }
      activeTenantId = nextTenant.id;
      token = generateToken({
        userId: user.id,
        email: user.email,
        tenantId: nextTenant.id,
        role: user.role,
      });
    }

    const ctx = await accountService.getContextForUser(userId);

    return {
      success: true,
      softDeleted: true,
      salons: ctx.salons,
      salonLimit: ctx.salonLimit,
      subscription: ctx.subscription,
      account: ctx.account,
      activeTenantId,
      ...(token ? { token } : {}),
      ...(needRetarget && nextTenant
        ? { switchedTo: { id: nextTenant.id, name: nextTenant.name } }
        : {}),
    };
  }

  /** Re-issue a tenant-scoped token for a salon the user owns (or belongs to). */
  async validateSwitchTarget(userId: string, targetTenantId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, tenantId: true },
    });
    if (!user) {
      throw { status: 401, error: 'User not found', message: 'User no longer exists' };
    }

    const isHomeTenant = user.tenantId === targetTenantId;
    const ownsTenant = await accountService.userOwnsTenant(userId, targetTenantId);
    if (!isHomeTenant && !ownsTenant) {
      throw {
        status: 403,
        error: 'Forbidden',
        message: 'Ce salon ne fait pas partie de votre compte',
      };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId },
      select: { id: true, name: true, isActive: true },
    });
    if (!tenant || !tenant.isActive) {
      throw { status: 404, error: 'Salon not found', message: 'Salon introuvable ou inactif' };
    }

    return { user, tenant };
  }
}

export const salonService = new SalonService();

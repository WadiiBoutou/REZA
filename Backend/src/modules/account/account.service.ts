import { prisma } from '../../lib/prisma';

/**
 * Under the virement model there is no per-plan salon cap — salons are paid
 * for one-time each. The limit is effectively unlimited (enforcement is
 * billing-based: unpaid salons stay hidden from the public site).
 */
export const UNLIMITED_SALON_LIMIT = 1000;

export interface SalonSummary {
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
  employeesPaid: number;
  latitude: number | null;
  longitude: number | null;
}

export interface AccountContext {
  account: { id: string; isActive: boolean } | null;
  salons: SalonSummary[];
  subscription: {
    status: string;
    salonsPaid: number;
    subscribedAt: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
  salonLimit: number;
}

export class AccountService {
  /**
   * Load the account owned by a user (owner-based multi-salon context).
   * Returns null account for non-owner users (staff, superadmin).
   */
  async getContextForUser(userId: string): Promise<AccountContext> {
    const account = await prisma.account.findUnique({
      where: { ownerUserId: userId },
      include: {
        tenants: {
          where: { isActive: true },
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
            employeesPaid: true,
            latitude: true,
            longitude: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        subscription: true,
      },
    });

    if (!account) {
      return { account: null, salons: [], subscription: null, salonLimit: UNLIMITED_SALON_LIMIT };
    }

    const sub = account.subscription;

    return {
      account: { id: account.id, isActive: account.isActive },
      salons: account.tenants,
      subscription: sub
        ? {
            status: sub.status,
            salonsPaid: sub.salonsPaid,
            subscribedAt: sub.subscribedAt,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
      salonLimit: UNLIMITED_SALON_LIMIT,
    };
  }

  /** Ensure the user owns an account; create one if missing (for ADMIN owners). */
  async ensureAccountForOwner(userId: string) {
    let account = await prisma.account.findUnique({ where: { ownerUserId: userId } });
    if (!account) {
      account = await prisma.account.create({ data: { ownerUserId: userId, isActive: true } });
    }
    return account;
  }

  /** True if the tenant belongs to the account owned by the user. */
  async userOwnsTenant(userId: string, tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { account: { select: { ownerUserId: true } } },
    });
    return tenant?.account?.ownerUserId === userId;
  }

}

export const accountService = new AccountService();

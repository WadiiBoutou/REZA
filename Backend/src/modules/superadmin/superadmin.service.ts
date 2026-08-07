import { Prisma } from '../../../prisma/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { accountService } from '../account/account.service';
import { isPeriodActive } from '../subscription/subscription.service';
import * as log from '../../utils/logger';

export type ListAccountsParams = {
  page?: number;
  limit?: number;
  q?: string;
};

export type UpdateAccountData = {
  isActive?: boolean;
  subscriptionStatus?: 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  currentPeriodEnd?: string | null;
};

function mapAccount(a: {
  id: string;
  isActive: boolean;
  createdAt: Date;
  owner: { id: string; email: string; firstName: string; lastName: string; isActive: boolean } | null;
  tenants: { id: string; name: string; city: string | null; isActive: boolean; subscriptionActive: boolean }[];
  subscription: {
    id: string;
    status: string;
    salonsPaid: number;
    subscribedAt: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
}) {
  return {
    id: a.id,
    isActive: a.isActive,
    createdAt: a.createdAt,
    owner: a.owner,
    salonCount: a.tenants.length,
    salons: a.tenants,
    subscription: a.subscription
      ? {
          id: a.subscription.id,
          status: a.subscription.status,
          salonsPaid: a.subscription.salonsPaid,
          subscribedAt: a.subscription.subscribedAt,
          currentPeriodEnd: a.subscription.currentPeriodEnd,
        }
      : null,
  };
}

/**
 * Sync subscriptionActive per salon: a salon is publicly visible while it is
 * covered (Tenant.salonCovered — one-time fee paid forever) and the account is
 * active. Called after approvals and on account reactivation.
 */
async function applySalonVisibility(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      tenants: { where: { isActive: true }, select: { id: true, salonCovered: true } },
    },
  });
  if (!account) return;

  await prisma.$transaction(
    account.tenants.map((t) =>
      prisma.tenant.update({
        where: { id: t.id },
        data: { subscriptionActive: t.salonCovered },
      })
    )
  );
}

export class SuperAdminService {
  /** Accounts with owner, salons, subscription — searchable / paginated. */
  async listAccounts(params: ListAccountsParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AccountWhereInput = {};

    const q = params.q?.trim();
    if (q) {
      where.OR = [
        { owner: { email: { contains: q, mode: 'insensitive' } } },
        { owner: { firstName: { contains: q, mode: 'insensitive' } } },
        { owner: { lastName: { contains: q, mode: 'insensitive' } } },
        { tenants: { some: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const include = {
      owner: {
        select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
      },
      tenants: {
        select: { id: true, name: true, city: true, isActive: true, subscriptionActive: true },
        orderBy: { createdAt: 'asc' as const },
      },
      subscription: true,
    };

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.account.count({ where }),
    ]);

    return {
      accounts: accounts.map(mapAccount),
      total,
      page,
      limit,
    };
  }

  /** Activate/deactivate an account. Deactivation hides all its salons from clients. */
  async updateAccount(accountId: string, data: UpdateAccountData) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { subscription: true },
    });
    if (!account) {
      throw { status: 404, error: 'Account not found', message: 'Compte introuvable' };
    }

    if (typeof data.isActive === 'boolean') {
      await prisma.account.update({ where: { id: accountId }, data: { isActive: data.isActive } });
      await prisma.tenant.updateMany({
        where: { accountId },
        data: { isActive: data.isActive, subscriptionActive: false },
      });
      if (data.isActive) {
        // Re-apply per-salon coverage visibility (only covered salons public)
        await applySalonVisibility(accountId);
      }
    }

    if (data.subscriptionStatus || data.currentPeriodEnd !== undefined) {
      const periodEnd =
        data.currentPeriodEnd === undefined
          ? undefined
          : data.currentPeriodEnd
            ? new Date(data.currentPeriodEnd)
            : null;
      if (account.subscription) {
        await prisma.subscription.update({
          where: { id: account.subscription.id },
          data: {
            ...(data.subscriptionStatus ? { status: data.subscriptionStatus } : {}),
            ...(periodEnd !== undefined ? { currentPeriodEnd: periodEnd } : {}),
          },
        });
      } else {
        const basePlan = await prisma.subscriptionPlan.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        if (!basePlan) {
          throw { status: 404, error: 'Plan not found', message: 'Aucun plan de référence' };
        }
        await prisma.subscription.create({
          data: {
            accountId,
            planId: basePlan.id,
            status: data.subscriptionStatus ?? 'ACTIVE',
            currentPeriodEnd: periodEnd ?? null,
          },
        });
      }
      await applySalonVisibility(accountId);
    }

    return { success: true };
  }

  // ── Billing configuration ──────────────────────────────────────────────

  async getBillingConfig() {
    const config = await prisma.billingConfig.findUnique({ where: { id: 'default' } });
    if (config) return { config };
    const created = await prisma.billingConfig.create({ data: { id: 'default' } });
    return { config: created };
  }

  async updateBillingConfig(data: {
    pricePerSalon?: number;
    freeEmployeeThreshold?: number;
    pricePerEmployee?: number;
    // Item fields typed optional: zod's inferred output resolves them that way
    // under this project's tsconfig (strict: false); they're validated below.
    employeeTiers?: { min?: number; max?: number | null; price?: number }[] | null;
    currency?: string;
  }) {
    const update: Prisma.BillingConfigCreateInput = {};
    if (data.pricePerSalon !== undefined) {
      if (data.pricePerSalon < 0) {
        throw { status: 400, error: 'Invalid price', message: 'Prix par salon invalide' };
      }
      update.pricePerSalon = data.pricePerSalon;
    }
    if (data.freeEmployeeThreshold !== undefined) {
      if (data.freeEmployeeThreshold < 0) {
        throw { status: 400, error: 'Invalid threshold', message: 'Seuil invalide' };
      }
      update.freeEmployeeThreshold = data.freeEmployeeThreshold;
    }
    if (data.pricePerEmployee !== undefined) {
      if (data.pricePerEmployee < 0) {
        throw { status: 400, error: 'Invalid price', message: 'Prix par employé invalide' };
      }
      update.pricePerEmployee = data.pricePerEmployee;
    }
    if (data.employeeTiers !== undefined) {
      // Normalize: sort by min, trim invalid entries, cap negative values.
      const tiers: { min: number; max: number | null; price: number }[] = [];
      for (const t of data.employeeTiers ?? []) {
        if (!t || typeof t.min !== 'number' || typeof t.price !== 'number' || t.min < 1 || t.price < 0) continue;
        tiers.push({
          min: Math.floor(t.min),
          max: t.max === null || t.max === undefined ? null : Math.max(t.min, Math.floor(t.max)),
          price: t.price,
        });
      }
      tiers.sort((a, b) => a.min - b.min);
      update.employeeTiers = (tiers.length > 0 ? tiers : []) as Prisma.InputJsonValue;
    }
    if (data.currency !== undefined) update.currency = data.currency;

    const config = await prisma.billingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...update },
      update,
    });
    return { config };
  }

  // ── Payments (virement declarations) ───────────────────────────────────

  async listPayments(params: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' } = {}) {
    const where: Prisma.SubscriptionPaymentWhereInput = {};
    if (params.status) where.status = params.status;

    const [payments, total] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          account: {
            select: {
              id: true,
              owner: { select: { id: true, email: true, firstName: true, lastName: true } },
              tenants: {
                where: { isActive: true },
                select: { id: true, name: true },
                orderBy: { createdAt: 'asc' },
              },
              subscription: true,
            },
          },
          declaredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.subscriptionPayment.count({ where }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        reference: p.reference,
        payerName: p.payerName,
        rejectedReason: p.rejectedReason,
        details: p.details,
        createdAt: p.createdAt,
        approvedAt: p.approvedAt,
        declaredBy: p.declaredBy,
        approvedBy: p.approvedBy,
        account: p.account
          ? {
              id: p.account.id,
              owner: p.account.owner,
              salons: p.account.tenants,
              subscription: p.account.subscription
                ? {
                    status: p.account.subscription.status,
                    salonsPaid: p.account.subscription.salonsPaid,
                    currentPeriodEnd: p.account.subscription.currentPeriodEnd,
                  }
                : null,
            }
          : null,
      })),
      total,
    };
  }

  /**
   * Approve a PENDING payment: apply the declared per-salon coverage snapshot —
   * exactly the salons the admin chose get salonCovered=true + subscriptionActive
   * (one-time fee, forever), each of those salons' employeesPaid += its declared
   * count, subscription becomes ACTIVE, period = now + 1 month, subscribedAt =
   * now (approval date = subscription start).
   */
  async approvePayment(paymentId: string, approverUserId: string) {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        account: {
          include: {
            subscription: true,
            tenants: {
              where: { isActive: true },
              include: { _count: { select: { employees: { where: { isActive: true } } } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!payment) {
      throw { status: 404, error: 'Payment not found', message: 'Paiement introuvable' };
    }
    if (payment.status !== 'PENDING') {
      throw { status: 400, error: 'Not pending', message: 'Ce paiement a déjà été traité' };
    }

    const details = (payment.details ?? {}) as {
      salonsDue?: number;
      employeesDue?: number;
      employeesBySalon?: Record<string, number>;
      salons?: { id: string; name: string; salonCovered: boolean; billableEmployees: number; salonFee: number; employeeFee: number }[];
    };
    const account = payment.account;
    const sub = account.subscription;

    // The admin's declared salon set (per-salon snapshot). Falls back to legacy
    // count-based details for payments declared before the per-salon model.
    const declaredSalons = details.salons?.length
      ? details.salons
      : account.tenants.map((t, i) => ({
          id: t.id,
          name: t.name,
          salonCovered: false,
          billableEmployees: 0,
          salonFee: 0,
          employeeFee: 0,
        }));
    const declaredIds = new Set(declaredSalons.map((s) => s.id));
    const employeesBySalon = details.employeesBySalon ?? {};

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // If the previous period had lapsed, the stored per-salon employeesPaid is
    // stale (billing treats it as 0) — SET the new period's coverage instead of
    // incrementing, otherwise coverage would stack and over-cover the account.
    const resetCoverage = !isPeriodActive(sub);

    await prisma.$transaction([
      prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'APPROVED', approvedById: approverUserId, approvedAt: now },
      }),
      prisma.subscription.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
          planId: sub?.planId ?? (await this.ensureReferencePlanId()),
          status: 'ACTIVE',
          salonsPaid: declaredIds.size,
          subscribedAt: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          status: 'ACTIVE',
          subscribedAt: sub?.subscribedAt ?? now,
          currentPeriodEnd: periodEnd,
        },
      }),
      // Declared salons become covered forever + get their employees' coverage.
      // Non-declared salons keep whatever coverage they already had (unchanged).
      ...account.tenants.map((t) => {
        const declared = declaredIds.has(t.id);
        const employeeDelta = declared ? (employeesBySalon[t.id] ?? 0) : 0;
        const data: any = {};
        if (declared) {
          data.salonCovered = true;
          data.subscriptionActive = true;
        }
        if (resetCoverage) {
          // Period lapsed: stored employeesPaid is stale (billing reads it as 0
          // while inactive). SET the new period's coverage explicitly — declared
          // salons get their declared count, and non-declared salons reset to 0
          // so they can't inherit free employee coverage from the old period.
          data.employeesPaid = declared ? employeeDelta : 0;
        } else if (declared) {
          data.employeesPaid = { increment: employeeDelta };
        }
        return prisma.tenant.update({ where: { id: t.id }, data });
      }),
    ]);

    // Keep salonsPaid in sync with the actual covered count
    const coveredCount = await prisma.tenant.count({
      where: { accountId: account.id, isActive: true, salonCovered: true },
    });
    await prisma.subscription.update({
      where: { accountId: account.id },
      data: { salonsPaid: coveredCount },
    });

    // Salon visibility: exactly the covered salons become public
    await applySalonVisibility(account.id);

    // Clear the PAYMENT_DECLARED notification(s) for this payment
    await this.clearPaymentNotifications(payment.id);

    log.log(
      `[Billing] Payment ${payment.id} approved by ${approverUserId} for account ${account.id} (salons: ${declaredSalons.map((s) => s.name).join(', ')}; employees: +${declaredSalons.reduce((a, s) => a + (employeesBySalon[s.id] ?? 0), 0)})`
    );

    return { success: true };
  }

  /** Reject a PENDING payment. Nothing is applied to coverage. */
  async rejectPayment(paymentId: string, reason?: string) {
    const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw { status: 404, error: 'Payment not found', message: 'Paiement introuvable' };
    }
    if (payment.status !== 'PENDING') {
      throw { status: 400, error: 'Not pending', message: 'Ce paiement a déjà été traité' };
    }

    await prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'REJECTED', rejectedReason: reason?.trim() || null },
    });

    // Clear the PAYMENT_DECLARED notification(s) for this payment
    await this.clearPaymentNotifications(paymentId);

    return { success: true };
  }

  /** Mark PAYMENT_DECLARED notifications for a payment as read (handled). */
  private async clearPaymentNotifications(paymentId: string) {
    try {
      await prisma.notification.updateMany({
        where: {
          type: 'PAYMENT_DECLARED',
          metadata: { path: ['paymentId'], equals: paymentId },
        },
        data: { isRead: true, readAt: new Date() },
      });
    } catch (notificationError) {
      // Never block the approve/reject itself
      log.error('Error clearing PAYMENT_DECLARED notification:', notificationError);
    }
  }

  private async ensureReferencePlanId(): Promise<string> {
    const plan = await prisma.subscriptionPlan.findFirst({ orderBy: { createdAt: 'asc' } });
    if (plan) return plan.id;
    const created = await prisma.subscriptionPlan.create({
      data: { name: 'Standard', priceCents: 0, maxSalons: 999, isActive: true },
    });
    return created.id;
  }

  // ── Superadmin notifications ───────────────────────────────────────────
  // Global superadmins are tenant-less, so the tenant-scoped /api/notifications
  // endpoint can't serve them. These queries target the superadmin's userId
  // directly (notifications created with the declaring salon's tenantId).

  async listSuperAdminNotifications(userId: string, unreadOnly?: boolean, limit?: number) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit || 30,
      }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return { notifications, unreadCount };
  }

  async markSuperAdminNotificationRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw { status: 404, error: 'Notification not found', message: 'Notification introuvable' };
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async markAllSuperAdminNotificationsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }
}

export const superAdminService = new SuperAdminService();

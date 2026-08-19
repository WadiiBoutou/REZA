import { Prisma } from '../../../prisma/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { accountService } from '../account/account.service';
import { isPeriodActive, isPeriodActiveWithGrace } from '../subscription/subscription.service';
import { createNotification } from '../../utils/notify';
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
        await prisma.subscription.create({
          data: {
            accountId,
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
            owner: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true } },
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
    let periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // If the previous period had lapsed (past grace period), the stored per-salon
    // employeesPaid is stale (billing treats it as 0) — SET the new period's
    // coverage instead of incrementing, otherwise coverage would stack and
    // over-cover the account.
    // We use isPeriodActiveWithGrace so that payments made within the 3-day grace
    // period are treated as renewals (extend from existing period end), not resets.
    const periodLapsed = !isPeriodActiveWithGrace(sub);
    const resetCoverage = periodLapsed;

    if (periodLapsed) {
      // New period started: period end = now + 1 month
    } else if (sub?.currentPeriodEnd) {
      // Period still active: DO NOT extend the period end.
      // Additional employee payments within the current period only add
      // employees to the paid count — the period end stays unchanged.
      periodEnd = new Date(sub.currentPeriodEnd);
    }

    await prisma.$transaction([
      prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'APPROVED', approvedById: approverUserId, approvedAt: now },
      }),
      prisma.subscription.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
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
      // Declared salons become covered forever + get their monetary + count coverage.
      // Non-declared salons keep whatever coverage they already had (unchanged).
      ...account.tenants.map((t) => {
        const declared = declaredIds.has(t.id);
        const salonSnapshot = declaredSalons.find((s) => s.id === t.id);
        const salonEmployeeFee = salonSnapshot?.employeeFee ?? 0;
        const employeeDelta = declared ? (employeesBySalon[t.id] ?? 0) : 0;
        const data: any = {};
        if (declared) {
          data.salonCovered = true;
          data.subscriptionActive = true;
        }
        if (resetCoverage) {
          data.employeesPaid = declared ? employeeDelta : 0;
          data.amountPaidThisPeriod = declared ? salonEmployeeFee : 0;
        } else if (declared) {
          data.employeesPaid = { increment: employeeDelta };
          data.amountPaidThisPeriod = { increment: salonEmployeeFee };
        }
        return prisma.tenant.update({ where: { id: t.id }, data });
      }),
    ]);

    // Set isPublic=true for newly covered employees in each declared salon.
    // For each salon, get active employees sorted alphabetically and set
    // isPublic=true for the first `employeesPaid` of them.
    // If period lapsed, reset all isPublic first so old visibility is cleared.
    for (const t of account.tenants) {
      if (!declaredIds.has(t.id)) continue;

      if (resetCoverage) {
        // Period lapsed: reset ALL employees in this salon to isPublic=false
        await prisma.employee.updateMany({ where: { tenantId: t.id, isActive: true }, data: { isPublic: false } });
      }

      const tenantData = await prisma.tenant.findUnique({
        where: { id: t.id },
        select: { employeesPaid: true }
      });
      const maxPublic = tenantData?.employeesPaid ?? 0;
      if (maxPublic <= 0) continue;
      const emps = await prisma.employee.findMany({
        where: { tenantId: t.id, isActive: true },
        select: { id: true },
        orderBy: { firstName: 'asc' },
      });
      const idsToPublish = emps.slice(0, maxPublic).map(e => e.id);
      const idsToUnpublish = emps.slice(maxPublic).map(e => e.id);
      if (idsToPublish.length > 0) {
        await prisma.employee.updateMany({ where: { id: { in: idsToPublish } }, data: { isPublic: true } });
      }
      if (idsToUnpublish.length > 0) {
        await prisma.employee.updateMany({ where: { id: { in: idsToUnpublish } }, data: { isPublic: false } });
      }
    }

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

    // Tell the account owner their virement was approved.
    await this.notifyOwner(payment.account.owner, {
      type: 'PAYMENT_APPROVED',
      title: 'Virement approuvé',
      message: `Votre virement de ${payment.amount.toLocaleString('fr-FR')} ${payment.currency} a été approuvé. Votre abonnement est actif.`,
    });

    log.log(
      `[Billing] Payment ${payment.id} approved by ${approverUserId} for account ${account.id} (salons: ${declaredSalons.map((s) => s.name).join(', ')}; employees: +${declaredSalons.reduce((a, s) => a + (employeesBySalon[s.id] ?? 0), 0)})`
    );

    return { success: true };
  }

  /** Reject a PENDING payment. Nothing is applied to coverage. */
  async rejectPayment(paymentId: string, reason?: string) {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        account: {
          select: {
            id: true,
            owner: { select: { id: true, tenantId: true, firstName: true, lastName: true, email: true } },
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

    const trimmedReason = reason?.trim() || null;

    await prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'REJECTED', rejectedReason: trimmedReason },
    });

    // Clear the PAYMENT_DECLARED notification(s) for this payment
    await this.clearPaymentNotifications(paymentId);

    // Tell the account owner their virement was rejected — the note is for them,
    // so they can fix the issue and re-declare.
    await this.notifyOwner(payment.account.owner, {
      type: 'PAYMENT_REJECTED',
      title: 'Virement refusé',
      message: trimmedReason
        ? `Votre virement de ${payment.amount.toLocaleString('fr-FR')} ${payment.currency} a été refusé. Motif : ${trimmedReason}`
        : `Votre virement de ${payment.amount.toLocaleString('fr-FR')} ${payment.currency} a été refusé.`,
    });

    log.log(
      `[Billing] Payment ${payment.id} rejected for account ${payment.account.id}${trimmedReason ? ` (reason: ${trimmedReason})` : ''}`
    );

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

  /**
   * Notify the account owner (admin) about their payment's outcome. The
   * notification is tenant-scoped like all staff notifications, so it lands in
   * the owner's bell under their home salon (their JWT tenantId).
   */
  private async notifyOwner(
    owner: { id: string; tenantId: string | null } | null,
    input: { type: 'PAYMENT_APPROVED' | 'PAYMENT_REJECTED'; title: string; message: string }
  ) {
    if (!owner) return;
    try {
      // Fall back to the owner's first salon if their user has no tenantId.
      let tenantId = owner.tenantId;
      if (!tenantId) {
        const account = await prisma.account.findFirst({
          where: { ownerUserId: owner.id },
          select: { tenants: { where: { isActive: true }, take: 1, select: { id: true } } },
        });
        tenantId = account?.tenants[0]?.id ?? null;
      }
      if (!tenantId) return;
      await createNotification({
        data: {
          tenantId,
          userId: owner.id,
          type: input.type,
          title: input.title,
          message: input.message,
          link: '/dashboard/admin/mon-abonnement',
          metadata: { paymentOutcome: true } as object,
        },
      });
    } catch (notificationError) {
      log.error(`Error creating ${input.type} notification:`, notificationError);
    }
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

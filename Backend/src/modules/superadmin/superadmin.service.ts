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

/** Set subscriptionActive per salon based on one-time salon coverage (first N salons by creation). */
async function applySalonVisibility(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      subscription: true,
      tenants: { where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } },
    },
  });
  if (!account) return;

  const coveredCount = Math.min(account.subscription?.salonsPaid ?? 0, account.tenants.length);

  await prisma.$transaction(
    account.tenants.map((t, i) =>
      prisma.tenant.update({
        where: { id: t.id },
        data: { subscriptionActive: i < coveredCount },
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
        data: { isActive: data.isActive, subscriptionActive: data.isActive },
      });
      if (data.isActive) {
        // Re-apply per-salon coverage visibility (only paid salons public)
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
   * Approve a PENDING payment: apply the declared coverage snapshot —
   * salonsPaid += declared salons, each salon's employeesPaid += its declared
   * count, subscription becomes ACTIVE, period = now + 1 month, subscribedAt =
   * now (approval date = subscription start). Public visibility is recomputed
   * per salon so only covered salons appear.
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
    };
    const salonsDue = Math.max(0, details.salonsDue ?? 0);
    const employeesBySalon = details.employeesBySalon ?? {};
    const account = payment.account;
    const sub = account.subscription;

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
          salonsPaid: salonsDue,
          subscribedAt: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          status: 'ACTIVE',
          salonsPaid: { increment: salonsDue },
          subscribedAt: sub?.subscribedAt ?? now,
          currentPeriodEnd: periodEnd,
        },
      }),
      // Per-salon employee coverage
      ...account.tenants.map((t) =>
        prisma.tenant.update({
          where: { id: t.id },
          data: resetCoverage
            ? { employeesPaid: employeesBySalon[t.id] ?? 0 }
            : { employeesPaid: { increment: employeesBySalon[t.id] ?? 0 } },
        })
      ),
    ]);

    // Salon visibility: the first `salonsPaid` salons become public
    await applySalonVisibility(account.id);

    log.log(
      `[Billing] Payment ${payment.id} approved by ${approverUserId} for account ${account.id} (salons +${salonsDue}, employees +${Object.values(employeesBySalon).reduce((a, b) => a + b, 0)})`
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

    return { success: true };
  }

  private async ensureReferencePlanId(): Promise<string> {
    const plan = await prisma.subscriptionPlan.findFirst({ orderBy: { createdAt: 'asc' } });
    if (plan) return plan.id;
    const created = await prisma.subscriptionPlan.create({
      data: { name: 'Standard', priceCents: 0, maxSalons: 999, isActive: true },
    });
    return created.id;
  }
}

export const superAdminService = new SuperAdminService();

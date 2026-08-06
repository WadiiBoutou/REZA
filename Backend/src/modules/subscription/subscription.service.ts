import { prisma } from '../../lib/prisma';
import { accountService } from '../account/account.service';
import * as log from '../../utils/logger';

export interface EmployeeTier {
  min: number;
  max: number | null; // null = unbounded
  price: number;
}

export interface BillBreakdown {
  config: {
    pricePerSalon: number;
    freeEmployeeThreshold: number;
    pricePerEmployee: number;
    employeeTiers: EmployeeTier[] | null;
    currency: string;
  };
  salonCount: number;
  salonsPaid: number;
  salonsDue: number;
  salonFee: number;
  employeeCount: number; // total active employees across salons
  employeesCovered: number; // total covered employees (threshold + paid)
  employeesDue: number;
  employeeFee: number;
  total: number;
  periodActive: boolean;
  employeesBySalon: Record<string, number>;
  status: string;
  subscribedAt: Date | null;
  currentPeriodEnd: Date | null;
}

/** A paid period is active when the subscription is ACTIVE and not past its end. */
export function isPeriodActive(sub: { status: string; currentPeriodEnd: Date | null } | null): boolean {
  if (!sub) return false;
  if (sub.status !== 'ACTIVE') return false;
  if (!sub.currentPeriodEnd) return true;
  return sub.currentPeriodEnd.getTime() > Date.now();
}

export class SubscriptionService {
  private async getConfig() {
    // Auto-create with defaults on first use (platform-wide config)
    const config = await prisma.billingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
    return config;
  }

  /** Parse the JSON employeeTiers column into sorted bands (null when unset/invalid → flat rate). */
  static parseEmployeeTiers(raw: unknown): EmployeeTier[] | null {
    if (!Array.isArray(raw)) return null;
    const tiers: EmployeeTier[] = [];
    for (const t of raw) {
      if (t && typeof t === 'object' && typeof (t as any).min === 'number' && typeof (t as any).price === 'number') {
        const max = (t as any).max;
        tiers.push({
          min: (t as any).min,
          max: max === null || max === undefined ? null : max,
          price: (t as any).price,
        });
      }
    }
    return tiers.length > 0 ? tiers.sort((a, b) => a.min - b.min) : null;
  }

  /**
   * Progressive (marginal) per-employee fee: each billable employee is charged
   * at the rate of the band its position falls into. e.g. tiers 1-5 @100,
   * 6+ @80 → 7 billable employees = 5×100 + 2×80 = 660.
   */
  static computeTieredFee(count: number, tiers: EmployeeTier[]): number {
    let remaining = Math.max(0, count);
    let fee = 0;
    for (const t of tiers) {
      if (remaining <= 0) break;
      const bandSize = t.max === null ? remaining : Math.max(0, t.max - t.min + 1);
      const take = Math.min(remaining, bandSize);
      fee += take * t.price;
      remaining -= take;
    }
    // Anything beyond the last defined band (when it's bounded) is charged at the last band's rate.
    if (remaining > 0 && tiers.length > 0) {
      fee += remaining * tiers[tiers.length - 1].price;
    }
    return fee;
  }

  /**
   * Compute the live bill for an account under the virement model:
   * - Salon fee: one-time per salon not yet covered (cumulative salonsPaid).
   * - Employee fee: per employee beyond the free threshold and the covered
   *   count, for the current paid period (per-salon Tenant.employeesPaid).
   * When the current period has lapsed, employee coverage resets to 0
   * (the admin must re-pay the employee fee for the new period).
   */
  async computeBill(accountId: string): Promise<BillBreakdown> {
    const config = await this.getConfig();
    const employeeTiers = SubscriptionService.parseEmployeeTiers(config.employeeTiers);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        tenants: {
          where: { isActive: true },
          include: { _count: { select: { employees: { where: { isActive: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
        subscription: true,
      },
    });
    if (!account) {
      throw { status: 404, error: 'Account not found', message: 'Compte introuvable' };
    }

    const sub = account.subscription;
    const periodActive = isPeriodActive(sub);
    const salons = account.tenants;

    const salonsPaid = sub?.salonsPaid ?? 0;
    const salonsDue = Math.max(0, salons.length - salonsPaid);
    const salonFee = salonsDue * config.pricePerSalon;

    let employeeCount = 0;
    let employeesCovered = 0;
    let employeesDue = 0;
    let employeeFee = 0;
    const employeesBySalon: Record<string, number> = {};

    for (const t of salons) {
      const count = t._count.employees;
      const covered = periodActive ? (t.employeesPaid ?? 0) : 0;
      const billable = Math.max(0, count - config.freeEmployeeThreshold - covered);
      employeeCount += count;
      employeesCovered += Math.min(count, config.freeEmployeeThreshold + covered);
      if (billable > 0) {
        employeesBySalon[t.id] = billable;
        employeesDue += billable;
        // Progressive tiered rate per salon when configured, else the flat rate.
        employeeFee += employeeTiers
          ? SubscriptionService.computeTieredFee(billable, employeeTiers)
          : billable * config.pricePerEmployee;
      }
    }

    return {
      config: {
        pricePerSalon: config.pricePerSalon,
        freeEmployeeThreshold: config.freeEmployeeThreshold,
        pricePerEmployee: config.pricePerEmployee,
        employeeTiers,
        currency: config.currency,
      },
      salonCount: salons.length,
      salonsPaid,
      salonsDue,
      salonFee,
      employeeCount,
      employeesCovered,
      employeesDue,
      employeeFee,
      total: Math.round((salonFee + employeeFee) * 100) / 100,
      periodActive,
      employeesBySalon,
      status: sub?.status ?? 'NONE',
      subscribedAt: sub?.subscribedAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }

  /** Full overview for the account owner: billing config, live bill, salons coverage, payment history. */
  async getOverview(userId: string) {
    const ctx = await accountService.getContextForUser(userId);
    if (!ctx.account) {
      throw { status: 404, error: 'No account', message: 'Aucun compte associé' };
    }

    const [bill, payments] = await Promise.all([
      this.computeBill(ctx.account.id),
      prisma.subscriptionPayment.findMany({
        where: { accountId: ctx.account.id },
        orderBy: { createdAt: 'desc' },
        include: {
          declaredBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        take: 50,
      }),
    ]);

    return {
      account: ctx.account,
      subscription: {
        status: ctx.subscription?.status ?? 'NONE',
        subscribedAt: bill.subscribedAt,
        currentPeriodEnd: bill.currentPeriodEnd,
        salonsPaid: bill.salonsPaid,
      },
      bill,
      salons: ctx.salons.map((s) => ({
        id: s.id,
        name: s.name,
        subscriptionActive: s.subscriptionActive,
        employeesPaid: bill.periodActive ? (s.employeesPaid ?? 0) : 0,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        reference: p.reference,
        rejectedReason: p.rejectedReason,
        details: p.details,
        declaredBy: p.declaredBy,
        approvedBy: p.approvedBy,
        approvedAt: p.approvedAt,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Declare a virement payment. The backend re-computes the live bill and
   * records a coverage snapshot — the superadmin's approval applies exactly
   * this snapshot, so the declared amount always matches what gets covered.
   */
  async declarePayment(userId: string, input: { amount?: number; reference?: string }) {
    const ctx = await accountService.getContextForUser(userId);
    if (!ctx.account) {
      throw { status: 404, error: 'No account', message: 'Aucun compte associé' };
    }

    const bill = await this.computeBill(ctx.account.id);
    if (bill.total <= 0) {
      throw { status: 400, error: 'Nothing due', message: "Votre facturation est entièrement réglée. Aucun paiement à déclarer." };
    }

    // Only one pending declaration at a time — prevents double-declare confusion
    const existingPending = await prisma.subscriptionPayment.findFirst({
      where: { accountId: ctx.account.id, status: 'PENDING' },
    });
    if (existingPending) {
      throw {
        status: 400,
        error: 'Already pending',
        message: 'Une déclaration de paiement est déjà en attente de validation par la plateforme.',
      };
    }

    // The declared amount must match the current bill exactly — approval applies
    // the coverage snapshot, so under- or over-payments would silently grant the
    // wrong coverage. The frontend prefills the exact bill.
    const amount = input.amount !== undefined && input.amount > 0 ? input.amount : bill.total;
    if (amount <= 0) {
      throw { status: 400, error: 'Invalid amount', message: 'Montant invalide' };
    }
    if (Math.abs(amount - bill.total) > 0.01) {
      throw {
        status: 400,
        error: 'Amount mismatch',
        message: `Le montant déclaré doit correspondre à votre facture (${bill.total} ${bill.config.currency}).`,
      };
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        accountId: ctx.account.id,
        amount: Math.round(amount * 100) / 100,
        currency: bill.config.currency,
        reference: input.reference?.trim() || null,
        declaredById: userId,
        details: {
          salonsDue: bill.salonsDue,
          employeesDue: bill.employeesDue,
          employeesBySalon: bill.employeesBySalon,
        } as object,
      },
    });

    log.log(`[Billing] Payment ${payment.id} declared for account ${ctx.account.id} (${amount} ${bill.config.currency})`);

    return { payment: { id: payment.id, amount: payment.amount, status: payment.status, createdAt: payment.createdAt } };
  }

  /** Payment history for the account owner. */
  async listPayments(userId: string) {
    const ctx = await accountService.getContextForUser(userId);
    if (!ctx.account) {
      return { payments: [] };
    }
    const payments = await prisma.subscriptionPayment.findMany({
      where: { accountId: ctx.account.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { payments };
  }
}

export const subscriptionService = new SubscriptionService();

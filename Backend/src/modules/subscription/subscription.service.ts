import { prisma } from '../../lib/prisma';
import { accountService } from '../account/account.service';
import * as log from '../../utils/logger';

export interface EmployeeTier {
  min: number;
  max: number | null; // null = unbounded
  price: number;
}

export interface SalonBill {
  id: string;
  name: string;
  subscriptionActive: boolean;
  salonCovered: boolean;
  employeeCount: number;
  employeesPaid: number;
  billableEmployees: number;
  salonFee: number; // one-time setup fee — only charged while the salon is NOT yet covered
  employeeFee: number; // tiered monthly fee for the salon's billable employees
  total: number;
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
  /** Per-salon breakdown — used by the declaration selection UI. */
  salons: SalonBill[];
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
    // Auto-create with hardcoded pricing on first use (fallback defaults):
    //   Salon: 1000 MAD one-time
    //   Employees (monthly): 1→250, 2-3→150, 4-5→100, 6+→80 MAD/employee
    const HARDCODED_TIERS = [
      { min: 1, max: 1, price: 250 },
      { min: 2, max: 3, price: 150 },
      { min: 4, max: 5, price: 100 },
      { min: 6, max: null, price: 80 },
    ];
    const config = await prisma.billingConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        pricePerSalon: 1000,
        freeEmployeeThreshold: 0,
        pricePerEmployee: 100,
        employeeTiers: HARDCODED_TIERS,
        currency: 'MAD',
      },
      // Intentionally empty: the superadmin configures thresholds/tiers through
      // PUT /superadmin/billing-config. Overwriting them here would silently
      // revert those edits on every bill computation.
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
   * Compute the live bill for an account under the virement model.
   *
   * Per salon:
   * - One-time salon fee (pricePerSalon) while the salon is NOT yet covered
   *   (Tenant.salonCovered=false). Once covered it stays covered forever.
   * - Monthly employee fee for the salon's employees beyond the free threshold
   *   and the already-paid count, for the current paid period. When the period
   *   has lapsed, employee coverage resets to 0 (the admin must re-pay it).
   *
   * The admin explicitly picks which salons a declaration covers (Q1/Q2): pass
   * opts.salonIds to compute the bill for ONLY that selection. Without it, all
   * active salons are included. The response always carries the full per-salon
   * breakdown so the UI can render the selection list.
   */
  async computeBill(accountId: string, opts?: { salonIds?: string[] }): Promise<BillBreakdown> {
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

    // Explicit selection restricts which salons contribute to the bill.
    const selected = new Set(opts?.salonIds ?? salons.map((t) => t.id));

    // Per-salon breakdown
    const salonsBills: SalonBill[] = salons.map((t) => {
      const count = t._count.employees;
      const covered = periodActive ? (t.employeesPaid ?? 0) : 0;
      const billable = Math.max(0, count - config.freeEmployeeThreshold - covered);
      const salonFee = t.salonCovered ? 0 : config.pricePerSalon;
      const employeeFee = employeeTiers
        ? SubscriptionService.computeTieredFee(billable, employeeTiers)
        : billable * config.pricePerEmployee;
      return {
        id: t.id,
        name: t.name,
        subscriptionActive: t.subscriptionActive,
        salonCovered: t.salonCovered,
        employeeCount: count,
        employeesPaid: covered,
        billableEmployees: billable,
        salonFee,
        employeeFee,
        total: Math.round((salonFee + employeeFee) * 100) / 100,
      };
    });

    // Aggregate over the selection only
    const included = salonsBills.filter((s) => selected.has(s.id));
    const salonsDue = included.filter((s) => !s.salonCovered).length;
    const salonFee = included.reduce((sum, s) => sum + s.salonFee, 0);
    const employeesDue = included.reduce((sum, s) => sum + s.billableEmployees, 0);
    const employeeFee = included.reduce((sum, s) => sum + s.employeeFee, 0);

    const employeesBySalon: Record<string, number> = {};
    for (const s of included) {
      if (s.billableEmployees > 0) employeesBySalon[s.id] = s.billableEmployees;
    }

    const salonsPaid = salonsBills.filter((s) => s.salonCovered).length;

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
      employeeCount: included.reduce((sum, s) => sum + s.employeeCount, 0),
      employeesCovered: included.reduce((sum, s) => sum + s.employeesPaid, 0),
      employeesDue,
      employeeFee,
      total: Math.round((salonFee + employeeFee) * 100) / 100,
      periodActive,
      employeesBySalon,
      status: sub?.status ?? 'NONE',
      subscribedAt: sub?.subscribedAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      salons: salonsBills,
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
      salons: bill.salons,
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
   * Declare a virement payment for an EXPLICIT set of salons (the admin picks
   * which salons to cover — Q1/Q2). The backend computes that selection's bill
   * and records a per-salon coverage snapshot; the superadmin's approval applies
   * exactly this snapshot, so the declared amount always matches what's covered.
   */
  async declarePayment(
    userId: string,
    input: { amount?: number; reference?: string; payerName?: string; salonIds?: string[] }
  ) {
    const ctx = await accountService.getContextForUser(userId);
    if (!ctx.account) {
      throw { status: 404, error: 'No account', message: 'Aucun compte associé' };
    }

    // Validate the requested salons belong to this account before billing
    const requested = input.salonIds?.length ? input.salonIds : undefined;
    if (requested) {
      const owned = new Set(ctx.salons.map((s) => s.id));
      const invalid = requested.filter((id) => !owned.has(id));
      if (invalid.length > 0) {
        throw {
          status: 400,
          error: 'Invalid salons',
          message: 'Certains salons sélectionnés ne font pas partie de votre compte.',
        };
      }
    }

    const bill = await this.computeBill(ctx.account.id, requested ? { salonIds: requested } : undefined);
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

    // The declared amount must match the selection's bill exactly — approval
    // applies the coverage snapshot, so under- or over-payments would silently
    // grant the wrong coverage. The frontend prefills the exact total.
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

    // Per-salon snapshot: exactly which salons get covered + how many employees
    const salonsSnapshot = bill.salons
      .filter((s) => (requested ? requested.includes(s.id) : !s.salonCovered || s.billableEmployees > 0))
      .map((s) => ({
        id: s.id,
        name: s.name,
        salonCovered: s.salonCovered,
        billableEmployees: s.billableEmployees,
        salonFee: s.salonFee,
        employeeFee: s.employeeFee,
      }));

    const payment = await prisma.subscriptionPayment.create({
      data: {
        accountId: ctx.account.id,
        amount: Math.round(amount * 100) / 100,
        currency: bill.config.currency,
        reference: input.reference?.trim() || null,
        payerName: input.payerName?.trim() || null,
        declaredById: userId,
        details: {
          salonsDue: bill.salonsDue,
          employeesDue: bill.employeesDue,
          employeesBySalon: bill.employeesBySalon,
          salons: salonsSnapshot,
        } as object,
      },
    });

    log.log(`[Billing] Payment ${payment.id} declared for account ${ctx.account.id} (${amount} ${bill.config.currency}, salons: ${salonsSnapshot.map((s) => s.name).join(', ')})`);

    // Notify all global superadmins — they review virement declarations.
    // Superadmins are tenant-less, so the notification carries the declaring
    // account's first salon as tenantId and the superadmin's userId; a dedicated
    // superadmin notifications endpoint (querying by userId only) surfaces it.
    try {
      const [superAdmins, owner] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'SUPER_ADMIN', isActive: true, tenantId: null },
          select: { id: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true, email: true },
        }),
      ]);

      const tenantId = ctx.salons[0]?.id;
      if (superAdmins.length > 0 && tenantId) {
        const ownerName =
          [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim() || owner?.email || 'Un administrateur';
        const salonsLabel =
          salonsSnapshot.map((s) => {
            const parts = [s.name];
            if (s.billableEmployees > 0) {
              parts.push(`${s.billableEmployees} employé${s.billableEmployees > 1 ? 's' : ''}`);
            }
            return parts.join(' — ');
          }).join(', ') || ctx.salons.map((s) => s.name).join(', ');
        await Promise.all(
          superAdmins.map((sa) =>
            prisma.notification.create({
              data: {
                tenantId,
                userId: sa.id,
                type: 'PAYMENT_DECLARED',
                title: 'Nouvelle déclaration de virement',
                message: `${ownerName} (${salonsLabel}) a déclaré ${payment.amount.toLocaleString('fr-FR')} ${payment.currency}.`,
                link: '/superadmin?tab=payments',
                metadata: {
                  paymentId: payment.id,
                  accountId: ctx.account.id,
                  amount: payment.amount,
                } as object,
              },
            })
          )
        );
        log.log(`[Billing] ${superAdmins.length} superadmin(s) notified of payment ${payment.id}`);
      }
    } catch (notificationError) {
      // Notification must never block the declaration itself.
      log.error('Error creating PAYMENT_DECLARED notification:', notificationError);
    }

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

  /**
   * Public pricing info for the pro-info landing page: the one-time per-salon
   * fee plus the marginal monthly employee tiers. No account/owner data.
   */
  async getPublicBillingConfig() {
    const config = await this.getConfig();
    return {
      pricePerSalon: config.pricePerSalon,
      pricePerEmployee: config.pricePerEmployee,
      currency: config.currency || 'MAD',
      freeEmployeeThreshold: config.freeEmployeeThreshold ?? 0,
      employeeTiers: SubscriptionService.parseEmployeeTiers(config.employeeTiers),
    };
  }
}

export const subscriptionService = new SubscriptionService();

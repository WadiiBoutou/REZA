import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export class SubscriptionInvoiceService {
  /** Generate a one-off SUBSCRIPTION invoice for an account's active subscription. */
  async generateForAccount(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscription: { include: { plan: true } },
        tenants: { take: 1, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!account) {
      throw { status: 404, error: 'Account not found', message: 'Compte introuvable' };
    }
    const sub = account.subscription;
    if (!sub || sub.status !== 'ACTIVE') {
      throw { status: 400, error: 'No active subscription', message: "Ce compte n'a pas d'abonnement actif" };
    }
    if (!sub.plan) {
      throw { status: 400, error: 'No plan', message: "L'abonnement n'a pas de plan associé" };
    }

    const periodStart = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd.getTime() - (sub.plan.interval === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000)
      : new Date();
    const periodEnd = sub.currentPeriodEnd || new Date();

    const planPriceMAD = sub.plan.priceCents / 100;
    const tax = 0;
    const total = planPriceMAD;

    const invoiceNumber = `INV-SUB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Attach invoice to the first tenant of the account (all share the same subscription)
    const targetTenantId = account.tenants[0]?.id;
    if (!targetTenantId) {
      throw { status: 400, error: 'No tenant', message: "Ce compte n'a aucun salon" };
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: targetTenantId,
        accountId,
        type: 'SUBSCRIPTION',
        invoiceNumber,
        amount: planPriceMAD,
        tax,
        total,
        status: 'PENDING',
        periodStart,
        periodEnd,
        notes: `${sub.plan.name} — ${sub.plan.interval === 'month' ? 'Mensuel' : 'Annuel'}`,
      },
    });

    return { invoice };
  }

  /** List SUBSCRIPTION invoices tied to the account that owns a given tenant. */
  async listForTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { accountId: true },
    });
    if (!tenant?.accountId) return { invoices: [] };

    const invoices = await prisma.invoice.findMany({
      where: { accountId: tenant.accountId, type: 'SUBSCRIPTION' },
      orderBy: { createdAt: 'desc' },
    });
    return { invoices };
  }

  /** Get the billing payment method for the account that owns a given tenant. */
  async getBillingPaymentMethod(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { account: { select: { billingPaymentMethod: true } } },
    });
    return { method: tenant?.account?.billingPaymentMethod || null };
  }

  /** Set the billing payment method on the account that owns a given tenant. */
  async setBillingPaymentMethod(tenantId: string, method: any) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { accountId: true },
    });
    if (!tenant?.accountId) {
      throw { status: 404, error: 'No account', message: "Aucun compte associé à ce salon" };
    }
    await prisma.account.update({
      where: { id: tenant.accountId },
      data: { billingPaymentMethod: method },
    });
    return { method };
  }
}

export const subscriptionInvoiceService = new SubscriptionInvoiceService();

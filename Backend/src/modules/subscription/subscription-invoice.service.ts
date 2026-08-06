import { prisma } from '../../lib/prisma';

export class SubscriptionInvoiceService {
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
}

export const subscriptionInvoiceService = new SubscriptionInvoiceService();

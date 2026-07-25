import { prisma } from '../../lib/prisma';
import crypto from 'crypto';
import { tenantIdFilter } from '../../utils/salonScope';
import { CreateSaleInput } from './invoice.schema';

const invoiceListInclude = {
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true
    }
  },
  appointment: {
    include: {
      services: {
        include: {
          employee: {
            select: { firstName: true, lastName: true, id: true }
          }
        }
      },
      bookingParticipant: {
        select: { displayName: true }
      }
    }
  },
  items: {
    select: {
      id: true,
      serviceId: true,
      serviceName: true,
      price: true,
      quantity: true
    }
  }
} as const;

export class InvoiceService {
  async getInvoices(tenantIds: string | string[], status?: string, type?: string) {
    const where: any = { tenantId: tenantIdFilter(tenantIds) };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }

    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: invoiceListInclude
    });
  }

  async getInvoiceById(tenantIds: string | string[], id: string) {
    return prisma.invoice.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) },
      include: {
        client: true,
        appointment: {
          include: {
            service: true,
            employee: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true
              }
            }
          }
        },
        tenant: {
          select: {
            name: true,
            phone: true,
            address: true,
            logo: true
          }
        }
      }
    });
  }

  async createInvoice(tenantId: string, data: any, salonIds?: string[]) {
    if (data.clientId) {
      // Allow clients from any salon in request scope (multi-salon lists).
      const scope = salonIds && salonIds.length > 0 ? salonIds : [tenantId];
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          tenantId: tenantIdFilter(scope)
        }
      });

      if (!client) {
        throw new Error('CLIENT_NOT_FOUND');
      }
    }

    if (data.appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: data.appointmentId,
          tenantId
        }
      });

      if (!appointment) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }

      if (data.clientId && appointment.clientId !== data.clientId) {
        throw new Error('CLIENT_MISMATCH');
      }
    }

    const invoiceNumber = this.generateInvoiceNumber();
    const tax = data.tax ?? 0;
    const total = data.amount + data.amount * (tax / 100);

    return prisma.invoice.create({
      data: {
        tenantId,
        clientId: data.clientId || null,
        appointmentId: data.appointmentId,
        invoiceNumber,
        amount: data.amount,
        tax,
        total,
        status: 'PENDING',
        paymentMethod: data.paymentMethod,
        notes: data.notes
      },
      include: {
        client: true,
        appointment: true,
        items: true
      }
    });
  }

  /**
   * Encaisser une vente: PAID invoice + Catalog service line items.
   */
  async createSale(tenantId: string, data: CreateSaleInput, _salonIds?: string[]) {
    // Client must belong to the write salon (no walk-in / cross-salon).
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, tenantId: true }
    });
    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }
    if (client.tenantId !== tenantId) {
      throw new Error('CLIENT_WRONG_SALON');
    }

    let resolvedItems: Array<{ serviceId: string | null; serviceName: string; price: number; quantity: number }> = [];

    if (data.appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: { id: data.appointmentId, tenantId },
        include: { services: true }
      });
      if (!appointment) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }
      if (appointment.clientId !== data.clientId) {
        throw new Error('CLIENT_MISMATCH');
      }
      const existingInvoice = await prisma.invoice.findFirst({
        where: { appointmentId: data.appointmentId }
      });
      if (existingInvoice) {
        throw new Error('APPOINTMENT_ALREADY_INVOICED');
      }

      resolvedItems = appointment.services.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        price: item.price,
        quantity: 1
      }));
    } else {
      const serviceIds = data.items.map((i) => i.serviceId);
      const services = await prisma.service.findMany({
        where: {
          id: { in: serviceIds },
          tenantId
        }
      });

      if (services.length !== new Set(serviceIds).size) {
        throw new Error('SERVICE_NOT_FOUND');
      }

      const serviceById = new Map(services.map((s) => [s.id, s]));

      resolvedItems = data.items.map((item) => {
        const service = serviceById.get(item.serviceId)!;
        const unitPrice =
          item.price ??
          service.price ??
          service.priceFrom ??
          0;
        if (unitPrice <= 0) {
          throw new Error('SERVICE_PRICE_REQUIRED');
        }
        const quantity = item.quantity ?? 1;
        return {
          serviceId: service.id,
          serviceName: service.name,
          price: unitPrice,
          quantity
        };
      });
    }

    const itemsSum = resolvedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const amount = data.amount ?? itemsSum;
    if (amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    const tax = data.tax ?? 0;
    const total = amount + amount * (tax / 100);
    const notes =
      data.notes?.trim() ||
      resolvedItems.map((i) => (i.quantity > 1 ? `${i.serviceName} x${i.quantity}` : i.serviceName)).join(', ');

    return prisma.invoice.create({
      data: {
        tenantId,
        clientId: data.clientId,
        appointmentId: data.appointmentId || null,
        invoiceNumber: this.generateInvoiceNumber(),
        amount,
        tax,
        total,
        status: 'PAID',
        paymentMethod: data.paymentMethod,
        paidAt: new Date(),
        notes,
        items: {
          create: resolvedItems.map((item) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            price: item.price,
            quantity: item.quantity
          }))
        }
      },
      include: invoiceListInclude
    });
  }

  async updateInvoice(tenantIds: string | string[], id: string, data: any) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) }
    });

    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.paidAt) {
      updateData.paidAt = new Date(data.paidAt);
    } else if (data.status === 'PAID' && !invoice.paidAt) {
      updateData.paidAt = new Date();
    }

    return prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        appointment: true,
        items: true
      }
    });
  }

  async getStats(tenantIds: string | string[]) {
    const filter = tenantIdFilter(tenantIds);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalRevenueResult, monthlyRevenueResult, invoicesCount, pendingInvoicesCount] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: {
            tenantId: filter,
            status: 'PAID'
          },
          _sum: {
            total: true
          }
        }),
        prisma.invoice.aggregate({
          where: {
            tenantId: filter,
            status: 'PAID',
            createdAt: {
              gte: startOfMonth
            }
          },
          _sum: {
            total: true
          }
        }),
        prisma.invoice.count({
          where: { tenantId: filter }
        }),
        prisma.invoice.count({
          where: {
            tenantId: filter,
            status: 'PENDING'
          }
        })
      ]);

    return {
      totalRevenue: totalRevenueResult._sum.total || 0,
      monthlyRevenue: monthlyRevenueResult._sum.total || 0,
      invoicesCount,
      pendingInvoicesCount
    };
  }

  private generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const randomStr = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INV-${year}${month}-${randomStr}`;
  }
}

export const invoiceService = new InvoiceService();

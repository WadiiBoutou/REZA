import { prisma } from '../../lib/prisma';
import crypto from 'crypto';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { CreateSaleInput, CreateGroupSaleInput } from './invoice.schema';

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
      quantity: true,
      participantName: true
    }
  },
  bookingGroup: {
    select: {
      id: true,
      participants: {
        select: {
          displayName: true,
          clientId: true,
          appointment: {
            select: {
              services: {
                select: {
                  serviceName: true,
                  employeeId: true,
                  employee: {
                    select: { firstName: true, lastName: true, id: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

const nullSaleFields = ['periodStart', 'periodEnd', 'accountId'] as const;

function sanitizeInvoice(invoice: any) {
  if (invoice.type === 'SALE' && invoice.appointmentId == null) {
    const clean = { ...invoice };
    for (const f of nullSaleFields) delete clean[f];
    delete clean.appointmentId;
    return clean;
  }
  return invoice;
}

export class InvoiceService {
  async getInvoices(tenantIds: string | string[], status?: string, type?: string) {
    const where: any = { tenantId: tenantIdFilter(tenantIds) };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: invoiceListInclude
    });
    return invoices.map(sanitizeInvoice);
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
          ...salonClientsFilter(scope)
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
  async createSale(salonIds: string | string[], data: CreateSaleInput) {
    // Resolve the write target from the linked appointment when the caller's
    // salon scope is ambiguous — the appointment carries its salon.
    let tenantId: string | null = null;
    if (data.tenantId) {
      const scopeAll = salonIds === 'all';
      const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
      if (scopeAll || scope.includes(data.tenantId)) tenantId = data.tenantId;
    }
    if (!tenantId) {
      const scopeAll = salonIds === 'all';
      const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
      if (!scopeAll && scope.length === 1) {
        tenantId = scope[0];
      } else if (data.appointmentId) {
        const appt = await prisma.appointment.findUnique({
          where: { id: data.appointmentId },
          select: { tenantId: true },
        });
        if (appt && (scopeAll || scope.includes(appt.tenantId))) tenantId = appt.tenantId;
      }
    }
    if (!tenantId) {
      const err: any = new Error(
        'Plusieurs salons sélectionnés : précisez tenantId (salon) pour cette opération.'
      );
      err.code = 'SALON_REQUIRED';
      throw err;
    }

    // Client must belong to the write salon: created by it OR booked there
    // (global client accounts have tenantId null and belong via appointments).
    const client = await prisma.client.findFirst({
      where: {
        id: data.clientId,
        ...salonClientsFilter(tenantId),
      },
      select: { id: true },
    });
    if (!client) {
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

  /**
   * Encaisser un RDV de groupe: one combined Invoice with participantName on each line item.
   * `bookingGroupId` identifies the group; `payerClientId` is the participant who pays.
   */
  async createGroupSale(salonIds: string | string[], data: CreateGroupSaleInput) {
    // Resolve the write target from the booking group itself when the caller's
    // salon scope is ambiguous — the group carries its salon.
    let tenantId: string | null = null;
    if (data.tenantId) {
      const scopeAll = salonIds === 'all';
      const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
      if (scopeAll || scope.includes(data.tenantId)) tenantId = data.tenantId;
    }
    if (!tenantId) {
      const scopeAll = salonIds === 'all';
      const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
      if (!scopeAll && scope.length === 1) {
        tenantId = scope[0];
      }
    }

    const group = await prisma.bookingGroup.findFirst({
      where: {
        id: data.bookingGroupId,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        participants: {
          include: {
            appointment: {
              include: {
                services: true,
              },
            },
            client: { select: { id: true, firstName: true, lastName: true, tenantId: true } },
          },
        },
      },
    });

    if (!group) {
      throw new Error('BOOKING_GROUP_NOT_FOUND');
    }

    if (!tenantId) {
      const scopeAll = salonIds === 'all';
      const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
      if (scopeAll || scope.includes(group.tenantId)) {
        tenantId = group.tenantId;
      } else {
        const err: any = new Error(
          'Plusieurs salons sélectionnés : précisez tenantId (salon) pour cette opération.'
        );
        err.code = 'SALON_REQUIRED';
        throw err;
      }
    }

    if (group.participants.length < 2) {
      throw new Error('NOT_A_GROUP');
    }

    // Validate the payer is one of the participants. Prefer the unique
    // participant id: two participants can share a client record (a guest
    // merged onto the booker's client via a shared phone), in which case a
    // clientId match would silently resolve to the wrong row.
    let payerParticipant;
    if (data.payerParticipantId) {
      payerParticipant = group.participants.find(
        (p) => p.id === data.payerParticipantId
      );
    } else {
      payerParticipant = group.participants.find(
        (p) => p.clientId === data.payerClientId
      );
    }
    if (!payerParticipant) {
      throw new Error('PAYER_NOT_IN_GROUP');
    }
    // Bill to the payer's client record (may be null for a guest).
    const payerClientId = payerParticipant.clientId || null;

    // Check no existing group invoice for this group
    const existingGroupInvoice = await prisma.invoice.findFirst({
      where: { bookingGroupId: data.bookingGroupId },
    });
    if (existingGroupInvoice) {
      throw new Error('GROUP_ALREADY_INVOICED');
    }

    // Block if any individual participant appointment already invoiced
    const participantAppointmentIds = group.participants
      .map((p) => p.appointmentId)
      .filter(Boolean) as string[];
    if (participantAppointmentIds.length > 0) {
      const existingApptInvoices = await prisma.invoice.findMany({
        where: { appointmentId: { in: participantAppointmentIds } },
        select: { appointmentId: true },
      });
      if (existingApptInvoices.length > 0) {
        throw new Error('APPOINTMENT_ALREADY_INVOICED');
      }
    }

    // Build line items from each participant's services
    const resolvedItems: Array<{
      serviceId: string | null;
      serviceName: string;
      price: number;
      quantity: number;
      participantName: string;
    }> = [];

    for (const p of group.participants) {
      // The participant's booked name (displayName) is the canonical "who this
      // is for" — two participants can share a Client row (proche merged onto
      // the booker's record), in which case the client's name would duplicate
      // the booker's name on every line.
      const displayName =
        (p.displayName || '').trim() ||
        `${p.client?.firstName || ''} ${p.client?.lastName || ''}`.trim();

      if (!p.appointment) continue;

      const svcItems = p.appointment.services;
      if (svcItems.length === 0) continue;

      for (const si of svcItems) {
        resolvedItems.push({
          serviceId: si.serviceId,
          serviceName: si.serviceName,
          price: si.price,
          quantity: 1,
          participantName: displayName,
        });
      }
    }

    if (resolvedItems.length === 0) {
      throw new Error('NO_SERVICES_TO_BILL');
    }

    const amount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (amount <= 0) {
      throw new Error('INVALID_AMOUNT');
    }

    const tax = data.tax ?? 0;
    const total = amount + amount * (tax / 100);

    const participantNames = [...new Set(resolvedItems.map((i) => i.participantName))];
    const notes =
      data.notes?.trim() ||
      `Groupe (${participantNames.length} personnes): ${participantNames.join(', ')}`;

    // Create invoice + mark all appointments as COMPLETED in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          clientId: payerClientId,
          bookingGroupId: data.bookingGroupId,
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
              quantity: item.quantity,
              participantName: item.participantName,
            })),
          },
        },
        include: invoiceListInclude,
      });

      // Mark all group appointments as COMPLETED to prevent double-billing
      if (participantAppointmentIds.length > 0) {
        await tx.appointment.updateMany({
          where: { id: { in: participantAppointmentIds } },
          data: { status: 'COMPLETED' },
        });
      }

      return invoice;
    });

    return result;
  }

  /**
   * Create individual invoices for each participant in a group — each participant's
   * services become a separate invoice billed to their own client record.
   */
  async separateGroupSale(
    salonIds: string | string[],
    data: { bookingGroupId: string; paymentMethod: string; tax?: number; tenantId?: string },
  ) {
    // Normalize the caller's salon scope ('all' = any salon).
    const scopeAll =
      salonIds === 'all' || (Array.isArray(salonIds) && salonIds.length === 1 && salonIds[0] === 'all');
    const scope: string[] = scopeAll ? [] : Array.isArray(salonIds) ? salonIds : [salonIds];
    const scopeIncludes = (id: string) => scopeAll || scope.includes(id);

    // The booking group belongs to a specific salon: resolve the write target from
    // the group itself when the scope is ambiguous, so the caller doesn't have to
    // pass tenantId explicitly — the card carries its salon.
    let tenantId: string | null = null;
    if (data.tenantId && scopeIncludes(data.tenantId)) tenantId = data.tenantId;
    else if (!scopeAll && scope.length === 1) tenantId = scope[0];

    const group = await prisma.bookingGroup.findFirst({
      where: {
        id: data.bookingGroupId,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        participants: {
          include: {
            appointment: { include: { services: true } },
            client: { select: { id: true, firstName: true, lastName: true, tenantId: true } },
          },
        },
      },
    });

    if (!group) throw new Error('BOOKING_GROUP_NOT_FOUND');

    if (!tenantId) {
      if (scopeIncludes(group.tenantId)) {
        tenantId = group.tenantId;
      } else {
        const err: any = new Error(
          'Plusieurs salons sélectionnés : précisez tenantId (salon) pour cette opération.'
        );
        err.code = 'SALON_REQUIRED';
        throw err;
      }
    }

    if (group.participants.length < 2) throw new Error('NOT_A_GROUP');

    const existingGroupInvoice = await prisma.invoice.findFirst({
      where: { bookingGroupId: data.bookingGroupId },
    });
    if (existingGroupInvoice) throw new Error('GROUP_ALREADY_INVOICED');

    const participantAppointmentIds = group.participants
      .map((p) => p.appointmentId).filter(Boolean) as string[];
    if (participantAppointmentIds.length > 0) {
      const existingApptInvoices = await prisma.invoice.findMany({
        where: { appointmentId: { in: participantAppointmentIds } },
        select: { appointmentId: true },
      });
      if (existingApptInvoices.length > 0) throw new Error('APPOINTMENT_ALREADY_INVOICED');
    }

    const invoices: any[] = [];

    // Two participants can point at the same Client row (e.g. a proche whose
    // booking was recorded against the booker's client record). Each separate
    // invoice must be attributed to the participant it is FOR, so detect
    // client records shared by more than one participant and give those
    // participants their own dedicated client below.
    const clientIdCounts = new Map<string, number>();
    for (const p of group.participants) {
      if (p.clientId) clientIdCounts.set(p.clientId, (clientIdCounts.get(p.clientId) || 0) + 1);
    }
    const isSharedClient = (id: string | null | undefined) =>
      !!id && (clientIdCounts.get(id) || 0) > 1;

    // When participants share a Client row, ONE of them is the natural owner
    // and keeps the existing record — the participant whose booked name matches
    // the client's name (i.e. the booker). Everyone else sharing the row gets
    // their own dedicated client; otherwise the booker would be duplicated and
    // the proche's invoice would stay tied to the booker's record.
    const sharedClientKeeperParticipantIds = new Set<string>();
    {
      const keeperByClient = new Map<string, string>(); // clientId -> participantId
      for (const p of group.participants) {
        if (!isSharedClient(p.clientId) || keeperByClient.has(p.clientId as string)) continue;
        const clientName =
          `${p.client?.firstName || ''} ${p.client?.lastName || ''}`.trim().toLowerCase();
        if (clientName && (p.displayName || '').trim().toLowerCase() === clientName) {
          keeperByClient.set(p.clientId as string, p.id);
        }
      }
      // No participant's booked name matched the client — keep the first one.
      for (const p of group.participants) {
        if (isSharedClient(p.clientId) && !keeperByClient.has(p.clientId as string)) {
          keeperByClient.set(p.clientId as string, p.id);
        }
      }
      for (const pid of keeperByClient.values()) sharedClientKeeperParticipantIds.add(pid);
    }

    await prisma.$transaction(async (tx) => {
      for (const p of group.participants) {
        if (!p.clientId || !p.appointment) continue;

        // The participant's own client record (may differ from the booked name
        // if their client row was renamed) — resolve a dedicated record when
        // the participant shares one with someone else in the group.
        let invoiceClientId = p.clientId;
        if (isSharedClient(p.clientId) && !sharedClientKeeperParticipantIds.has(p.id)) {
          invoiceClientId = await this.resolveDedicatedParticipantClient(tx, p, group.participants);
        }

        const svcItems = p.appointment.services;
        if (svcItems.length === 0) continue;

        // participantName = the name the participant booked under. The client
        // record's name is NOT reliable here: a shared client row would echo
        // the booker's name onto the proche's invoice line.
        const participantName =
          (p.displayName || '').trim() ||
          `${p.client?.firstName || ''} ${p.client?.lastName || ''}`.trim();

        const items = svcItems.map((si) => ({
          serviceId: si.serviceId,
          serviceName: si.serviceName,
          price: si.price,
          quantity: 1,
          participantName,
        }));

        const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (amount <= 0) continue;

        const tax = data.tax ?? 0;
        const total = amount + amount * (tax / 100);

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            clientId: invoiceClientId,
            bookingGroupId: data.bookingGroupId,
            appointmentId: p.appointmentId || undefined,
            invoiceNumber: this.generateInvoiceNumber(),
            amount,
            tax,
            total,
            status: 'PAID',
            paymentMethod: data.paymentMethod as any,
            paidAt: new Date(),
            notes: `Séparation — ${participantName}`,
            items: { create: items },
          },
        });
        invoices.push(invoice);
      }

      if (participantAppointmentIds.length > 0) {
        await tx.appointment.updateMany({
          where: { id: { in: participantAppointmentIds } },
          data: { status: 'COMPLETED' },
        });
      }
    });

    return invoices;
  }

  /**
   * Give a participant their own Client record when they currently share one
   * with another participant of the same group (e.g. a proche recorded against
   * the booker's client). Reuses an existing client with the same name as long
   * as no other participant of this group is already linked to it, then heals
   * the participant + appointment links so future billing stays correct.
   */
  private async resolveDedicatedParticipantClient(
    tx: any,
    p: { id: string; displayName: string; appointmentId: string | null },
    participants: Array<{ id: string; clientId: string | null }>,
  ): Promise<string> {
    const name = (p.displayName || '').trim();
    const parts = name.split(' ');
    const firstName = parts[0] || name;
    const lastName = parts.slice(1).join(' ').trim() || '';

    const usedByOtherParticipants = new Set(
      participants
        .filter((x) => x.id !== p.id && x.clientId)
        .map((x) => x.clientId as string)
    );

    // Reuse a matching client record (name-based, like the booking flow's
    // fallback) — never one already linked to another participant here.
    let client = await tx.client.findFirst({
      where: { firstName, lastName },
    });
    if (client && usedByOtherParticipants.has(client.id)) {
      client = null;
    }
    if (!client) {
      client = await tx.client.create({
        data: {
          firstName,
          lastName,
          phone: '',
          status: 'ACTIVE',
        },
      });
    }

    await tx.bookingParticipant.update({
      where: { id: p.id },
      data: { clientId: client.id },
    });
    if (p.appointmentId) {
      await tx.appointment.update({
        where: { id: p.appointmentId },
        data: { clientId: client.id },
      });
    }

    return client.id;
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

  /**
   * Fetch a booking group with all participants, their services, employees, and prices.
   * Used by the caisse frontend to display the group billing modal.
   */
  async getGroupDetails(tenantId: string, groupId: string) {
    const group = await prisma.bookingGroup.findFirst({
      where: { id: groupId, tenantId },
      include: {
        participants: {
          include: {
            appointment: {
              include: {
                services: {
                  include: {
                    employee: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
            client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new Error('BOOKING_GROUP_NOT_FOUND');
    }

    // Check if already invoiced
    const existingInvoice = await prisma.invoice.findFirst({
      where: { bookingGroupId: groupId },
      select: { id: true, invoiceNumber: true },
    });

    // Check if any appointment is already individually invoiced
    const appointmentIds = group.participants
      .map((p) => p.appointmentId)
      .filter(Boolean) as string[];
    let hasInvoicedAppointment = false;
    if (appointmentIds.length > 0) {
      const count = await prisma.invoice.count({
        where: { appointmentId: { in: appointmentIds } },
      });
      hasInvoicedAppointment = count > 0;
    }

    const participants = group.participants.map((p) => {
      const clientName = p.client
        ? `${p.client.firstName} ${p.client.lastName}`.trim()
        : '';

      // Prefer the name the participant booked under (stored displayName) over
      // the linked client's name: a guest can be linked to someone else's client
      // record (e.g. a shared phone number with the booker), which would make
      // the group billing show the same person twice.
      const displayName = (p.displayName || '').trim() || clientName || 'Participant';

      const services = (p.appointment?.services || []).map((si) => ({
        serviceId: si.serviceId,
        serviceName: si.serviceName,
        price: si.price,
        duration: si.duration,
        employee: si.employee
          ? { id: si.employee.id, firstName: si.employee.firstName, lastName: si.employee.lastName }
          : null,
      }));

      const subtotal = services.reduce((sum, s) => sum + s.price, 0);
      const startTime = p.appointment?.startTime || null;

      return {
        participantId: p.id,
        clientId: p.clientId,
        displayName,
        isBooker: p.isBooker,
        services,
        subtotal,
        startTime,
        appointmentId: p.appointmentId,
      };
    });

    const total = participants.reduce((sum, p) => sum + p.subtotal, 0);

    return {
      groupId: group.id,
      bookerClientId: group.bookerClientId,
      participants,
      total,
      alreadyInvoiced: !!existingInvoice,
      existingInvoiceId: existingInvoice?.id || null,
      hasInvoicedAppointment,
    };
  }

  /**
   * List booking groups that are billable (have >1 participant, not yet invoiced).
   * Used by the caisse frontend to populate the group billing selector.
   */
  async getPendingGroups(tenantId: string) {
    // Find groups that have participants with appointments
    const groups = await prisma.bookingGroup.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      include: {
        participants: {
          select: {
            id: true,
            clientId: true,
            displayName: true,
            isBooker: true,
            appointmentId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to groups with >1 participant
    const multiParticipantGroups = groups.filter((g) => g.participants.length > 1);

    // Check which ones are already invoiced
    const groupIds = multiParticipantGroups.map((g) => g.id);
    const invoicedGroupIds = new Set(
      (
        await prisma.invoice.findMany({
          where: { bookingGroupId: { in: groupIds } },
          select: { bookingGroupId: true },
        })
      ).map((inv) => inv.bookingGroupId)
    );

    // Also check for individually invoiced appointments
    const allAppointmentIds: string[] = multiParticipantGroups
      .flatMap((g) => g.participants.map((p) => p.appointmentId).filter(Boolean)) as string[];
    const invoicedAppointmentIds = new Set(
      (
        await prisma.invoice.findMany({
          where: { appointmentId: { in: allAppointmentIds } },
          select: { appointmentId: true },
        })
      ).map((inv) => inv.appointmentId)
    );

    return multiParticipantGroups.map((g) => {
      const booker = g.participants.find((p) => p.isBooker);
      const participantNames = g.participants.map((p) => p.displayName);
      const hasInvoicedAppointment = g.participants.some(
        (p) => p.appointmentId && invoicedAppointmentIds.has(p.appointmentId)
      );

      return {
        id: g.id,
        bookerClientId: g.bookerClientId,
        participantCount: g.participants.length,
        participantNames,
        alreadyInvoiced: invoicedGroupIds.has(g.id),
        hasInvoicedAppointment,
        createdAt: g.createdAt,
      };
    });
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

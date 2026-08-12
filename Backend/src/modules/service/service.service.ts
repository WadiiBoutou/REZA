import { prisma } from '../../lib/prisma';
import { tenantIdFilter } from '../../utils/salonScope';

export class ServiceService {
  async getServices(tenantIds: string | string[], category?: string, search?: string) {
    const where: any = { tenantId: tenantIdFilter(tenantIds) };
    
    if (category && category !== 'all') {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      include: {
        employeeServices: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            appointments: true
          }
        }
      }
    });

    // Categories = declared salon categories (persisted via setCategories) UNION
    // categories actually derived from services. Declared-but-empty categories
    // survive a refresh; derived ones keep showing up automatically.
    const [derivedRows, tenants] = await Promise.all([
      prisma.service.findMany({
        where: { tenantId: tenantIdFilter(tenantIds) },
        select: { category: true },
        distinct: ['category']
      }),
      prisma.tenant.findMany({
        where: { id: tenantIdFilter(tenantIds) },
        select: { categories: true }
      })
    ]);

    const declared = tenants.flatMap(t => t.categories || []);
    const derived = derivedRows.map(c => c.category).filter(Boolean);

    return { 
      services, 
      categories: Array.from(new Set([...declared, ...derived])) 
    };
  }

  /**
   * Persist the salon(s)' declared service categories (full replace of the list).
   * The pro "Gestion des prestations" page calls this whenever the admin adds or
   * removes a category so the choice survives a refresh.
   */
  async setCategories(tenantIds: string | string[], categories: string[]) {
    const cleaned = Array.from(
      new Set(categories.map((c) => c.trim()).filter(Boolean))
    );
    await prisma.tenant.updateMany({
      where: { id: tenantIdFilter(tenantIds) },
      data: { categories: cleaned }
    });
    return { categories: cleaned };
  }

  async getServiceById(tenantId: string, id: string) {
    return prisma.service.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        employeeServices: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            appointments: true
          }
        }
      }
    });
  }

  async createService(tenantId: string, data: any) {
    const { employeeIds, ...serviceData } = data;

    return prisma.service.create({
      data: {
        ...serviceData,
        tenantId,
        employeeServices: employeeIds && employeeIds.length > 0 ? {
          create: employeeIds.map((employeeId: string) => ({
            employeeId
          }))
        } : undefined
      } as any,
      include: {
        employeeServices: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  async updateService(tenantId: string, id: string, data: any) {
    const { employeeIds, ...serviceData } = data;

    const existing = await prisma.service.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    if (employeeIds !== undefined) {
      await prisma.employeeService.deleteMany({
        where: { serviceId: id }
      });

      if (employeeIds.length > 0) {
        await prisma.employeeService.createMany({
          data: employeeIds.map((employeeId: string) => ({
            serviceId: id,
            employeeId
          })),
          skipDuplicates: true
        });
      }
    }

    return prisma.service.update({
      where: { id },
      data: serviceData,
      include: {
        employeeServices: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  }

  async deleteService(tenantId: string, id: string) {
    const service = await prisma.service.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            appointments: true,
            employeeServices: true
          }
        }
      }
    });

    if (!service) {
      throw new Error('SERVICE_NOT_FOUND');
    }

    let deletedAppointmentsCount = 0;
    if (service._count.appointments > 0) {
      const appointments = await prisma.appointment.findMany({
        where: { serviceId: id },
        include: {
          invoice: true
        }
      });

      const appointmentsWithInvoices = appointments.filter(apt => apt.invoice !== null);
      if (appointmentsWithInvoices.length > 0) {
        throw new Error(`HAS_INVOICES:${appointmentsWithInvoices.length}:${service._count.appointments}`);
      }

      const deleteResult = await prisma.appointment.deleteMany({
        where: { serviceId: id }
      });
      deletedAppointmentsCount = deleteResult.count;
    }

    await prisma.employeeService.deleteMany({
      where: { serviceId: id }
    });

    await prisma.service.delete({
      where: { id }
    });

    return { deletedAppointmentsCount };
  }
}

export const serviceService = new ServiceService();

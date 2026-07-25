import { prisma } from '../../../lib/prisma';
import { fail } from '../utils/http';

export class TenantCatalogService {
  async getTenantServices(tenantId: string, query: Record<string, unknown>) {
    try {
    const { category } = query;

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      },
      select: { id: true }
    });

    if (!tenant) {
      fail(404, {
        error: 'Tenant not found'
      });
    }

    const where: any = {
      tenantId: tenant.id,
      visibility: { in: ['BOOKABLE', 'VISIBLE'] } // Only public services
    };

    if (category && category !== 'all') {
      where.category = category;
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        employeeServices: {
          select: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    // Transform services to include employees array
    const servicesWithEmployees = services.map(service => ({
      ...service,
      employees: service.employeeServices.map(es => es.employee)
    }));

    return { services: servicesWithEmployees };
  } catch (error) {
    throw error;
  }
  }

  async getTenantEmployees(tenantId: string, query: Record<string, unknown>) {
    try {
    const { active } = query;

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      },
      select: { id: true }
    });

    if (!tenant) {
      fail(404, {
        error: 'Tenant not found'
      });
    }

    const where: any = {
      tenantId: tenant.id
    };

    if (active === 'true') {
      where.isActive = true;
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        isActive: true,
        agendaSettings: true,
        employeeServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    // Filter out employees with inactive/vacation status from public listing
    const filteredEmployees = employees.filter(emp => {
      const status = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
      return !status || status === 'active';
    });

    // Transform employees to include services array
    const employeesWithServices = filteredEmployees.map(employee => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      avatar: employee.avatar,
      isActive: employee.isActive,
      services: employee.employeeServices.map(es => es.service)
    }));

    return { employees: employeesWithServices };
  } catch (error) {
    throw error;
  }
  }

  async getTenantReviews(tenantId: string, query: Record<string, unknown>) {
    try {
    const { page = '1', limit = '50' } = query;

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      },
      select: { id: true }
    });

    if (!tenant) {
      fail(404, {
        error: 'Tenant not found'
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          tenantId: tenant.id,
          status: 'APPROVED' // Only show approved reviews
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.review.count({
        where: {
          tenantId: tenant.id,
          status: 'APPROVED'
        }
      })
    ]);

    // Calculate average rating
    const ratingStats = await prisma.review.aggregate({
      where: {
        tenantId: tenant.id,
        status: 'APPROVED'
      },
      _avg: {
        rating: true
      },
      _count: {
        rating: true
      }
    });

    return {
      reviews,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      },
      stats: {
        averageRating: ratingStats._avg.rating || 0,
        totalReviews: ratingStats._count.rating || 0
      }
    };
  } catch (error) {
    throw error;
  }
  }

}

export const tenantCatalogService = new TenantCatalogService();

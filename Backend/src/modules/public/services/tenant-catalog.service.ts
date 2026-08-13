import { prisma } from '../../../lib/prisma';
import { fail } from '../utils/http';
import { transformImageUrl } from '../../../utils/imageUrl';

export class TenantCatalogService {
  async getTenantServices(tenantId: string, query: Record<string, unknown>) {
    try {
    const { category } = query;

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
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
          { slug: tenantId }, { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true,
        subscriptionActive: true
      },
      select: {
        id: true,
        employeesPaid: true,
        account: {
          select: {
            subscription: {
              select: { status: true, currentPeriodEnd: true }
            }
          }
        }
      }
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
                category: true,
                price: true,
                priceType: true,
                priceFrom: true,
                priceTo: true,
                duration: true
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

    // Billing coverage slice: only employees within the free threshold plus the
    // paid covered count (for the current period) are shown publicly. Employees
    // added beyond coverage stay hidden until the owner pays the difference.
    const sub = tenant.account?.subscription;
    const periodActive =
      sub?.status === 'ACTIVE' &&
      (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());
    const covered =
      (await this.getFreeEmployeeThreshold()) + (periodActive ? (tenant.employeesPaid ?? 0) : 0);
    const visibleEmployees = covered >= filteredEmployees.length
      ? filteredEmployees
      : filteredEmployees.slice(0, Math.max(0, covered));

    // Transform employees to include services array
    const employeesWithServices = visibleEmployees.map(employee => ({
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

  /** Free employee threshold from the platform billing config (defaults to 2). */
  private async getFreeEmployeeThreshold(): Promise<number> {
    try {
      const config = await prisma.billingConfig.findUnique({ where: { id: 'default' } });
      return config?.freeEmployeeThreshold ?? 2;
    } catch {
      return 2;
    }
  }

  /**
   * Featured "elite" professionals for the public homepage: active employees of
   * SUBSCRIBED salons only (so every "Réserver" link resolves to a live salon
   * page), each with real services/prestations, salon info and real ratings.
   */
  async getFeaturedEmployees(query: Record<string, unknown>) {
    const limit = Math.min(parseInt(String(query.limit)) || 8, 20);

    // Only employees from subscribed, active salons.
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true, subscriptionActive: true },
      select: { id: true, name: true, subdomain: true },
    });
    if (tenants.length === 0) return { employees: [] };
    const tenantIds = tenants.map((t) => t.id);

    // Real salon-level rating per tenant (fallback when an employee has no
    // personal reviews): approved reviews only.
    const tenantRatings = await prisma.review.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: tenantIds }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingByTenant = new Map(
      tenantRatings.map((r) => [r.tenantId, { rating: r._avg.rating ?? 0, count: r._count._all }])
    );

    // Per-employee ratings: reviews are tied to the agenda User; map by
    // (tenant, first+last name) to the public Employee record.
    const reviews = await prisma.review.findMany({
      where: { tenantId: { in: tenantIds }, status: 'APPROVED', employeeId: { not: null } },
      select: {
        tenantId: true,
        rating: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    const empKey = (firstName: string, lastName: string) =>
      `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
    const reviewsByEmp = new Map<string, { sum: number; count: number }>();
    for (const r of reviews) {
      if (!r.employee) continue;
      const key = `${r.tenantId}:${empKey(r.employee.firstName, r.employee.lastName)}`;
      const cur = reviewsByEmp.get(key) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      reviewsByEmp.set(key, cur);
    }

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: { in: tenantIds },
        isActive: true,
        employeeServices: {
          some: { service: { visibility: { in: ['BOOKABLE', 'VISIBLE'] } } },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        agendaSettings: true,
        tenantId: true,
        employeeServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                priceType: true,
                priceFrom: true,
                duration: true,
                visibility: true,
              },
            },
          },
        },
      },
      take: limit * 4, // room to filter inactive/vacation staff below
    });

    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const featured: any[] = [];
    for (const emp of employees) {
      const status = (emp.agendaSettings as any)?.status;
      if (status && status !== 'active') continue; // skip inactive/vacation
      const services = emp.employeeServices
        .map((es) => es.service)
        .filter((s) => s.visibility === 'BOOKABLE' || s.visibility === 'VISIBLE');
      if (services.length === 0) continue;
      const tenant = tenantById.get(emp.tenantId);
      if (!tenant) continue;

      const empRatings = reviewsByEmp.get(
        `${emp.tenantId}:${empKey(emp.firstName, emp.lastName)}`
      );
      const tenantStat = ratingByTenant.get(emp.tenantId);
      const rating = empRatings
        ? Math.round((empRatings.sum / empRatings.count) * 10) / 10
        : tenantStat?.rating ?? 0;
      const reviewCount = empRatings ? empRatings.count : (tenantStat?.count ?? 0);

      featured.push({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        avatar: emp.avatar,
        specialty: services[0].category || services[0].name || 'Professionnel',
        salonName: tenant.name,
        tenantId: emp.tenantId,
        subdomain: tenant.subdomain,
        rating,
        reviews: reviewCount,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price ?? s.priceFrom ?? 0,
          priceType: s.priceType,
          duration: s.duration,
        })),
      });
      if (featured.length >= limit) break;
    }

    return { employees: featured };
  }

  async getTenantReviews(tenantId: string, query: Record<string, unknown>) {
    try {
    const { page = '1', limit = '50' } = query;

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
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
              lastName: true,
              avatar: true
            }
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true
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

    const transformedReviews = reviews.map((r) => ({
      ...r,
      client: r.client
        ? { ...r.client, avatar: transformImageUrl(r.client.avatar ?? null) }
        : r.client,
      employee: r.employee
        ? { ...r.employee, avatar: transformImageUrl(r.employee.avatar ?? null) }
        : r.employee
    }));

    return {
      reviews: transformedReviews,
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

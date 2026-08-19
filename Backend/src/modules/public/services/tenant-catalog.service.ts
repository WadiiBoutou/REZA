import { prisma } from '../../../lib/prisma';
import { HttpError } from '../../../lib/errors';
import { transformImageUrl } from '../../../utils/imageUrl';
import { getVisibleEmployeeIds } from '../../../utils/feasibility';

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
      throw new HttpError(404, {
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

    // Filter: only show services with at least 1 visible (paid-for) employee
    const visibleIds = await getVisibleEmployeeIds(tenant.id);
    const filteredServices = visibleIds
      ? servicesWithEmployees.filter(s => s.employees.some((e: any) => visibleIds.has(e.id)))
      : servicesWithEmployees;

    return { services: filteredServices };
  } catch (error) {
    throw error;
  }
  }

  async getTenantEmployees(tenantId: string, query: Record<string, unknown>) {
    try {
    const { active } = query;

    // Verify tenant exists and is active    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
          { domain: tenantId }, { id: tenantId }
        ],
        isActive: true,
        subscriptionActive: true
      },
      select: { id: true }
    });

    if (!tenant) {
      throw new HttpError(404, {
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
        isPublic: true,
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
      return (!status || status === 'active') && emp.isPublic;
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

  /**
   * Real employee stats for the public salon page:
   *   completedAppointments — appointments marked COMPLETED
   *   clientsServed         — distinct clients among those appointments
   * Public Employee rows are linked to the agenda User rows by email (fallback:
   * full name) — the same mapping the scheduler uses — because appointments
   * store the User id (legacy employeeId or per-service item).
   */
  async getEmployeeStats(tenantId: string, employeeId: string) {
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
      throw new HttpError(404, {
        error: 'Tenant not found'
      });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: tenant.id },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    if (!employee) {
      throw new HttpError(404, {
        error: 'Employee not found'
      });
    }

    // Map Employee -> agenda User (appointments reference the User id)
    let userId: string | null = null;
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, email: true, firstName: true, lastName: true }
    });
    if (employee.email) {
      const byEmail = tenantUsers.find(
        (u) => u.email && u.email.toLowerCase() === (employee.email as string).toLowerCase()
      );
      if (byEmail) userId = byEmail.id;
    }
    if (!userId) {
      const byName = tenantUsers.find(
        (u) =>
          u.firstName.toLowerCase() === employee.firstName.toLowerCase() &&
          u.lastName.toLowerCase() === employee.lastName.toLowerCase()
      );
      if (byName) userId = byName.id;
    }

    // No linked User means no appointments can reference this employee
    if (!userId) {
      return { completedAppointments: 0, clientsServed: 0 };
    }

    // Count both the legacy top-level employeeId and the per-service items
    const where = {
      tenantId: tenant.id,
      status: 'COMPLETED' as const,
      OR: [
        { employeeId: userId },
        { services: { some: { employeeId: userId } } }
      ]
    };

    const [completedAppointments, clientRows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        select: { clientId: true },
        distinct: ['clientId']
      })
    ]);

    return {
      completedAppointments,
      clientsServed: clientRows.length
    };
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
      throw new HttpError(404, {
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
              email: true,
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

    // A client can exist as several rows (one per salon they booked at). If the
    // row attached to a review has no avatar but another row with the same
    // email does (e.g. the profile picture was uploaded from another salon's
    // context), fall back to that avatar so initials don't show when a photo
    // actually exists.
    const missingAvatarEmails = [...new Set(
      reviews
        .map((r) => r.client)
        .filter((c) => !!c && !c.avatar && !!c.email)
        .map((c) => (c as { email: string }).email)
    )];
    let avatarByEmail: Map<string, string> = new Map();
    if (missingAvatarEmails.length > 0) {
      const withAvatar = await prisma.client.findMany({
        where: { email: { in: missingAvatarEmails }, avatar: { not: null } },
        select: { email: true, avatar: true }
      });
      avatarByEmail = new Map(
        withAvatar
          .filter((c) => c.email && c.avatar)
          .map((c) => [c.email as string, c.avatar as string])
      );
    }

    const transformedReviews = reviews.map((r) => {
      let clientAvatar = r.client?.avatar ?? null;
      if (!clientAvatar && r.client?.email && avatarByEmail.has(r.client.email)) {
        clientAvatar = avatarByEmail.get(r.client.email) as string;
      }
      return {
        ...r,
        client: r.client
          ? { ...r.client, avatar: transformImageUrl(clientAvatar) }
          : r.client,
        employee: r.employee
          ? { ...r.employee, avatar: transformImageUrl(r.employee.avatar ?? null) }
          : r.employee
      };
    });

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

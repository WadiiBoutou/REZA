import { prisma } from '../../lib/prisma';
import { tenantIdFilter } from '../../utils/salonScope';

export class EmployeeService {
  async getEmployees(tenantIds: string | string[], active?: string, search?: string) {
    const where: any = { tenantId: tenantIdFilter(tenantIds) };

    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    return prisma.employee.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ],
      include: {
        employeeServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      }
    });
  }

  async getEmployeeById(tenantId: string, id: string) {
    return prisma.employee.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        employeeServices: {
          include: {
            service: true
          }
        }
      }
    });
  }

  async createEmployee(tenantId: string, data: any) {
    const { serviceIds, isPublic, ...employeeData } = data;

    return prisma.employee.create({
      data: {
        ...employeeData,
        tenantId,
        isPublic: isPublic !== undefined ? isPublic : false,
        employeeServices: serviceIds ? {
          create: serviceIds.map((serviceId: string) => ({
            serviceId
          }))
        } : undefined
      } as any,
      include: {
        employeeServices: {
          include: {
            service: true
          }
        }
      }
    });
  }

  async updateEmployee(tenantId: string, id: string, data: any) {
    const { serviceIds, isPublic, ...employeeData } = data;

    const existing = await prisma.employee.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new Error('EMPLOYEE_NOT_FOUND');
    }

    if (serviceIds !== undefined) {
      await prisma.employeeService.deleteMany({
        where: { employeeId: id }
      });

      if (serviceIds.length > 0) {
        await prisma.employeeService.createMany({
          data: serviceIds.map((serviceId: string) => ({
            employeeId: id,
            serviceId
          })),
          skipDuplicates: true
        });
      }
    }

    return prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        ...(isPublic !== undefined ? { isPublic } : {})
      },
      include: {
        employeeServices: {
          include: {
            service: true
          }
        }
      }
    });
  }

  async deleteEmployee(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, tenantId }
    });

    if (!employee) {
      throw new Error('EMPLOYEE_NOT_FOUND');
    }

    let userIdToCheck = null;
    if (employee.email) {
      const user = await prisma.user.findFirst({
        where: { email: employee.email, tenantId }
      });
      if (user) {
        userIdToCheck = user.id;
      }
    }

    if (userIdToCheck) {
      const futureAppointmentsCount = await prisma.appointment.count({
        where: {
          employeeId: userIdToCheck,
          tenantId,
          startTime: { gte: new Date() },
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
        }
      });

      if (futureAppointmentsCount > 0) {
        throw new Error(`HAS_FUTURE_APPOINTMENTS:${futureAppointmentsCount}`);
      }
    }

    await prisma.employee.delete({
      where: { id }
    });
  }
}

export const employeeService = new EmployeeService();

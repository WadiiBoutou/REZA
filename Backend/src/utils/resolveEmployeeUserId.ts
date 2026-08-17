import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from './password';

/**
 * Resolve an Employee.id or User.id to the User.id stored on appointments.
 */
export async function resolveEmployeeUserId(
  tenantId: string,
  employeeOrUserId: string
): Promise<string | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeOrUserId, tenantId },
  });

  if (employee) {
    if (employee.email) {
      let user = await prisma.user.findFirst({
        where: { email: employee.email, tenantId },
      });
      if (!user) {
        try {
          const randomPassword = crypto.randomBytes(32).toString('hex');
          const defaultPassword = await hashPassword(randomPassword);
          user = await prisma.user.create({
            data: {
              email: employee.email,
              password: defaultPassword,
              firstName: employee.firstName,
              lastName: employee.lastName,
              phone: employee.phone,
              tenantId,
              role: 'STAFF',
            },
          });
        } catch {
          user = await prisma.user.findFirst({
            where: { email: employee.email, tenantId },
          });
        }
      }
      return user?.id ?? null;
    }

    let user = await prisma.user.findFirst({
      where: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        tenantId,
      },
    });
    if (!user) {
      // Email-less employee: create a dormant User record so the appointment can
      // reference it (AppointmentServiceItem.employeeId → User). Synthetic email
      // (.invalid TLD never delivers) + random password → cannot be logged into.
      try {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        user = await prisma.user.create({
          data: {
            email: `staff.${employee.id}@reza.invalid`,
            password: await hashPassword(randomPassword),
            firstName: employee.firstName,
            lastName: employee.lastName,
            phone: employee.phone,
            tenantId,
            role: 'STAFF',
          },
        });
      } catch {
        user = await prisma.user.findFirst({
          where: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            tenantId,
          },
        });
      }
    }
    return user?.id ?? null;
  }

  const user = await prisma.user.findFirst({
    where: { id: employeeOrUserId, tenantId },
  });
  return user?.id ?? null;
}

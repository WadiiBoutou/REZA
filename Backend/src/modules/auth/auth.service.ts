import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { LoginInput, RegisterInput } from './auth.schema';
import { accountService } from '../account/account.service';
import * as log from '../../utils/logger';

export class AuthService {
  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    // Case-insensitive email match (emails stored mixed-case in some seeds)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    if (!user) {
      throw {
        status: 401,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      };
    }

    if (!user.isActive) {
      throw {
        status: 403,
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      };
    }

    // Global SUPER_ADMIN has no tenant; regular users require an active tenant
    if (user.tenant && !user.tenant.isActive) {
      throw {
        status: 403,
        error: 'Tenant inactive',
        message: 'Your organization account has been deactivated'
      };
    }
    if (!user.tenant && user.role !== 'SUPER_ADMIN') {
      throw {
        status: 403,
        error: 'Invalid account',
        message: 'Your account is not linked to an organization'
      };
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw {
        status: 401,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      };
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
      role: user.role
    });

    // Multi-salon account context (owner admins)
    const accountContext = await accountService.getContextForUser(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name
            }
          : null
      },
      account: accountContext.account,
      salons: accountContext.salons,
      activeTenantId: user.tenantId,
      subscription: accountContext.subscription,
      salonLimit: accountContext.salonLimit
    };
  }

  async register(input: RegisterInput) {
    let tenantId: string;
    let tenant: { id: string; name: string; isActive: boolean } | null = null;

    if (input.createTenant && input.tenantName && input.tenantEmail) {
      const tags: string[] = [];
      if (input.businessType) {
        tags.push(input.businessType);
      }

      const newTenant = await prisma.tenant.create({
        data: {
          name: input.tenantName,
          email: input.tenantEmail,
          phone: input.tenantPhone || input.phone || null,
          address: input.tenantAddress || null,
          city: input.tenantCity || null,
          category: input.tenantCategory || null,
          tags,
          isActive: true,
          // New salons stay hidden from clients until the account subscribes
          subscriptionActive: false
        }
      });

      const onboardingData = {
        businessType: input.businessType || null,
        hasCommercialLocal: input.hasCommercialLocal || null,
        onboardingCompleted: true,
        onboardingDate: new Date().toISOString()
      };

      await prisma.tenantSettings.create({
        data: {
          tenantId: newTenant.id,
          timezone: 'Africa/Casablanca',
          currency: 'EUR',
          language: 'fr',
          bookingAdvanceDays: 30,
          cancellationHours: 24,
          description: JSON.stringify(onboardingData)
        }
      });

      tenantId = newTenant.id;
      tenant = {
        id: newTenant.id,
        name: newTenant.name,
        isActive: newTenant.isActive
      };

      log.log(`[Register] ✅ Auto-generated tenant ID: ${tenantId} for organization: ${input.tenantName}`);
    } else if (input.tenantId) {
      tenantId = input.tenantId;

      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, isActive: true }
      });

      if (!tenant) {
        throw {
          status: 404,
          error: 'Tenant not found',
          message: 'The specified organization does not exist. Please verify the tenant ID or contact support.'
        };
      }

      if (!tenant.isActive) {
        throw {
          status: 403,
          error: 'Tenant inactive',
          message: 'This organization account has been deactivated. Please contact support.'
        };
      }
    } else {
      throw {
        status: 400,
        error: 'Tenant required',
        message: 'Registration requires either: (1) an existing tenant ID, or (2) create a new organization by providing tenantName and tenantEmail with createTenant=true.'
      };
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: input.email,
        tenantId: tenantId
      }
    });

    if (existingUser) {
      throw {
        status: 409,
        error: 'User exists',
        message: 'A user with this email already exists in this organization'
      };
    }

    const hashedPassword = await hashPassword(input.password);
    const userRole = input.createTenant ? 'ADMIN' : 'STAFF';

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        tenantId: tenantId,
        role: userRole
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Multi-salon: tenant creators own an Account that groups their salons
    if (input.createTenant) {
      const account = await accountService.ensureAccountForOwner(user.id);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { accountId: account.id }
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tenantId: tenantId,
      role: user.role
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name
            }
          : null
      }
    };
  }

  /**
   * Multi-salon: re-issue a tenant-scoped token for another salon of the
   * owner's account.
   */
  async switchSalon(userId: string, targetTenantId: string) {
    const { salonService } = await import('../salon/salon.service');
    const { tenant } = await salonService.validateSwitchTarget(userId, targetTenantId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true
      }
    });
    if (!user) {
      throw { status: 401, error: 'User not found', message: 'User no longer exists' };
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: user.role
    });

    const accountContext = await accountService.getContextForUser(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
        tenant: { id: tenant.id, name: tenant.name }
      },
      account: accountContext.account,
      salons: accountContext.salons,
      activeTenantId: tenant.id,
      subscription: accountContext.subscription,
      salonLimit: accountContext.salonLimit
    };
  }

  async getCurrentUser(userId: string, activeTenantId?: string) {
    log.log('[Auth Service /me] Fetching user:', userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true
      }
    });

    if (!user) {
      log.error('[Auth Service /me] User not found for userId:', userId);
      throw {
        status: 404,
        error: 'User not found'
      };
    }

    // The token's tenant wins (multi-salon switch); fall back to home tenant
    const effectiveTenantId = activeTenantId || user.tenantId;

    let tenant = null;
    if (effectiveTenantId) {
      try {
        tenant = await prisma.tenant.findUnique({
          where: { id: effectiveTenantId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            logo: true
          }
        });
      } catch (tenantError: any) {
        log.error('[Auth Service /me] Error fetching tenant:', tenantError);
      }
    }

    if (!tenant && user.role !== 'SUPER_ADMIN') {
      log.error('[Auth Service /me] User tenant not found for tenantId:', user.tenantId);
      throw {
        status: 500,
        error: 'Invalid user data',
        message: 'User tenant information is missing. Please contact support.'
      };
    }

    // Multi-salon account context (owner admins)
    const accountContext = await accountService.getContextForUser(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: effectiveTenantId,
        tenant
      },
      account: accountContext.account,
      salons: accountContext.salons,
      activeTenantId: effectiveTenantId,
      subscription: accountContext.subscription,
      salonLimit: accountContext.salonLimit
    };
  }

  async handleGoogleCallback(googleUser: any, frontendUrl: string) {
    const { email, given_name, family_name, picture } = googleUser;

    if (!email) {
      throw {
        status: 400,
        error: 'No email',
        message: 'Google account must have an email'
      };
    }

    log.log('[Auth Service Google] Searching for user with email:', email.toLowerCase());
    let user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase()
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    log.log('[Auth Service Google] User lookup result:', { found: !!user, userId: user?.id });

    if (!user) {
      throw {
        status: 404,
        error: 'User not found',
        email,
        message: 'Compte non trouvé. Veuillez créer un compte d\'abord.'
      };
    }

    if (!user.isActive) {
      throw {
        status: 403,
        error: 'Account inactive',
        message: 'User account is inactive'
      };
    }

    if (!user.tenant?.isActive) {
      throw {
        status: 403,
        error: 'Tenant inactive',
        message: 'Tenant account is inactive'
      };
    }

    if (picture && !user.avatar) {
      log.log('[Auth Service Google] Updating user avatar');
      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: picture }
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
      role: user.role
    });

    return {
      token,
      frontendUrl,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name
            }
          : null
      }
    };
  }

}

export const authService = new AuthService();

import { prisma } from '../../../lib/prisma';
import { comparePassword, hashPassword } from '../../../utils/password';
import { fail } from '../utils/http';

const INVALID_CREDENTIALS_MSG = 'Email ou mot de passe incorrect.';

export class ClientAuthService {
  async registerClient(body: any) {
    try {
    const { email, firstName, lastName, phone, password } = body;

    if (!email || !firstName || !lastName) {
      fail(400, {
        error: 'Missing required fields',
        message: 'Email, first name, and last name are required.'
      });
    }

    if (!password || String(password).trim().length < 6) {
      fail(400, {
        error: 'Invalid password',
        message: 'Le mot de passe doit contenir au moins 6 caractères.'
      });
    }

    const hashedPassword = await hashPassword(String(password).trim());

    // Find or create a tenant for clients (use first active tenant or create default)
    let tenant = await prisma.tenant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    if (!tenant) {
      // Create default tenant for clients
      try {
        tenant = await prisma.tenant.create({
          data: {
            name: 'WellBe Platform',
            email: 'support@wellbe.com',
            isActive: true,
            category: 'Platform',
            shortDescription: 'Default tenant for client accounts'
          }
        });

        await prisma.tenantSettings.create({
          data: {
            tenantId: tenant.id,
            onlineReservationEnabled: true,
            showMap: true,
            showOpeningHours: true,
            showReviews: true
          }
        });
      } catch (tenantError: any) {
        // If creation fails, try to find it again
        tenant = await prisma.tenant.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        });

        if (!tenant) {
          fail(500, {
            error: 'System setup required',
            message: 'Unable to initialize the system. Please contact support.'
          });
        }
      }
    }

    // Check if client already exists
    const existingClient = await prisma.client.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        tenantId: tenant.id
      }
    });

    if (existingClient) {
      await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone || existingClient.phone,
          password: hashedPassword,
        },
      });

      return {
        client: {
          id: existingClient.id,
          email: existingClient.email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone || existingClient.phone,
          tenantId: existingClient.tenantId
        },
        message: 'Compte créé avec succès'
      };
    }

    // Create new client
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || '',
        password: hashedPassword,
        status: 'ACTIVE'
      }
    });

    return {
      client: {
        id: client.id,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        tenantId: client.tenantId
      },
      message: 'Compte créé avec succès'
    };
  } catch (error) {
    throw error;
  }
  }

  async loginClient(body: any) {
    try {
    const { email, password } = body;

    if (!email) {
      fail(400, {
        error: 'Email required',
        message: 'Please provide your email address.'
      });
    }

    if (!password) {
      fail(400, {
        error: 'Password required',
        message: INVALID_CREDENTIALS_MSG
      });
    }

    // Same email can exist per salon (booking) + platform account — use row with password
    const normalizedEmail = email.trim().toLowerCase();

    const candidates = await prisma.client.findMany({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
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

    const client = candidates.find((c) => c.password);

    if (!client) {
      fail(401, {
        error: 'Invalid credentials',
        message: INVALID_CREDENTIALS_MSG
      });
    }

    const passwordValid = await comparePassword(password, client.password!);
    if (!passwordValid) {
      fail(401, {
        error: 'Invalid credentials',
        message: INVALID_CREDENTIALS_MSG
      });
    }

    // Check if client is active
    if (client.status !== 'ACTIVE') {
      fail(401, {
        error: 'Invalid credentials',
        message: INVALID_CREDENTIALS_MSG
      });
    }

    // Return client data (without sensitive information)
    return {
      client: {
        id: client.id,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        tenantId: client.tenantId,
        tenant: client.tenant ? {
          id: client.tenant.id,
          name: client.tenant.name
        } : null
      },
      message: 'Connexion réussie'
    };
  } catch (error) {
    throw error;
  }
  }

}

export const clientAuthService = new ClientAuthService();

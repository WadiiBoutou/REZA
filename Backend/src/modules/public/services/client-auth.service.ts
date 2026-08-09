import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { comparePassword, hashPassword } from '../../../utils/password';
import { sendMail } from '../../../utils/mailer';
import { fail } from '../utils/http';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function getClientFrontendBaseUrl(req?: any): string {
  const envUrl = process.env.CLIENT_APP_URL || process.env.CLIENT_URL;
  if (envUrl) {
    return envUrl.split(',')[0].trim().replace(/\/$/, '');
  }
  if (req && req.headers && req.headers.origin) {
    return String(req.headers.origin).replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

const INVALID_CREDENTIALS_MSG = 'Email ou mot de passe incorrect.';

export class ClientAuthService {
  /**
   * Forgot password for client accounts (reza-client / mobile).
   */
  async forgotClientPassword(body: any, req?: any) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      fail(400, { error: 'Email required', message: "Veuillez entrer votre adresse email." });
    }

    const client = await prisma.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, firstName: true, lastName: true, password: true },
    });

    if (client && client.password) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.client.update({
        where: { id: client.id },
        data: {
          resetPasswordToken: hashToken(token),
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${getClientFrontendBaseUrl(req)}/reset-password?token=${token}`;
      const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
      try {
        await sendMail({
          to: client.email!,
          subject: 'Réinitialisation de votre mot de passe — Reza',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #002366;">Réinitialisation de votre mot de passe</h2>
              <p>Bonjour ${name},</p>
              <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
              <p style="text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" style="background: #002366; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
              </p>
              <p style="font-size: 13px; color: #666;">Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </div>
          `,
        });
      } catch (mailError: any) {
        await prisma.client.update({
          where: { id: client.id },
          data: { resetPasswordToken: null, resetPasswordExpires: null },
        });
        throw mailError;
      }
    }

    return {
      message: "Si un compte existe pour cette adresse email, un lien de réinitialisation a été envoyé.",
    };
  }

  /**
   * Reset password for client accounts using a one-time token.
   */
  async resetClientPassword(body: any) {
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    if (!token) {
      fail(400, { error: 'Token required', message: 'Lien de réinitialisation invalide.' });
    }
    if (password.length < 6) {
      fail(400, { error: 'Invalid password', message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const tokenHash = hashToken(token);
    const client = await prisma.client.findFirst({
      where: { resetPasswordToken: tokenHash },
      select: { id: true, resetPasswordExpires: true },
    });

    if (!client) {
      fail(400, { error: 'Invalid token', message: 'Ce lien de réinitialisation est invalide. Veuillez refaire une demande.' });
    }
    if (!client.resetPasswordExpires || client.resetPasswordExpires.getTime() < Date.now()) {
      fail(400, { error: 'Token expired', message: 'Ce lien de réinitialisation a expiré. Veuillez refaire une demande.' });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.client.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

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

import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { comparePassword, hashPassword } from '../../../utils/password';
import { sendMail } from '../../../utils/mailer';
import { fail } from '../utils/http';
import { isValidPhone, phoneError } from '../../../utils/phone';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — recommended for password resets
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — recommended for email confirmation
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
              <p style="font-size: 13px; color: #666;">Ce lien expire dans 30 minutes. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
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
    }  return {
    message: "Si un compte existe pour cette adresse email, un lien de réinitialisation a été envoyé.",
  };
}

  /**
   * Email verification for a newly registered client account (one-time token).
   */
  async verifyClientEmail(body: any) {
    const token = String(body.token || '').trim();
    if (!token) {
      fail(400, { error: 'Token required', message: 'Lien de vérification invalide.' });
    }

    const tokenHash = hashToken(token);
    const client = await prisma.client.findFirst({
      where: { verifyEmailToken: tokenHash },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        verifyEmailExpires: true,
      },
    });

    if (!client) {
      fail(400, { error: 'Invalid token', message: 'Ce lien de vérification est invalide. Veuillez réessayer.' });
    }
    if (!client.verifyEmailExpires || client.verifyEmailExpires.getTime() < Date.now()) {
      fail(400, { error: 'Token expired', message: 'Ce lien de vérification a expiré. Veuillez demander un nouveau lien.' });
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { verifyEmailToken: null, verifyEmailExpires: null },
    });

    // The confirmation link proves email ownership — return the full client so
    // the frontend can sign the user in immediately (no password needed).
    return {
      message: 'Email vérifié avec succès. Vous êtes maintenant connecté.',
      client: {
        id: client.id,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
      },
    };
  }

  /**
   * Resend the verification email for an unverified client account.
   * Always returns the same message (no account enumeration).
   */
  async resendClientVerification(body: any) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      fail(400, { error: 'Email required', message: 'Veuillez entrer votre adresse email.' });
    }

    const client = await prisma.client.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        password: { not: null },
        verifyEmailToken: { not: null },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (client) {
      const token = crypto.randomBytes(32).toString('hex');
      try {
        await this.sendVerificationEmail(client, token);
      } catch (mailError) {
        throw mailError;
      }
      await prisma.client.update({
        where: { id: client.id },
        data: {
          verifyEmailToken: hashToken(token),
          verifyEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      });
    }

    return {
      message: 'Si un compte existe pour cette adresse, un email de confirmation a été envoyé.',
    };
  }

  private async sendVerificationEmail(
    client: { email?: string | null; firstName?: string | null; lastName?: string | null },
    token: string
  ) {
    const base = getClientFrontendBaseUrl();
    const verifyUrl = `${base}/verify-email?token=${token}`;
    const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    await sendMail({
      to: client.email!,
      subject: 'Confirmez votre adresse email — Reza',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #002366;">Confirmez votre adresse email</h2>
          <p>Bonjour ${name},</p>
          <p>Merci de vous être inscrit sur Reza. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${verifyUrl}" style="background: #002366; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Confirmer mon email</a>
          </p>
          <p style="font-size: 13px; color: #666;">Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte sur Reza, ignorez cet email.</p>
        </div>
      `,
    });
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

  /**
   * Lightweight pre-registration check: does a *confirmed* account already
   * exist for this email? Mirrors registerClient's 409 logic (password set
   * and no pending verification) so the app can stop the user before they
   * fill the rest of the form. Unverified/guest rows don't block — register
   * will refresh them and re-send the confirmation email.
   */
  async checkEmailExists(email: string) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) {
      return { exists: false };
    }
    const client = await prisma.client.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, password: true, verifyEmailToken: true },
    });
    const exists = !!(client && client.password && !client.verifyEmailToken);
    return { exists };
  }

  async registerClient(body: any) {
    const { email, firstName, lastName, phone, password, avatar, dateOfBirth, gender } = body;

    // Optional fields: only accept a valid ISO date for dateOfBirth (harmless
    // to store nothing when missing) and a URL/string for avatar.
    let parsedDateOfBirth: Date | null = null;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) parsedDateOfBirth = d;
    }
    const parsedAvatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null;
    const parsedGender = typeof gender === 'string' && (gender === 'male' || gender === 'female') ? gender : null;

    if (!email || !firstName || !lastName || !phone || !String(phone).trim()) {
      fail(400, {
        error: 'Missing required fields',
        message: 'Email, prénom, nom et téléphone sont requis.'
      });
    }

    if (!isValidPhone(phone)) {
      fail(400, {
        error: 'Invalid phone',
        message: phoneError()
      });
    }

    if (!password || String(password).trim().length < 6) {
      fail(400, {
        error: 'Invalid password',
        message: 'Le mot de passe doit contenir au moins 6 caractères.'
      });
    }

    const hashedPassword = await hashPassword(String(password).trim());

    // Platform accounts are GLOBAL — never tied to a salon. A client becomes
    // associated with a salon only by booking there (appointment.tenantId),
    // so no tenant is needed at registration time.
    const normalizedEmail = email.trim().toLowerCase();

    // Check if client already exists (any salon scope)
    const existingClient = await prisma.client.findFirst({
      where: {
        email: normalizedEmail
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingClient) {
      // A real, already-confirmed account must not be silently re-registered.
      if (existingClient.password && !existingClient.verifyEmailToken) {
        fail(409, {
          error: 'Account exists',
          message: 'Un compte existe déjà avec cette adresse email. Connectez-vous.'
        });
      }

      // Unverified registration (or a guest booking row): refresh details and
      // re-issue the confirmation email.
      await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: String(phone).trim(),
          password: hashedPassword,
          ...(parsedAvatar ? { avatar: parsedAvatar } : {}),
          ...(parsedDateOfBirth ? { dateOfBirth: parsedDateOfBirth } : {}),
          ...(parsedGender ? { gender: parsedGender } : {}),
        },
      });

      await this.issueClientVerification(existingClient.id, {
        email: existingClient.email || normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      return {
        requiresEmailVerification: true,
        message: 'Un email de confirmation a été envoyé. Vérifiez votre boîte de réception pour activer votre compte.',
      };
    }

    // Create new client (global, no salon), locked until the email is confirmed.
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const client = await prisma.client.create({
      data: {
        tenantId: null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: String(phone).trim(),
        password: hashedPassword,
        avatar: parsedAvatar,
        dateOfBirth: parsedDateOfBirth,
        gender: parsedGender,
        status: 'ACTIVE',
        verifyEmailToken: hashToken(verifyToken),
        verifyEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      }
    });

    // If the confirmation email cannot be sent, roll the account back so the
    // user can retry cleanly instead of being stuck unverified.
    try {
      await this.sendVerificationEmail(
        { email: client.email, firstName: client.firstName, lastName: client.lastName },
        verifyToken
      );
    } catch (mailError) {
      await prisma.client.delete({ where: { id: client.id } });
      throw mailError;
    }

    return {
      requiresEmailVerification: true,
      message: 'Un email de confirmation a été envoyé. Vérifiez votre boîte de réception pour activer votre compte.',
    };
  }

  private async issueClientVerification(
    clientId: string,
    client: { email: string; firstName: string; lastName: string }
  ) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.sendVerificationEmail(client, token);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        verifyEmailToken: hashToken(token),
        verifyEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });
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

    // A client's status is salon-relative (a salon flags a client INACTIVE to
    // block online booking there only) — it must never lock the client out of
    // their platform account. Only email verification gates login.

    // Unverified accounts cannot log in until the confirmation link is clicked.
    if (client.verifyEmailToken) {
      fail(403, {
        error: 'Email not verified',
        message:
          'Veuillez confirmer votre adresse email. Vérifiez votre boîte de réception — un lien de confirmation vous a été envoyé.',
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

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { slugifyName } from '../../utils/slugify';
import { sendMail } from '../../utils/mailer';
import { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, SendPasswordCodeInput, ChangePasswordInput } from './auth.schema';
import { accountService } from '../account/account.service';
import * as log from '../../utils/logger';

/**
 * Base URL for links included in emails (password reset link).
 * Uses the deployed reza-pro frontend URL when available (set on Render),
 * falls back to the request's origin, then to localhost:3001.
 */
function getFrontendBaseUrl(req?: any): string {
  const envUrl = process.env.PRO_APP_URL || process.env.FRONTEND_URL;
  if (envUrl) {
    return envUrl.split(',')[0].trim().replace(/\/$/, '');
  }
  if (req && req.headers && req.headers.origin) {
    return String(req.headers.origin).replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — recommended for password resets
// Email OTP for password changes from the dashboard: shorter TTL is safer.
const PASSWORD_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — recommended for email confirmation

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

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

    // Unverified accounts cannot log in until the confirmation link is clicked.
    if (user.verifyEmailToken) {
      throw {
        status: 403,
        error: 'Email not verified',
        message:
          'Veuillez confirmer votre adresse email. Un lien de confirmation vous a été envoyé — vérifiez votre boîte de réception.'
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

      // Public URL slug (pretty, non-CUID client URLs)
      await prisma.tenant.update({
        where: { id: newTenant.id },
        data: { slug: slugifyName(newTenant.name, newTenant.id) },
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

    // New accounts are locked until the email is confirmed.
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        avatar: input.avatar || null,
        tenantId: tenantId,
        role: userRole,
        verifyEmailToken: hashToken(verifyToken),
        verifyEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
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

    // If the confirmation email cannot be sent, roll the account back so the
    // user can retry cleanly instead of being stuck unverified. Deleting the
    // tenant cascades the user, which cascades the owner account.
    try {
      await this.sendVerificationEmail(
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        verifyToken
      );
    } catch (mailError) {
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
      throw mailError;
    }

    return {
      requiresEmailVerification: true,
      message:
        'Un email de confirmation a été envoyé. Vérifiez votre boîte de réception pour activer votre compte.',
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
   * Email verification for a newly registered pro account (one-time token).
   */
  async verifyEmail(body: any) {
    const token = String(body.token || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!token || !email) {
      throw {
        status: 400,
        error: 'Invalid link',
        message: 'Lien de vérification invalide.'
      };
    }

    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        verifyEmailToken: tokenHash,
        email: { equals: email, mode: 'insensitive' }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        verifyEmailExpires: true,
        tenant: { select: { id: true, name: true, isActive: true } }
      }
    });

    if (!user) {
      throw {
        status: 400,
        error: 'Invalid token',
        message: 'Ce lien de vérification est invalide. Veuillez réessayer.'
      };
    }
    if (!user.verifyEmailExpires || user.verifyEmailExpires.getTime() < Date.now()) {
      throw {
        status: 400,
        error: 'Token expired',
        message: 'Ce lien de vérification a expiré. Veuillez demander un nouveau lien.'
      };
    }

    // Mirror the login guards: a deactivated account or organization cannot sign in.
    if (!user.isActive) {
      throw {
        status: 403,
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      };
    }
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

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyEmailToken: null, verifyEmailExpires: null }
    });

    // The confirmation link proves email ownership — issue a session immediately.
    const authToken = generateToken({
      userId: user.id,
      email: user.email,
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
      role: user.role
    });

    const accountContext = await accountService.getContextForUser(user.id);

    return {
      token: authToken,
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
      salonLimit: accountContext.salonLimit,
      message: 'Email vérifié avec succès. Vous êtes maintenant connecté.',
      emailVerified: true
    };
  }

  /**
   * Resend the verification email for an unverified pro account.
   * Always returns the same message (no account enumeration).
   */
  async resendVerificationEmail(body: any) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      throw {
        status: 400,
        error: 'Email required',
        message: 'Veuillez entrer votre adresse email.'
      };
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        verifyEmailToken: { not: null }
      },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await this.sendVerificationEmail(
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        token
      );
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verifyEmailToken: hashToken(token),
          verifyEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
        }
      });
    }

    return {
      message: 'Si un compte existe pour cette adresse, un email de confirmation a été envoyé.'
    };
  }

  private async sendVerificationEmail(
    user: { email: string; firstName?: string | null; lastName?: string | null },
    token: string
  ) {
    const base = getFrontendBaseUrl();
    const verifyUrl = `${base}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    await sendMail({
      to: user.email,
      subject: 'Confirmez votre adresse email — Reza Pro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #002366;">Confirmez votre adresse email</h2>
          <p>Bonjour ${name},</p>
          <p>Merci de vous être inscrit sur Reza Pro. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${verifyUrl}" style="background: #002366; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Confirmer mon email</a>
          </p>
          <p style="font-size: 13px; color: #666;">Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte sur Reza Pro, ignorez cet email.</p>
        </div>
      `
    });
  }

  /**
   * Forgot password: generate a reset token, store its hash on the user and
   * email a reset link. Always returns the same message whether or not the
   * email exists (no account enumeration).
   */
  async forgotPassword(input: ForgotPasswordInput, req?: any) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, firstName: true, isActive: true },
    });

    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hashToken(token),
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const resetUrl = `${getFrontendBaseUrl(req)}/reset-password?token=${token}`;
      const firstName = user.firstName || '';
      try {
        await sendMail({
          to: user.email,
          subject: 'Réinitialisation de votre mot de passe — Reza Pro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #002366;">Réinitialisation de votre mot de passe</h2>
              <p>Bonjour ${firstName},</p>
              <p>Vous avez demandé la réinitialisation de votre mot de passe Reza Pro.</p>
              <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong>30 minutes</strong>.</p>
              <p style="text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" style="background: #002366; color: #ffffff; padding: 12px 28px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
              </p>
              <p style="font-size: 13px; color: #666;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Le lien ne peut être utilisé qu'une seule fois.</p>
            </div>
          `,
        });
      } catch (mailError: any) {
        log.error('[forgotPassword] Email send failed:', mailError?.message || mailError);
        // Clear the token so a stale token is never left dangling when the mail fails
        await prisma.user.update({
          where: { id: user.id },
          data: { resetPasswordToken: null, resetPasswordExpires: null },
        });
        throw mailError;
      }
    }

    return {
      message:
        "Si un compte existe pour cette adresse email, un lien de réinitialisation a été envoyé.",
    };
  }

  /**
   * Reset password: validate the one-time token and set the new password.
   */
  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = hashToken(input.token);
    const user = await prisma.user.findFirst({
      where: { resetPasswordToken: tokenHash },
      select: { id: true, resetPasswordExpires: true },
    });

    if (!user) {
      throw {
        status: 400,
        error: 'Invalid token',
        message: 'Ce lien de réinitialisation est invalide. Veuillez refaire une demande.',
      };
    }
    if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      throw {
        status: 400,
        error: 'Token expired',
        message: 'Ce lien de réinitialisation a expiré. Veuillez refaire une demande.',
      };
    }

    const hashedPassword = await hashPassword(input.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.' };
  }

  /**
   * Change password (authenticated): step 1 — verify the current password and
   * email a 6-digit verification code to the user's address. Proves it really
   * is the account owner before any password change is possible.
   */
  async sendPasswordCode(userId: string, input: SendPasswordCodeInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, password: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw { status: 404, error: 'User not found', message: 'Utilisateur introuvable.' };
    }
    if (!user.email) {
      throw { status: 400, error: 'No email', message: 'Aucune adresse email associée à ce compte.' };
    }
    if (!user.password) {
      throw {
        status: 400,
        error: 'No password',
        message: 'Ce compte n\'a pas de mot de passe. Utilisez la réinitialisation par email.',
      };
    }

    const valid = await comparePassword(input.currentPassword, user.password);
    if (!valid) {
      throw { status: 401, error: 'Invalid password', message: 'Le mot de passe actuel est incorrect.' };
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashToken(code),
        resetPasswordExpires: new Date(Date.now() + PASSWORD_CODE_TTL_MS),
      },
    });

    const firstName = user.firstName || '';
    try {
      await sendMail({
        to: user.email,
        subject: 'Votre code de vérification — Reza Pro',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #002366;">Changement de mot de passe</h2>
            <p>Bonjour ${firstName},</p>
            <p>Vous avez demandé à changer votre mot de passe Reza Pro. Voici votre code de vérification :</p>
            <p style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 32px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #002366;">${code}</span>
            </p>
            <p style="font-size: 13px; color: #666;">Ce code expire dans <strong>10 minutes</strong>. Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
          </div>
        `,
      });
    } catch (mailError: any) {
      log.error('[sendPasswordCode] Email send failed:', mailError?.message || mailError);
      // Clear the code so a stale code is never left dangling when the mail fails
      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      });
      throw mailError;
    }

    return { message: 'Un code de vérification a été envoyé à votre adresse email.' };
  }

  /**
   * Change password (authenticated): step 2 — validate the emailed code and set
   * the new password. The code was stored hashed, so a DB leak never leaks codes.
   */
  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, resetPasswordToken: true, resetPasswordExpires: true },
    });

    if (!user) {
      throw { status: 404, error: 'User not found', message: 'Utilisateur introuvable.' };
    }

    const codeHash = hashToken(input.code.trim());
    if (!user.resetPasswordToken || user.resetPasswordToken !== codeHash) {
      throw {
        status: 400,
        error: 'Invalid code',
        message: 'Le code de vérification est invalide. Vérifiez votre email et réessayez.',
      };
    }
    if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      throw {
        status: 400,
        error: 'Code expired',
        message: 'Le code de vérification a expiré. Veuillez en demander un nouveau.',
      };
    }

    const hashedPassword = await hashPassword(input.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Votre mot de passe a été modifié avec succès.' };
  }

  /**
   * Update the authenticated user's avatar (URL already uploaded to Cloudinary).
   */
  async updateAvatar(userId: string, avatar: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar },
      select: { id: true, avatar: true },
    });
    return user;
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


}

export const authService = new AuthService();

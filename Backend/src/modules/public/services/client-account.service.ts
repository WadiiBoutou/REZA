import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { hashPassword, comparePassword } from '../../../utils/password';
import { sendMail } from '../../../utils/mailer';
import { fail } from '../utils/http';
import * as log from '../../../utils/logger';

const PASSWORD_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const hashCode = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

export class ClientAccountService {
  async updateClientProfile(email: string, body: any) {
    try {
    const { firstName, lastName, phone, address, avatar, gender } = body;

    if (!email) {
      fail(400, {
        error: 'Email required',
        message: 'Please provide an email parameter.'
      });
    }

    // Find client by email across all tenants
    const client = await prisma.client.findFirst({
      where: {
        email: decodeURIComponent(email)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!client) {
      fail(404, {
        error: 'Client not found',
        message: 'The client was not found.'
      });
    }

    // Update client information. A client email can map to SEVERAL Client rows
    // (one per salon booking) — the avatar/name must land on ALL of them so
    // every review and salon file shows the real image, not just the newest row.
    log.log('[Update Client Profile] Avatar value received:', avatar ? 'present' : 'null/undefined', typeof avatar);

    const updateData: any = {
      firstName: firstName !== undefined ? firstName.trim() : undefined,
      lastName: lastName !== undefined ? lastName.trim() : undefined,
      phone: phone !== undefined ? phone.trim() : undefined,
      address: address !== undefined ? address.trim() : undefined,
      gender: gender !== undefined ? gender : undefined,
    };

    // Handle avatar separately to ensure it's properly set
    if (avatar !== undefined) {
      updateData.avatar = avatar || null;
    }

    await prisma.client.updateMany({
      where: { email: decodeURIComponent(email) },
      data: updateData,
    });

    const updatedClient = await prisma.client.findUnique({
      where: { id: client.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        gender: true,
        avatar: true,
        tenantId: true
      } as any // Temporary cast until Prisma client is regenerated
    });
    
    // Verify avatar was saved by querying directly
    const verifyClient = await prisma.client.findUnique({
      where: { id: client.id },
      select: { avatar: true }
    });
    
    log.log('[Update Client Profile] Avatar saved:', updatedClient.avatar ? `present (length: ${updatedClient.avatar.length})` : 'null');
    log.log('[Update Client Profile] Avatar verified in DB:', verifyClient?.avatar ? `present (length: ${verifyClient.avatar.length})` : 'null');

    return {
      client: updatedClient,
      message: 'Profil mis à jour avec succès'
    };
  } catch (error) {
    throw error;
  }
  }

  /**
   * Step 1 of changing the client password: verify the current password and
   * email a one-time 6-digit code to the client's address (reza-client account).
   */
  async sendClientPasswordCode(email: string, body: any) {
    const { currentPassword } = body;

    if (!email) {
      fail(400, {
        error: 'Email required',
        message: 'Veuillez fournir votre adresse email.'
      });
    }

    if (!currentPassword) {
      fail(400, {
        error: 'Password required',
        message: 'Le mot de passe actuel est requis.'
      });
    }

    const client = await prisma.client.findFirst({
      where: { email: decodeURIComponent(email) },
      orderBy: { createdAt: 'desc' },
    });

    if (!client || !(client as any).password) {
      fail(404, {
        error: 'Client not found',
        message: 'Le client n\'a pas été trouvé.'
      });
    }

    const isValidPassword = await comparePassword(
      currentPassword,
      (client as any).password
    );
    if (!isValidPassword) {
      fail(401, {
        error: 'Invalid password',
        message: 'Le mot de passe actuel est incorrect.'
      });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await prisma.client.update({
      where: { id: client.id },
      data: {
        resetPasswordToken: hashCode(code),
        resetPasswordExpires: new Date(Date.now() + PASSWORD_CODE_TTL_MS),
      },
    });

    const name = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    try {
      await sendMail({
        to: client.email!,
        subject: 'Votre code de vérification — Reza',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #002366;">Changement de mot de passe</h2>
            <p>Bonjour ${name},</p>
            <p>Vous avez demandé à changer votre mot de passe Reza. Voici votre code de vérification :</p>
            <p style="text-align: center; margin: 28px 0;">
              <span style="display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 32px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #002366;">${code}</span>
            </p>
            <p style="font-size: 13px; color: #666;">Ce code expire dans <strong>10 minutes</strong>. Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
          </div>
        `,
      });
    } catch (mailError: any) {
      log.error('[Change Password] Code email send failed:', mailError?.message || mailError);
      await prisma.client.update({
        where: { id: client.id },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      });
      throw mailError;
    }

    return { message: 'Un code de vérification a été envoyé à votre adresse email.' };
  }

  async changeClientPassword(email: string, body: any) {
    try {
    const { code, newPassword } = body;

    log.log('[Change Password] Request received for email:', email);

    if (!email) {
      fail(400, {
        error: 'Email required',
        message: 'Please provide an email parameter.'
      });
    }

    if (!code || !newPassword) {
      fail(400, {
        error: 'Code and password required',
        message: 'Le code de vérification et le nouveau mot de passe sont requis.'
      });
    }

    if (newPassword.length < 8) {
      fail(400, {
        error: 'Invalid password',
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
      });
    }

    // Find client by email across all tenants
    const client = await prisma.client.findFirst({
      where: {
        email: decodeURIComponent(email)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!client) {
      log.log('[Change Password] Client not found for email:', email);
      fail(404, {
        error: 'Client not found',
        message: 'Le client n\'a pas été trouvé.'
      });
    }

    log.log('[Change Password] Client found:', client.id);

    // Verify the emailed code (stored hashed — never compare plaintext).
    if ((client as any).resetPasswordToken !== hashCode(code.trim())) {
      fail(400, {
        error: 'Invalid code',
        message: 'Le code de vérification est invalide. Vérifiez votre email et réessayez.'
      });
    }
    if (!(client as any).resetPasswordExpires || new Date((client as any).resetPasswordExpires).getTime() < Date.now()) {
      fail(400, {
        error: 'Code expired',
        message: 'Le code de vérification a expiré. Veuillez en demander un nouveau.'
      });
    }

    // Hash the new password
    log.log('[Change Password] Hashing new password...');
    const hashedPassword = await hashPassword(newPassword);
    log.log('[Change Password] Password hashed successfully');

    // Update client password using raw query to ensure it works even if Prisma client is not updated
    log.log('[Change Password] Updating password in database...');
    let updateSuccess = false;
    
    try {
      // Try using Prisma update first
      await prisma.client.update({
        where: { id: client.id },
        data: {
          password: hashedPassword
        } as any
      });
      log.log('[Change Password] Password updated via Prisma');
      updateSuccess = true;
    } catch (prismaError: any) {
      // If Prisma fails (field not recognized), use raw SQL
      if (prismaError.message && prismaError.message.includes('Unknown arg `password`')) {
        log.log('[Change Password] Prisma client not updated, using raw SQL...');
        await prisma.$executeRaw`
          UPDATE "clients" 
          SET "password" = ${hashedPassword}
          WHERE "id" = ${client.id}
        `;
        log.log('[Change Password] Password updated via raw SQL');
        updateSuccess = true;
      } else {
        log.error('[Change Password] Prisma error:', prismaError);
        throw prismaError;
      }
    }

    if (!updateSuccess) {
      fail(500, {
        error: 'Update failed',
        message: 'Impossible de mettre à jour le mot de passe. Veuillez réessayer.'
      });
    }

    // Verify the password was saved using raw query
    log.log('[Change Password] Verifying password was saved...');
    const verifyResult = await prisma.$queryRaw<Array<{ password: string | null }>>`
      SELECT "password" FROM "clients" WHERE "id" = ${client.id}
    `;

    if (verifyResult && verifyResult[0] && verifyResult[0].password) {
      log.log('[Change Password] Password verified in database - saved successfully');
    } else {
      log.error('[Change Password] WARNING: Password was not saved correctly!');
      fail(500, {
        error: 'Database error',
        message: 'Le mot de passe n\'a pas pu être sauvegardé. Veuillez réessayer.'
      });
    }

    return {
      message: 'Mot de passe modifié avec succès'
    };
  } catch (error: any) {
    log.error('[Change Password] Error:', error);
    // Check if it's a Prisma error about missing field
    if (error.message && error.message.includes('Unknown arg `password`')) {
      fail(500, {
        error: 'Database schema error',
        message: 'Le champ password n\'existe pas dans la base de données. Veuillez exécuter la migration Prisma.'
      });
    }
    throw error;
  }
  }

}

export const clientAccountService = new ClientAccountService();

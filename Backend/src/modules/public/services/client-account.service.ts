import { prisma } from '../../../lib/prisma';
import { hashPassword, comparePassword } from '../../../utils/password';
import { fail } from '../utils/http';
import * as log from '../../../utils/logger';

export class ClientAccountService {
  async updateClientProfile(email: string, body: any) {
    try {
    const { firstName, lastName, phone, address, avatar } = body;

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

  async changeClientPassword(email: string, body: any) {
    try {
    const { currentPassword, newPassword } = body;

    log.log('[Change Password] Request received for email:', email);

    if (!email) {
      fail(400, {
        error: 'Email required',
        message: 'Please provide an email parameter.'
      });
    }

    if (!currentPassword || !newPassword) {
      fail(400, {
        error: 'Password required',
        message: 'Le mot de passe actuel et le nouveau mot de passe sont requis.'
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

    // Get client with password field
    const clientWithPassword = await prisma.client.findUnique({
      where: { id: client.id }
    });

    // If client has a password, verify the current password
    if (clientWithPassword && (clientWithPassword as any).password) {
      log.log('[Change Password] Client has existing password, verifying...');
      const isValidPassword = await comparePassword(
        currentPassword,
        (clientWithPassword as any).password
      );

      if (!isValidPassword) {
        log.log('[Change Password] Current password is incorrect');
        fail(401, {
          error: 'Invalid password',
          message: 'Le mot de passe actuel est incorrect.'
        });
      }
      log.log('[Change Password] Current password verified');
    } else {
      log.log('[Change Password] No existing password, setting new password');
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

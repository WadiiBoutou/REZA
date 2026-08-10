import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import {
  createPublicFamilyMemberSchema,
  updatePublicFamilyMemberSchema,
} from '../schemas/public.schema';
import { fail } from '../utils/http';

/**
 * Same email can have many Client rows (one per salon booking).
 * Proches must stick to the platform account — not the latest booking stub.
 */
function normalizeEmail(email: string) {
  return decodeURIComponent(email).trim().toLowerCase();
}

async function findClientsByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.client.findMany({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
}

/** Prefer password-bearing account; else oldest row. */
async function resolveAccountClient(email: string) {
  const clients = await findClientsByEmail(email);
  if (clients.length === 0) return null;
  return clients.find((c) => !!c.password) ?? clients[0];
}

export class FamilyMembersService {
  async getFamilyMembers(email: string) {
    try {
      if (!email) {
        fail(400, {
          error: 'Email required',
          message: 'Please provide an email parameter.',
        });
      }

      const clients = await findClientsByEmail(email);
      if (clients.length === 0) {
        return { familyMembers: [] };
      }

      const clientIds = clients.map((c) => c.id);
      const accountClient = clients.find((c) => !!c.password) ?? clients[0];

      const familyMembers = await prisma.familyMember.findMany({
        where: { clientId: { in: clientIds } },
        orderBy: { createdAt: 'desc' },
      });

      // Re-home proches from booking stubs onto the account client
      const orphaned = familyMembers.filter((fm) => fm.clientId !== accountClient.id);
      if (orphaned.length > 0) {
        await prisma.familyMember.updateMany({
          where: { id: { in: orphaned.map((fm) => fm.id) } },
          data: { clientId: accountClient.id },
        });
        return {
          familyMembers: await prisma.familyMember.findMany({
            where: { clientId: accountClient.id },
            orderBy: { createdAt: 'desc' },
          }),
        };
      }

      return { familyMembers };
    } catch (error) {
      throw error;
    }
  }

  async createFamilyMember(body: unknown) {
    try {
      const data = createPublicFamilyMemberSchema.parse(body);
      const { clientEmail, ...familyMemberData } = data;

      let client = await resolveAccountClient(clientEmail);

      if (!client) {
        // Create a GLOBAL client — family members are client-owned, never
        // salon-owned, so no tenant is needed here.
        const nameParts = clientEmail.split('@')[0].split('.');
        try {
          client = await prisma.client.create({
            data: {
              tenantId: null,
              firstName: nameParts[0] || 'User',
              lastName: nameParts.slice(1).join(' ') || '',
              email: normalizeEmail(clientEmail),
              phone: '',
              status: 'ACTIVE',
            },
          });
        } catch {
          client = await resolveAccountClient(clientEmail);
          if (!client) {
            fail(500, {
              error: 'Failed to create client',
              message: 'Unable to create your account. Please try again or contact support.',
            });
          }
        }
      }

      const familyMember = await prisma.familyMember.create({
        data: {
          clientId: client!.id,
          firstName: familyMemberData.firstName,
          lastName: familyMemberData.lastName || '',
          email: familyMemberData.email || null,
          phone: familyMemberData.phone || null,
          relationship: familyMemberData.relationship,
          avatar: familyMemberData.avatar || null,
        },
      });

      fail(201, { familyMember });
    } catch (error) {
      if (error instanceof z.ZodError) {
        fail(400, {
          error: 'Validation error',
          message: error.errors[0].message,
        });
      }
      throw error;
    }
  }

  async updateFamilyMember(id: string, body: unknown) {
    try {
      const data = updatePublicFamilyMemberSchema.parse(body);
      const { clientEmail } = data;

      if (!clientEmail) {
        fail(400, {
          error: 'Client email required',
          message: 'Please provide clientEmail in the request body.',
        });
      }

      const clients = await findClientsByEmail(clientEmail);
      if (clients.length === 0) {
        fail(404, {
          error: 'Client not found',
          message: 'The client was not found.',
        });
      }

      const existingMember = await prisma.familyMember.findFirst({
        where: {
          id,
          clientId: { in: clients.map((c) => c.id) },
        },
      });

      if (!existingMember) {
        fail(404, {
          error: 'Family member not found',
          message: 'The family member was not found or does not belong to this client.',
        });
      }

      const accountClient = clients.find((c) => !!c.password) ?? clients[0];
      const familyMemberUpdateData: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName !== undefined ? data.lastName || '' : undefined,
        email: data.email !== undefined ? data.email || null : undefined,
        phone: data.phone !== undefined ? data.phone || null : undefined,
        relationship: data.relationship,
        // Keep proches on account client
        clientId: accountClient.id,
      };

      if (data.avatar !== undefined) {
        familyMemberUpdateData.avatar = data.avatar || null;
      }

      const familyMember = await prisma.familyMember.update({
        where: { id },
        data: familyMemberUpdateData,
      });

      return { familyMember };
    } catch (error) {
      if (error instanceof z.ZodError) {
        fail(400, {
          error: 'Validation error',
          message: error.errors[0].message,
        });
      }
      throw error;
    }
  }

  async deleteFamilyMember(id: string, query: Record<string, unknown>) {
    try {
      const { clientEmail } = query;

      if (!clientEmail) {
        fail(400, {
          error: 'Client email required',
          message: 'Please provide clientEmail as a query parameter.',
        });
      }

      const clients = await findClientsByEmail(clientEmail as string);
      if (clients.length === 0) {
        fail(404, {
          error: 'Client not found',
          message: 'The client was not found.',
        });
      }

      const existingMember = await prisma.familyMember.findFirst({
        where: {
          id,
          clientId: { in: clients.map((c) => c.id) },
        },
      });

      if (!existingMember) {
        fail(404, {
          error: 'Family member not found',
          message: 'The family member was not found or does not belong to this client.',
        });
      }

      await prisma.familyMember.delete({ where: { id } });

      return { message: 'Family member deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}

export const familyMembersService = new FamilyMembersService();

import { prisma } from '../../lib/prisma';

export class FamilyMemberService {
  async getFamilyMembers(tenantId: string, userEmail: string) {
    // Global lookup: platform client accounts are not tied to a salon.
    const client = await prisma.client.findFirst({
      where: {
        email: userEmail
      }
    });

    if (!client) {
      return [];
    }

    const familyMembers = await (prisma as any).familyMember.findMany({
      where: {
        clientId: client.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return familyMembers;
  }

  async createFamilyMember(tenantId: string, userEmail: string, data: any) {
    let client = await prisma.client.findFirst({
      where: {
        email: userEmail
      }
    });

    if (!client) {
      const emailParts = userEmail.split('@')[0].split('.');
      // Global fallback row (tenantId null) — never tie a platform account to a salon.
      client = await prisma.client.create({
        data: {
          firstName: emailParts[0] || 'User',
          lastName: emailParts.slice(1).join(' ') || '',
          email: userEmail,
          phone: '',
          status: 'ACTIVE'
        }
      });
    }

    const familyMember = await (prisma as any).familyMember.create({
      data: {
        clientId: client.id,
        firstName: data.firstName,
        lastName: data.lastName || '',
        email: data.email || null,
        phone: data.phone || null,
        relationship: data.relationship,
        avatar: data.avatar || null
      }
    });

    return familyMember;
  }

  async updateFamilyMember(tenantId: string, userEmail: string, id: string, data: any) {
    const client = await prisma.client.findFirst({
      where: {
        email: userEmail
      }
    });

    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    const existingMember = await (prisma as any).familyMember.findFirst({
      where: {
        id,
        clientId: client.id
      }
    });

    if (!existingMember) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    const familyMember = await (prisma as any).familyMember.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName !== undefined ? (data.lastName || '') : undefined,
        email: data.email !== undefined ? (data.email || null) : undefined,
        phone: data.phone !== undefined ? (data.phone || null) : undefined,
        relationship: data.relationship,
        avatar: data.avatar !== undefined ? (data.avatar || null) : undefined
      }
    });

    return familyMember;
  }

  async deleteFamilyMember(tenantId: string, userEmail: string, id: string) {
    const client = await prisma.client.findFirst({
      where: {
        email: userEmail
      }
    });

    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    const existingMember = await (prisma as any).familyMember.findFirst({
      where: {
        id,
        clientId: client.id
      }
    });

    if (!existingMember) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    await (prisma as any).familyMember.delete({
      where: { id }
    });
  }
}

export const familyMemberService = new FamilyMemberService();

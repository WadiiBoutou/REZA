import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';

export class ClientService {
  async getClients(tenantIds: string | string[], search?: string, status?: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const take = limit;
    // Salon membership = created by the salon OR has an appointment there
    // (global client accounts become "the salon's" clients once they book).
    const where: any = { ...salonClientsFilter(tenantIds) };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } }
          ]
        }
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              // Visit count scoped to this salon only
              appointments: { where: { tenantId: tenantIdFilter(tenantIds) } }
            }
          }
        }
      }),
      prisma.client.count({ where })
    ]);

    return {
      clients,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  async detectDuplicates(tenantIds: string | string[]) {
    const allClients = await prisma.client.findMany({
      where: salonClientsFilter(tenantIds),
      orderBy: { createdAt: 'desc' }
    });

    const duplicateGroups: any[] = [];
    const processed = new Set<string>();

    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

    const isSimilarName = (name1: string, name2: string) => {
      const n1 = normalize(name1);
      const n2 = normalize(name2);
      if (n1 === n2) return true;
      
      const parts1 = n1.split(' ').filter(p => p.length > 1);
      const parts2 = n2.split(' ').filter(p => p.length > 1);
      
      if (parts1.length >= 2 && parts2.length >= 2) {
        const firstLetters1 = parts1.map(p => p[0]).join('');
        const firstLetters2 = parts2.map(p => p[0]).join('');
        if (firstLetters1 === firstLetters2 && Math.abs(parts1.length - parts2.length) <= 1) {
          return true;
        }
      }
      
      const words1 = new Set(n1.split(' '));
      const words2 = new Set(n2.split(' '));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      const similarity = intersection / union;
      
      return similarity >= 0.7;
    };

    for (let i = 0; i < allClients.length; i++) {
      if (processed.has(allClients[i].id)) continue;

      const client = allClients[i];
      const duplicates: any[] = [];

      for (let j = i + 1; j < allClients.length; j++) {
        if (processed.has(allClients[j].id)) continue;

        const otherClient = allClients[j];
        let isDuplicate = false;
        let reason = '';

        if (client.email && otherClient.email && normalize(client.email) === normalize(otherClient.email)) {
          isDuplicate = true;
          reason = 'Email identique';
        }
        
        if (!isDuplicate && client.phone && otherClient.phone) {
          const phone1 = client.phone.replace(/\s|-|\(|\)/g, '');
          const phone2 = otherClient.phone.replace(/\s|-|\(|\)/g, '');
          if (phone1 === phone2) {
            isDuplicate = true;
            reason = 'Téléphone identique';
          }
        }

        if (!isDuplicate) {
          const fullName1 = `${client.firstName} ${client.lastName}`;
          const fullName2 = `${otherClient.firstName} ${otherClient.lastName}`;
          if (isSimilarName(fullName1, fullName2)) {
            const emailMatch = client.email && otherClient.email && normalize(client.email) === normalize(otherClient.email);
            const phoneMatch = client.phone && otherClient.phone && client.phone.replace(/\s|-|\(|\)/g, '') === otherClient.phone.replace(/\s|-|\(|\)/g, '');
            
            if (emailMatch || phoneMatch) {
              isDuplicate = true;
              reason = emailMatch && phoneMatch ? 'Nom, email et téléphone similaires' :
                      emailMatch ? 'Nom et email similaires' : 'Nom et téléphone similaires';
            }
          }
        }

        if (isDuplicate) {
          duplicates.push({ ...otherClient, reason });
          processed.add(otherClient.id);
        }
      }

      if (duplicates.length > 0) {
        duplicateGroups.push({ ...client, duplicates });
        processed.add(client.id);
      }
    }

    return duplicateGroups;
  }

  async getClientById(tenantIds: string | string[], id: string) {
    const filter = tenantIdFilter(tenantIds);
    return prisma.client.findFirst({
      where: { id, ...salonClientsFilter(tenantIds) },
      include: {
        appointments: {
          where: { tenantId: filter },
          take: 10,
          orderBy: { startTime: 'desc' },
          include: {
            service: true,
            employee: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        reviews: {
          where: { tenantId: filter },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            appointments: { where: { tenantId: filter } },
            reviews: { where: { tenantId: filter } },
            invoices: { where: { tenantId: filter } }
          }
        }
      }
    });
  }

  async createClient(tenantId: string, data: any) {
    if (data.email) {
      // Global duplicate check: one person = one row. A salon must not re-create
      // a client who already has a platform account (tenantId null) or who booked
      // at another salon — they become "this salon's" client via their appointment.
      const existing = await prisma.client.findFirst({
        where: { email: data.email }
      });
      if (existing) {
        throw new Error('DUPLICATE_EMAIL');
      }
    }

    return prisma.client.create({
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        tenantId
      } as any
    });
  }

  async updateClient(tenantIds: string | string[], id: string, data: any) {
    const existing = await prisma.client.findFirst({
      where: { id, ...salonClientsFilter(tenantIds) }
    });

    if (!existing) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    return prisma.client.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined
      }
    });
  }

  async deleteClient(tenantIds: string | string[], id: string) {
    const client = await prisma.client.findFirst({
      where: { id, ...salonClientsFilter(tenantIds) }
    });

    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    await prisma.client.delete({
      where: { id }
    });
  }

  async mergeClients(
    tenantIds: string | string[],
    primaryClientId: string,
    duplicateClientIds: string[],
    fieldValues?: Record<string, any>
  ) {
    const filter = tenantIdFilter(tenantIds);
    const primaryClient = await prisma.client.findFirst({
      where: { id: primaryClientId, ...salonClientsFilter(tenantIds) }
    });

    if (!primaryClient) {
      throw new Error('PRIMARY_CLIENT_NOT_FOUND');
    }

    const duplicateClients = await prisma.client.findMany({
      where: { id: { in: duplicateClientIds }, ...salonClientsFilter(tenantIds) }
    });

    if (duplicateClients.length !== duplicateClientIds.length) {
      throw new Error('DUPLICATE_CLIENT_NOT_FOUND');
    }

    await prisma.$transaction(async (tx) => {
      const allNotes = [
        primaryClient.notes || '',
        ...duplicateClients.map(c => c.notes || '').filter(n => n)
      ].filter(n => n);
      const mergedNotes = allNotes.join('\n\n---\n\n');

      const mergedData: any = {};
      
      if (!primaryClient.email) {
        const emailFromDuplicate = duplicateClients.find(c => c.email);
        if (emailFromDuplicate?.email) mergedData.email = emailFromDuplicate.email;
      }

      if (!primaryClient.address) {
        const addressFromDuplicate = duplicateClients.find(c => c.address);
        if (addressFromDuplicate?.address) mergedData.address = addressFromDuplicate.address;
      }

      if (mergedNotes) {
        mergedData.notes = mergedNotes;
      }

      if (primaryClient.status === 'INACTIVE') {
        const hasActive = duplicateClients.some(c => c.status === 'ACTIVE');
        if (hasActive) mergedData.status = 'ACTIVE';
      }

      // Admin field-by-field selections win over everything — but only for
      // real client profile fields. Never allow id/tenantId/timestamps to be
      // overwritten from a request body.
      const MERGE_FIELD_WHITELIST = [
        'firstName', 'lastName', 'email', 'phone', 'address', 'avatar',
        'dateOfBirth', 'notes', 'status', 'password'
      ];
      if (fieldValues && typeof fieldValues === 'object') {
        for (const key of MERGE_FIELD_WHITELIST) {
          const value = (fieldValues as any)[key];
          if (value !== undefined && value !== null && value !== '') {
            mergedData[key] = value;
          }
        }
      }

      if (Object.keys(mergedData).length > 0) {
        await tx.client.update({
          where: { id: primaryClientId },
          data: mergedData
        });
      }

      // Repoint EVERY clientId foreign key to the surviving record before deleting,
      // otherwise these children get cascade-deleted (familyMembers, favorites) or
      // orphaned to NULL (bookingParticipants, bookingGroups booker) with the duplicate.
      // The salon scope (filter) drives the repoint — a global primary client has
      // tenantId null, but its children carry the salon's tenantId.
      await tx.appointment.updateMany({
        where: { clientId: { in: duplicateClientIds }, tenantId: filter },
        data: { clientId: primaryClientId }
      });

      await tx.invoice.updateMany({
        where: { clientId: { in: duplicateClientIds }, tenantId: filter },
        data: { clientId: primaryClientId }
      });

      await tx.review.updateMany({
        where: { clientId: { in: duplicateClientIds }, tenantId: filter },
        data: { clientId: primaryClientId }
      });

      // BookingParticipant has no tenantId column; duplicates were validated within the salon scope.
      await tx.bookingParticipant.updateMany({
        where: { clientId: { in: duplicateClientIds } },
        data: { clientId: primaryClientId }
      });

      await tx.bookingGroup.updateMany({
        where: { bookerClientId: { in: duplicateClientIds }, tenantId: filter },
        data: { bookerClientId: primaryClientId }
      });

      // FamilyMember has no tenantId column; duplicates were validated within the salon scope.
      await tx.familyMember.updateMany({
        where: { clientId: { in: duplicateClientIds } },
        data: { clientId: primaryClientId }
      });

      await tx.favorite.updateMany({
        where: { clientId: { in: duplicateClientIds }, tenantId: filter },
        data: { clientId: primaryClientId }
      });

      await tx.client.deleteMany({
        where: { id: { in: duplicateClientIds }, ...salonClientsFilter(tenantIds) }
      });
    });
  }
}

export const clientService = new ClientService();

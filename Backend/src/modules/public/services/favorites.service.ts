import { prisma } from '../../../lib/prisma';
import { HttpError } from '../../../lib/errors';

export class FavoritesService {
  async getClientFavorites(email: string) {
    try {

    if (!email) {
      throw new HttpError(400, {
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
      return { favorites: [], count: 0 };
    }

    const favorites = await (prisma as any).favorite.findMany({
      where: {
        clientId: client.id
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            logo: true,
            coverImage: true,
            address: true,
            city: true,
            category: true,
            shortDescription: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { 
      favorites: favorites.map((f: any) => ({
        id: f.id,
        tenantId: f.tenantId,
        tenant: f.tenant,
        createdAt: f.createdAt
      })),
      count: favorites.length
    };
  } catch (error) {
    throw error;
  }
  }

  async addFavorite(body: any) {
    try {
    const { clientEmail, tenantId } = body;

    if (!clientEmail || !tenantId) {
      throw new HttpError(400, {
        error: 'Missing required fields',
        message: 'clientEmail and tenantId are required.'
      });
    }

    // Find client by email
    let client = await prisma.client.findFirst({
      where: {
        email: clientEmail.trim().toLowerCase()
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!client) {
      // Create a GLOBAL client — never tied to a salon. Favorites are linked
      // to the salons via the Favorite row (tenantId) independently.
      const nameParts = clientEmail.split('@')[0].split('.');
      client = await prisma.client.create({
        data: {
          tenantId: null,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || '',
          email: clientEmail.trim().toLowerCase(),
          phone: '',
          status: 'ACTIVE'
        }
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      }
    });

    if (!tenant) {
      throw new HttpError(404, {
        error: 'Tenant not found',
        message: 'The requested salon was not found.'
      });
    }

    // Check if favorite already exists
    const existingFavorite = await (prisma as any).favorite.findUnique({
      where: {
        clientId_tenantId: {
          clientId: client.id,
          tenantId: tenant.id
        }
      }
    });

    if (existingFavorite) {
      return {
        favorite: existingFavorite,
        message: 'Already in favorites'
      };
    }

    // Create favorite
    const favorite = await (prisma as any).favorite.create({
      data: {
        clientId: client.id,
        tenantId: tenant.id
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            logo: true,
            coverImage: true,
            address: true,
            city: true,
            category: true,
            shortDescription: true
          }
        }
      }
    });

    throw new HttpError(201, {
      favorite: {
        id: favorite.id,
        tenantId: favorite.tenantId,
        tenant: favorite.tenant,
        createdAt: favorite.createdAt
      },
      message: 'Added to favorites'
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Unique constraint violation - already favorited
      return {
        message: 'Already in favorites'
      };
    }
    throw error;
  }
  }

  async removeFavorite(id: string, query: Record<string, unknown>) {
    try {
    const { clientEmail } = query;

    if (!clientEmail) {
      throw new HttpError(400, {
        error: 'Client email required',
        message: 'Please provide clientEmail as a query parameter.'
      });
    }

    // Find client by email
    const client = await prisma.client.findFirst({
      where: {
        email: decodeURIComponent(clientEmail as string)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!client) {
      throw new HttpError(404, {
        error: 'Client not found',
        message: 'The client was not found.'
      });
    }

    // Verify favorite belongs to this client
    const favorite = await (prisma as any).favorite.findFirst({
      where: {
        id,
        clientId: client.id
      }
    });

    if (!favorite) {
      throw new HttpError(404, {
        error: 'Favorite not found',
        message: 'The favorite was not found or does not belong to this client.'
      });
    }

    await (prisma as any).favorite.delete({
      where: { id }
    });

    return { message: 'Favorite removed successfully' };
  } catch (error) {
    throw error;
  }
  }

}

export const favoritesService = new FavoritesService();

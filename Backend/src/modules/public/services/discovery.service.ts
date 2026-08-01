import { prisma } from '../../../lib/prisma';
import { calculateBusinessStatus } from '../utils/businessStatus';
import { transformImageUrl } from '../../../utils/imageUrl';
import { fail } from '../utils/http';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class DiscoveryService {
  async getTenantByIdentifier(identifier: string) {
    try {

    // Try to find tenant by subdomain, domain, or ID
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: identifier },
          { domain: identifier },
          { id: identifier }
        ],
        isActive: true,
        subscriptionActive: true
      },
      include: {
        settings: true
      }
    });

    if (!tenant) {
      fail(404, {
        error: 'Tenant not found',
        message: 'The requested salon or establishment was not found.'
      });
    }

    // Get services with prices for price calculation
    const services = await prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        visibility: { in: ['BOOKABLE', 'VISIBLE'] }
      },
      select: {
        name: true,
        category: true,
        price: true,
        priceType: true,
        priceFrom: true,
        priceTo: true
      }
    });

    // Calculate price range from services
    const servicePrices = services
      .map(s => {
        if (s.price) return s.price;
        if (s.priceType === 'FROM' && s.priceFrom) return s.priceFrom;
        if (s.priceType === 'RANGE' && s.priceFrom) return s.priceFrom;
        return null;
      })
      .filter((p): p is number => p !== null);

    const minPrice = servicePrices.length > 0 ? Math.min(...servicePrices) : null;
    const maxPrice = servicePrices.length > 0 ? Math.max(...servicePrices) : null;
    const avgPrice = servicePrices.length > 0 
      ? servicePrices.reduce((a, b) => a + b, 0) / servicePrices.length 
      : null;

    // Calculate current status based on business hours
    const now = new Date();
    const businessHours = tenant.settings?.businessHours as any || {};
    const nextAvailable = calculateBusinessStatus(businessHours, now);

    // Format price display
    let priceDisplay: string | null = null;
    if (minPrice !== null && maxPrice !== null) {
      if (minPrice === maxPrice) {
        priceDisplay = `${Math.round(minPrice)} MAD`;
      } else {
        priceDisplay = `${Math.round(minPrice)}-${Math.round(maxPrice)} MAD`;
      }
    } else if (minPrice !== null) {
      priceDisplay = `À partir de ${Math.round(minPrice)} MAD`;
    }

    // Transform business hours from schedules array to day-keyed object format
    const schedules = businessHours.schedules || [];
    
    // Map French day names to lowercase keys
    const dayNameMap: { [key: string]: string } = {
      'Lundi': 'lundi',
      'Mardi': 'mardi',
      'Mercredi': 'mercredi',
      'Jeudi': 'jeudi',
      'Vendredi': 'vendredi',
      'Samedi': 'samedi',
      'Dimanche': 'dimanche'
    };

    // Convert schedules array to day-keyed object
    const formattedBusinessHours: any = {};
    schedules.forEach((schedule: any) => {
      if (schedule.isOpen && schedule.openTime && schedule.closeTime) {
        const dayKey = dayNameMap[schedule.day];
        if (dayKey) {
          formattedBusinessHours[dayKey] = {
            open: schedule.openTime,
            close: schedule.closeTime
          };
        }
      }
    });

    // Preserve top-level booking configuration that the frontend calendar needs
    // to preemptively grey out days within min lead time or explicitly blocked dates.
    if ((businessHours as any)?.bookingDelay) {
      formattedBusinessHours.bookingDelay = (businessHours as any).bookingDelay;
    }
    if ((businessHours as any)?.blockedDates) {
      formattedBusinessHours.blockedDates = (businessHours as any).blockedDates;
    }

    // Transform photos array if it exists
    const photos = tenant.settings?.photos;
    const photosArray = Array.isArray(photos) ? photos : [];
    const transformedPhotos = photosArray.map((photo: string) => transformImageUrl(photo));
    
    // Return public tenant information only
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        domain: tenant.domain,
        email: tenant.email,
        phone: tenant.phone,
        address: tenant.address,
        logo: transformImageUrl(tenant.logo),
        category: tenant.category,
        coverImage: transformImageUrl(tenant.coverImage),
        shortDescription: tenant.shortDescription,
        website: tenant.website,
        city: tenant.city,
        googleMapsLink: tenant.googleMapsLink,
        coordinates:
          tenant.latitude != null && tenant.longitude != null
            ? { lat: tenant.latitude, lng: tenant.longitude }
            : null,
        tags: tenant.tags || [],
        price: priceDisplay,
        priceRange: minPrice !== null && maxPrice !== null ? { min: minPrice, max: maxPrice, avg: avgPrice } : null,
        nextAvailable: nextAvailable,
        settings: {
          description: (() => {
            // Filter out onboarding JSON data from description
            const desc = tenant.settings?.description;
            if (!desc || typeof desc !== 'string') return null;
            
            // Check if it's a JSON string (onboarding data)
            try {
              const parsed = JSON.parse(desc);
              // If it's an object with onboarding fields, it's not a real description
              if (parsed && typeof parsed === 'object' && (parsed.businessType !== undefined || parsed.onboardingCompleted !== undefined)) {
                return null; // Don't return onboarding data as description
              }
            } catch (e) {
              // Not JSON, continue
            }
            
            // Return the description if it's a valid string
            return desc.trim() !== '' ? desc : null;
          })(),
          businessHours: formattedBusinessHours,
          photos: transformedPhotos,
          socialMedia: tenant.settings?.socialMedia || {},
          amenities: tenant.settings?.amenities || [],
        onlineReservationEnabled: tenant.settings?.onlineReservationEnabled !== false,
          showMap: tenant.settings?.showMap !== false,
          showOpeningHours: tenant.settings?.showOpeningHours !== false,
          showReviews: tenant.settings?.showReviews !== false,
          bookingAdvanceDays: tenant.settings?.bookingAdvanceDays ?? 30,
        }
      }
    };
  } catch (error) {
    throw error;
  }
  }

  async searchTenants(query: Record<string, unknown>) {
    try {
    const { search, category, city, limit = '50', lat, lng, radiusKm } = query;
    const take = parseInt(limit as string);
    const userLat = lat != null ? parseFloat(String(lat)) : null;
    const userLng = lng != null ? parseFloat(String(lng)) : null;
    const radius = radiusKm != null ? parseFloat(String(radiusKm)) : null;

    const where: any = {
      isActive: true,
      // subscriptionActive filter removed — show all active tenants regardless of subscription
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { subdomain: { contains: search as string, mode: 'insensitive' } },
        { shortDescription: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } }
      ];
    }
    
    if (category) {
      where.category = category as string;
    }

    if (city) {
      where.city = { contains: city as string, mode: 'insensitive' };
    }

    const tenants = await prisma.tenant.findMany({
      where,
      take: userLat != null && userLng != null ? take * 3 : take,
      orderBy: { name: 'asc' },
      include: {
        settings: true,
        _count: {
          select: {
            reviews: true
          }
        }
      }
    });

    // Get reviews stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const reviewStats = await prisma.review.aggregate({
          where: {
            tenantId: tenant.id,
            status: 'APPROVED'
          },
          _avg: {
            rating: true
          },
          _count: {
            rating: true
          }
        });

        // Get first few services for display with prices
        const services = await prisma.service.findMany({
          where: {
            tenantId: tenant.id,
            visibility: { in: ['BOOKABLE', 'VISIBLE'] }
          },
          take: 3,
          select: {
            name: true,
            category: true,
            price: true,
            priceType: true,
            priceFrom: true,
            priceTo: true
          }
        });

        // Calculate price range from services
        const servicePrices = services
          .map(s => {
            if (s.price) return s.price;
            if (s.priceType === 'FROM' && s.priceFrom) return s.priceFrom;
            if (s.priceType === 'RANGE' && s.priceFrom) return s.priceFrom;
            return null;
          })
          .filter((p): p is number => p !== null);

        const minPrice = servicePrices.length > 0 ? Math.min(...servicePrices) : null;
        const maxPrice = servicePrices.length > 0 ? Math.max(...servicePrices) : null;
        const avgPrice = servicePrices.length > 0 
          ? servicePrices.reduce((a, b) => a + b, 0) / servicePrices.length 
          : null;

        // Calculate current status based on business hours
        const now = new Date();
        const businessHours = tenant.settings?.businessHours as any || {};
        const nextAvailable = calculateBusinessStatus(businessHours, now);

        // Format price display
        let priceDisplay: string | null = null;
        if (minPrice !== null && maxPrice !== null) {
          if (minPrice === maxPrice) {
            priceDisplay = `${Math.round(minPrice)} MAD`;
          } else {
            priceDisplay = `${Math.round(minPrice)}-${Math.round(maxPrice)} MAD`;
          }
        } else if (minPrice !== null) {
          priceDisplay = `À partir de ${Math.round(minPrice)} MAD`;
        }

        return {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          domain: tenant.domain,
          email: tenant.email,
          phone: tenant.phone,
          address: tenant.address,
          logo: transformImageUrl(tenant.logo),
          category: tenant.category || (tenant.settings as any)?.category || 'Établissement',
          coverImage: transformImageUrl(tenant.coverImage),
          shortDescription: tenant.shortDescription,
          website: tenant.website,
          city: tenant.city,
          googleMapsLink: tenant.googleMapsLink,
          tags: tenant.tags || [],
          rating: reviewStats._avg.rating || 0,
          reviews: reviewStats._count.rating || 0,
          services: services.map(s => s.name),
          price: priceDisplay,
          priceRange: minPrice !== null && maxPrice !== null ? { min: minPrice, max: maxPrice, avg: avgPrice } : null,
          nextAvailable: nextAvailable,
          coordinates:
            tenant.latitude != null && tenant.longitude != null
              ? { lat: tenant.latitude, lng: tenant.longitude }
              : null,
          distanceKm:
            userLat != null &&
            userLng != null &&
            tenant.latitude != null &&
            tenant.longitude != null
              ? Math.round(
                  haversineKm(userLat, userLng, tenant.latitude, tenant.longitude) * 10
                ) / 10
              : null,
          onlineReservationEnabled: tenant.settings?.onlineReservationEnabled !== false,
          showMap: tenant.settings?.showMap !== false,
          showOpeningHours: tenant.settings?.showOpeningHours !== false,
          showReviews: tenant.settings?.showReviews !== false
        };
      })
    );

    let results = tenantsWithStats;

    if (userLat != null && userLng != null && radius != null && radius > 0) {
      results = results.filter(
        (t) => t.distanceKm != null && t.distanceKm <= radius
      );
    }

    if (userLat != null && userLng != null) {
      results = [...results].sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    return { tenants: results.slice(0, take) };
  } catch (error) {
    throw error;
  }
  }

  async getCategories() {
    try {
    const categories = await prisma.service.findMany({
      where: {
        visibility: { in: ['BOOKABLE', 'VISIBLE'] }
      },
      select: {
        category: true
      },
      distinct: ['category']
    });

    // Count services per category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        if (!cat.category) return null;
        const count = await prisma.service.count({
          where: {
            category: cat.category,
            visibility: { in: ['BOOKABLE', 'VISIBLE'] }
          }
        });
        return {
          name: cat.category,
          count
        };
      })
    );

    return {
      categories: categoriesWithCount.filter(Boolean).sort((a, b) => b!.count - a!.count)
    };
  } catch (error) {
    throw error;
  }
  }

  async getFeaturedServices(query: Record<string, unknown>) {
    try {
    const { limit = '10' } = query;
    const take = parseInt(limit as string);

    // Get services that have appointments (popular services)
    const servicesWithAppointments = await prisma.service.findMany({
      where: {
        visibility: { in: ['BOOKABLE', 'VISIBLE'] },
        appointments: {
          some: {}
        }
      },
      include: {
        _count: {
          select: {
            appointments: true
          }
        },
        appointments: {
          take: 1,
          include: {
            invoice: {
              select: {
                total: true
              }
            },
            tenant: {
              select: {
                name: true,
                address: true,
                logo: true
              }
            }
          },
          orderBy: {
            startTime: 'desc'
          }
        }
      },
      orderBy: {
        appointments: {
          _count: 'desc'
        }
      },
      take
    });

    const featuredServices = servicesWithAppointments.map(service => {
      const latestAppointment = service.appointments[0];
      const tenant = latestAppointment?.tenant;
      
      return {
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        price: service.price || service.priceFrom || 0,
        duration: service.duration,
        image: service.appointments[0]?.tenant?.logo || null,
        establishment: tenant?.name || '',
        location: tenant?.address?.split(',')[0] || '',
        appointmentsCount: service._count.appointments,
        rating: 4.7, // Could be calculated from reviews
        reviews: Math.floor(service._count.appointments * 0.3) // Estimate
      };
    });

    return { services: featuredServices };
  } catch (error) {
    throw error;
  }
  }

  async getFeaturedReviews(query: Record<string, unknown>) {
    try {
    const { limit = '10' } = query;
    const take = parseInt(limit as string);

    const reviews = await prisma.review.findMany({
      where: {
        status: 'APPROVED'
      },
      take,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        tenant: {
          select: {
            name: true
          }
        }
      }
    });

    const featuredReviews = reviews.map(review => ({
      id: review.id,
      name: review.client.firstName + ' ' + review.client.lastName.charAt(0) + '.',
      role: review.tenant?.name || 'Client',
      city: '',
      rating: review.rating,
      text: review.comment || '',
      avatar: review.client.firstName?.charAt(0) || 'U',
      date: new Date(review.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      type: 'Client'
    }));

    return { reviews: featuredReviews };
  } catch (error) {
    throw error;
  }
  }

}

export const discoveryService = new DiscoveryService();

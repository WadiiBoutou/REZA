import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { hashPassword } from '../../../utils/password';
import { slugifyName } from '../../../utils/slugify';
import { fail } from '../utils/http';

export class EarlyAccessService {
  async signupEarlyAccess(body: unknown) {
    try {
    const schema = z.object({
      fullName: z.string().min(1).optional(),
      firstName: z.string().min(1, 'Le prénom est requis').optional(),
      lastName: z.string().min(1, 'Le nom est requis').optional(),
      email: z.string().email('Email invalide'),
      password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
      phone: z.string().optional(),
      establishment: z.string().optional().nullable(),
      city: z.string().min(1, 'La ville est requise'),
      userType: z.enum(['PROFESSIONAL', 'CLIENT'], {
        errorMap: () => ({ message: 'Le type d\'utilisateur doit être PROFESSIONAL ou CLIENT' })
      })
    }).refine((data) => {
      // Either fullName OR (firstName AND lastName) must be provided
      return (data.fullName && data.fullName.trim().length > 0) || 
             (data.firstName && data.firstName.trim().length > 0 && data.lastName && data.lastName.trim().length > 0);
    }, {
      message: 'Le nom complet (fullName) ou le prénom et nom (firstName, lastName) sont requis',
      path: ['firstName']
    });

    const data = schema.parse(body);
    const email = data.email.trim().toLowerCase();
    
    // Extract firstName and lastName from fullName if needed
    let firstName: string;
    let lastName: string;
    let fullName: string;
    
    if (data.firstName && data.lastName) {
      firstName = data.firstName.trim();
      lastName = data.lastName.trim();
      fullName = `${firstName} ${lastName}`;
    } else if (data.fullName) {
      fullName = data.fullName.trim();
      const nameParts = fullName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    } else {
      fail(400, {
        error: 'Validation error',
        message: 'Le prénom et le nom sont requis.'
      });
    }

    // Check if email already exists in early access signups
    const existingSignup = await (prisma as any).earlyAccessSignup.findFirst({
      where: {
        email: email
      }
    });

    if (existingSignup) {
      fail(409, {
        error: 'Email already registered',
        message: 'Cette adresse email est déjà enregistrée pour l\'accès anticipé.'
      });
    }

    // For PROFESSIONAL users: Create Tenant and User account
    if (data.userType === 'PROFESSIONAL') {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email
        }
      });

      if (existingUser) {
        fail(409, {
          error: 'Email already registered',
          message: 'Un compte existe déjà avec cette adresse email.'
        });
      }

      // Check if establishment name is provided
      if (!data.establishment || !data.establishment.trim()) {
        fail(400, {
          error: 'Establishment required',
          message: 'Le nom de l\'établissement est requis pour les professionnels.'
        });
      }

      // Create Tenant (organization/establishment)
      const tenant = await prisma.tenant.create({
        data: {
          name: data.establishment.trim(),
          email: email,
          phone: data.phone?.trim() || null,
          city: data.city.trim(),
          isActive: true
        }
      });

      // Public URL slug (pretty, non-CUID client URLs)
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { slug: slugifyName(tenant.name, tenant.id) },
      });

      // Create tenant settings (matching register endpoint behavior)
      await prisma.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          timezone: 'Africa/Casablanca', // Morocco timezone
          currency: 'EUR',
          language: 'fr',
          bookingAdvanceDays: 30,
          cancellationHours: 24,
          description: JSON.stringify({
            onboardingCompleted: true,
            onboardingDate: new Date().toISOString()
          })
        }
      });

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create User account with ADMIN role
      const user = await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
          firstName: firstName,
          lastName: lastName,
          phone: data.phone?.trim() || null,
          tenantId: tenant.id,
          role: 'ADMIN',
          isActive: true
        }
      });

      // Also create early access signup record for tracking
      await (prisma as any).earlyAccessSignup.create({
        data: {
          fullName: fullName,
          email: email,
          phone: data.phone?.trim() || null,
          establishment: data.establishment.trim(),
          city: data.city.trim(),
          userType: data.userType
        }
      });

      fail(201, {
        success: true,
        message: 'Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.',
        data: {
          id: user.id,
          email: user.email,
          tenantId: tenant.id,
          tenantName: tenant.name
        }
      });
    } else {
      // For CLIENT users: Just create early access signup record
      // (Clients may have a different login flow or will be created later)
      const signup = await (prisma as any).earlyAccessSignup.create({
        data: {
          fullName: fullName,
          email: email,
          phone: data.phone?.trim() || null,
          establishment: null,
          city: data.city.trim(),
          userType: data.userType
        }
      });

      fail(201, {
        success: true,
        message: 'Merci pour votre inscription ! Vous recevrez bientôt un accès prioritaire.',
        data: {
          id: signup.id,
          email: signup.email
        }
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(400, {
        error: 'Validation error',
        message: error.errors[0].message,
        details: error.errors
      });
    }
    throw error;
  }
  }

}

export const earlyAccessService = new EarlyAccessService();

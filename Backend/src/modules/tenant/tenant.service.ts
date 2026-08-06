import { prisma } from '../../lib/prisma';
import { transformImageUrl } from '../../utils/imageUrl';
import { CreateTenantInput } from './tenant.schema';
import * as log from '../../utils/logger';

export class TenantService {
  async getTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });

    if (!tenant) {
      throw { status: 404, error: 'Tenant not found' };
    }

    return {
      tenant: {
        ...tenant,
        logo: transformImageUrl(tenant.logo),
        coverImage: transformImageUrl(tenant.coverImage),
        settings: tenant.settings
          ? {
              ...tenant.settings,
              photos: tenant.settings.photos && Array.isArray(tenant.settings.photos)
                ? (tenant.settings.photos as any[]).map((photo: string) => transformImageUrl(photo))
                : tenant.settings.photos
            }
          : tenant.settings
      }
    };
  }

  async updateTenant(tenantId: string, input: Partial<CreateTenantInput>) {
    const data = { ...input };

    // Extract coordinates from Google Maps URL if provided
    if (data.googleMapsLink && (!data.latitude || !data.longitude)) {
      const coords = await this.extractCoordinatesFromGoogleMapsUrl(data.googleMapsLink);
      if (coords) {
        data.latitude = coords.lat;
        data.longitude = coords.lng;
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      include: { settings: true }
    });

    return { tenant };
  }

  async getTenantSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    return { settings };
  }

  async updateTenantSettings(tenantId: string, input: any) {
    // Handle emailNotifications merge for nested fields (autoConfirm, acceptedPaymentMethods)
    let finalEmailNotifications = input.emailNotifications;
    if (input.autoConfirm !== undefined || input.acceptedPaymentMethods !== undefined) {
      let existing: any = input.emailNotifications;
      if (!existing) {
        try {
          const currentSettings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { emailNotifications: true } });
          existing = (currentSettings?.emailNotifications as any) || {};
        } catch { existing = {}; }
      }
      finalEmailNotifications = { ...existing };
      if (input.autoConfirm !== undefined) finalEmailNotifications.autoConfirm = input.autoConfirm;
      if (input.acceptedPaymentMethods !== undefined) finalEmailNotifications.acceptedPaymentMethods = input.acceptedPaymentMethods;
    }

    const {
      businessHours,
      timezone,
      currency,
      language,
      bookingAdvanceDays,
      cancellationHours,
      appointmentDisplaySettings,
      description,
      photos,
      coverImages,
      paymentMethods,
      amenities,
      socialMedia,
      featured,
      showMap,
      showOpeningHours,
      showOnlineReservation,
      showReviews,
      onlineReservationEnabled
    } = input;

    const updateData: any = {};
    if (businessHours !== undefined) updateData.businessHours = businessHours;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (currency !== undefined) updateData.currency = currency;
    if (language !== undefined) updateData.language = language;
    if (bookingAdvanceDays !== undefined) updateData.bookingAdvanceDays = bookingAdvanceDays;
    if (cancellationHours !== undefined) updateData.cancellationHours = cancellationHours;
    if (appointmentDisplaySettings !== undefined) updateData.appointmentDisplaySettings = appointmentDisplaySettings;
    if (description !== undefined) updateData.description = description;
    updateData.emailNotifications = finalEmailNotifications !== undefined ? finalEmailNotifications : undefined;
    if (photos !== undefined) updateData.photos = photos;
    if (coverImages !== undefined) updateData.coverImages = coverImages;
    if (paymentMethods !== undefined) updateData.paymentMethods = paymentMethods;
    if (amenities !== undefined) updateData.amenities = amenities;
    if (socialMedia !== undefined) updateData.socialMedia = socialMedia;
    if (featured !== undefined) updateData.featured = featured;
    if (showMap !== undefined) updateData.showMap = showMap;
    if (showOpeningHours !== undefined) updateData.showOpeningHours = showOpeningHours;
    if (showOnlineReservation !== undefined) updateData.showOnlineReservation = showOnlineReservation;
    if (showReviews !== undefined) updateData.showReviews = showReviews;
    if (onlineReservationEnabled !== undefined) updateData.onlineReservationEnabled = onlineReservationEnabled;

    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: { tenantId, ...updateData }
    });

    return { settings };
  }

  async getAppointmentDisplaySettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: {
          tenantId,
          appointmentDisplaySettings: {
            showColorInRDV: true,
            fields: [
              { id: 'hours', label: 'Horaires', visible: true, order: 1 },
              { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
              { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
              { id: 'notes', label: 'Titre ou note', visible: true, order: 4 }
            ]
          }
        }
      });
    }

    const displaySettings = settings.appointmentDisplaySettings || {
      showColorInRDV: true,
      fields: [
        { id: 'hours', label: 'Horaires', visible: true, order: 1 },
        { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
        { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
        { id: 'notes', label: 'Titre ou note', visible: true, order: 4 }
      ]
    };

    return { settings: displaySettings };
  }

  async updateAppointmentDisplaySettings(tenantId: string, input: any) {
    const { showColorInRDV, fields } = input;

    if (fields && !Array.isArray(fields)) {
      throw { status: 400, error: 'Validation error', message: 'Fields must be an array' };
    }

    const appointmentDisplaySettings = {
      showColorInRDV: showColorInRDV !== undefined ? showColorInRDV : true,
      fields: fields || [
        { id: 'hours', label: 'Horaires', visible: true, order: 1 },
        { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
        { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
        { id: 'notes', label: 'Titre ou note', visible: true, order: 4 }
      ]
    };

    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { appointmentDisplaySettings: appointmentDisplaySettings as any },
      create: { tenantId, appointmentDisplaySettings: appointmentDisplaySettings as any }
    });

    return { settings: settings.appointmentDisplaySettings };
  }

  async getPhotos(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const photos = settings?.photos ? (settings.photos as any) : [];
    return { photos };
  }

  async addPhotos(tenantId: string, input: any) {
    const { photos } = input;

    if (!Array.isArray(photos)) {
      throw { status: 400, error: 'Validation error', message: 'Photos must be an array' };
    }

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const existingPhotos = settings?.photos ? (settings.photos as any[]) : [];
    const newPhotos = photos.map((photo: any) => ({
      ...photo,
      id: photo.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: photo.date || new Date().toISOString(),
      status: photo.status || 'validated'
    }));

    const allPhotos = [...existingPhotos, ...newPhotos];

    settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { photos: allPhotos as any },
      create: { tenantId, photos: allPhotos as any }
    });

    return { photos: settings.photos };
  }

  async updatePhoto(tenantId: string, photoId: string, updates: any) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const photos = settings?.photos ? (settings.photos as any[]) : [];
    const photoIndex = photos.findIndex((p: any) => p.id === photoId || p.id === parseInt(photoId));

    if (photoIndex === -1) {
      throw { status: 404, error: 'Photo not found' };
    }

    photos[photoIndex] = { ...photos[photoIndex], ...updates };

    settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { photos: photos as any },
      create: { tenantId, photos: photos as any }
    });

    return { photo: photos[photoIndex] };
  }

  async deletePhoto(tenantId: string, photoId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const photos = settings?.photos ? (settings.photos as any[]) : [];
    const filteredPhotos = photos.filter((p: any) => p.id !== photoId && p.id !== parseInt(photoId));

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { photos: filteredPhotos as any },
      create: { tenantId, photos: filteredPhotos as any }
    });

    return { message: 'Photo deleted successfully' };
  }

  async deleteMultiplePhotos(tenantId: string, ids: string[]) {
    if (!Array.isArray(ids)) {
      throw { status: 400, error: 'Validation error', message: 'Ids must be an array' };
    }

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const photos = settings?.photos ? (settings.photos as any[]) : [];
    const filteredPhotos = photos.filter((p: any) => !ids.includes(p.id) && !ids.includes(String(p.id)));

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { photos: filteredPhotos as any },
      create: { tenantId, photos: filteredPhotos as any }
    });

    return { message: `${ids.length} photo(s) deleted successfully` };
  }

  async getAppointmentNotificationEmails(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId, emailNotifications: { appointmentEmails: [] } }
      });
    }

    const emailNotifications = settings.emailNotifications as any;
    const appointmentEmails = emailNotifications?.appointmentEmails || [];

    return { emails: appointmentEmails };
  }

  async updateAppointmentNotificationEmails(tenantId: string, emails: string[]) {
    if (!Array.isArray(emails)) {
      throw { status: 400, error: 'Validation error', message: 'Emails must be an array' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        throw { status: 400, error: 'Validation error', message: `Invalid email format: ${email}` };
      }
    }

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const emailNotifications = (settings?.emailNotifications as any) || {};
    emailNotifications.appointmentEmails = emails;

    settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { emailNotifications: emailNotifications as any },
      create: { tenantId, emailNotifications: emailNotifications as any }
    });

    return { emails: emailNotifications.appointmentEmails };
  }

  async getBusinessHours(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const businessHours = (settings.businessHours as any) || {};

    return {
      onlineBooking: businessHours.onlineBooking || 'open',
      schedules: businessHours.schedules || [],
      exceptionalSchedules: businessHours.exceptionalSchedules || [],
      agendaStart: businessHours.agendaStart || '08:00',
      agendaEnd: businessHours.agendaEnd || '23:55',
      bookingDelay: businessHours.bookingDelay || { value: '1', unit: 'jours', allowLastMoment: false },
      cancellationDelay: businessHours.cancellationDelay || { value: '1', unit: 'jours', allowLastMoment: false },
      advanceBooking: businessHours.advanceBooking || { value: '1', unit: 'mois' },
      blockedDates: businessHours.blockedDates || []
    };
  }

  async updateBusinessHours(tenantId: string, input: any) {
    const { onlineBooking, schedules, exceptionalSchedules, agendaStart, agendaEnd, bookingDelay, cancellationDelay, advanceBooking, blockedDates } = input;

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const existingHours = settings?.businessHours ? (settings.businessHours as any) : {};

    const businessHours = {
      ...existingHours,
      onlineBooking: onlineBooking !== undefined ? onlineBooking : existingHours.onlineBooking,
      schedules: schedules !== undefined ? schedules : existingHours.schedules,
      exceptionalSchedules: exceptionalSchedules !== undefined ? exceptionalSchedules : existingHours.exceptionalSchedules,
      agendaStart: agendaStart !== undefined ? agendaStart : existingHours.agendaStart,
      agendaEnd: agendaEnd !== undefined ? agendaEnd : existingHours.agendaEnd,
      bookingDelay: bookingDelay !== undefined ? bookingDelay : existingHours.bookingDelay,
      cancellationDelay: cancellationDelay !== undefined ? cancellationDelay : existingHours.cancellationDelay,
      advanceBooking: advanceBooking !== undefined ? advanceBooking : existingHours.advanceBooking,
      blockedDates: blockedDates !== undefined ? blockedDates : existingHours.blockedDates
    };

    settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        businessHours: businessHours as any,
        bookingAdvanceDays: advanceBooking?.value && advanceBooking?.unit === 'mois' ? parseInt(advanceBooking.value) * 30 : (advanceBooking?.value && advanceBooking?.unit === 'semaines' ? parseInt(advanceBooking.value) * 7 : (advanceBooking?.value ? parseInt(advanceBooking.value) : 30)),
        cancellationHours: cancellationDelay?.value && cancellationDelay?.unit === 'jours' ? parseInt(cancellationDelay.value) * 24 : (cancellationDelay?.value && cancellationDelay?.unit === 'heures' ? parseInt(cancellationDelay.value) : 24)
      },
      create: {
        tenantId,
        businessHours: businessHours as any,
        bookingAdvanceDays: advanceBooking?.value && advanceBooking?.unit === 'mois' ? parseInt(advanceBooking.value) * 30 : (advanceBooking?.value && advanceBooking?.unit === 'semaines' ? parseInt(advanceBooking.value) * 7 : (advanceBooking?.value ? parseInt(advanceBooking.value) : 30)),
        cancellationHours: cancellationDelay?.value && cancellationDelay?.unit === 'jours' ? parseInt(cancellationDelay.value) * 24 : (cancellationDelay?.value && cancellationDelay?.unit === 'heures' ? parseInt(cancellationDelay.value) : 24)
      }
    });

    return { settings: settings.businessHours };
  }

  async getAcceptedPaymentMethods(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId, emailNotifications: { acceptedPaymentMethods: ['Espèces'] } as any }
      });
    }

    const emailNotif = (settings.emailNotifications as any) || {};
    const methods: string[] = emailNotif.acceptedPaymentMethods || ['Espèces'];
    return { methods };
  }

  async addAcceptedPaymentMethod(tenantId: string, name: string) {
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await prisma.tenantSettings.create({ data: { tenantId } });
    }
    const emailNotif = (settings.emailNotifications as any) || {};
    const methods: string[] = emailNotif.acceptedPaymentMethods || ['Espèces'];
    if (methods.includes(name)) {
      throw { status: 409, error: 'Duplicate', message: 'Cette méthode de paiement existe déjà.' };
    }
    methods.push(name);
    emailNotif.acceptedPaymentMethods = methods;
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { emailNotifications: emailNotif as any }
    });
    return { methods };
  }

  async deleteAcceptedPaymentMethod(tenantId: string, name: string) {
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) throw { status: 404, error: 'Settings not found' };
    const emailNotif = (settings.emailNotifications as any) || {};
    const methods: string[] = emailNotif.acceptedPaymentMethods || ['Espèces'];
    if (methods.length <= 1) {
      throw { status: 400, error: 'Last method', message: 'Impossible de supprimer la dernière méthode de paiement.' };
    }
    const filtered = methods.filter((m) => m !== name);
    if (filtered.length === methods.length) {
      throw { status: 404, error: 'Not found', message: 'Méthode de paiement introuvable.' };
    }
    emailNotif.acceptedPaymentMethods = filtered;
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { emailNotifications: emailNotif as any }
    });
    return { methods: filtered };
  }

  async getAutoConfirmSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await prisma.tenantSettings.create({ data: { tenantId } });
    }
    const emailNotif = (settings.emailNotifications as any) || {};
    return { enabled: emailNotif.autoConfirm === true };
  }

  async updateAutoConfirmSettings(tenantId: string, enabled: boolean) {
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await prisma.tenantSettings.create({ data: { tenantId } });
    }
    const emailNotif = (settings.emailNotifications as any) || {};
    emailNotif.autoConfirm = enabled === true;
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { emailNotifications: emailNotif as any }
    });
    return { enabled: emailNotif.autoConfirm };
  }

  async getPaymentMethods(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const paymentMethods = (settings.paymentMethods as any) || [];
    return { paymentMethods };
  }

  async addPaymentMethod(tenantId: string, input: any) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const paymentMethods = ((settings as any).paymentMethods || []) as any[];

    const newMethod = {
      id: Date.now().toString(),
      type: input.type,
      last4: input.last4 || (input.type === 'moroccan_transfer' ? input.iban?.slice(-2) : input.cardNumber?.slice(-4)),
      name: input.type === 'moroccan_transfer'
        ? `MA****${input.iban?.slice(-2)}`
        : `**** ${input.cardNumber?.slice(-4)}`,
      createdDate: new Date().toISOString(),
      isDefault: paymentMethods.length === 0,
      iban: input.type === 'moroccan_transfer' ? input.iban : undefined,
      cardNumber: input.type === 'card' ? input.cardNumber : undefined,
      cardName: input.type === 'card' ? input.cardName : undefined,
      cardExpiry: input.type === 'card' ? input.cardExpiry : undefined
    };

    paymentMethods.push(newMethod);

    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { paymentMethods: paymentMethods }
    });

    return { paymentMethod: newMethod };
  }

  async updatePaymentMethod(tenantId: string, methodId: string, input: any) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      throw { status: 404, error: 'Settings not found' };
    }

    const paymentMethods = ((settings.paymentMethods as any) || []) as any[];
    const methodToUpdate = paymentMethods.find((m: any) => String(m.id) === String(methodId));

    if (!methodToUpdate) {
      throw { status: 404, error: 'Payment method not found' };
    }

    if (input.isDefault) {
      paymentMethods.forEach((method: any) => {
        method.isDefault = false;
      });
      methodToUpdate.isDefault = true;
    } else {
      methodToUpdate.isDefault = false;
    }

    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { paymentMethods: paymentMethods }
    });

    return { success: true };
  }

  async deletePaymentMethod(tenantId: string, methodId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      throw { status: 404, error: 'Settings not found' };
    }

    const paymentMethods = ((settings.paymentMethods as any) || []) as any[];
    const methodToDelete = paymentMethods.find((m: any) => m.id === methodId);
    const newMethods = paymentMethods.filter((m: any) => m.id !== methodId);

    if (methodToDelete?.isDefault && newMethods.length > 0) {
      newMethods[0].isDefault = true;
    }

    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { paymentMethods: newMethods }
    });

    return { success: true };
  }

  async getMessageSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const messageSettings = (settings.emailNotifications as any)?.messageSettings || {};

    return {
      enabled: messageSettings.enabled !== undefined ? messageSettings.enabled : false,
      content: messageSettings.content || ''
    };
  }

  async updateMessageSettings(tenantId: string, input: any) {
    const { enabled, content } = input;

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const emailNotifications = (settings?.emailNotifications as any) || {};
    emailNotifications.messageSettings = { enabled, content };

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { emailNotifications: emailNotifications as any },
      create: { tenantId, emailNotifications: emailNotifications as any }
    });

    return {
      enabled: emailNotifications.messageSettings.enabled,
      content: emailNotifications.messageSettings.content
    };
  }

  async getWaitingListSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const waitingListSettings = (settings.emailNotifications as any)?.waitingListSettings || {};

    return {
      activated: waitingListSettings.activated !== undefined ? waitingListSettings.activated : false
    };
  }

  async updateWaitingListSettings(tenantId: string, input: any) {
    const { activated } = input;

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const emailNotifications = (settings?.emailNotifications as any) || {};
    emailNotifications.waitingListSettings = { activated: activated === true || activated === 'oui' };

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { emailNotifications: emailNotifications as any },
      create: { tenantId, emailNotifications: emailNotifications as any }
    });

    return {
      activated: emailNotifications.waitingListSettings.activated
    };
  }

  async getClientFieldSettings(tenantId: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: { tenantId }
      });
    }

    const clientFieldSettings = (settings.emailNotifications as any)?.clientFieldSettings || {};

    const defaultFields = [
      {
        name: 'genre',
        label: 'Genre',
        display: true,
        required: false
      },
      {
        name: 'birthDate',
        label: 'Date de naissance',
        display: true,
        required: false,
        askYearOnly: false
      },
      {
        name: 'address',
        label: 'Adresse postale',
        display: true,
        required: false,
        askPostalCodeOnly: false
      }
    ];

    return {
      fields: clientFieldSettings.fields || defaultFields
    };
  }

  async updateClientFieldSettings(tenantId: string, input: any) {
    const { fields } = input;

    if (!Array.isArray(fields)) {
      throw { status: 400, error: 'Validation error', message: 'Fields must be an array' };
    }

    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const emailNotifications = (settings?.emailNotifications as any) || {};
    emailNotifications.clientFieldSettings = { fields };

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { emailNotifications: emailNotifications as any },
      create: { tenantId, emailNotifications: emailNotifications as any }
    });

    return {
      fields: emailNotifications.clientFieldSettings.fields
    };
  }

  async getHeaderImage(tenantId: string) {
    log.log('[Tenant Service] Header image GET for tenantId:', tenantId);

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    let headerImage: string | null = null;

    if (settings) {
      const emailNotifications = settings.emailNotifications as any;

      if (emailNotifications && typeof emailNotifications === 'object') {
        if (emailNotifications.dashboardSettings?.headerImage) {
          headerImage = emailNotifications.dashboardSettings.headerImage;

          if (headerImage && typeof headerImage === 'string' && headerImage.includes('/cover-images/')) {
            headerImage = headerImage.replace('/cover-images/', '/header-images/');
          }
        } else if (emailNotifications.headerImage) {
          headerImage = emailNotifications.headerImage;

          if (headerImage && typeof headerImage === 'string' && headerImage.includes('/cover-images/')) {
            headerImage = headerImage.replace('/cover-images/', '/header-images/');
          }
        }
      }
    }

    return { headerImage };
  }

  async saveHeaderImage(tenantId: string, fileUrl: string) {
    let settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    const emailNotifications = (settings?.emailNotifications as any) || {};

    if (!emailNotifications.dashboardSettings) {
      emailNotifications.dashboardSettings = {};
    }

    emailNotifications.dashboardSettings.headerImage = fileUrl;

    const result = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { emailNotifications: emailNotifications as any },
      create: { tenantId, emailNotifications: emailNotifications as any }
    });

    return {
      success: true,
      headerImage: fileUrl,
      message: 'Header image uploaded successfully'
    };
  }

  async saveCoverImage(tenantId: string, fileUrl: string) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { coverImage: fileUrl }
    });

    const apiBase = process.env.BACKEND_URL || 'https://api.wellbe.ma';
    const finalUrl = `${apiBase}${fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl}`;

    return {
      success: true,
      coverImage: finalUrl,
      message: 'Cover image uploaded successfully'
    };
  }

  private async extractCoordinatesFromGoogleMapsUrl(url: string): Promise<{ lat: number; lng: number } | null> {
    try {
      let finalUrl = url;

      if (url.includes('maps.app.goo.gl') || url.includes('goo.gl')) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          finalUrl = response.url || url;
        } catch (fetchError) {
          log.warn('[Tenant Service] Could not follow redirect');
          finalUrl = url;
        }

        const coordMatch = finalUrl.match(/[?&]q=([^&]+)/);
        if (coordMatch) {
          const query = decodeURIComponent(coordMatch[1]);
          const latLngMatch = query.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
          if (latLngMatch) {
            return { lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) };
          }
        }

        const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) {
          return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
        }
      } else {
        const coordMatch = url.match(/[?&]q=([^&]+)/);
        if (coordMatch) {
          const query = decodeURIComponent(coordMatch[1]);
          const latLngMatch = query.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
          if (latLngMatch) {
            return { lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) };
          }
        }

        const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) {
          return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
        }
      }
    } catch (error) {
      log.warn('[Tenant Service] Error extracting coordinates:', error);
    }
    return null;
  }
}

export const tenantService = new TenantService();

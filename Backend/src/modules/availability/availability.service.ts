import { prisma } from '../../lib/prisma';
import { schedulingService } from '../appointment/scheduling.service';

export class AvailabilityService {
  async getAvailability(tenantId: string, date: string, serviceIdsArray: string[], employeeId?: string) {
    // Verify tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      },
      include: {
        settings: true
      }
    });

    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    // Calculate total duration
    let totalDuration = 60;
    if (serviceIdsArray.length > 0) {
      const services = await prisma.service.findMany({
        where: {
          id: { in: serviceIdsArray },
          tenantId: tenant.id
        }
      });
      totalDuration = services.reduce((sum: number, s: any) => sum + s.duration, 0);
    }

    // Get business hours
    const businessHours = tenant.settings?.businessHours as any || {};
    const defaultHours = {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: null
    };

    const selectedDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[selectedDate.getDay()];
    const hours = businessHours[dayName] || defaultHours[dayName as keyof typeof defaultHours];

    if (!hours || !hours.open || !hours.close) {
      return [];
    }

    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour, closeMin] = hours.close.split(':').map(Number);
    
    const openTime = new Date(selectedDate);
    openTime.setHours(openHour, openMin, 0, 0);
    
    const closeTime = new Date(selectedDate);
    closeTime.setHours(closeHour, closeMin, 0, 0);

    // Check if selected date is today
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = today.getTime() === selectedDay.getTime();

    const slots: string[] = [];
    const slotDuration = 30;
    let currentTime = new Date(openTime);
    
    while (currentTime.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
      if (isToday && currentTime.getTime() <= now.getTime()) {
        currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
        continue;
      }

      const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

      // Use the scheduling engine to check if this start time is feasible
      const slotCheck = await schedulingService.checkSlotAvailability({
        tenantId: tenant.id,
        serviceIds: serviceIdsArray,
        date,
        startTime: timeStr,
      });

      if (slotCheck.available) {
        slots.push(timeStr);
      }

      currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
    }

    return slots;
  }
}

export const availabilityService = new AvailabilityService();

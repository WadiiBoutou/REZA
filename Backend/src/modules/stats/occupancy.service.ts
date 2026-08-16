import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { StatsBase } from './stats.base';

/**
 * Stats sub-service (A1 split). Pure refactor — identical behavior.
 */
export class OccupancyService extends StatsBase {
    async getOccupancyOverview(tenantId: string, month?: string, year?: string, employeeId?: string) {
      const selectedMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
      const selectedYear = year !== undefined ? parseInt(year) : new Date().getFullYear();
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const tenantWhere = { tenantId };
      const appointmentWhere: any = {
        ...tenantWhere,
        startTime: { gte: start, lte: end },
        status: { not: 'CANCELLED' as const }
      };

      if (employeeId && employeeId !== 'all') {
        appointmentWhere.employeeId = employeeId;
      }

      const appointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        include: { service: true, services: true }
      });

      // Fetch all active employees to determine scheduled capacity per slot
      const employees = await prisma.employee.findMany({
        where: { tenantId, isActive: true }
      });

      const daysOfWeekIndex = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
      const daysOfWeekDisplay = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
      const daysFullNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const timeSlots = [
        '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '13:00 - 14:00',
        '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
      ];

      const occupancyData: { [day: string]: { [time: string]: { count: number; totalMinutes: number } } } = {};
      daysOfWeekDisplay.forEach(day => {
        occupancyData[day] = {};
        timeSlots.forEach(time => {
          occupancyData[day][time] = { count: 0, totalMinutes: 0 };
        });
      });

      // Use each service item's duration for the slot it starts in.
      // For single-service appointments (no items array), fall back to apt.duration.
      appointments.forEach(apt => {
        const date = new Date(apt.startTime);
        const dayOfWeek = daysOfWeekIndex[date.getDay()];
        const hour = date.getHours();

        const itemDuration = apt.services && apt.services.length > 0
          ? apt.services.reduce((s: number, it: any) => s + (it.duration || 0), 0)
          : (apt.duration || 60);

        for (const slot of timeSlots) {
          const [startTime] = slot.split(' - ');
          const [startHour] = startTime.split(':');
          if (hour === parseInt(startHour)) {
            if (occupancyData[dayOfWeek] && occupancyData[dayOfWeek][slot]) {
              occupancyData[dayOfWeek][slot].count++;
              occupancyData[dayOfWeek][slot].totalMinutes += itemDuration;
            }
            break;
          }
        }
      });

      /**
       * Compute real available capacity for a given weekday+hour slot.
       * Returns the number of employees actually scheduled during that time.
       */
      const getEmployeeCountForSlot = (dayName: string, slotHour: number): number => {
        let count = 0;
        employees.forEach(emp => {
          const workingHours = (emp.workingHours as any) || [];
          const daySchedule = workingHours.find((h: any) => h.day === dayName && h.isWorking);

          if (daySchedule) {
            const [startH] = daySchedule.startTime.split(':').map(Number);
            const [endH] = daySchedule.endTime.split(':').map(Number);
            // Employee covers this slot if they start at or before it and end after it
            if (startH <= slotHour && endH > slotHour) {
              count++;
            }
          }
        });
        return count;
      };

      const occupancyRates: { [day: string]: { [time: string]: number } } = {};

      daysOfWeekDisplay.forEach(day => {
        occupancyRates[day] = {};
        const dayIndex = daysOfWeekIndex.indexOf(day);
        const dayFullName = daysFullNames[dayIndex];

        timeSlots.forEach(time => {
          const data = occupancyData[day][time];
          const [startTime] = time.split(' - ');
          const [startHour] = startTime.split(':');
          const slotHour = parseInt(startHour);

          // Count how many days in the month have this day of week
          let dayOccurrences = 0;
          const tempDate = new Date(start);
          while (tempDate <= end) {
            if (tempDate.getDay() === dayIndex) {
              dayOccurrences++;
            }
            tempDate.setDate(tempDate.getDate() + 1);
          }

          // Real capacity = (employees scheduled in this slot) * 60 minutes per occurrence
          const employeeCount = getEmployeeCountForSlot(dayFullName, slotHour);
          const totalAvailableMinutes = dayOccurrences * employeeCount * 60;

          occupancyRates[day][time] = totalAvailableMinutes > 0
            ? Math.round((data.totalMinutes / totalAvailableMinutes) * 100)
            : 0;
        });
      });

      let total = 0, count = 0, max = 0, maxDay = '', maxTime = '';
      Object.entries(occupancyRates).forEach(([day, times]) => {
        Object.entries(times).forEach(([time, value]) => {
          total += value;
          count++;
          if (value > max) { max = value; maxDay = day; maxTime = time; }
        });
      });

      return {
        occupancyData: occupancyRates,
        stats: { average: count > 0 ? Math.round(total / count) : 0, peak: max, peakDay: maxDay, peakTime: maxTime }
      };
    }

    async getOccupancyCollaborateurs(tenantIds: string | string[], period?: string, startDate?: string, endDate?: string, month?: string, year?: string, categoryId?: string, serviceId?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      const tenantWhere = { tenantId: tenantIdFilter(tenantIds) };
      const appointmentWhere: any = {
        ...tenantWhere,
        startTime: { gte: start, lte: end },
        status: { not: 'CANCELLED' as const }
      };

      // Optional per-service filters (category string / service id) — match on the appointment's service items
      const serviceFilters: any[] = [];
      if (categoryId && categoryId !== 'all') serviceFilters.push({ service: { category: categoryId } });
      if (serviceId && serviceId !== 'all') serviceFilters.push({ service: { id: serviceId } });
      if (serviceFilters.length === 1) appointmentWhere.services = { some: serviceFilters[0] };
      else if (serviceFilters.length > 1) appointmentWhere.services = { some: { AND: serviceFilters } };

      // Service items + legacy appointment.employeeId reference User records (role STAFF),
      // so employee buckets MUST be keyed by User.id — Employee records live in a separate id space.
      const allEmployees = await prisma.user.findMany({
        where: { ...tenantWhere, role: 'STAFF', isActive: true }
      });
      const avatarByUserId = await this.buildAvatarByUserId(tenantIds, allEmployees);

      const appointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        include: { employee: true, invoice: true, services: { include: { service: true } } }
      });

      const employeeStats: any = {};
      allEmployees.forEach(emp => {
        employeeStats[emp.id] = { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, avatar: emp.avatar || avatarByUserId.get(emp.id) || null, totalMinutes: 0, revenue: 0, appointmentCount: 0 };
      });

      appointments.forEach((apt: any) => {
        const items = apt.services && apt.services.length > 0 ? apt.services : null;
        if (items) {
          items.forEach((item: any) => {
            if (item.employeeId && employeeStats[item.employeeId]) {
              employeeStats[item.employeeId].totalMinutes += item.duration || 0;
              employeeStats[item.employeeId].appointmentCount++;
              // Per-service item price (the app-wide revenue convention)
              employeeStats[item.employeeId].revenue += item.price || 0;
            }
          });
        } else if (apt.employeeId && employeeStats[apt.employeeId]) {
          employeeStats[apt.employeeId].totalMinutes += apt.duration || 0;
          employeeStats[apt.employeeId].appointmentCount++;
          if (apt.invoice) employeeStats[apt.employeeId].revenue += apt.invoice.total || 0;
        }
      });

      const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedWorkingMinutes = daysInRange * 8 * 60;

      const colors = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
      // Zero-activity staff (no appointments in the window) are excluded from
      // listings, matching the personels/statistiques behaviour (app-wide rule).
      const activeEmployees = Object.values(employeeStats).filter((emp: any) => emp.appointmentCount > 0);
      const collaborators = activeEmployees
        .map((emp: any, idx: number) => {
          const workedHours = Math.round(emp.totalMinutes / 60);
          const occupationRate = estimatedWorkingMinutes > 0
            ? Math.round((emp.totalMinutes / estimatedWorkingMinutes) * 100 * 10) / 10
            : 0;
          return {
            id: emp.id, name: emp.name, avatar: emp.avatar, color: colors[idx % colors.length],
            occupationRate, workedHours, revenue: Math.round(emp.revenue * 100) / 100,
            appointmentCount: emp.appointmentCount
          };
        })
        .sort((a: any, b: any) => b.occupationRate - a.occupationRate);

      const empArr = activeEmployees as any[];
      const totalAppointmentCount = empArr.reduce((sum: number, emp: any) => sum + emp.appointmentCount, 0);
      const totalWorkedHours = empArr.reduce((sum: number, emp: any) => sum + Math.round(emp.totalMinutes / 60), 0);
      const totalRevenue = empArr.reduce((sum: number, emp: any) => sum + emp.revenue, 0);
      const avgOccupationRate = collaborators.length > 0
        ? Math.round((collaborators.reduce((sum: number, c: any) => sum + c.occupationRate, 0) / collaborators.length) * 10) / 10
        : 0;

      return {
        collaborators,
        totals: { occupationRate: avgOccupationRate, workedHours: totalWorkedHours, revenue: Math.round(totalRevenue * 100) / 100, appointmentCount: totalAppointmentCount }
      };
    }

    async getOccupancyPrestations(tenantId: string, month?: string, year?: string, employeeId?: string) {
      const selectedMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
      const selectedYear = year !== undefined ? parseInt(year) : new Date().getFullYear();
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const tenantWhere = { tenantId };
      const appointmentWhere: any = {
        ...tenantWhere,
        startTime: { gte: start, lte: end },
        status: { not: 'CANCELLED' as const }
      };

      if (employeeId && employeeId !== 'all') {
        appointmentWhere.employeeId = employeeId;
      }

      const appointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        include: { service: true, invoice: true, services: { include: { service: true } } }
      });

      // Fetch all services and employees to compute real capacity
      const services = await prisma.service.findMany({
        where: { tenantId },
        include: {
          employeeServices: {
            include: { employee: true }
          }
        }
      });

      const serviceStats: any = {};

      appointments.forEach(apt => {
        // Prefer the AppointmentServiceItem rows (multi-service bookings) over the
        // legacy single serviceId field — each item has its own service + duration.
        const items = apt.services && apt.services.length > 0 ? apt.services : null;

        if (items) {
          items.forEach((item: any) => {
            const svcId = item.serviceId;
            if (!svcId) return;
            if (!serviceStats[svcId]) {
              // Look up the service name/category from the full services list
              const svcDef = services.find((s: any) => s.id === svcId);
              serviceStats[svcId] = {
                serviceId: svcId,
                name: svcDef?.name || item.serviceName || 'Unknown',
                category: svcDef?.category || 'AUTRE',
                totalMinutes: 0,
                revenue: 0,
                count: 0
              };
            }
            serviceStats[svcId].totalMinutes += item.duration || 0;
            serviceStats[svcId].count++;
            serviceStats[svcId].revenue += item.price || 0;
          });
        } else if (apt.serviceId) {
          // Fallback: legacy single-service appointment
          if (!serviceStats[apt.serviceId]) {
            serviceStats[apt.serviceId] = {
              serviceId: apt.serviceId,
              name: apt.service?.name || 'Unknown',
              category: apt.service?.category || 'AUTRE',
              totalMinutes: 0,
              revenue: 0,
              count: 0
            };
          }
          serviceStats[apt.serviceId].totalMinutes += apt.duration || 0;
          serviceStats[apt.serviceId].count++;
          serviceStats[apt.serviceId].revenue += this.appointmentRevenue(apt);
        }
      });

      /**
       * Compute real available capacity for each service based on employees who actually
       * provide it (from EmployeeService relation) and their actual working hours during
       * the selected month.
       */
      const computeServiceCapacity = (service: any): number => {
        const employeesForService = service.employeeServices?.map((es: any) => es.employee) || [];
        if (employeesForService.length === 0) return 0;

        let totalAvailableMinutes = 0;

        // For each employee who provides this service
        employeesForService.forEach((employee: any) => {
          const workingHours = (employee.workingHours as any) || [];
          const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

          // For each day in the selected month
          const dayIterator = new Date(start);
          while (dayIterator <= end) {
            const dayName = dayNames[dayIterator.getDay()];
            const daySchedule = workingHours.find((h: any) => h.day === dayName && h.isWorking);

            if (daySchedule) {
              // Parse working hours and breaks
              const [startH, startM] = daySchedule.startTime.split(':').map(Number);
              const [endH, endM] = daySchedule.endTime.split(':').map(Number);
              const startMinutes = startH * 60 + startM;
              const endMinutes = endH * 60 + endM;
              let dayWorkingMinutes = endMinutes - startMinutes;

              // Subtract break times
              if (daySchedule.breaks && Array.isArray(daySchedule.breaks)) {
                daySchedule.breaks.forEach((brk: any) => {
                  const [brkH, brkM] = brk.start.split(':').map(Number);
                  const [brkEndH, brkEndM] = brk.end.split(':').map(Number);
                  const brkStart = brkH * 60 + brkM;
                  const brkEnd = brkEndH * 60 + brkEndM;
                  dayWorkingMinutes -= Math.max(0, brkEnd - brkStart);
                });
              }

              totalAvailableMinutes += Math.max(0, dayWorkingMinutes);
            }

            dayIterator.setDate(dayIterator.getDate() + 1);
          }
        });

        return totalAvailableMinutes;
      };

      const serviceArray = Object.values(serviceStats);
      const categoryMap: { [key: string]: any[] } = {};

      serviceArray.forEach((service: any) => {
        const category = (service.category || 'AUTRE').toUpperCase();
        if (!categoryMap[category]) categoryMap[category] = [];

        const workedHours = Math.round(service.totalMinutes / 60);
        const workedMinutes = service.totalMinutes % 60;
        const hoursWorked = workedMinutes > 0 ? `${workedHours}h ${workedMinutes}m` : `${workedHours}h`;

        // Find the service definition to compute real capacity
        const serviceDef = services.find((s: any) => s.id === service.serviceId);
        const realCapacityMinutes = serviceDef ? computeServiceCapacity(serviceDef) : 0;

        // Real occupancy = booked minutes / actual available capacity for employees who provide this service
        const occupationRate = realCapacityMinutes > 0
          ? Math.round((service.totalMinutes / realCapacityMinutes) * 100 * 100) / 100
          : 0;

        categoryMap[category].push({
          name: service.name,
          occupancyRate: occupationRate,
          hoursWorked,
          totalRevenue: Math.round(service.revenue * 100) / 100,
          appointmentCount: service.count
        });
      });

      const servicesData = Object.entries(categoryMap)
        .map(([category, services]) => ({
          category,
          services: services.sort((a: any, b: any) => b.occupancyRate - a.occupancyRate)
        }))
        .sort((a, b) => {
          const aTotal = (a.services as any[]).reduce((sum: number, s: any) => sum + s.occupancyRate, 0);
          const bTotal = (b.services as any[]).reduce((sum: number, s: any) => sum + s.occupancyRate, 0);
          return bTotal - aTotal;
        });

      const allServices = servicesData.flatMap(cat => cat.services as any[]);
      const totalRevenue = allServices.reduce((sum: number, s: any) => sum + s.totalRevenue, 0);
      const totalAppointmentCount = allServices.reduce((sum: number, s: any) => sum + (s.appointmentCount || 0), 0);
      const totalMinutes = allServices.reduce((sum: number, s: any) => {
        const match = s.hoursWorked.match(/(\d+)h(?: (\d+)m)?/);
        if (match) return sum + parseInt(match[1] || '0') * 60 + parseInt(match[2] || '0');
        return sum;
      }, 0);
      const totalHours = Math.round(totalMinutes / 60);
      const avgOccupancy = allServices.length > 0
        ? Math.round((allServices.reduce((sum: number, s: any) => sum + s.occupancyRate, 0) / allServices.length) * 100) / 100
        : 0;

      return {
        servicesData,
        stats: { totalRevenue, totalHours, avgOccupancy, totalAppointmentCount }
      };
    }
}

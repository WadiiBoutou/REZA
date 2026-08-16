import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { StatsBase } from './stats.base';

/**
 * Stats sub-service (A1 split). Pure refactor — identical behavior.
 */
export class OverviewService extends StatsBase {
    async getOverview(tenantId: string, startDate?: string, endDate?: string) {
      const where: any = { tenantId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [totalClients, totalAppointments, totalRevenue, activeEmployees, pendingReviews] = await Promise.all([
        // Salon's clients = created by it OR booked there (global accounts)
        prisma.client.count({ where: salonClientsFilter(tenantId) }),
        prisma.appointment.count({ where: { tenantId } }),
        prisma.invoice.aggregate({
          where: {
            tenantId,
            status: 'PAID'
          },
          _sum: { total: true }
        }),
        prisma.employee.count({
          where: {
            tenantId,
            isActive: true
          }
        }),
        prisma.review.count({
          where: {
            tenantId,
            status: 'PENDING'
          }
        })
      ]);

      return {
        stats: {
          totalClients,
          totalAppointments,
          totalRevenue: totalRevenue._sum.total || 0,
          activeEmployees,
          pendingReviews
        }
      };
    }

    async getAppointmentStats(tenantId: string, startDate?: string, endDate?: string) {
      const where: any = { tenantId };

      if (startDate || endDate) {
        where.startTime = {};
        if (startDate) where.startTime.gte = new Date(startDate);
        if (endDate) where.startTime.lte = new Date(endDate);
      }

      const appointments = await prisma.appointment.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      });

      const byService = await prisma.appointment.groupBy({
        by: ['serviceId'],
        where,
        _count: { id: true }
      });

      return { byStatus: appointments, byService };
    }

    async getRevenueStats(tenantId: string, startDate?: string, endDate?: string) {
      const where: any = {
        tenantId,
        status: 'PAID'
      };

      if (startDate || endDate) {
        where.paidAt = {};
        if (startDate) where.paidAt.gte = new Date(startDate);
        if (endDate) where.paidAt.lte = new Date(endDate);
      }

      const revenue = await prisma.invoice.aggregate({
        where,
        _sum: { total: true, amount: true, tax: true },
        _count: { id: true }
      });

      return { revenue };
    }

    /**
     * Filter for "new clients at this salon" in a period: either the salon created
     * the record during the period (manual adds / legacy rows), or the client's
     * FIRST appointment at this salon falls inside the period (global accounts —
     * their row's createdAt is account creation, not first visit).
     */

    async getDashboardStats(tenantId: string, period?: string, startDate?: string, endDate?: string, month?: string, year?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      // Previous equivalent period for real delta computation.
      let prevStart: Date;
      let prevEnd: Date;
      if (month !== undefined && year !== undefined) {
        const m = parseInt(month);
        const y = parseInt(year);
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;
        prevStart = new Date(prevY, prevM, 1);
        prevEnd = new Date(prevY, prevM + 1, 0, 23, 59, 59);
      } else {
        const durationMs = end.getTime() - start.getTime();
        prevStart = new Date(start.getTime() - durationMs);
        prevEnd = new Date(start.getTime() - 1);
      }
      const prev = await this.computeScalarMetrics(tenantId, prevStart, prevEnd);

      const tenantWhere = { tenantId };
      const appointmentWhere = {
        ...tenantWhere,
        startTime: { gte: start, lte: end }
      };

      const appointments = await this.fetchAppointmentsWithRelations(appointmentWhere);

      const totalAppointments = appointments.length;
      const onlineAppointments = appointments.filter(a => a.source === 'ONLINE').length;
      const salonAppointments = totalAppointments - onlineAppointments;
      const onlineRate = totalAppointments > 0 ? (onlineAppointments / totalAppointments) * 100 : 0;

      const newClients = await prisma.client.findMany({
        where: this.newClientsFilter(tenantId, start, end)
      });

      // New-client origin follows the same source-based classification as the rest
      // of the stats section (Appointment.source is the only tracked origin).
      const onlineClientIds = new Set(appointments.filter(a => a.source === 'ONLINE').map(a => a.clientId));
      const salonClientIds = new Set(appointments.filter(a => a.source !== 'ONLINE').map(a => a.clientId));
      const newOnlineClients = newClients.filter(c => onlineClientIds.has(c.id)).length;
      const newSalonClients = newClients.filter(c => salonClientIds.has(c.id) && !onlineClientIds.has(c.id)).length;

      const appointmentsTrend: any[] = [];
      if (period === 'week') {
        for (let i = 0; i < 7; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
          const dayAppts = appointments.filter(a => {
            const aptDate = new Date(a.startTime);
            return aptDate >= dayStart && aptDate <= dayEnd;
          });
          const online = dayAppts.filter(a => a.source === 'ONLINE').length;
          const salon = dayAppts.length - online;
          appointmentsTrend.push({ day: String(dayStart.getDate()).padStart(2, '0'), salon, online });
        }
      } else if (period === 'month') {
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const dayStart = new Date(start.getFullYear(), start.getMonth(), i);
          const dayEnd = new Date(start.getFullYear(), start.getMonth(), i, 23, 59, 59, 999);
          const dayAppts = appointments.filter(a => {
            const aptDate = new Date(a.startTime);
            return aptDate >= dayStart && aptDate <= dayEnd;
          });
          const online = dayAppts.filter(a => a.source === 'ONLINE').length;
          const salon = dayAppts.length - online;
          appointmentsTrend.push({ day: String(i).padStart(2, '0'), salon, online });
        }
      } else {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(start.getFullYear(), i, 1);
          const monthEnd = new Date(start.getFullYear(), i + 1, 0, 23, 59, 59);
          const monthAppts = appointments.filter(a => {
            const aptDate = new Date(a.startTime);
            return aptDate >= monthStart && aptDate <= monthEnd;
          });
          const online = monthAppts.filter(a => a.source === 'ONLINE').length;
          const salon = monthAppts.length - online;
          appointmentsTrend.push({ day: monthNames[i], salon, online });
        }
      }

      // Revenue = sum of per-service item prices (AppointmentServiceItem.price,
      // falling back to service.price) for non-cancelled appointments in the
      // window — never Invoice data, so the platform SUBSCRIPTION invoice can
      // never leak into a salon revenue chart.
      const revenueAppointments = appointments.filter(a => a.status !== 'CANCELLED');
      const revenueByAppt = new Map<string, number>();
      revenueAppointments.forEach(a => { revenueByAppt.set(a.id, this.appointmentRevenue(a)); });
      const totalRevenue = revenueAppointments.reduce((sum, a) => sum + (revenueByAppt.get(a.id) || 0), 0);

      let revenueData: any[] = [];
      if (period === 'week') {
        const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        for (let i = 0; i < 7; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
          const dayRevenue = revenueAppointments
            .filter(a => {
              const aptDate = new Date(a.startTime);
              return aptDate >= dayStart && aptDate <= dayEnd;
            })
            .reduce((sum, a) => sum + (revenueByAppt.get(a.id) || 0), 0);
          revenueData.push({ name: weekDays[i], value: Math.round(dayRevenue) });
        }
      } else if (period === 'month') {
        const weeks: { [key: number]: number } = {};
        revenueAppointments.forEach(a => {
          const weekNum = Math.ceil(new Date(a.startTime).getDate() / 7);
          weeks[weekNum] = (weeks[weekNum] || 0) + (revenueByAppt.get(a.id) || 0);
        });
        for (let i = 1; i <= 4; i++) {
          revenueData.push({ name: `S${i}`, value: Math.round(weeks[i] || 0) });
        }
      } else {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        for (let i = 0; i < 12; i++) {
          const monthRevenue = revenueAppointments
            .filter(a => new Date(a.startTime).getMonth() === i)
            .reduce((sum, a) => sum + (revenueByAppt.get(a.id) || 0), 0);
          revenueData.push({ name: monthNames[i], value: Math.round(monthRevenue) });
        }
      }

      const avgRevenue = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;

      let peakDay = 'N/A';
      if (revenueData.length > 0) {
        const maxRevenue = Math.max(...revenueData.map(r => r.value));
        const peak = revenueData.find(r => r.value === maxRevenue);
        if (peak) peakDay = peak.name;
      }

      const serviceCounts: { [key: string]: number } = {};
      appointments.forEach(apt => {
        const svcName = apt.service?.name || 'Autre';
        serviceCounts[svcName] = (serviceCounts[svcName] || 0) + 1;
      });
      const serviceData = Object.entries(serviceCounts)
        .map(([name, value]) => ({ name, value, color: '#002366' }))
        .sort((a, b) => b.value - a.value).slice(0, 5);

      // Service items + legacy appointment.employeeId reference User records (role STAFF),
      // whose avatar is often null — the real avatar lives on the Employee record.
      // Fall back to it per user (same pattern as getAutresStats / getCollaborateursStats).
      const allEmployees = await prisma.user.findMany({
        where: { ...tenantWhere, role: 'STAFF', isActive: true }
      });
      const avatarByUserId = await this.buildAvatarByUserId(tenantId, allEmployees);

      const employeeStatsMap: { [key: string]: { appointments: number; revenue: number; ratings: number[]; avatar: string | null } } = {};
      appointments.forEach(apt => {
        if (apt.status === 'CANCELLED') return;
        const items = apt.services && apt.services.length > 0 ? apt.services : null;
        if (items) {
          items.forEach((item: any) => {
            if (item.employeeId && item.employee) {
              const empName = `${item.employee.firstName} ${item.employee.lastName}`;
              if (!employeeStatsMap[empName]) {
                employeeStatsMap[empName] = { appointments: 0, revenue: 0, ratings: [], avatar: null };
              }
              if (!employeeStatsMap[empName].avatar) {
                employeeStatsMap[empName].avatar = item.employee.avatar || avatarByUserId.get(item.employee.id) || null;
              }
              employeeStatsMap[empName].appointments++;
              // Per-service item price (the app-wide revenue convention)
              employeeStatsMap[empName].revenue += item.price || 0;
            }
          });
        } else if (apt.employeeId && apt.employee) {
          const empName = `${apt.employee.firstName} ${apt.employee.lastName}`;
          if (!employeeStatsMap[empName]) {
            employeeStatsMap[empName] = { appointments: 0, revenue: 0, ratings: [], avatar: null };
          }
          if (!employeeStatsMap[empName].avatar) {
            employeeStatsMap[empName].avatar = apt.employee.avatar || avatarByUserId.get(apt.employee.id) || null;
          }
          employeeStatsMap[empName].appointments++;
          employeeStatsMap[empName].revenue += this.appointmentRevenue(apt);
        }
      });

      const reviews = await prisma.review.findMany({
        where: { ...tenantWhere, createdAt: { gte: start, lte: end } },
        include: {
          client: {
            include: {
              appointments: {
                where: appointmentWhere,
                include: { employee: true }
              }
            }
          }
        }
      });

      reviews.forEach(review => {
        if (review.rating) {
          const lastAppt = review.client.appointments?.[0];
          if (lastAppt?.employeeId && lastAppt.employee) {
            const empName = `${lastAppt.employee.firstName} ${lastAppt.employee.lastName}`;
            if (employeeStatsMap[empName]) {
              employeeStatsMap[empName].ratings.push(review.rating);
            }
          }
        }
      });

      const employeeData = Object.entries(employeeStatsMap).map(([name, stats]) => {
        const avgRating = stats.ratings.length > 0
          ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length
          : 4.5;
        return {
          name,
          avatar: stats.avatar,
          appointments: stats.appointments,
          revenue: Math.round(stats.revenue),
          rating: Math.round(avgRating * 10) / 10
        };
      }).sort((a, b) => b.appointments - a.appointments);

      const timeSlotCounts: { [key: string]: number } = {};
      appointments.forEach(apt => {
        const hour = new Date(apt.startTime).getHours();
        const slot = `${String(hour).padStart(2, '0')}:00`;
        timeSlotCounts[slot] = (timeSlotCounts[slot] || 0) + 1;
      });
      const timeSlotData = Object.entries(timeSlotCounts)
        .map(([slot, count]) => ({ slot, count }))
        .sort((a, b) => a.slot.localeCompare(b.slot))
        .slice(0, 9);

      const completedAppointments = appointments.filter(a => a.status === 'COMPLETED').length;
      const noShowAppointments = appointments.filter(a => a.status === 'NO_SHOW').length;
      const attendanceRate = totalAppointments > 0
        ? ((completedAppointments / (completedAppointments + noShowAppointments)) * 100)
        : 0;

      const totalDuration = appointments.reduce((sum, apt) => sum + (apt.duration || 0), 0);
      const avgDuration = totalAppointments > 0 ? Math.round(totalDuration / totalAppointments) : 0;

      const allReviews = await prisma.review.findMany({
        where: { ...tenantWhere, createdAt: { gte: start, lte: end }, status: 'APPROVED' }
      });
      const avgSatisfaction = allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length
        : 0;

      const clientAppointmentCounts: { [key: string]: number } = {};
      appointments.forEach(apt => {
        clientAppointmentCounts[apt.clientId] = (clientAppointmentCounts[apt.clientId] || 0) + 1;
      });
      const loyalClients = Object.values(clientAppointmentCounts).filter(c => c >= 3).length;
      const totalUniqueClients = Object.keys(clientAppointmentCounts).length;
      const loyaltyRate = totalUniqueClients > 0 ? (loyalClients / totalUniqueClients) * 100 : 0;

      const cancelledAppointments = appointments.filter(a => a.status === 'CANCELLED').length;
      const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;

      const advanceBookings = appointments.filter(apt => {
        const bookingDate = new Date(apt.createdAt);
        const apptDate = new Date(apt.startTime);
        const daysDiff = (apptDate.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 2;
      }).length;
      const advanceBookingRate = totalAppointments > 0 ? (advanceBookings / totalAppointments) * 100 : 0;

      const revenueAppointmentsCount = revenueAppointments.filter(a => (revenueByAppt.get(a.id) || 0) > 0).length;
      const avgBasket = revenueAppointmentsCount > 0 ? totalRevenue / revenueAppointmentsCount : 0;

      const loyalClientsCount = loyalClients;

      const peakHours: { time: string; rate: number }[] = [];
      const hourGroups = [
        { start: 9, end: 11, label: '09:00 - 11:00' },
        { start: 11, end: 13, label: '11:00 - 13:00' },
        { start: 14, end: 16, label: '14:00 - 16:00' },
        { start: 16, end: 18, label: '16:00 - 18:00' },
        { start: 18, end: 20, label: '18:00 - 20:00' },
      ];
      hourGroups.forEach(group => {
        const slotAppointments = appointments.filter(apt => {
          const hour = new Date(apt.startTime).getHours();
          return hour >= group.start && hour < group.end;
        }).length;
        const theoreticalMax = totalAppointments * 0.25;
        const rate = theoreticalMax > 0 ? Math.min((slotAppointments / theoreticalMax) * 100, 100) : 0;
        peakHours.push({ time: group.label, rate: Math.round(rate) });
      });

      // Only two booking origins are tracked in the data model: ONLINE (public booking)
      // and STAFF (salon-created). A finer per-channel breakdown (Instagram, WhatsApp…)
      // is never recorded, so we expose the real 2-category split instead of fake estimates.
      const totalChannelCount = onlineAppointments + salonAppointments;
      const channelEstimates = [
        { channel: 'Site web', count: onlineAppointments, percentage: totalChannelCount > 0 ? Math.round((onlineAppointments / totalChannelCount) * 100) : 0, icon: 'globe' },
        { channel: 'En salon', count: salonAppointments, percentage: totalChannelCount > 0 ? Math.round((salonAppointments / totalChannelCount) * 100) : 0, icon: 'store' },
      ].filter(c => c.count > 0);

      const clientsWithBirthDate = await prisma.client.findMany({
        where: { ...salonClientsFilter(tenantId), dateOfBirth: { not: null } },
        select: { dateOfBirth: true }
      });

      const ageDist = { '18-25': 0, '26-35': 0, '36-45': 0, '46-60': 0, '60+': 0 };
      const now = new Date();
      clientsWithBirthDate.forEach(client => {
        if (client.dateOfBirth) {
          const birthDate = new Date(client.dateOfBirth);
          const age = now.getFullYear() - birthDate.getFullYear();
          if (age >= 18 && age <= 25) ageDist['18-25']++;
          else if (age >= 26 && age <= 35) ageDist['26-35']++;
          else if (age >= 36 && age <= 45) ageDist['36-45']++;
          else if (age >= 46 && age <= 60) ageDist['46-60']++;
          else if (age > 60) ageDist['60+']++;
        }
      });
      const totalClientsWithAge = Object.values(ageDist).reduce((sum, c) => sum + c, 0);
      const ageData = [
        { age: '18-25 ans', count: ageDist['18-25'], percentage: totalClientsWithAge > 0 ? Math.round((ageDist['18-25'] / totalClientsWithAge) * 100) : 0 },
        { age: '26-35 ans', count: ageDist['26-35'], percentage: totalClientsWithAge > 0 ? Math.round((ageDist['26-35'] / totalClientsWithAge) * 100) : 0 },
        { age: '36-45 ans', count: ageDist['36-45'], percentage: totalClientsWithAge > 0 ? Math.round((ageDist['36-45'] / totalClientsWithAge) * 100) : 0 },
        { age: '46-60 ans', count: ageDist['46-60'], percentage: totalClientsWithAge > 0 ? Math.round((ageDist['46-60'] / totalClientsWithAge) * 100) : 0 },
        { age: '60+ ans', count: ageDist['60+'], percentage: totalClientsWithAge > 0 ? Math.round((ageDist['60+'] / totalClientsWithAge) * 100) : 0 },
      ];

      const frequencyData = [
        { type: 'Réguliers', desc: 'Hebdomadaire', count: Object.values(clientAppointmentCounts).filter(c => c >= 4).length, color: '#002366' },
        { type: 'Fréquents', desc: 'Bi-mensuel', count: Object.values(clientAppointmentCounts).filter(c => c === 2 || c === 3).length, color: '#3B82F6' },
        { type: 'Occasionnels', desc: 'Mensuel', count: Object.values(clientAppointmentCounts).filter(c => c === 1).length, color: '#60A5FA' },
        { type: 'Nouveaux', desc: 'Première visite', count: newClients.length, color: '#93C5FD' },
      ];

      const timePreferences: { day: string; morning: number; afternoon: number; evening: number }[] = [];
      const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      for (let dayIdx = 1; dayIdx <= 6; dayIdx++) {
        const dayAppts = appointments.filter(apt => new Date(apt.startTime).getDay() === dayIdx);
        if (dayAppts.length > 0) {
          const morning = dayAppts.filter(apt => { const h = new Date(apt.startTime).getHours(); return h >= 8 && h < 12; }).length;
          const afternoon = dayAppts.filter(apt => { const h = new Date(apt.startTime).getHours(); return h >= 12 && h < 17; }).length;
          const evening = dayAppts.filter(apt => { const h = new Date(apt.startTime).getHours(); return h >= 17 && h < 20; }).length;
          const total = morning + afternoon + evening;
          timePreferences.push({
            day: daysOfWeek[dayIdx - 1],
            morning: total > 0 ? Math.round((morning / total) * 100) : 0,
            afternoon: total > 0 ? Math.round((afternoon / total) * 100) : 0,
            evening: total > 0 ? Math.round((evening / total) * 100) : 0,
          });
        }
      }

      // Real period-over-period deltas for the KPI delta badges (null = no previous data → badge hidden).
      const hasPrevData = prev.totalAppointments > 0;

      return {
        onlineAppointments,
        totalAppointments,
        onlineRate: Math.round(onlineRate * 10) / 10,
        newOnlineClients,
        newSalonClients,
        appointmentsTrend,
        revenueData,
        totalRevenue: Math.round(totalRevenue),
        avgRevenue: Math.round(avgRevenue),
        peakDay,
        serviceData,
        employeeData,
        timeSlotData,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        avgDuration,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        loyaltyRate: Math.round(loyaltyRate * 10) / 10,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        advanceBookingRate: Math.round(advanceBookingRate * 10) / 10,
        avgBasket: Math.round(avgBasket),
        loyalClientsCount,
        peakHours,
        bookingChannels: channelEstimates,
        ageDistribution: ageData,
        visitFrequency: frequencyData,
        timePreferences,
        // Real period-over-period deltas for the KPI delta badges (null = no previous data → badge hidden).
        deltas: {
          totalAppointments: this.computeDelta(totalAppointments, prev.totalAppointments, 'pct', hasPrevData),
          onlineAppointments: this.computeDelta(onlineAppointments, prev.onlineAppointments, 'pct', hasPrevData),
          onlineRate: this.computeDelta(onlineRate, prev.onlineRate, 'points', hasPrevData),
          newOnlineClients: this.computeDelta(newOnlineClients, prev.newOnlineClients, 'pct', hasPrevData),
          newSalonClients: this.computeDelta(newSalonClients, prev.newSalonClients, 'pct', hasPrevData),
          attendanceRate: this.computeDelta(attendanceRate, prev.attendanceRate, 'points', hasPrevData),
          avgDuration: this.computeDelta(avgDuration, prev.avgDuration, 'diff', hasPrevData),
          avgSatisfaction: this.computeDelta(avgSatisfaction, prev.avgSatisfaction, 'diff', hasPrevData),
          loyaltyRate: this.computeDelta(loyaltyRate, prev.loyaltyRate, 'points', hasPrevData),
          cancellationRate: this.computeDelta(cancellationRate, prev.cancellationRate, 'points', hasPrevData),
          advanceBookingRate: this.computeDelta(advanceBookingRate, prev.advanceBookingRate, 'points', hasPrevData),
          avgBasket: this.computeDelta(avgBasket, prev.avgBasket, 'pct', hasPrevData),
          loyalClientsCount: this.computeDelta(loyalClientsCount, prev.loyalClientsCount, 'pct', hasPrevData),
        },
      };
    }
}

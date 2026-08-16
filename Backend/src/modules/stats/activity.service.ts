import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { StatsBase } from './stats.base';

/**
 * Stats sub-service (A1 split). Pure refactor — identical behavior.
 */
export class ActivityService extends StatsBase {
    async getAutresStats(tenantId: string, period?: string, startDate?: string, endDate?: string, month?: string, year?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      const tenantWhere = { tenantId };
      const appointmentWhere = { ...tenantWhere, startTime: { gte: start, lte: end } };

      const appointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        include: {
          service: true,
          employee: true,
          invoice: true,
          // Per-service employee assignments — bookings made with distinct
          // employees per service leave appointment.employeeId null, so the
          // real attribution lives here (same pattern as getCollaborateursStats).
          services: { select: { employeeId: true } },
        }
      });

      const allServices = await prisma.service.findMany({ where: tenantWhere });
      // Service items + legacy appointment.employeeId reference User records (role STAFF),
      // so employee buckets MUST be keyed by User.id — Employee records live in a separate id space.
      const allEmployees = await prisma.user.findMany({
        where: { ...tenantWhere, role: 'STAFF', isActive: true }
      });
      // Avatars are stored on the Employee record; the STAFF User row is often
      // auto-created without one. Fall back to the Employee avatar per user.
      const avatarByUserId = await this.buildAvatarByUserId(tenantId, allEmployees);

      const totalRDV = appointments.length;
      const activeCollaborateurs = allEmployees.length;
      const totalServices = allServices.length;
      const totalDuration = appointments.reduce((sum, apt) => sum + (apt.duration || 0), 0);
      const avgDuration = totalRDV > 0 ? Math.round(totalDuration / totalRDV) : 0;

      const salonAppointments = appointments.filter(a => a.source !== 'ONLINE').length;
      const onlineAppointments = totalRDV - salonAppointments;
      const salonPercentage = totalRDV > 0 ? Math.round((salonAppointments / totalRDV) * 100) : 0;
      const onlinePercentage = 100 - salonPercentage;

      const employeeStats: any = {};
      allEmployees.forEach(emp => {
        employeeStats[emp.id] = {
          name: `${emp.firstName} ${emp.lastName}`,
          avatar: emp.avatar || avatarByUserId.get(emp.id) || null,
          salonAppointments: 0, onlineAppointments: 0, totalAppointments: 0,
          salonServices: 0, onlineServices: 0, totalServices: 0, onlineRate: 0
        };
      });

      appointments.forEach((apt: any) => {
        // "Services performed" counts exclude cancelled appointments (app-wide rule)
        if (apt.status === 'CANCELLED') return;
        const isSalon = apt.source !== 'ONLINE';
        const items = apt.services && apt.services.length > 0 ? apt.services : null;

        // Prestations = performed services: count once per service item.
        // RDV counts = appointments: dedupe employees so one appointment with
        // several services assigned to the same employee counts as one RDV.
        const rdvEmployees = new Set<string>();
        if (items) {
          items.forEach((item: any) => {
            if (item.employeeId && employeeStats[item.employeeId]) {
              rdvEmployees.add(item.employeeId);
              employeeStats[item.employeeId].totalServices++;
              if (isSalon) employeeStats[item.employeeId].salonServices++;
              else employeeStats[item.employeeId].onlineServices++;
            }
          });
        } else if (apt.employeeId && employeeStats[apt.employeeId]) {
          rdvEmployees.add(apt.employeeId);
          employeeStats[apt.employeeId].totalServices++;
          if (isSalon) employeeStats[apt.employeeId].salonServices++;
          else employeeStats[apt.employeeId].onlineServices++;
        }

        rdvEmployees.forEach((empId: string) => {
          employeeStats[empId].totalAppointments++;
          if (isSalon) employeeStats[empId].salonAppointments++;
          else employeeStats[empId].onlineAppointments++;
        });
      });

      Object.values(employeeStats).forEach((emp: any) => {
        emp.onlineRate = emp.totalAppointments > 0 ? Math.round((emp.onlineAppointments / emp.totalAppointments) * 100) : 0;
      });

      const serviceStats: any = {};
      allServices.forEach(svc => {
        serviceStats[svc.id] = { name: svc.name, salonAppointments: 0, onlineAppointments: 0, totalAppointments: 0 };
      });

      appointments.forEach(apt => {
        // "Services performed" counts exclude cancelled appointments (app-wide rule)
        if (apt.status === 'CANCELLED') return;
        if (apt.serviceId && serviceStats[apt.serviceId]) {
          serviceStats[apt.serviceId].totalAppointments++;
          const isSalon = apt.source !== 'ONLINE';
          if (isSalon) serviceStats[apt.serviceId].salonAppointments++;
          else serviceStats[apt.serviceId].onlineAppointments++;
        }
      });

      const colors = ['#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

      const rdvPrisData = [
        { name: 'Pris en ligne', value: onlinePercentage, color: '#10b981' },
        { name: 'Pris en salon', value: salonPercentage, color: '#d1d5db' },
      ];

      const employeeList = Object.values(employeeStats).filter((e: any) => e.totalServices > 0) as any[];
      const totalSalonServices = employeeList.reduce((sum: number, e: any) => sum + e.salonServices, 0);
      const totalOnlineServices = employeeList.reduce((sum: number, e: any) => sum + e.onlineServices, 0);
      const totalAllServices = employeeList.reduce((sum: number, e: any) => sum + e.totalServices, 0);

      const salonPct = this.roundTo100(employeeList.map((emp: any) => emp.salonServices), totalSalonServices);
      const lignePct = this.roundTo100(employeeList.map((emp: any) => emp.onlineServices), totalOnlineServices);
      const allPct = this.roundTo100(employeeList.map((emp: any) => emp.totalServices), totalAllServices);

      const prestationsSalonData = employeeList
        .map((emp: any, idx: number) => ({ name: emp.name, value: salonPct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value);

      const prestationsLigneData = employeeList
        .map((emp: any, idx: number) => ({ name: emp.name, value: lignePct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value);

      const totalPrestationsData = employeeList
        .map((emp: any, idx: number) => ({ name: emp.name, value: allPct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value);

      const serviceList = Object.values(serviceStats).filter((s: any) => s.totalAppointments > 0) as any[];
      const totalSalonAppointments = serviceList.reduce((sum: number, s: any) => sum + s.salonAppointments, 0);
      const totalOnlineAppointments = serviceList.reduce((sum: number, s: any) => sum + s.onlineAppointments, 0);
      const totalAllAppointments = serviceList.reduce((sum: number, s: any) => sum + s.totalAppointments, 0);

      const rdvSalonPct = this.roundTo100(serviceList.map((svc: any) => svc.salonAppointments), totalSalonAppointments);
      const rdvLignePct = this.roundTo100(serviceList.map((svc: any) => svc.onlineAppointments), totalOnlineAppointments);
      const rdvAllPct = this.roundTo100(serviceList.map((svc: any) => svc.totalAppointments), totalAllAppointments);

      const rdvSalonParPrestationData = serviceList
        .map((svc: any, idx: number) => ({ name: svc.name, value: rdvSalonPct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value).slice(0, 6);

      const rdvLigneParPrestationData = serviceList
        .map((svc: any, idx: number) => ({ name: svc.name, value: rdvLignePct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value).slice(0, 6);

      const totalRdvParPrestationData = serviceList
        .map((svc: any, idx: number) => ({ name: svc.name, value: rdvAllPct[idx], color: colors[idx % colors.length] }))
        .sort((a: any, b: any) => b.value - a.value).slice(0, 6);

      const performanceData = employeeList
        .map((emp: any) => ({
          name: emp.name,
          avatar: emp.avatar || null,
          initials: emp.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
          rdv: emp.totalAppointments,
          prestations: emp.totalServices,
          taux: emp.onlineRate
        }))
        .sort((a: any, b: any) => b.rdv - a.rdv).slice(0, 10);

      return {
        totalRDV, activeCollaborateurs, totalServices, avgDuration,
        rdvPrisData, prestationsSalonData, prestationsLigneData, totalPrestationsData,
        rdvSalonParPrestationData, rdvLigneParPrestationData, totalRdvParPrestationData,
        performanceData
      };
    }

    async getPrestationsStats(tenantId: string, period?: string, startDate?: string, endDate?: string, month?: string, year?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      const tenantWhere = { tenantId };
      const appointmentWhere = { ...tenantWhere, startTime: { gte: start, lte: end } };

      const appointments = await this.fetchAppointmentsWithRelations(appointmentWhere);

      const allServices = await prisma.service.findMany({ where: tenantWhere });

      const serviceStats: any = {};
      allServices.forEach(svc => {
        serviceStats[svc.id] = { name: svc.name, category: svc.category || 'AUTRE', total: 0, salon: 0, ligne: 0, revenue: 0 };
      });

      appointments.forEach(apt => {
        // "Services performed" counts exclude cancelled appointments (app-wide rule)
        if (apt.status === 'CANCELLED') return;
        if (apt.serviceId && serviceStats[apt.serviceId]) {
          serviceStats[apt.serviceId].total++;
          const isSalon = apt.source !== 'ONLINE';
          if (isSalon) serviceStats[apt.serviceId].salon++;
          else serviceStats[apt.serviceId].ligne++;
          // Per-service item price convention (never Invoice totals)
          serviceStats[apt.serviceId].revenue += this.appointmentRevenue(apt);
        }
      });

      const categoryMap: { [key: string]: any[] } = {};
      Object.values(serviceStats).forEach((stat: any) => {
        if (stat.total > 0) {
          const category = stat.category.toUpperCase();
          if (!categoryMap[category]) categoryMap[category] = [];
          categoryMap[category].push({
            name: stat.name, total: stat.total, salon: stat.salon, ligne: stat.ligne,
            taux: stat.total > 0 ? Math.round((stat.ligne / stat.total) * 100 * 10) / 10 : 0,
            revenue: Math.round(stat.revenue)
          });
        }
      });

      const prestationsData = Object.entries(categoryMap).map(([category, items]) => ({
        category,
        items: items.sort((a, b) => b.total - a.total)
      })).sort((a, b) => {
        const aTotal = (a.items as any[]).reduce((sum: number, item: any) => sum + item.total, 0);
        const bTotal = (b.items as any[]).reduce((sum: number, item: any) => sum + item.total, 0);
        return bTotal - aTotal;
      });

      const statsArr = Object.values(serviceStats) as any[];
      const totalPrestations = statsArr.reduce((sum: number, s: any) => sum + s.total, 0);
      const totalSalon = statsArr.reduce((sum: number, s: any) => sum + s.salon, 0);
      const totalLigne = statsArr.reduce((sum: number, s: any) => sum + s.ligne, 0);
      const tauxLigne = totalPrestations > 0 ? Math.round((totalLigne / totalPrestations) * 100 * 10) / 10 : 0;

      return { totalPrestations, prisEnSalon: totalSalon, prisEnLigne: totalLigne, tauxEnLigne: tauxLigne, prestationsData };
    }

    async getCollaborateursStats(tenantIds: string | string[], period?: string, startDate?: string, endDate?: string, month?: string, year?: string, categoryId?: string, serviceId?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      const tenantWhere = { tenantId: tenantIdFilter(tenantIds) };
      const appointmentWhere: any = {
        ...tenantWhere,
        startTime: { gte: start, lte: end },
        // CANCELLED excluded from revenue/"services performed" counts (app-wide rule)
        status: { not: 'CANCELLED' }
      };

      // Optional per-service filters (category string / service id) — match on the appointment's service items
      const serviceFilters: any[] = [];
      if (categoryId && categoryId !== 'all') serviceFilters.push({ service: { category: categoryId } });
      if (serviceId && serviceId !== 'all') serviceFilters.push({ service: { id: serviceId } });
      if (serviceFilters.length === 1) appointmentWhere.services = { some: serviceFilters[0] };
      else if (serviceFilters.length > 1) appointmentWhere.services = { some: { AND: serviceFilters } };

      const appointments = await this.fetchAppointmentsWithRelations(appointmentWhere);

      // Service items + legacy appointment.employeeId reference User records (role STAFF),
      // so employee buckets MUST be keyed by User.id — Employee records live in a separate id space.
      const allEmployees = await prisma.user.findMany({
        where: { ...tenantWhere, role: 'STAFF', isActive: true }
      });
      const avatarByUserId = await this.buildAvatarByUserId(tenantIds, allEmployees);

      const employeeStats: any = {};
      allEmployees.forEach(emp => {
        employeeStats[emp.id] = { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, avatar: emp.avatar || avatarByUserId.get(emp.id) || null, totalServices: 0, inSalon: 0, online: 0, revenue: 0 };
      });

      appointments.forEach((apt: any) => {
        const isSalon = apt.source !== 'ONLINE';
        const items = apt.services && apt.services.length > 0 ? apt.services : null;
        if (items) {
          items.forEach((item: any) => {
            if (item.employeeId && employeeStats[item.employeeId]) {
              employeeStats[item.employeeId].totalServices++;
              if (isSalon) employeeStats[item.employeeId].inSalon++;
              else employeeStats[item.employeeId].online++;
              // Per-service item price (the app-wide revenue convention)
              employeeStats[item.employeeId].revenue += item.price || 0;
            }
          });
        } else if (apt.employeeId && employeeStats[apt.employeeId]) {
          employeeStats[apt.employeeId].totalServices++;
          if (isSalon) employeeStats[apt.employeeId].inSalon++;
          else employeeStats[apt.employeeId].online++;
          if (apt.invoice) employeeStats[apt.employeeId].revenue += apt.invoice.total || 0;
        }
      });

      const colors = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
      const collaborators = Object.values(employeeStats)
        .filter((emp: any) => emp.totalServices > 0)
        .map((emp: any, idx: number) => ({
          id: emp.id, name: emp.name, avatar: emp.avatar, color: colors[idx % colors.length],
          totalServices: emp.totalServices, inSalon: emp.inSalon, online: emp.online,
          onlineRate: emp.totalServices > 0 ? Math.round((emp.online / emp.totalServices) * 100 * 10) / 10 : 0,
          revenue: Math.round(emp.revenue * 100) / 100
        }))
        .sort((a: any, b: any) => b.totalServices - a.totalServices);

      const totals = {
        totalServices: collaborators.reduce((sum: number, c: any) => sum + c.totalServices, 0),
        inSalon: collaborators.reduce((sum: number, c: any) => sum + c.inSalon, 0),
        online: collaborators.reduce((sum: number, c: any) => sum + c.online, 0),
        revenue: collaborators.reduce((sum: number, c: any) => sum + c.revenue, 0),
        onlineRate: 0
      };
      totals.onlineRate = totals.totalServices > 0 ? Math.round((totals.online / totals.totalServices) * 100 * 10) / 10 : 0;

      return { collaborators, totals };
    }

    async getDailyRdvStats(tenantId: string, period?: string, startDate?: string, endDate?: string, month?: string, year?: string) {
      const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

      const tenantWhere = { tenantId };
      const appointmentWhere = { ...tenantWhere, startTime: { gte: start, lte: end } };

      const appointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        include: { client: true }
      });

      const daysInMonth = month ? new Date(parseInt(year || String(new Date().getFullYear())), parseInt(month) + 1, 0).getDate() : 31;
      const selectedMonth = month !== undefined ? parseInt(month) : new Date().getMonth();
      const selectedYear = year !== undefined ? parseInt(year) : new Date().getFullYear();

      // Absences (NO_SHOW) and cancellations (CANCELLED) are tracked separately:
      // the "taux d'absence" must NOT include cancelled appointments.
      const dailyStats: { [key: string]: { total: number; salon: number; online: number; absents: number; annules: number } } = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        dailyStats[dateKey] = { total: 0, salon: 0, online: 0, absents: 0, annules: 0 };
      }

      appointments.forEach(apt => {
        const date = new Date(apt.startTime);
        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        if (dailyStats[dateKey]) {
          dailyStats[dateKey].total++;
          const isSalon = apt.source !== 'ONLINE';
          if (isSalon) dailyStats[dateKey].salon++;
          else dailyStats[dateKey].online++;
          if (apt.status === 'NO_SHOW') dailyStats[dateKey].absents++;
          else if (apt.status === 'CANCELLED') dailyStats[dateKey].annules++;
        }
      });

      const dailyData = Object.entries(dailyStats).map(([dateKey, stats]) => {
        const [, monthStr, dayStr] = dateKey.split('-');
        return {
          date: `${dayStr}/${monthStr}`,
          totalPrestations: stats.total,
          inSalon: stats.salon,
          online: stats.online,
          onlineRate: stats.total > 0 ? ((stats.online / stats.total) * 100).toFixed(2) + '%' : '0%',
          absents: stats.absents,
          tauxAbsence: stats.total > 0 ? ((stats.absents / stats.total) * 100).toFixed(1) + '%' : '0%',
          annules: stats.annules,
          tauxAnnulation: stats.total > 0 ? ((stats.annules / stats.total) * 100).toFixed(1) + '%' : '0%',
        };
      }).sort((a, b) => {
        const [aDay, aMonth] = a.date.split('/');
        const [bDay, bMonth] = b.date.split('/');
        return parseInt(aDay) - parseInt(bDay);
      });

      const totals = dailyData.reduce((acc, day) => ({
        totalPrestations: acc.totalPrestations + day.totalPrestations,
        inSalon: acc.inSalon + day.inSalon,
        online: acc.online + day.online,
        absents: acc.absents + day.absents,
        annules: acc.annules + day.annules
      }), { totalPrestations: 0, inSalon: 0, online: 0, absents: 0, annules: 0 });

      const totalOnlineRate = totals.totalPrestations > 0 ? ((totals.online / totals.totalPrestations) * 100).toFixed(1) : '0';
      const totalTauxAbsence = totals.totalPrestations > 0 ? ((totals.absents / totals.totalPrestations) * 100).toFixed(1) : '0';
      const totalTauxAnnulation = totals.totalPrestations > 0 ? ((totals.annules / totals.totalPrestations) * 100).toFixed(1) : '0';

      // Equivalent previous period for real delta badges (same semantics as getDashboardStats)
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
      const prev = await this.computeDailyTotals(tenantId, prevStart, prevEnd);
      const hasPrevData = prev.totalPrestations > 0;
      const currentOnlineRate = totals.totalPrestations > 0 ? (totals.online / totals.totalPrestations) * 100 : 0;
      const currentAbsenceRate = totals.totalPrestations > 0 ? (totals.absents / totals.totalPrestations) * 100 : 0;
      const currentAnnulationRate = totals.totalPrestations > 0 ? (totals.annules / totals.totalPrestations) * 100 : 0;

      return {
        dailyData,
        totals: {
          ...totals,
          totalOnlineRate: totalOnlineRate + '%',
          totalTauxAbsence: totalTauxAbsence + '%',
          totalTauxAnnulation: totalTauxAnnulation + '%',
        },
        // Real period-over-period deltas (null = no previous-period data → badge hidden)
        deltas: {
          totalPrestations: this.computeDelta(totals.totalPrestations, prev.totalPrestations, 'pct', hasPrevData),
          inSalon: this.computeDelta(totals.inSalon, prev.inSalon, 'pct', hasPrevData),
          online: this.computeDelta(totals.online, prev.online, 'pct', hasPrevData),
          totalOnlineRate: this.computeDelta(currentOnlineRate, prev.onlineRate, 'points', hasPrevData),
          absents: this.computeDelta(totals.absents, prev.absents, 'pct', hasPrevData),
          totalTauxAbsence: this.computeDelta(currentAbsenceRate, prev.absenceRate, 'points', hasPrevData),
          annules: this.computeDelta(totals.annules, prev.annules, 'pct', hasPrevData),
          totalTauxAnnulation: this.computeDelta(currentAnnulationRate, prev.annulationRate, 'points', hasPrevData),
        },
      };
    }

    /**
     * Channel totals (salon vs online) + absences for an arbitrary window — used
     * for the rdv page's real period-over-period delta badges.
     */
}

import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';

interface DateRange {
  start: Date;
  end: Date;
}

export class StatsService {
  private parseDateRange(params: {
    period?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
    year?: string;
  }): DateRange {
    let start: Date;
    let end: Date = new Date();

    if (params.startDate && params.endDate) {
      start = new Date(params.startDate);
      end = new Date(params.endDate);
    } else if (params.month && params.year) {
      start = new Date(parseInt(params.year), parseInt(params.month), 1);
      end = new Date(parseInt(params.year), parseInt(params.month) + 1, 0, 23, 59, 59);
    } else {
      const now = new Date();
      const period = params.period || 'month';
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      switch (period) {
        case 'week':
          start = new Date(now);
          start.setDate(now.getDate() - 7);
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
        case 'all':
          start = new Date(2000, 0, 1);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    return { start, end };
  }

  /**
   * Largest-remainder percentage distribution: returns integer percentages that
   * always sum to exactly 100 (when total > 0), so stacked donut totals reconcile.
   */
  private roundTo100(values: number[], total: number): number[] {
    if (total <= 0 || values.length === 0) return values.map(() => 0);
    const exact = values.map((v) => (v / total) * 100);
    const rounded = exact.map((v) => Math.floor(v));
    let remainder = 100 - rounded.reduce((s, v) => s + v, 0);
    const byFraction = exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < byFraction.length && remainder > 0; k++) {
      rounded[byFraction[k].i] += 1;
      remainder -= 1;
    }
    return rounded;
  }

  /**
   * Map User.id → Employee.avatar so stats that bucket by STAFF User records
   * still show the avatar, which lives on the Employee record. Matches by
   * email first, then by first+last name (same convention as
   * resolveEmployeeUserId).
   */
  private async buildAvatarByUserId(
    tenantId: string | string[],
    users: { id: string; email: string | null; firstName: string; lastName: string }[]
  ): Promise<Map<string, string>> {
    const employees = await prisma.employee.findMany({
      where: { tenantId: tenantIdFilter(tenantId) },
    });
    const map = new Map<string, string>();
    for (const emp of employees) {
      if (!emp.avatar) continue;
      const user = users.find(
        (u) =>
          (emp.email && u.email?.toLowerCase() === emp.email.toLowerCase()) ||
          (!emp.email && u.firstName === emp.firstName && u.lastName === emp.lastName)
      );
      if (user && !map.has(user.id)) map.set(user.id, emp.avatar);
    }
    return map;
  }

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
  private newClientsFilter(tenantIds: string | string[], start: Date, end: Date) {
    const filter = tenantIdFilter(tenantIds);
    return {
      OR: [
        { tenantId: filter, createdAt: { gte: start, lte: end } },
        {
          appointments: {
            // New client = first contact in the period: they booked during the
            // period (createdAt) OR their first visit falls in it (startTime).
            // A booking made today for next week still makes them a new client.
            some: {
              tenantId: filter,
              OR: [
                { createdAt: { gte: start, lte: end } },
                { startTime: { gte: start, lte: end } },
              ],
            },
            none: { tenantId: filter, startTime: { lt: start } },
          },
        },
      ],
    };
  }

  /**
   * Revenue for one appointment following the app-wide convention: the sum of
   * per-service item prices (AppointmentServiceItem.price), falling back to the
   * legacy appointment-level service price, then to the PAID invoice total only
   * when no service price is available. Never used for SUBSCRIPTION invoices.
   */
  private appointmentRevenue(apt: any): number {
    const items = apt.services && apt.services.length > 0 ? apt.services : null;
    if (items) {
      return items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
    }
    if (apt.service?.price) return apt.service.price;
    if (apt.invoice?.status === 'PAID') return apt.invoice.total || 0;
    return 0;
  }

  /**
   * Compute the scalar metrics that drive the KPI cards, for an arbitrary window.
   * Used twice by getDashboardStats (current + previous period) so the delta
   * badges on the indicateurs-cles page compare real period-over-period data
   * instead of hardcoded values.
   */
  private async computeScalarMetrics(tenantId: string, start: Date, end: Date) {
    const tenantWhere = { tenantId };
    const appointmentWhere: any = { ...tenantWhere, startTime: { gte: start, lte: end } };

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      include: {
        service: true,
        services: { include: { service: true } },
        invoice: { select: { total: true, status: true } },
      },
    });

    const totalAppointments = appointments.length;
    const onlineAppointments = appointments.filter((a) => a.source === 'ONLINE').length;

    const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const attendanceRate = completed + noShow > 0 ? (completed / (completed + noShow)) * 100 : 0;

    const totalDuration = appointments.reduce((s, a) => s + (a.duration || 0), 0);
    const avgDuration = totalAppointments > 0 ? Math.round(totalDuration / totalAppointments) : 0;

    const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
    const cancellationRate = totalAppointments > 0 ? (cancelled / totalAppointments) * 100 : 0;

    const advance = appointments.filter((a) => (new Date(a.startTime).getTime() - new Date(a.createdAt).getTime()) / 86400000 >= 2).length;
    const advanceBookingRate = totalAppointments > 0 ? (advance / totalAppointments) * 100 : 0;

    // Revenue = sum of per-service item prices for non-cancelled appointments
    // (the app-wide convention — never Invoice data, so the platform SUBSCRIPTION
    // invoice can never leak into salon revenue).
    const activeAppointments = appointments.filter((a) => a.status !== 'CANCELLED');
    const totalRevenue = activeAppointments.reduce((s, a) => s + this.appointmentRevenue(a), 0);
    const revenueAppointments = activeAppointments.filter((a) => this.appointmentRevenue(a) > 0);
    const avgBasket = revenueAppointments.length > 0 ? totalRevenue / revenueAppointments.length : 0;

    const perClient: Record<string, number> = {};
    activeAppointments.forEach((a) => { perClient[a.clientId] = (perClient[a.clientId] || 0) + 1; });
    const loyalClientsCount = Object.values(perClient).filter((c) => c >= 3).length;
    const uniqueClients = Object.keys(perClient).length;
    const loyaltyRate = uniqueClients > 0 ? (loyalClientsCount / uniqueClients) * 100 : 0;

    const newClients = await prisma.client.findMany({
      where: this.newClientsFilter(tenantId, start, end),
      select: { id: true },
    });
    // New-client origin follows the same source-based classification as the rest
    // of the stats section (Appointment.source is the only tracked origin).
    const onlineClientIds = new Set(appointments.filter((a) => a.source === 'ONLINE').map((a) => a.clientId));
    const salonClientIds = new Set(appointments.filter((a) => a.source !== 'ONLINE').map((a) => a.clientId));
    const newOnlineClients = newClients.filter((c) => onlineClientIds.has(c.id)).length;
    const newSalonClients = newClients.filter((c) => salonClientIds.has(c.id) && !onlineClientIds.has(c.id)).length;

    const reviews = await prisma.review.findMany({
      where: { ...tenantWhere, createdAt: { gte: start, lte: end }, status: 'APPROVED' },
      select: { rating: true },
    });
    const avgSatisfaction = reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
      : 0;

    return {
      totalAppointments,
      onlineAppointments,
      onlineRate: totalAppointments > 0 ? (onlineAppointments / totalAppointments) * 100 : 0,
      newOnlineClients,
      newSalonClients,
      attendanceRate,
      avgDuration,
      avgSatisfaction,
      loyaltyRate,
      cancellationRate,
      advanceBookingRate,
      avgBasket,
      loyalClientsCount,
    };
  }

  /**
   * Delta for a delta badge. kind 'pct' = % change, 'points' = percentage-point
   * change (for rate metrics), 'diff' = raw difference. Returns null when there
   * is no previous-period data to compare against (badge hidden on the page).
   */
  private computeDelta(
    current: number,
    previous: number,
    kind: 'pct' | 'points' | 'diff',
    hasPrevData: boolean
  ): number | null {
    if (kind === 'pct') {
      return previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
    }
    // For points/diff: only meaningful when the previous period actually had
    // appointments — otherwise a "+0"/"−30.3" badge against an empty period is noise.
    if (!hasPrevData) return null;
    return Math.round((current - previous) * 10) / 10;
  }

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

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      include: {
        service: true,
        employee: true,
        invoice: true,
        services: { include: { service: true, employee: true } }
      }
    });

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

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      include: { service: true, client: true, invoice: true, services: { include: { service: true } } }
    });

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

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      include: { employee: true, client: true, invoice: true, services: { include: { service: true } } }
    });

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

    // Each day also tracks absences (NO_SHOW + CANCELLED) — the "taux d'absence"
    // merged into this page (previously a separate rdv-pas-venus page).
    const dailyStats: { [key: string]: { total: number; salon: number; online: number; absents: number } } = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      dailyStats[dateKey] = { total: 0, salon: 0, online: 0, absents: 0 };
    }

    appointments.forEach(apt => {
      const date = new Date(apt.startTime);
      const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].total++;
        const isSalon = apt.source !== 'ONLINE';
        if (isSalon) dailyStats[dateKey].salon++;
        else dailyStats[dateKey].online++;
        if (apt.status === 'NO_SHOW' || apt.status === 'CANCELLED') dailyStats[dateKey].absents++;
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
      absents: acc.absents + day.absents
    }), { totalPrestations: 0, inSalon: 0, online: 0, absents: 0 });

    const totalOnlineRate = totals.totalPrestations > 0 ? ((totals.online / totals.totalPrestations) * 100).toFixed(1) : '0';
    const totalTauxAbsence = totals.totalPrestations > 0 ? ((totals.absents / totals.totalPrestations) * 100).toFixed(1) : '0';

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

    return {
      dailyData,
      totals: { ...totals, totalOnlineRate: totalOnlineRate + '%', totalTauxAbsence: totalTauxAbsence + '%' },
      // Real period-over-period deltas (null = no previous-period data → badge hidden)
      deltas: {
        totalPrestations: this.computeDelta(totals.totalPrestations, prev.totalPrestations, 'pct', hasPrevData),
        inSalon: this.computeDelta(totals.inSalon, prev.inSalon, 'pct', hasPrevData),
        online: this.computeDelta(totals.online, prev.online, 'pct', hasPrevData),
        totalOnlineRate: this.computeDelta(currentOnlineRate, prev.onlineRate, 'points', hasPrevData),
        absents: this.computeDelta(totals.absents, prev.absents, 'pct', hasPrevData),
        totalTauxAbsence: this.computeDelta(currentAbsenceRate, prev.absenceRate, 'points', hasPrevData),
      },
    };
  }

  /**
   * Channel totals (salon vs online) + absences for an arbitrary window — used
   * for the rdv page's real period-over-period delta badges.
   */
  private async computeDailyTotals(tenantId: string, start: Date, end: Date) {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId, startTime: { gte: start, lte: end } },
      select: { source: true, status: true }
    });
    const totalPrestations = appointments.length;
    const online = appointments.filter((a) => a.source === 'ONLINE').length;
    const inSalon = totalPrestations - online;
    const absents = appointments.filter((a) => a.status === 'NO_SHOW' || a.status === 'CANCELLED').length;
    return {
      totalPrestations,
      inSalon,
      online,
      absents,
      onlineRate: totalPrestations > 0 ? (online / totalPrestations) * 100 : 0,
      absenceRate: totalPrestations > 0 ? (absents / totalPrestations) * 100 : 0,
    };
  }

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

  private async aggregateClientVisitStats(
    tenantIds: string | string[],
    start: Date,
    end: Date
  ) {
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenantIdFilter(tenantIds),
        // Count a booking when it was MADE during the period (createdAt) OR when
        // the visit happens during it (startTime). Future-dated bookings made in
        // the period are real salon business and must count — a client who books
        // today for next week would otherwise be invisible to the stats.
        OR: [
          { createdAt: { gte: start, lte: end } },
          { startTime: { gte: start, lte: end } },
        ],
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            createdAt: true,
            status: true,
          },
        },
        service: { select: { price: true } },
        services: { select: { price: true } },
        invoice: { select: { total: true, status: true } },
      },
    });

    const byClient: Record<
      string,
      {
        client: (typeof appointments)[0]['client'];
        visits: number;
        revenue: number;
        lastVisit: Date | null;
      }
    > = {};

    for (const apt of appointments) {
      if (!apt.client) continue;
      const id = apt.clientId;
      if (!byClient[id]) {
        byClient[id] = { client: apt.client, visits: 0, revenue: 0, lastVisit: null };
      }
      byClient[id].visits += 1;
      // CA follows the app-wide convention: the sum of the prices shown in the
      // agenda (per-service item prices) — the same definition the personnels
      // stats use. This is not the accounting revenue: completing an appointment
      // via "Terminé" never creates an Invoice, so invoice-only sums were always 0.
      const items = (apt as any).services as { price: number }[] | undefined;
      if (items && items.length > 0) {
        byClient[id].revenue += items.reduce((sum, item) => sum + (item.price || 0), 0);
      } else if ((apt as any).service?.price) {
        byClient[id].revenue += (apt as any).service.price;
      } else if (apt.invoice?.status === 'PAID') {
        byClient[id].revenue += apt.invoice.total;
      }
      const aptStart = new Date(apt.startTime);
      if (!byClient[id].lastVisit || aptStart > byClient[id].lastVisit!) {
        byClient[id].lastVisit = aptStart;
      }
    }

    return byClient;
  }

  async getTopClients(
    tenantIds: string | string[],
    limit: number = 100,
    period?: string,
    startDate?: string,
    endDate?: string,
    month?: string,
    year?: string
  ) {
    const { start, end } = this.parseDateRange({
      period: period || 'all',
      startDate,
      endDate,
      month,
      year,
    });

    const byClient = await this.aggregateClientVisitStats(tenantIds, start, end);

    const clients = Object.values(byClient)
      .map((entry) => ({
        id: entry.client!.id,
        firstName: entry.client!.firstName,
        lastName: entry.client!.lastName,
        email: entry.client!.email,
        phone: entry.client!.phone,
        status: entry.client!.status,
        visits: entry.visits,
        revenue: Math.round(entry.revenue * 100) / 100,
        lastVisit: entry.lastVisit?.toISOString() ?? null,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits)
      .slice(0, limit);

    return {
      clients,
      total: clients.length,
      period: { start: start.toISOString(), end: end.toISOString() },
    };
  }

  async getNewClientsStats(
    tenantIds: string | string[],
    period?: string,
    startDate?: string,
    endDate?: string,
    month?: string,
    year?: string
  ) {
    const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });

    const filter = tenantIdFilter(tenantIds);
    const clients = await prisma.client.findMany({
      where: this.newClientsFilter(tenantIds, start, end),
      include: {
        _count: {
          select: {
            appointments: { where: { tenantId: filter } },
            invoices: { where: { tenantId: filter } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byMonth: Record<string, number> = {};
    for (const client of clients) {
      const key = `${client.createdAt.getFullYear()}-${String(client.createdAt.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }

    return {
      clients: clients.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        appointmentCount: c._count.appointments,
        invoiceCount: c._count.invoices,
      })),
      total: clients.length,
      trend: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      period: { start: start.toISOString(), end: end.toISOString() },
    };
  }

  async getClientFrequencyStats(
    tenantIds: string | string[],
    period?: string,
    startDate?: string,
    endDate?: string,
    month?: string,
    year?: string
  ) {
    const { start, end } = this.parseDateRange({ period, startDate, endDate, month, year });
    const byClient = await this.aggregateClientVisitStats(tenantIds, start, end);

    const visitCounts = Object.values(byClient).map((c) => c.visits);
    const clientsWithVisits = visitCounts.length;
    const noVisitClients = await prisma.client.findMany({
      where: {
        ...salonClientsFilter(tenantIds),
        appointments: { none: { tenantId: tenantIdFilter(tenantIds), startTime: { gte: start, lte: end }, status: { notIn: ['CANCELLED'] } } },
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
    const clientsWithoutVisits = noVisitClients.length;

    const regular = visitCounts.filter((c) => c >= 4).length;
    const frequent = visitCounts.filter((c) => c === 2 || c === 3).length;
    const occasional = visitCounts.filter((c) => c === 1).length;

    // Drill-down lists: which clients fall into each bucket (name, contact, visits).
    const clientsFor = (pred: (v: number) => boolean) =>
      Object.values(byClient)
        .filter((e) => pred(e.visits))
        .map((e) => ({
          id: e.client!.id,
          firstName: e.client!.firstName,
          lastName: e.client!.lastName,
          email: e.client!.email,
          phone: e.client!.phone,
          visits: e.visits,
        }));

    const frequencyBuckets = [
      { type: 'Réguliers', desc: '4+ visites', count: regular, color: '#002366', clients: clientsFor((v) => v >= 4) },
      { type: 'Fréquents', desc: '2-3 visites', count: frequent, color: '#3B82F6', clients: clientsFor((v) => v === 2 || v === 3) },
      { type: 'Occasionnels', desc: '1 visite', count: occasional, color: '#60A5FA', clients: clientsFor((v) => v === 1) },
      {
        type: 'Sans visite', desc: 'Aucun RDV sur la période', count: clientsWithoutVisits, color: '#93C5FD',
        clients: noVisitClients.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, visits: 0 })),
      },
    ];

    const avgVisits =
      clientsWithVisits > 0
        ? Math.round((visitCounts.reduce((s, c) => s + c, 0) / clientsWithVisits) * 10) / 10
        : 0;

    return {
      frequencyBuckets,
      stats: {
        clientsWithVisits,
        clientsWithoutVisits,
        totalClients: clientsWithVisits + clientsWithoutVisits,
        avgVisits,
        totalVisits: visitCounts.reduce((s, c) => s + c, 0),
      },
      period: { start: start.toISOString(), end: end.toISOString() },
    };
  }
}

export const statsService = new StatsService();

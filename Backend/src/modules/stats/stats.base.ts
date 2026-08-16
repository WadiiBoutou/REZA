import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';

interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Shared helpers for the stats sub-services (A1 split). Pure refactor —
 * identical behavior, only the file organization changed.
 */
export class StatsBase {
    protected parseDateRange(params: {
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

    protected roundTo100(values: number[], total: number): number[] {
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

    protected async buildAvatarByUserId(
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

    protected newClientsFilter(tenantIds: string | string[], start: Date, end: Date) {
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

    protected appointmentRevenue(apt: any): number {
      const items = apt.services && apt.services.length > 0 ? apt.services : null;
      if (items) {
        return items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
      }
      if (apt.service?.price) return apt.service.price;
      if (apt.invoice?.status === 'PAID') return apt.invoice.total || 0;
      return 0;
    }

    /**
     * Fetch appointments + relations in a flattened query shape (1 + 4 queries
     * total, instead of ~6 nested queries per appointment row) while returning
     * the EXACT same nested object shape Prisma's `include` would produce.
     * This kills the N+1 round-trip pattern on the stats dashboard/scalar paths.
     */

    protected async fetchAppointmentsWithRelations(where: any): Promise<any[]> {
      const appointments = await prisma.appointment.findMany({
        where,
        select: {
          id: true, tenantId: true, clientId: true, serviceId: true, employeeId: true,
          createdById: true, startTime: true, endTime: true, duration: true, status: true,
          source: true, notes: true, cancelledAt: true, cancelledBy: true,
          cancellationReason: true, bookingGroupId: true, createdAt: true, updatedAt: true,
        },
      });
      if (appointments.length === 0) return [];

      const ids = appointments.map(a => a.id);
      const serviceIds = [...new Set(appointments.map(a => a.serviceId).filter(Boolean))];
      const employeeIds = [...new Set(appointments.map(a => a.employeeId).filter(Boolean))];

      const [items, services, employees, invoices] = await Promise.all([
        prisma.appointmentServiceItem.findMany({
          where: { appointmentId: { in: ids } },
          select: {
            id: true, appointmentId: true, serviceId: true, employeeId: true,
            serviceName: true, duration: true, price: true, sortOrder: true,
            createdAt: true, updatedAt: true,
          },
        }),
        serviceIds.length
          ? prisma.service.findMany({
              where: { id: { in: serviceIds } },
              select: { id: true, name: true, price: true, category: true, duration: true },
            })
          : Promise.resolve([]),
        employeeIds.length
          ? prisma.user.findMany({
              where: { id: { in: employeeIds } },
              select: { id: true, firstName: true, lastName: true, avatar: true },
            })
          : Promise.resolve([]),
        prisma.invoice.findMany({
          where: { appointmentId: { in: ids } },
          select: { appointmentId: true, status: true, total: true, paidAt: true },
        }),
      ]);

      const serviceMap = new Map(services.map(s => [s.id, s]));
      const employeeMap = new Map(employees.map(e => [e.id, e]));
      const invoiceMap = new Map(invoices.map(i => [i.appointmentId, i]));
      const itemsByAppt = new Map<string, any[]>();
      for (const it of items) {
        const list = itemsByAppt.get(it.appointmentId) || [];
        list.push({
          ...it,
          service: it.serviceId ? serviceMap.get(it.serviceId) ?? null : null,
          employee: it.employeeId ? employeeMap.get(it.employeeId) ?? null : null,
        });
        itemsByAppt.set(it.appointmentId, list);
      }

      return appointments.map(a => ({
        ...a,
        service: a.serviceId ? serviceMap.get(a.serviceId) ?? null : null,
        employee: a.employeeId ? employeeMap.get(a.employeeId) ?? null : null,
        invoice: invoiceMap.get(a.id) ?? null,
        services: itemsByAppt.get(a.id) || [],
      }));
    }

    /**
     * Compute the scalar metrics that drive the KPI cards, for an arbitrary window.
     * Used twice by getDashboardStats (current + previous period) so the delta
     * badges on the indicateurs-cles page compare real period-over-period data
     * instead of hardcoded values.
     */

    protected async computeScalarMetrics(tenantId: string, start: Date, end: Date) {
      const tenantWhere = { tenantId };
      const appointmentWhere: any = { ...tenantWhere, startTime: { gte: start, lte: end } };

      const appointments = await this.fetchAppointmentsWithRelations(appointmentWhere);

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

    protected computeDelta(
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

    protected async computeDailyTotals(tenantId: string, start: Date, end: Date) {
      const appointments = await prisma.appointment.findMany({
        where: { tenantId, startTime: { gte: start, lte: end } },
        select: { source: true, status: true }
      });
      const totalPrestations = appointments.length;
      const online = appointments.filter((a) => a.source === 'ONLINE').length;
      const inSalon = totalPrestations - online;
      const absents = appointments.filter((a) => a.status === 'NO_SHOW').length;
      const annules = appointments.filter((a) => a.status === 'CANCELLED').length;
      return {
        totalPrestations,
        inSalon,
        online,
        absents,
        annules,
        onlineRate: totalPrestations > 0 ? (online / totalPrestations) * 100 : 0,
        absenceRate: totalPrestations > 0 ? (absents / totalPrestations) * 100 : 0,
        annulationRate: totalPrestations > 0 ? (annules / totalPrestations) * 100 : 0,
      };
    }

    protected async aggregateClientVisitStats(
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
}

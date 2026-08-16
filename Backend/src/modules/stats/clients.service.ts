import { prisma } from '../../lib/prisma';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { StatsBase } from './stats.base';

/**
 * Stats sub-service (A1 split). Pure refactor — identical behavior.
 */
export class ClientsService extends StatsBase {
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

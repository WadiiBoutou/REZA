// Stats facade — A1 split: implementation lives in stats.base.ts +
// per-domain sub-services; this file preserves the original exported API
// (statsService.getX(...)) so routes/controllers are untouched.
import { StatsBase } from './stats.base';
import { OverviewService } from './overview.service';
import { ActivityService } from './activity.service';
import { OccupancyService } from './occupancy.service';
import { ClientsService } from './clients.service';

// Class methods live on the prototype, so merging instances with Object.assign
// would copy nothing. Merge prototype methods explicitly instead.
function mergePrototypes(...Ctors: Array<{ prototype: unknown }>): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const Ctor of Ctors) {
    const proto = Ctor.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor') target[name] = proto[name];
    }
  }
  return target;
}

export const statsService = mergePrototypes(
  StatsBase, // shared protected helpers used via `this.` by sub-services
  OverviewService,
  ActivityService,
  OccupancyService,
  ClientsService,
) as unknown as {
  getOverview: Function;
  getAppointmentStats: Function;
  getRevenueStats: Function;
  getDashboardStats: Function;
  getAutresStats: Function;
  getPrestationsStats: Function;
  getCollaborateursStats: Function;
  getDailyRdvStats: Function;
  getOccupancyOverview: Function;
  getOccupancyCollaborateurs: Function;
  getOccupancyPrestations: Function;
  getTopClients: Function;
  getNewClientsStats: Function;
  getClientFrequencyStats: Function;
};

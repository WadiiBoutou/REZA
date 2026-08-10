import { Request } from 'express';

/**
 * Prisma tenant filter: single id or { in: ids }.
 */
export function tenantIdFilter(salonIds: string | string[]): string | { in: string[] } {
  const ids = Array.isArray(salonIds) ? salonIds : [salonIds];
  if (ids.length === 0) {
    throw new Error('SECURITY: salonIds is empty');
  }
  return ids.length === 1 ? ids[0] : { in: ids };
}

/**
 * Client membership filter for a salon scope: a client belongs to a salon when
 * it was created by that salon (tenantId) OR has booked there (appointments
 * carry their own tenantId). This keeps global client accounts (tenantId null)
 * visible in the salon's client list/stats once they have an appointment.
 */
export function salonClientsFilter(salonIds: string | string[]): { OR: unknown[] } {
  const filter = tenantIdFilter(salonIds);
  return {
    OR: [
      { tenantId: filter },
      { appointments: { some: { tenantId: filter } } },
    ],
  };
}

/**
 * Resolve target tenant for write ops.
 * Single-salon scope → that id.
 * Multi/all → require body/query tenantId within scope.
 */
export function resolveWriteTenantId(
  req: Request,
  bodyTenantId?: string | null
): string {
  const salonIds =
    req.salonIds && req.salonIds.length > 0
      ? req.salonIds
      : req.tenantId
        ? [req.tenantId]
        : [];

  if (salonIds.length === 0) {
    const err: any = new Error('No salon in scope');
    err.code = 'SALON_REQUIRED';
    throw err;
  }

  if (salonIds.length === 1) {
    return salonIds[0];
  }

  if (bodyTenantId && salonIds.includes(bodyTenantId)) {
    return bodyTenantId;
  }

  const err: any = new Error(
    'Plusieurs salons sélectionnés : précisez tenantId (salon) pour cette opération.'
  );
  err.code = 'SALON_REQUIRED';
  throw err;
}

export function isSalonRequiredError(error: unknown): boolean {
  return !!(error && typeof error === 'object' && (error as any).code === 'SALON_REQUIRED');
}

/** Parse X-Salon-Ids header or salonIds query into raw tokens. */
export function parseSalonIdsInput(req: Request): string[] | 'all' {
  const header = req.headers['x-salon-ids'];
  const headerRaw = Array.isArray(header) ? header[0] : header;
  const queryRaw = req.query.salonIds;
  const queryStr = Array.isArray(queryRaw) ? queryRaw[0] : queryRaw;

  const raw = (headerRaw || queryStr || '').toString().trim();
  if (!raw || raw.toLowerCase() === 'all') {
    return 'all';
  }

  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return ids.length === 0 ? 'all' : ids;
}

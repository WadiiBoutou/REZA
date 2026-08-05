import api from './api';

/**
 * Shared, module-level cached fetch of the full active salon catalog
 * (limit 200) so the homepage carousels don't issue duplicate requests and
 * so the global-average-rating + min-max normalization in the recommendation
 * score covers the whole platform, not just a slice.
 *
 * Cached for the lifetime of the page session; pass force=true to refresh.
 */
let catalogPromise: Promise<any[]> | null = null;

export function fetchSalonCatalog(force = false): Promise<any[]> {
  if (!catalogPromise || force) {
    catalogPromise = api
      .searchTenants(undefined, undefined, undefined, 200)
      .then((res) => res.tenants || [])
      .catch((err) => {
        catalogPromise = null; // allow a retry on next call
        throw err;
      });
  }
  return catalogPromise;
}

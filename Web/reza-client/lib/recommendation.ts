/**
 * Recommendation scoring for the homepage salon carousels.
 *
 * Bayesian-weighted rating (so a low-review-count salon doesn't dominate from a
 * lucky high rating):
 *
 *   bayesianRating = (v / (v + m)) * R + (m / (v + m)) * C
 *
 *   v = number of reviews for this salon
 *   R = this salon's own average rating
 *   C = average rating across ALL salons on the platform
 *   m = minimum trusted review volume (tunable constant)
 *
 * Combined recommendation score (when client location is known):
 *
 *   proximityScore    = 1 / (1 + distanceKm)
 *   recommendedScore  = 0.6 * normalize(bayesianRating) + 0.4 * normalize(proximityScore)
 *
 * where normalize() is min-max scaling across the salons being ranked.
 * When location is unknown, recommendedScore = bayesianRating (rating only).
 */

/** Minimum trusted review volume for the Bayesian weight. Tune this constant. */
export const BAYESIAN_MIN_REVIEWS = 15;

/** Weight of the (normalized) rating component when location is known. */
export const RATING_WEIGHT = 0.6;

/** Weight of the (normalized) proximity component when location is known. */
export const PROXIMITY_WEIGHT = 0.4;

/** How many salons a homepage carousel displays at most. */
export const CAROUSEL_SIZE = 10;

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bayesian-weighted rating for a single salon.
 * With v = 0 the formula collapses to the global mean C (the prior), which is
 * exactly the intended behavior for salons with no reviews yet.
 */
export function computeBayesianRating(
  reviewCount: number,
  rating: number,
  globalAverageRating: number,
  m: number = BAYESIAN_MIN_REVIEWS
): number {
  const v = Math.max(0, reviewCount);
  const R = rating || 0;
  const C = globalAverageRating || 0;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

/** Min-max normalize an array of numbers to [0, 1]. */
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // All values equal → nothing to discriminate; keep them at full weight.
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

/** Human-friendly distance string: "800 m" under 1 km, otherwise "1.2 km". */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

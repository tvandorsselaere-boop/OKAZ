// OKAZ Highlights System v1.0.0
// Système de mise en avant contextuelle (séparé du score)

import type { AnalyzedResult } from './scoring';

// ============================================================================
// INTERFACES
// ============================================================================

export type HighlightType = 'best_deal' | 'near_you' | 'guaranteed' | 'just_posted';

export interface Highlight {
  type: HighlightType;
  listing: AnalyzedResult;
  reason: string;
}

export interface HighlightConfig {
  // Position utilisateur (optionnelle)
  userLocation?: {
    lat: number;
    lng: number;
  };
  // Distance max en km pour "near_you" (défaut: 30)
  maxDistanceKm?: number;
  // Score minimum pour être éligible aux highlights
  minScore?: number;
}

// ============================================================================
// HIGHLIGHT LABELS
// ============================================================================

export const HIGHLIGHT_LABELS: Record<HighlightType, { emoji: string; title: string; color: string }> = {
  best_deal: {
    emoji: '🏆',
    title: 'Meilleure affaire',
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
  },
  near_you: {
    emoji: '📍',
    title: 'Près de chez toi',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  },
  guaranteed: {
    emoji: '🛡️',
    title: 'Avec garantie',
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  },
  just_posted: {
    emoji: '⚡',
    title: 'Vient de sortir',
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  },
};

// ============================================================================
// DISTANCE CALCULATION (Haversine)
// ============================================================================

/**
 * Calcule la distance en km entre deux points GPS
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ============================================================================
// GEOCODING (Simple mapping pour les grandes villes)
// Pour une vraie implémentation, utiliser l'API Nominatim ou Google Geocoding
// ============================================================================

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'paris': { lat: 48.8566, lng: 2.3522 },
  'marseille': { lat: 43.2965, lng: 5.3698 },
  'lyon': { lat: 45.7640, lng: 4.8357 },
  'toulouse': { lat: 43.6047, lng: 1.4442 },
  'nice': { lat: 43.7102, lng: 7.2620 },
  'nantes': { lat: 47.2184, lng: -1.5536 },
  'strasbourg': { lat: 48.5734, lng: 7.7521 },
  'montpellier': { lat: 43.6108, lng: 3.8767 },
  'bordeaux': { lat: 44.8378, lng: -0.5792 },
  'lille': { lat: 50.6292, lng: 3.0573 },
  'rennes': { lat: 48.1173, lng: -1.6778 },
  'reims': { lat: 49.2583, lng: 4.0317 },
  'le havre': { lat: 49.4944, lng: 0.1079 },
  'saint-etienne': { lat: 45.4397, lng: 4.3872 },
  'toulon': { lat: 43.1242, lng: 5.9280 },
  'grenoble': { lat: 45.1885, lng: 5.7245 },
  'dijon': { lat: 47.3220, lng: 5.0415 },
  'angers': { lat: 47.4784, lng: -0.5632 },
  'nîmes': { lat: 43.8367, lng: 4.3601 },
  'villeurbanne': { lat: 45.7676, lng: 4.8810 },
};

// Arrondissements Paris
for (let i = 1; i <= 20; i++) {
  const suffix = i === 1 ? 'er' : 'e';
  CITY_COORDINATES[`paris ${i}${suffix}`] = { lat: 48.8566, lng: 2.3522 };
  CITY_COORDINATES[`${i}${suffix} paris`] = { lat: 48.8566, lng: 2.3522 };
  CITY_COORDINATES[`paris ${i}`] = { lat: 48.8566, lng: 2.3522 };
}

/**
 * Tente de géocoder une localisation
 * Retourne null si non trouvée
 */
export function geocodeLocation(location: string): { lat: number; lng: number } | null {
  if (!location) return null;

  const normalized = location.toLowerCase().trim();

  // Recherche exacte
  if (CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized];
  }

  // Recherche partielle (ville dans la chaîne)
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalized.includes(city) || city.includes(normalized)) {
      return coords;
    }
  }

  return null;
}

// ============================================================================
// HIGHLIGHT DETECTION
// ============================================================================

/**
 * Trouve le meilleur deal (score le plus haut)
 */
function findBestDeal(results: AnalyzedResult[], minScore: number): Highlight | null {
  const eligible = results.filter(r => r.score >= minScore);
  if (eligible.length === 0) return null;

  const best = eligible.reduce((a, b) => (a.score > b.score ? a : b));

  return {
    type: 'best_deal',
    listing: best,
    reason: `Score de ${best.score}/100`,
  };
}

/**
 * Trouve le meilleur résultat proche de l'utilisateur
 */
function findNearYou(
  results: AnalyzedResult[],
  userLocation: { lat: number; lng: number },
  maxDistanceKm: number,
  minScore: number
): Highlight | null {
  // Filtrer les résultats avec handDelivery et une localisation
  const withLocation = results.filter(r =>
    r.handDelivery === true &&
    r.location &&
    r.score >= minScore
  );

  if (withLocation.length === 0) return null;

  // Calculer les distances
  const withDistance = withLocation
    .map(r => {
      const coords = geocodeLocation(r.location!);
      if (!coords) return null;

      const distance = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        coords.lat,
        coords.lng
      );

      return { result: r, distance };
    })
    .filter((item): item is { result: AnalyzedResult; distance: number } =>
      item !== null && item.distance <= maxDistanceKm
    );

  if (withDistance.length === 0) return null;

  // Trouver le meilleur score parmi ceux à proximité
  const best = withDistance.reduce((a, b) =>
    a.result.score > b.result.score ? a : b
  );

  return {
    type: 'near_you',
    listing: best.result,
    reason: `À ${Math.round(best.distance)} km de toi`,
  };
}

/**
 * Trouve le meilleur résultat avec garantie
 */
function findGuaranteed(results: AnalyzedResult[], minScore: number): Highlight | null {
  const withWarranty = results.filter(r =>
    r.hasWarranty === true &&
    r.score >= minScore
  );

  if (withWarranty.length === 0) return null;

  const best = withWarranty.reduce((a, b) => (a.score > b.score ? a : b));

  return {
    type: 'guaranteed',
    listing: best,
    reason: 'Garantie incluse',
  };
}

/**
 * Trouve une annonce très récente avec un bon score
 */
function findJustPosted(results: AnalyzedResult[], minScore: number): Highlight | null {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recent = results.filter(r => {
    if (!r.postedAt) return false;
    const posted = typeof r.postedAt === 'string' ? new Date(r.postedAt) : r.postedAt;
    return posted >= oneHourAgo && r.score >= minScore;
  });

  if (recent.length === 0) return null;

  const best = recent.reduce((a, b) => (a.score > b.score ? a : b));

  const posted = typeof best.postedAt === 'string' ? new Date(best.postedAt) : best.postedAt!;
  const minutesAgo = Math.round((now.getTime() - posted.getTime()) / (1000 * 60));

  return {
    type: 'just_posted',
    listing: best,
    reason: `Publié il y a ${minutesAgo} min`,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Génère les highlights pour une liste de résultats
 * Retourne un tableau de highlights (max 1 par type)
 */
export function generateHighlights(
  results: AnalyzedResult[],
  config: HighlightConfig = {}
): Highlight[] {
  const {
    userLocation,
    maxDistanceKm = 30,
    minScore = 50,
  } = config;

  const highlights: Highlight[] = [];

  // 1. Best Deal (toujours affiché si trouvé)
  const bestDeal = findBestDeal(results, minScore);
  if (bestDeal) {
    highlights.push(bestDeal);
  }

  // 2. Near You (seulement si géoloc disponible)
  if (userLocation) {
    const nearYou = findNearYou(results, userLocation, maxDistanceKm, minScore);
    if (nearYou && nearYou.listing.id !== bestDeal?.listing.id) {
      highlights.push(nearYou);
    }
  }

  // 3. Guaranteed
  const guaranteed = findGuaranteed(results, minScore);
  if (guaranteed) {
    // Éviter les doublons
    const existingIds = highlights.map(h => h.listing.id);
    if (!existingIds.includes(guaranteed.listing.id)) {
      highlights.push(guaranteed);
    }
  }

  // 4. Just Posted
  const justPosted = findJustPosted(results, 70); // Score minimum plus élevé
  if (justPosted) {
    const existingIds = highlights.map(h => h.listing.id);
    if (!existingIds.includes(justPosted.listing.id)) {
      highlights.push(justPosted);
    }
  }

  return highlights;
}

/**
 * Vérifie si un résultat est un highlight
 */
export function isHighlight(resultId: string, highlights: Highlight[]): HighlightType | null {
  const found = highlights.find(h => h.listing.id === resultId);
  return found?.type ?? null;
}

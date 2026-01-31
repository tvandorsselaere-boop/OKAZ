// OKAZ Geolocation Utilities v1.0.0
// Gestion de la géolocalisation et calcul de distances

// ============================================================================
// INTERFACES
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  coords: Coordinates;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Rayon de la Terre en km
const EARTH_RADIUS_KM = 6371;

// Cache de géocodage (évite les requêtes répétées)
const geocodeCache = new Map<string, GeocodingResult | null>();

// Coordonnées des grandes villes françaises
const FRENCH_CITIES: Record<string, Coordinates> = {
  // Top 20 villes
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
  'nimes': { lat: 43.8367, lng: 4.3601 },
  'villeurbanne': { lat: 45.7676, lng: 4.8810 },
  // Villes moyennes importantes
  'aix-en-provence': { lat: 43.5297, lng: 5.4474 },
  'brest': { lat: 48.3904, lng: -4.4861 },
  'limoges': { lat: 45.8336, lng: 1.2611 },
  'tours': { lat: 47.3941, lng: 0.6848 },
  'amiens': { lat: 49.8941, lng: 2.2958 },
  'perpignan': { lat: 42.6986, lng: 2.8956 },
  'metz': { lat: 49.1193, lng: 6.1757 },
  'besancon': { lat: 47.2378, lng: 6.0241 },
  'orleans': { lat: 47.9029, lng: 1.9039 },
  'rouen': { lat: 49.4432, lng: 1.0999 },
  'mulhouse': { lat: 47.7508, lng: 7.3359 },
  'caen': { lat: 49.1829, lng: -0.3707 },
  'nancy': { lat: 48.6921, lng: 6.1844 },
  'argenteuil': { lat: 48.9472, lng: 2.2467 },
  'montreuil': { lat: 48.8638, lng: 2.4483 },
  'saint-denis': { lat: 48.9362, lng: 2.3574 },
  'versailles': { lat: 48.8014, lng: 2.1301 },
  'boulogne-billancourt': { lat: 48.8352, lng: 2.2410 },
  'nanterre': { lat: 48.8924, lng: 2.2071 },
  'vitry-sur-seine': { lat: 48.7875, lng: 2.3928 },
  'creteil': { lat: 48.7904, lng: 2.4556 },
};

// ============================================================================
// HAVERSINE DISTANCE
// ============================================================================

/**
 * Convertit des degrés en radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcule la distance entre deux points GPS en km (formule de Haversine)
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
    Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Formate une distance pour l'affichage
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

// ============================================================================
// GEOCODING
// ============================================================================

/**
 * Normalise une chaîne de localisation pour la recherche
 */
function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les accents
    .replace(/[^a-z0-9\s-]/g, '') // Garde lettres, chiffres, espaces, tirets
    .replace(/\s+/g, ' '); // Normalise les espaces
}

/**
 * Extrait le nom de ville d'une localisation
 * Ex: "75011 Paris 11e" → "paris"
 */
function extractCityName(location: string): string | null {
  const normalized = normalizeLocation(location);

  // Pattern pour les arrondissements parisiens
  const parisMatch = normalized.match(/paris\s*(\d+)/);
  if (parisMatch || normalized.includes('paris')) {
    return 'paris';
  }

  // Cherche une correspondance directe
  for (const city of Object.keys(FRENCH_CITIES)) {
    if (normalized.includes(city.replace(/-/g, ' '))) {
      return city;
    }
  }

  // Essaie de matcher le premier mot significatif
  const words = normalized.split(' ').filter(w => w.length > 2);
  for (const word of words) {
    if (FRENCH_CITIES[word]) {
      return word;
    }
  }

  return null;
}

/**
 * Géocode une localisation texte en coordonnées
 * Utilise un cache local + mapping des villes françaises
 */
export function geocodeLocation(location: string): GeocodingResult | null {
  if (!location || location.trim().length === 0) {
    return null;
  }

  // Check cache
  const cacheKey = normalizeLocation(location);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  // Extraction du nom de ville
  const cityName = extractCityName(location);
  if (!cityName) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const coords = FRENCH_CITIES[cityName];
  if (!coords) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const result: GeocodingResult = {
    coords,
    displayName: cityName.charAt(0).toUpperCase() + cityName.slice(1),
    confidence: cityName === cacheKey ? 'high' : 'medium',
  };

  geocodeCache.set(cacheKey, result);
  return result;
}

/**
 * Géocode une localisation via API Nominatim (OpenStreetMap)
 * À utiliser si le géocodage local échoue
 * ATTENTION: Respecter les rate limits (1 req/sec)
 */
export async function geocodeLocationAsync(location: string): Promise<GeocodingResult | null> {
  // D'abord essayer le géocodage local
  const localResult = geocodeLocation(location);
  if (localResult) {
    return localResult;
  }

  // Sinon utiliser Nominatim
  try {
    const encoded = encodeURIComponent(`${location}, France`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=fr`,
      {
        headers: {
          'User-Agent': 'OKAZ/1.0 (https://okaz.fr)',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const result: GeocodingResult = {
      coords: {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      },
      displayName: data[0].display_name.split(',')[0],
      confidence: 'medium',
    };

    // Cache le résultat
    geocodeCache.set(normalizeLocation(location), result);

    return result;
  } catch {
    return null;
  }
}

// ============================================================================
// PROXIMITY CHECK
// ============================================================================

/**
 * Vérifie si une localisation est dans un rayon donné
 */
export function isWithinRadius(
  userLocation: Coordinates,
  listingLocation: string,
  radiusKm: number
): { isNear: boolean; distance: number | null } {
  const geocoded = geocodeLocation(listingLocation);

  if (!geocoded) {
    return { isNear: false, distance: null };
  }

  const distance = calculateDistance(userLocation, geocoded.coords);

  return {
    isNear: distance <= radiusKm,
    distance,
  };
}

/**
 * Trie les résultats par distance
 */
export function sortByDistance<T extends { location?: string }>(
  items: T[],
  userLocation: Coordinates
): Array<T & { distance: number | null }> {
  return items
    .map(item => {
      if (!item.location) {
        return { ...item, distance: null };
      }
      const geocoded = geocodeLocation(item.location);
      if (!geocoded) {
        return { ...item, distance: null };
      }
      const distance = calculateDistance(userLocation, geocoded.coords);
      return { ...item, distance };
    })
    .sort((a, b) => {
      // Items sans distance à la fin
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Vide le cache de géocodage
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Retourne la taille du cache
 */
export function getGeocacheCacheSize(): number {
  return geocodeCache.size;
}

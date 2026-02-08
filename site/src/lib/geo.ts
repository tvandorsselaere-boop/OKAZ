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
  // PACA / Sud-Est
  'avignon': { lat: 43.9493, lng: 4.8055 },
  'cannes': { lat: 43.5528, lng: 7.0174 },
  'antibes': { lat: 43.5808, lng: 7.1239 },
  'frejus': { lat: 43.4332, lng: 6.7370 },
  'gap': { lat: 44.5594, lng: 6.0786 },
  'draguignan': { lat: 43.5369, lng: 6.4646 },
  'hyeres': { lat: 43.1204, lng: 6.1286 },
  'la ciotat': { lat: 43.1748, lng: 5.6044 },
  'aubagne': { lat: 43.2927, lng: 5.5708 },
  'martigues': { lat: 43.4055, lng: 5.0537 },
  'salon-de-provence': { lat: 43.6407, lng: 5.0982 },
  'istres': { lat: 43.5131, lng: 4.9870 },
  'arles': { lat: 43.6768, lng: 4.6310 },
  'la seyne-sur-mer': { lat: 43.1007, lng: 5.8780 },
  'six-fours-les-plages': { lat: 43.0979, lng: 5.8200 },
  'gardanne': { lat: 43.4547, lng: 5.4694 },
  'trets': { lat: 43.4483, lng: 5.6839 },
  'puyloubier': { lat: 43.5275, lng: 5.6777 },
  'rousset': { lat: 43.4808, lng: 5.6184 },
  'fuveau': { lat: 43.4553, lng: 5.5605 },
  'peynier': { lat: 43.4457, lng: 5.6396 },
  'saint-maximin-la-sainte-baume': { lat: 43.4519, lng: 5.8617 },
  'brignoles': { lat: 43.4057, lng: 6.0618 },
  // Rhône-Alpes
  'valence': { lat: 44.9334, lng: 4.8924 },
  'annecy': { lat: 45.8992, lng: 6.1294 },
  'chambery': { lat: 45.5646, lng: 5.9178 },
  'saint-raphael': { lat: 43.4253, lng: 6.7688 },
  'orange': { lat: 44.1386, lng: 4.8095 },
  'carpentras': { lat: 44.0550, lng: 5.0489 },
  'cavaillon': { lat: 43.8376, lng: 5.0379 },
  'apt': { lat: 43.8768, lng: 5.3966 },
  'manosque': { lat: 43.8280, lng: 5.7868 },
  'digne-les-bains': { lat: 44.0927, lng: 6.2362 },
  'sisteron': { lat: 44.1942, lng: 5.9424 },
  // Autres villes moyennes
  'montlucon': { lat: 46.3404, lng: 2.6036 },
  'clermont-ferrand': { lat: 45.7772, lng: 3.0870 },
  'saint-nazaire': { lat: 47.2733, lng: -2.2133 },
  'la rochelle': { lat: 46.1603, lng: -1.1511 },
  'poitiers': { lat: 46.5802, lng: 0.3404 },
  'pau': { lat: 43.2951, lng: -0.3708 },
  'bayonne': { lat: 43.4929, lng: -1.4748 },
  'troyes': { lat: 48.2973, lng: 4.0744 },
  'chartres': { lat: 48.4439, lng: 1.4894 },
  'colmar': { lat: 48.0793, lng: 7.3580 },
  'bourges': { lat: 47.0810, lng: 2.3988 },
  'quimper': { lat: 47.9960, lng: -4.1024 },
  'lorient': { lat: 47.7483, lng: -3.3700 },
  'vannes': { lat: 47.6586, lng: -2.7599 },
  'calais': { lat: 50.9513, lng: 1.8587 },
  'dunkerque': { lat: 51.0343, lng: 2.3768 },
  'ajaccio': { lat: 41.9192, lng: 8.7386 },
  'bastia': { lat: 42.6977, lng: 9.4508 },
};

// Codes postaux des villes françaises (pour le format URL LeBonCoin)
const CITY_POSTAL_CODES: Record<string, string> = {
  'paris': '75000', 'marseille': '13000', 'lyon': '69000', 'toulouse': '31000',
  'nice': '06000', 'nantes': '44000', 'strasbourg': '67000', 'montpellier': '34000',
  'bordeaux': '33000', 'lille': '59000', 'rennes': '35000', 'reims': '51100',
  'le havre': '76600', 'saint-etienne': '42000', 'toulon': '83000', 'grenoble': '38000',
  'dijon': '21000', 'angers': '49000', 'nimes': '30000', 'villeurbanne': '69100',
  'aix-en-provence': '13100', 'brest': '29200', 'limoges': '87000', 'tours': '37000',
  'amiens': '80000', 'perpignan': '66000', 'metz': '57000', 'besancon': '25000',
  'orleans': '45000', 'rouen': '76000', 'mulhouse': '68100', 'caen': '14000',
  'nancy': '54000', 'argenteuil': '95100', 'montreuil': '93100', 'saint-denis': '93200',
  'versailles': '78000', 'boulogne-billancourt': '92100', 'nanterre': '92000',
  'vitry-sur-seine': '94400', 'creteil': '94000',
  // PACA / Sud-Est
  'avignon': '84000', 'cannes': '06400', 'antibes': '06600', 'frejus': '83600',
  'gap': '05000', 'draguignan': '83300', 'hyeres': '83400', 'la ciotat': '13600',
  'aubagne': '13400', 'martigues': '13500', 'salon-de-provence': '13300',
  'istres': '13800', 'arles': '13200', 'la seyne-sur-mer': '83500',
  'six-fours-les-plages': '83140', 'gardanne': '13120', 'trets': '13530',
  'puyloubier': '13114', 'rousset': '13790', 'fuveau': '13710', 'peynier': '13790',
  'saint-maximin-la-sainte-baume': '83470', 'brignoles': '83170',
  // Rhône-Alpes
  'valence': '26000', 'annecy': '74000', 'chambery': '73000',
  'saint-raphael': '83700', 'orange': '84100', 'carpentras': '84200',
  'cavaillon': '84300', 'apt': '84400', 'manosque': '04100',
  'digne-les-bains': '04000', 'sisteron': '04200',
  // Autres
  'montlucon': '03100', 'clermont-ferrand': '63000', 'saint-nazaire': '44600',
  'la rochelle': '17000', 'poitiers': '86000', 'pau': '64000', 'bayonne': '64100',
  'troyes': '10000', 'chartres': '28000', 'colmar': '68000', 'bourges': '18000',
  'quimper': '29000', 'lorient': '56100', 'vannes': '56000', 'calais': '62100',
  'dunkerque': '59140', 'ajaccio': '20000', 'bastia': '20200',
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

  // Cherche une correspondance directe (avec et sans tirets)
  const normalizedNoHyphens = normalized.replace(/-/g, ' ');
  for (const city of Object.keys(FRENCH_CITIES)) {
    const cityNoHyphens = city.replace(/-/g, ' ');
    if (normalized.includes(city) || normalized.includes(cityNoHyphens) || normalizedNoHyphens.includes(cityNoHyphens)) {
      return city;
    }
  }

  // Essaie de matcher le premier mot significatif
  const words = normalized.replace(/-/g, ' ').split(' ').filter(w => w.length > 2);
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
  if (cityName) {
    const coords = FRENCH_CITIES[cityName];
    if (coords) {
      const result: GeocodingResult = {
        coords,
        displayName: cityName.charAt(0).toUpperCase() + cityName.slice(1),
        confidence: cityName === cacheKey ? 'high' : 'medium',
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }

  // Fallback: extraire le code postal et trouver la ville la plus proche
  const postalMatch = location.match(/(\d{5})/);
  if (postalMatch) {
    const postal = postalMatch[1];
    // Chercher une ville avec ce code postal exact
    for (const [city, cityPostal] of Object.entries(CITY_POSTAL_CODES)) {
      if (cityPostal === postal) {
        const coords = FRENCH_CITIES[city];
        if (coords) {
          const result: GeocodingResult = {
            coords,
            displayName: city.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-'),
            confidence: 'medium',
          };
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }
    // Fallback: utiliser le préfixe département (2 premiers chiffres) → ville principale
    const dept = postal.substring(0, 2);
    const deptMainCity: Record<string, string> = {
      '13': 'marseille', '06': 'nice', '83': 'toulon', '84': 'avignon',
      '04': 'digne-les-bains', '05': 'gap', '75': 'paris', '69': 'lyon',
      '31': 'toulouse', '33': 'bordeaux', '34': 'montpellier', '44': 'nantes',
      '59': 'lille', '67': 'strasbourg', '35': 'rennes', '38': 'grenoble',
      '42': 'saint-etienne', '45': 'orleans', '49': 'angers', '54': 'nancy',
      '57': 'metz', '76': 'rouen', '80': 'amiens', '86': 'poitiers',
      '87': 'limoges', '37': 'tours', '14': 'caen', '29': 'brest',
      '63': 'clermont-ferrand', '64': 'pau', '68': 'mulhouse', '21': 'dijon',
      '25': 'besancon', '30': 'nimes', '51': 'reims', '56': 'lorient',
      '62': 'calais', '66': 'perpignan', '74': 'annecy', '73': 'chambery',
      '26': 'valence', '10': 'troyes', '28': 'chartres', '18': 'bourges',
      '92': 'boulogne-billancourt', '93': 'montreuil', '94': 'creteil', '95': 'argenteuil',
      '78': 'versailles', '91': 'paris', '77': 'paris',
    };
    const mainCity = deptMainCity[dept];
    if (mainCity && FRENCH_CITIES[mainCity]) {
      const result: GeocodingResult = {
        coords: FRENCH_CITIES[mainCity],
        displayName: mainCity.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-'),
        confidence: 'low',
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }

  geocodeCache.set(cacheKey, null);
  return null;
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
// REVERSE GEOCODING (coordonnées → nom de ville)
// ============================================================================

/**
 * Trouve la ville la plus proche à partir de coordonnées GPS
 * Retourne le nom de ville formaté, le code postal, et la clé interne
 */
export function reverseGeocodeLocal(coords: Coordinates): { cityName: string; postalCode: string; key: string } {
  let closestKey = '';
  let closestDistance = Infinity;

  for (const [city, cityCoords] of Object.entries(FRENCH_CITIES)) {
    const dist = calculateDistance(coords, cityCoords);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestKey = city;
    }
  }

  const cityName = closestKey
    ? closestKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
    : 'Localisation';
  const postalCode = CITY_POSTAL_CODES[closestKey] || '';

  return { cityName, postalCode, key: closestKey };
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

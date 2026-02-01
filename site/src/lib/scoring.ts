// OKAZ Scoring Logic v1.0.0
// Score principal (0-100) neutre entre sites
// Les highlights sont gérés séparément dans highlights.ts

// ============================================================================
// INTERFACES
// ============================================================================

export interface SearchResult {
  id: string;
  title: string;
  price: number;
  site: string;
  siteColor: string;
  image: string | null;
  url: string;
  score: number;
  redFlags: string[];
  // Nouveaux champs scrapés par l'extension
  handDelivery?: boolean;      // Remise en main propre disponible
  location?: string;           // Ville ou arrondissement
  postedAt?: Date | string;    // Date de publication
  sellerRating?: number;       // Note vendeur (0-5)
  sellerSales?: number;        // Nombre de ventes
  sellerType?: 'pro' | 'private';
  condition?: 'new' | 'like_new' | 'very_good' | 'good' | 'fair';
  hasWarranty?: boolean;       // Garantie disponible (BackMarket)
  photoCount?: number;         // Nombre de photos
  hasShipping?: boolean;       // Livraison disponible
  isLocal?: boolean;           // Résultat de recherche locale (géoloc)
}

export interface ScoringInput {
  result: SearchResult;
  marketPrice?: number;        // Prix du marché estimé par Gemini
}

export interface ScoreBreakdown {
  economy: number;             // 0-40 pts
  freshness: number;           // 0-15 pts
  seller: number;              // 0-15 pts
  condition: number;           // 0-15 pts
  convenience: number;         // 0-15 pts
  scamPenalty: number;         // 0 à -50 pts
  total: number;               // 0-100
}

export interface AnalyzedResult extends SearchResult {
  scoreBreakdown: ScoreBreakdown;
  analysis: {
    dealType: 'excellent' | 'good' | 'fair' | 'overpriced' | 'suspicious';
    dealText: string;
    badges: Array<{ type: 'positive' | 'warning' | 'danger'; text: string }>;
  };
  // Ajouté par Gemini
  geminiAnalysis?: {
    relevant?: boolean;
    confidence?: number;        // 0-100: confiance que c'est le bon produit
    matchDetails?: string;      // Ce qui matche ou pas
    correctedPrice?: number;
    dealScore?: number;
    dealType?: 'excellent' | 'good' | 'fair' | 'overpriced' | 'suspicious';
    explanation?: string;
    redFlags?: string[];
    marketPrice?: number;
  };
}

export interface CategorizedResults {
  results: AnalyzedResult[];
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Poids des critères (total = 100)
const WEIGHTS = {
  ECONOMY: 40,
  FRESHNESS: 15,
  SELLER: 15,
  CONDITION: 15,
  CONVENIENCE: 15,
} as const;

// Mots-clés suspects (arnaque potentielle)
const SCAM_KEYWORDS = [
  'paypal amis', 'paypal famille', 'virement avant',
  'western union', 'mandat cash', 'pcs mastercard',
  'urgent cause', 'divorce', 'deces', 'décès',
];

// Mots-clés de pression
const PRESSURE_KEYWORDS = [
  'urgent', 'vite', 'depart', 'départ', 'liquidation',
  'demenagement', 'déménagement', 'dernier prix',
];

// Condition mapping pour le score
const CONDITION_SCORES: Record<string, number> = {
  'new': 15,
  'like_new': 13,
  'very_good': 10,
  'good': 7,
  'fair': 4,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calcule le score d'économie (0-40 pts)
 * Compare le prix au prix du marché
 */
function calculateEconomyScore(price: number, marketPrice?: number): number {
  if (!marketPrice || marketPrice <= 0) {
    // Sans prix de référence, on donne un score neutre
    return WEIGHTS.ECONOMY * 0.5; // 20 pts
  }

  const ratio = price / marketPrice;

  if (ratio <= 0.5) {
    // Prix trop bas = suspect, pas de bonus maximum
    return WEIGHTS.ECONOMY * 0.3; // 12 pts (suspect)
  } else if (ratio <= 0.7) {
    // Excellente affaire : -30% ou plus
    return WEIGHTS.ECONOMY; // 40 pts
  } else if (ratio <= 0.85) {
    // Bonne affaire : -15% à -30%
    return WEIGHTS.ECONOMY * 0.85; // 34 pts
  } else if (ratio <= 1.0) {
    // Prix correct : jusqu'au prix du marché
    return WEIGHTS.ECONOMY * 0.7; // 28 pts
  } else if (ratio <= 1.15) {
    // Légèrement cher : +15%
    return WEIGHTS.ECONOMY * 0.5; // 20 pts
  } else if (ratio <= 1.3) {
    // Cher : +15% à +30%
    return WEIGHTS.ECONOMY * 0.3; // 12 pts
  } else {
    // Très cher : +30% ou plus
    return WEIGHTS.ECONOMY * 0.1; // 4 pts
  }
}

/**
 * Calcule le score de fraîcheur (0-15 pts)
 * Basé sur l'ancienneté de l'annonce
 */
function calculateFreshnessScore(postedAt?: Date | string): number {
  if (!postedAt) {
    return WEIGHTS.FRESHNESS * 0.5; // 7.5 pts par défaut
  }

  const posted = typeof postedAt === 'string' ? new Date(postedAt) : postedAt;
  const now = new Date();
  const hoursAgo = (now.getTime() - posted.getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 1) {
    return WEIGHTS.FRESHNESS; // 15 pts - très frais
  } else if (hoursAgo < 6) {
    return WEIGHTS.FRESHNESS * 0.9; // 13.5 pts
  } else if (hoursAgo < 24) {
    return WEIGHTS.FRESHNESS * 0.75; // 11.25 pts
  } else if (hoursAgo < 72) {
    return WEIGHTS.FRESHNESS * 0.6; // 9 pts
  } else if (hoursAgo < 168) { // 1 semaine
    return WEIGHTS.FRESHNESS * 0.4; // 6 pts
  } else if (hoursAgo < 720) { // 1 mois
    return WEIGHTS.FRESHNESS * 0.2; // 3 pts
  } else {
    return WEIGHTS.FRESHNESS * 0.1; // 1.5 pts
  }
}

/**
 * Calcule le score vendeur (0-15 pts)
 * Basé sur la note, le nombre de ventes et le type
 */
function calculateSellerScore(
  rating?: number,
  sales?: number,
  sellerType?: 'pro' | 'private'
): number {
  let score = 0;

  // Note vendeur (0-5) → 0-8 pts
  if (rating !== undefined) {
    score += (rating / 5) * 8;
  } else {
    score += 4; // Neutre si pas de note
  }

  // Volume de ventes → 0-4 pts
  if (sales !== undefined) {
    if (sales >= 100) score += 4;
    else if (sales >= 50) score += 3;
    else if (sales >= 20) score += 2;
    else if (sales >= 5) score += 1;
    // 0 ventes = 0 pts
  } else {
    score += 2; // Neutre
  }

  // Bonus pro (garantie implicite) → 0-3 pts
  if (sellerType === 'pro') {
    score += 3;
  } else {
    score += 1; // Particulier = neutre
  }

  return Math.min(WEIGHTS.SELLER, score);
}

/**
 * Calcule le score condition (0-15 pts)
 * Basé sur l'état annoncé + bonus BackMarket
 */
function calculateConditionScore(
  condition?: string,
  site?: string,
  title?: string
): number {
  let score = 0;

  // Score basé sur la condition déclarée
  if (condition && CONDITION_SCORES[condition]) {
    score = CONDITION_SCORES[condition];
  } else if (title) {
    // Fallback: détecter dans le titre
    const titleLower = title.toLowerCase();
    if (titleLower.includes('neuf') && !titleLower.includes('comme neuf')) {
      score = 15;
    } else if (titleLower.includes('comme neuf')) {
      score = 13;
    } else if (titleLower.includes('excellent') || titleLower.includes('parfait')) {
      score = 10;
    } else if (titleLower.includes('très bon') || titleLower.includes('tres bon')) {
      score = 8;
    } else if (titleLower.includes('bon état') || titleLower.includes('bon etat')) {
      score = 6;
    } else {
      score = 5; // État non précisé
    }
  } else {
    score = 5; // Neutre
  }

  // Bonus BackMarket : produits reconditionnés vérifiés
  if (site?.toLowerCase() === 'backmarket' || site?.toLowerCase() === 'back market') {
    score = Math.min(WEIGHTS.CONDITION, score + 2);
  }

  return Math.min(WEIGHTS.CONDITION, score);
}

/**
 * Calcule le score commodité (0-15 pts)
 * Basé sur livraison, garantie, photos
 */
function calculateConvenienceScore(
  hasShipping?: boolean,
  hasWarranty?: boolean,
  photoCount?: number
): number {
  let score = 0;

  // Livraison disponible → 0-5 pts
  if (hasShipping === true) {
    score += 5;
  } else if (hasShipping === undefined) {
    score += 2.5; // Neutre
  }
  // hasShipping === false → 0 pts

  // Garantie → 0-5 pts
  if (hasWarranty === true) {
    score += 5;
  } else if (hasWarranty === undefined) {
    score += 1; // Neutre (la plupart n'ont pas de garantie)
  }

  // Nombre de photos → 0-5 pts
  if (photoCount !== undefined) {
    if (photoCount >= 5) score += 5;
    else if (photoCount >= 3) score += 3;
    else if (photoCount >= 1) score += 2;
    // 0 photos = 0 pts
  } else {
    score += 2; // Neutre
  }

  return Math.min(WEIGHTS.CONVENIENCE, score);
}

/**
 * Calcule le malus arnaque (0 à -50 pts)
 * Basé sur les signaux suspects
 */
function calculateScamPenalty(
  title: string,
  price: number,
  marketPrice?: number
): number {
  let penalty = 0;
  const titleLower = title.toLowerCase();

  // Mots-clés de paiement suspect → -20 pts
  for (const keyword of SCAM_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      penalty -= 20;
      break;
    }
  }

  // Mots-clés de pression → -10 pts
  for (const keyword of PRESSURE_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      penalty -= 10;
      break;
    }
  }

  // Prix anormalement bas (< 50% du marché) → -15 pts
  if (marketPrice && price < marketPrice * 0.5) {
    penalty -= 15;
  }

  // Titre en MAJUSCULES excessives → -5 pts
  const uppercaseRatio = (title.match(/[A-Z]/g) || []).length / title.length;
  if (uppercaseRatio > 0.6 && title.length > 15) {
    penalty -= 5;
  }

  // Prix rond suspect sur produit cher → -5 pts
  if (marketPrice && marketPrice > 200) {
    if (price === 1 || price === 10 || price === 50 || price === 100) {
      penalty -= 5;
    }
  }

  return Math.max(-50, penalty);
}

/**
 * Calcule le score total pour un résultat
 */
export function calculateScore(input: ScoringInput): ScoreBreakdown {
  const { result, marketPrice } = input;

  const economy = calculateEconomyScore(result.price, marketPrice);
  const freshness = calculateFreshnessScore(result.postedAt);
  const seller = calculateSellerScore(result.sellerRating, result.sellerSales, result.sellerType);
  const condition = calculateConditionScore(result.condition, result.site, result.title);
  const convenience = calculateConvenienceScore(result.hasShipping, result.hasWarranty, result.photoCount);
  const scamPenalty = calculateScamPenalty(result.title, result.price, marketPrice);

  const total = Math.max(0, Math.min(100, Math.round(
    economy + freshness + seller + condition + convenience + scamPenalty
  )));

  return {
    economy: Math.round(economy),
    freshness: Math.round(freshness),
    seller: Math.round(seller),
    condition: Math.round(condition),
    convenience: Math.round(convenience),
    scamPenalty: Math.round(scamPenalty),
    total,
  };
}

/**
 * Détermine le type de deal basé sur le score
 */
function getDealType(score: number, scamPenalty: number): AnalyzedResult['analysis']['dealType'] {
  if (scamPenalty <= -20) {
    return 'suspicious';
  }
  if (score >= 80) {
    return 'excellent';
  }
  if (score >= 65) {
    return 'good';
  }
  if (score >= 45) {
    return 'fair';
  }
  return 'overpriced';
}

/**
 * Génère le texte explicatif du deal
 */
function getDealText(breakdown: ScoreBreakdown, price: number, marketPrice?: number): string {
  if (breakdown.scamPenalty <= -20) {
    return 'Signaux suspects détectés';
  }

  if (marketPrice && marketPrice > 0) {
    const diff = marketPrice - price;
    const percent = Math.round((diff / marketPrice) * 100);

    if (percent > 20) {
      return `${percent}% sous le marché`;
    } else if (percent > 0) {
      return `${diff}€ sous le marché`;
    } else if (percent < -20) {
      return `${Math.abs(percent)}% au-dessus du marché`;
    } else if (percent < 0) {
      return `${Math.abs(diff)}€ au-dessus du marché`;
    }
    return 'Prix dans la moyenne';
  }

  if (breakdown.total >= 75) {
    return 'Bonne opportunité';
  }
  if (breakdown.total >= 50) {
    return 'Correct';
  }
  return 'À négocier';
}

/**
 * Génère les badges pour un résultat
 */
function generateBadges(result: SearchResult): AnalyzedResult['analysis']['badges'] {
  const badges: AnalyzedResult['analysis']['badges'] = [];
  const titleLower = result.title.toLowerCase();

  // Badges positifs
  if (result.hasWarranty) {
    badges.push({ type: 'positive', text: 'Garantie' });
  }
  if (titleLower.includes('facture')) {
    badges.push({ type: 'positive', text: 'Facture' });
  }
  if (titleLower.includes('comme neuf')) {
    badges.push({ type: 'positive', text: 'Comme neuf' });
  } else if (titleLower.includes('neuf') && !titleLower.includes('comme neuf')) {
    badges.push({ type: 'positive', text: 'Neuf' });
  }

  // Badge warning pour pression
  for (const keyword of PRESSURE_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      badges.push({ type: 'warning', text: 'Vente urgente' });
      break;
    }
  }

  // Badge danger pour arnaque potentielle
  for (const keyword of SCAM_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      badges.push({ type: 'danger', text: 'Paiement suspect' });
      break;
    }
  }

  return badges.slice(0, 3); // Max 3 badges
}

/**
 * Analyse un résultat et calcule son score
 * Le score est déjà pondéré par la pertinence (confidence) dans page.tsx
 * On utilise directement ce score pondéré
 */
export function analyzeResult(result: SearchResult, marketPrice?: number): AnalyzedResult {
  const breakdown = calculateScore({ result, marketPrice });

  // Utiliser le score déjà pondéré par la pertinence (calculé dans page.tsx)
  // Ce score intègre : scoreBase × (confidence / 100)
  let finalScore = result.score || breakdown.total;

  // Si le score est trop bas (pas de données), mettre un minimum raisonnable
  if (finalScore < 20) {
    finalScore = 65; // Score neutre par défaut
  }

  breakdown.total = finalScore;

  // Utiliser le dealType de Gemini s'il est disponible
  const dealType = gemini?.dealType || getDealType(finalScore, breakdown.scamPenalty);
  const dealText = gemini?.explanation || getDealText(breakdown, result.price, marketPrice);
  const badges = generateBadges(result);

  return {
    ...result,
    score: finalScore,
    scoreBreakdown: breakdown,
    analysis: {
      dealType,
      dealText,
      badges,
    },
  };
}

/**
 * Analyse tous les résultats
 */
export function analyzeResults(results: SearchResult[], _query: string): CategorizedResults {
  if (!results || results.length === 0) {
    return { results: [] };
  }

  // Pour l'instant, on analyse sans prix de marché
  // Gemini enrichira ensuite avec geminiAnalysis
  const analyzedResults = results.map(result => {
    const marketPrice = (result as AnalyzedResult).geminiAnalysis?.marketPrice;
    return analyzeResult(result, marketPrice);
  });

  // Trier par score décroissant
  analyzedResults.sort((a, b) => b.score - a.score);

  return { results: analyzedResults };
}

/**
 * Détecte les red flags (pour compatibilité avec l'extension)
 */
export function detectRedFlags(title: string, price: number, marketPrice?: number): string[] {
  const flags: string[] = [];
  const titleLower = title.toLowerCase();

  // Mots-clés suspects
  for (const keyword of SCAM_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      flags.push('Paiement suspect');
      break;
    }
  }

  // Prix trop bas
  if (marketPrice && price < marketPrice * 0.5) {
    flags.push('Prix anormalement bas');
  }

  // Titre en majuscules
  const uppercaseRatio = (title.match(/[A-Z]/g) || []).length / title.length;
  if (uppercaseRatio > 0.6 && title.length > 15) {
    flags.push('Titre suspect');
  }

  // Mots de pression
  for (const keyword of PRESSURE_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      flags.push('Vente urgente');
      break;
    }
  }

  return flags.slice(0, 3);
}

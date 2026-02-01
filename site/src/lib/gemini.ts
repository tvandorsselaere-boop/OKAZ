// OKAZ - Service Gemini pour optimisation des requêtes
// Transforme une requête en langage naturel en critères structurés pour LeBonCoin

import { GoogleGenerativeAI } from '@google/generative-ai';

// Sites disponibles pour la recherche
export type SearchSite = 'leboncoin' | 'vinted' | 'backmarket';

// Types pour les critères de recherche
export interface SearchCriteria {
  keywords: string;           // Mots-clés nettoyés pour LeBonCoin
  priceMin?: number;          // Prix minimum
  priceMax?: number;          // Prix maximum
  shippable?: boolean;        // Livraison disponible
  ownerType?: 'private' | 'pro' | 'all';  // Type de vendeur
  category?: string;          // Catégorie détectée
  sites?: SearchSite[];       // Sites à interroger (si vide = tous)
  originalQuery: string;      // Requête originale pour debug
}

// Mapping catégorie → sites pertinents
const SITES_BY_CATEGORY: Record<string, SearchSite[]> = {
  tech: ['leboncoin', 'backmarket'],           // Tech = LBC + Back Market (pas Vinted)
  mode: ['vinted', 'leboncoin'],               // Mode = Vinted + LBC (pas Back Market)
  auto: ['leboncoin'],                         // Auto = LBC seulement
  immo: ['leboncoin'],                         // Immo = LBC seulement
  maison: ['leboncoin', 'vinted'],             // Maison = LBC + Vinted
  loisirs: ['leboncoin', 'vinted'],            // Loisirs = LBC + Vinted
  autre: ['leboncoin', 'vinted', 'backmarket'], // Autre = tous
};

// Briefing Pré-Chasse - Contenu affiché pendant le loading
export interface SearchBriefing {
  marketPriceRange: {
    min: number;
    max: number;
    label: string;            // Ex: "280-380€ en bon état"
  };
  warningPrice: number;       // Seuil de méfiance (arnaque probable)
  warningText: string;        // Ex: "Méfiance sous 220€"
  tips: string[];             // 3 conseils contextuels max
  backMarketAlternative?: {
    available: boolean;
    estimatedPrice?: number;
    url: string;              // URL affiliée
    label: string;            // Ex: "iPhone 13 reconditionné"
  };
}

// Plus de prix statiques - Gemini estime lui-même les prix du marché

// Initialiser le client Gemini
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY non configurée');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Construire le prompt pour Gemini - Optimisation de requête + Briefing
function buildPrompt(query: string): string {
  return `Tu es un expert du marché de l'occasion en France (LeBonCoin, Vinted, etc.).

TÂCHE: Optimiser cette requête, préparer un briefing, et détecter si plus de contexte est nécessaire.

REQUÊTE UTILISATEUR: "${query}"

PARTIE 1 - ANALYSE DE LA REQUÊTE:

1. CATÉGORIE: Identifie la catégorie principale
   - Tech: iPhone, MacBook, Samsung, PS5, Xbox, etc.
   - Mode: Nike, Adidas, vêtements, chaussures, sacs, etc.
   - Auto: voiture, moto, scooter, pièces auto
   - Immo: appartement, maison, studio
   - Maison: meuble, électroménager, déco
   - Loisirs: vélo, sport, musique, jeux

2. AMBIGUÏTÉ: La requête est-elle ambiguë?
   - "13 pro" → iPhone 13 Pro ou MacBook Pro 13" ? = AMBIGU
   - "dunk" → Nike Dunk ou autre ? = PRÉCISER MARQUE
   - "40" seul → taille ou autre ? = AMBIGU
   - Si ambigu, suggère une question de clarification

3. DÉTAILS MANQUANTS pour cette catégorie:
   - Mode: taille manquante? (S/M/L ou 38/40/42)
   - Tech: capacité manquante? (64Go/128Go/256Go)
   - Auto: année/kilométrage manquant?

PARTIE 2 - MOTS-CLÉS INTELLIGENTS:

Génère des mots-clés OPTIMISÉS pour la recherche:
- Inclus le MODÈLE EXACT (iPhone 13, pas juste iPhone)
- Ajoute des SYNONYMES utiles entre parenthèses si pertinent
- Pour la mode: inclus la marque + type + taille si mentionnée
- Max 5 mots-clés, séparés par espaces

EXEMPLES:
- "iPhone 13 pas cher" → keywords: "iPhone 13"
- "MacBook M2 avec peu de cycles" → keywords: "MacBook M2"
- "Nike Dunk taille 42" → keywords: "Nike Dunk 42"
- "PS5 avec manette" → keywords: "PS5 manette" (garde "manette" car critère important)

PARTIE 3 - BRIEFING:
1. Prix du marché occasion (fourchette réaliste en bon état)
2. Prix de méfiance (en dessous = arnaque probable, -30% du min)
3. 3 conseils SPÉCIFIQUES au produit (pas génériques!)
4. Prix reconditionné estimé (Back Market)

PARTIE 4 - SI CONTEXTE NÉCESSAIRE:
Si la requête est trop vague ou ambiguë, génère une question de clarification.

RÉPONDS EN JSON UNIQUEMENT (pas de markdown):
{
  "keywords": "string (mots-clés optimisés)",
  "category": "tech" | "mode" | "auto" | "immo" | "maison" | "loisirs" | "autre",
  "priceMin": number | null,
  "priceMax": number | null,
  "shippable": boolean | null,
  "ownerType": "private" | "pro" | null,
  "needsClarification": boolean,
  "clarificationQuestion": "string | null (ex: 'Vous cherchez un iPhone 13 Pro ou un MacBook Pro 13 pouces ?')",
  "detectedSpecs": {
    "size": "string | null (taille détectée: 42, M, L...)",
    "capacity": "string | null (capacité: 128Go, 256Go...)",
    "condition": "string | null (neuf, comme neuf, bon état...)",
    "extras": ["string"] (accessoires mentionnés: manette, chargeur...)
  },
  "briefing": {
    "marketPriceMin": number,
    "marketPriceMax": number,
    "warningPrice": number,
    "tips": ["string", "string", "string"],
    "refurbishedPrice": number | null
  }
}`;
}

// Interface pour la réponse parsée incluant le briefing
interface ParsedGeminiResponse {
  criteria: Partial<SearchCriteria>;
  briefing?: SearchBriefing;
}

// Parser la réponse Gemini
function parseGeminiResponse(text: string, query: string): ParsedGeminiResponse {
  try {
    // Nettoyer la réponse (enlever markdown si présent)
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Construire le briefing si présent
    let briefing: SearchBriefing | undefined;
    if (parsed.briefing) {
      const b = parsed.briefing;
      const minPrice = b.marketPriceMin || 0;
      const maxPrice = b.marketPriceMax || 0;

      briefing = {
        marketPriceRange: {
          min: minPrice,
          max: maxPrice,
          label: `${minPrice}-${maxPrice}€ en bon état`,
        },
        warningPrice: b.warningPrice || Math.round(minPrice * 0.7),
        warningText: `Méfiance sous ${b.warningPrice || Math.round(minPrice * 0.7)}€`,
        tips: Array.isArray(b.tips) ? b.tips.slice(0, 3) : [],
        backMarketAlternative: b.refurbishedPrice ? {
          available: true,
          estimatedPrice: b.refurbishedPrice,
          url: buildBackMarketUrl(query),
          label: `${parsed.keywords || query} reconditionné`,
        } : undefined,
      };
    }

    // Déterminer les sites à interroger selon la catégorie
    const category = parsed.category || 'autre';
    const sites = SITES_BY_CATEGORY[category] || SITES_BY_CATEGORY.autre;

    console.log(`[Gemini] Catégorie détectée: ${category} → Sites: ${sites.join(', ')}`);

    return {
      criteria: {
        keywords: parsed.keywords || '',
        priceMin: parsed.priceMin || undefined,
        priceMax: parsed.priceMax || undefined,
        shippable: parsed.shippable || undefined,
        ownerType: parsed.ownerType || undefined,
        category,
        sites,
      },
      briefing,
    };
  } catch (e) {
    console.error('[Gemini] Erreur parsing réponse:', e);
    return { criteria: {} };
  }
}

// Construire l'URL Back Market affiliée
function buildBackMarketUrl(query: string): string {
  // TODO: Remplacer par le vrai lien affilié une fois le partenariat signé
  const searchTerms = encodeURIComponent(query);
  return `https://www.backmarket.fr/fr-fr/search?q=${searchTerms}&utm_source=okaz&utm_medium=referral&utm_campaign=briefing`;
}

// Modèle Gemini à utiliser
// Voir: https://ai.google.dev/gemini-api/docs/models
const GEMINI_MODEL = 'gemini-2.5-flash';

// Réponse de l'optimisation incluant le briefing
export interface OptimizeResult {
  criteria: SearchCriteria;
  briefing?: SearchBriefing;
}

// Fonction principale: optimiser une requête
export async function optimizeQuery(query: string): Promise<OptimizeResult> {
  console.log('[Gemini] ====== DÉBUT OPTIMISATION ======');
  console.log('[Gemini] Requête:', query);
  console.log('[Gemini] Modèle:', GEMINI_MODEL);

  // Fallback si pas de clé API
  if (!process.env.GEMINI_API_KEY) {
    console.log('[Gemini] ❌ Pas de clé API, utilisation du fallback');
    return {
      criteria: {
        keywords: query,
        originalQuery: query,
      },
    };
  }

  console.log('[Gemini] ✓ Clé API présente (masquée):', process.env.GEMINI_API_KEY?.substring(0, 10) + '...');

  try {
    console.log('[Gemini] Initialisation client...');
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    console.log('[Gemini] ✓ Client initialisé');

    const prompt = buildPrompt(query);
    console.log('[Gemini] Envoi requête à l\'API...');

    const result = await model.generateContent(prompt);
    console.log('[Gemini] ✓ Réponse reçue');

    const response = await result.response;
    const text = response.text();

    console.log('[Gemini] Réponse brute:', text);

    const { criteria, briefing } = parseGeminiResponse(text, query);

    const finalCriteria: SearchCriteria = {
      keywords: criteria.keywords || query,
      priceMin: criteria.priceMin,
      priceMax: criteria.priceMax,
      shippable: criteria.shippable,
      ownerType: criteria.ownerType,
      category: criteria.category,
      sites: criteria.sites,
      originalQuery: query,
    };

    console.log('[Gemini] ✓ Critères extraits:', JSON.stringify(finalCriteria));
    if (briefing) {
      console.log('[Gemini] ✓ Briefing généré:', JSON.stringify(briefing));
    }
    console.log('[Gemini] ====== FIN OPTIMISATION ======');

    return {
      criteria: finalCriteria,
      briefing,
    };

  } catch (error: unknown) {
    console.error('[Gemini] ❌ ERREUR:', error);
    if (error instanceof Error) {
      console.error('[Gemini] Message:', error.message);
      console.error('[Gemini] Stack:', error.stack);
    }
    // Fallback: retourner la requête originale
    console.log('[Gemini] Utilisation du fallback (requête brute)');
    return {
      criteria: {
        keywords: query,
        originalQuery: query,
      },
    };
  }
}

// Types pour l'analyse des résultats
export interface RawResult {
  id: string;
  title: string;
  price: number;
  url: string;
  image?: string | null;
}

export interface AnalyzedResultGemini {
  id: string;
  title: string;
  relevant: boolean;         // false UNIQUEMENT si clairement hors-sujet
  confidence: number;        // 0-100: confiance que c'est le bon produit
  matchDetails: string;      // Ce qui matche ou ne matche pas
  correctedPrice: number;    // Prix corrigé par Gemini
  originalPrice: number;     // Prix original (peut être erroné)
  marketPrice: number;       // Prix estimé du marché
  dealScore: number;         // 1-10, 10 = excellente affaire
  dealType: 'excellent' | 'good' | 'fair' | 'overpriced' | 'suspicious';
  explanation: string;       // Explication courte
  redFlags: string[];        // Alertes
}

// LA recommandation - Le TOP PICK identifié par Gemini
export interface TopPick {
  id: string;                    // ID de l'annonce recommandée
  confidence: 'high' | 'medium' | 'low';  // Niveau de confiance
  headline: string;              // Ex: "Excellent rapport qualité-prix"
  reason: string;                // Explication en 1-2 phrases
  highlights: string[];          // Points forts (max 3)
}

// Résultat complet de l'analyse
export interface AnalysisResult {
  analyzed: AnalyzedResultGemini[];
  topPick?: TopPick;
}

// Analyser les résultats avec Gemini (2ème appel)
export async function analyzeResultsWithGemini(
  results: RawResult[],
  searchQuery: string
): Promise<AnalysisResult> {
  console.log('[Gemini] ====== ANALYSE DES RÉSULTATS ======');
  console.log('[Gemini] Nombre de résultats à analyser:', results.length);

  if (!process.env.GEMINI_API_KEY || results.length === 0) {
    console.log('[Gemini] Pas de clé API ou pas de résultats, skip analyse');
    return { analyzed: [] };
  }

  // Analyser TOUS les résultats - l'IA est la valeur ajoutée d'OKAZ
  // Pas de limite artificielle, on track les coûts pour optimiser plus tard
  console.log('[Gemini] Analyse de TOUS les', results.length, 'résultats');

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = buildAnalysisPrompt(results, searchQuery);
    console.log('[Gemini] Envoi analyse...');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[Gemini] Réponse analyse brute:', text.substring(0, 500));

    return parseAnalysisResponse(text, results);

  } catch (error) {
    console.error('[Gemini] Erreur analyse:', error);
    return { analyzed: [] };
  }
}

// Prompt pour l'analyse des résultats
function buildAnalysisPrompt(results: RawResult[], query: string): string {
  const resultsJson = results.map(r => ({
    id: r.id,
    title: r.title,
    price: r.price
  }));

  return `Tu es un expert du marché de l'occasion. Analyse ces annonces pour la recherche "${query}".

ANNONCES:
${JSON.stringify(resultsJson, null, 2)}

=== PARTIE 1: ÉVALUATION DE LA PERTINENCE ===

Pour CHAQUE annonce, évalue sa correspondance avec la recherche:

1. SCORE DE CONFIANCE (0-100):
   - 90-100: Match parfait (même produit, même modèle, même taille si applicable)
   - 70-89: Match probable (bon produit, modèle peut varier légèrement)
   - 50-69: Match partiel (même catégorie, modèle/specs différents)
   - 30-49: Match incertain (catégorie proche, mais pas sûr)
   - 0-29: Hors-sujet (catégorie différente)

2. RELEVANT = false UNIQUEMENT SI:
   - Catégorie TOTALEMENT différente (ex: téléphone vs chaussure)
   - Accessoire au lieu du produit (coque iPhone ≠ iPhone)
   - Autre marque (Samsung ≠ iPhone)

   IMPORTANT: En cas de doute, garde relevant: true avec un confidence bas.
   Mieux vaut montrer plus de résultats que d'en cacher de bons.

3. MATCHDETAILS: Explique ce qui matche ou pas:
   - "✓ iPhone 13, 128Go comme demandé"
   - "✓ Nike Dunk, mais taille non précisée"
   - "⚠ iPhone 13 Pro (pas standard demandé)"
   - "✗ C'est une coque, pas un téléphone"

EXEMPLES DE SCORING:
- Recherche "iPhone 13 128Go" + "iPhone 13 128Go noir" → confidence: 95, relevant: true
- Recherche "iPhone 13 128Go" + "iPhone 13 Pro 256Go" → confidence: 65, relevant: true
- Recherche "Nike Dunk 42" + "Nike Dunk Low" (taille ?) → confidence: 70, relevant: true
- Recherche "Nike Dunk 42" + "Motorola Edge 40" → confidence: 5, relevant: false
- Recherche "iPhone 13" + "Coque iPhone 13" → confidence: 10, relevant: false

=== PARTIE 2: ANALYSE DU DEAL ===

Pour chaque annonce PERTINENTE (relevant: true):
1. Prix du marché occasion (bon état)
2. Score deal 1-10 (10 = excellente affaire)
3. dealType: excellent (<75% marché), good (75-90%), fair (90-100%), overpriced (>100%), suspicious (prix bizarre)

RED FLAGS à détecter:
- Prix <60% du marché → "Prix suspect"
- "Urgent", "départ" → "Vente urgente"
- "PayPal amis", "virement" → "Paiement suspect"
- "Neuf sous blister" à prix cassé → "Arnaque probable"
- Tout en MAJUSCULES → "Titre suspect"

=== PARTIE 3: TOP PICK ===

Identifie LA meilleure annonce parmi celles avec:
- confidence >= 70
- Pas de red flags critiques
- Bon dealScore

RÉPONDS EN JSON UNIQUEMENT:
{
  "analyzed": [
    {
      "id": "string",
      "relevant": boolean,
      "confidence": number (0-100),
      "matchDetails": "string (ce qui matche ou pas)",
      "correctedPrice": number,
      "marketPrice": number,
      "dealScore": number (1-10),
      "dealType": "excellent" | "good" | "fair" | "overpriced" | "suspicious",
      "explanation": "string (max 100 chars, résumé factuel du deal)",
      "redFlags": ["string"]
    }
  ],
  "topPick": {
    "id": "string | null",
    "confidence": "high" | "medium" | "low",
    "headline": "string",
    "reason": "string (1-2 phrases)",
    "highlights": ["string", "string"]
  }
}`;
}

// Parser la réponse d'analyse
function parseAnalysisResponse(text: string, originalResults: RawResult[]): AnalysisResult {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Gérer l'ancien format (tableau) et le nouveau format (objet avec analyzed + topPick)
    let analyzedArray: Record<string, unknown>[];
    let topPickData: Record<string, unknown> | null = null;

    if (Array.isArray(parsed)) {
      // Ancien format: tableau direct
      analyzedArray = parsed;
    } else if (parsed.analyzed && Array.isArray(parsed.analyzed)) {
      // Nouveau format: objet avec analyzed et topPick
      analyzedArray = parsed.analyzed;
      topPickData = parsed.topPick || null;
    } else {
      return { analyzed: [] };
    }

    const analyzed: AnalyzedResultGemini[] = analyzedArray.map((item: Record<string, unknown>, index: number) => {
      const original = originalResults.find(r => r.id === item.id) || originalResults[index];

      // Confidence = pertinence du résultat (0-100%)
      // Le filtrage et la pondération du score sont faits dans page.tsx
      const confidence = Math.min(100, Math.max(0, Number(item.confidence) || 50));
      const relevant = confidence >= 30; // Seuil minimum de pertinence

      return {
        id: String(item.id || original?.id || index),
        title: original?.title || '',
        relevant: relevant,
        confidence: confidence,
        matchDetails: String(item.matchDetails || ''),
        correctedPrice: Number(item.correctedPrice) || original?.price || 0,
        originalPrice: original?.price || 0,
        marketPrice: Number(item.marketPrice) || 0,
        dealScore: Math.min(10, Math.max(1, Number(item.dealScore) || 5)),
        dealType: item.dealType as AnalyzedResultGemini['dealType'] || 'fair',
        explanation: String(item.explanation || ''),
        redFlags: Array.isArray(item.redFlags) ? item.redFlags.map(String) : [],
      };
    });

    // Parser le topPick si présent
    let topPick: TopPick | undefined;
    if (topPickData && topPickData.id) {
      topPick = {
        id: String(topPickData.id),
        confidence: (topPickData.confidence as TopPick['confidence']) || 'medium',
        headline: String(topPickData.headline || 'Mon choix pour toi'),
        reason: String(topPickData.reason || ''),
        highlights: Array.isArray(topPickData.highlights)
          ? topPickData.highlights.slice(0, 3).map(String)
          : [],
      };
      console.log('[Gemini] ✓ TopPick identifié:', topPick.id, '-', topPick.headline);
    }

    return { analyzed, topPick };
  } catch (e) {
    console.error('[Gemini] Erreur parsing analyse:', e);
    return { analyzed: [] };
  }
}

// Construire l'URL LeBonCoin à partir des critères
export function buildLeBonCoinUrl(criteria: SearchCriteria): string {
  const params = new URLSearchParams();

  params.set('text', criteria.keywords);

  if (criteria.priceMin) {
    params.set('price_min', criteria.priceMin.toString());
  }
  if (criteria.priceMax) {
    params.set('price_max', criteria.priceMax.toString());
  }
  if (criteria.shippable) {
    params.set('shippable', '1');
  }
  if (criteria.ownerType && criteria.ownerType !== 'all') {
    params.set('owner_type', criteria.ownerType);
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

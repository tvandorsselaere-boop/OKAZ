// OKAZ - Service Gemini pour optimisation des requêtes
// Transforme une requête en langage naturel en critères structurés pour LeBonCoin

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

// Sites disponibles pour la recherche
export type SearchSite = 'leboncoin' | 'vinted' | 'backmarket' | 'amazon' | 'ebay';

// Critères de matching extraits par Gemini pour vérification code-side
export interface MatchCriteria {
  mainProduct: string;          // Produit principal (ex: "Fender Stratocaster")
  requiredInTitle: string[];    // Mots qui DOIVENT apparaître (au moins 1) pour être pertinent
  boostIfPresent: string[];     // Mots qui AUGMENTENT la pertinence si présents
  excludeIfPresent: string[];   // Mots qui indiquent un mauvais résultat (accessoire, pièce détachée)
}

// Types pour les critères de recherche
export interface SearchCriteria {
  keywords: string;           // Mots-clés nettoyés pour LeBonCoin/Vinted
  keywordsBM?: string;        // Mots-clés simplifiés pour Back Market
  priceMin?: number;          // Prix minimum
  priceMax?: number;          // Prix maximum
  shippable?: boolean;        // Livraison disponible
  ownerType?: 'private' | 'pro' | 'all';  // Type de vendeur
  category?: string;          // Catégorie détectée
  sites?: SearchSite[];       // Sites à interroger (si vide = tous)
  excludeAccessories?: boolean; // Exclure les accessoires (coques, câbles...)
  acceptedModels?: string[];  // Modèles acceptés si multi-produits
  matchCriteria?: MatchCriteria; // Critères de matching pour vérification post-Gemini
  originalQuery: string;      // Requête originale pour debug
}

// v0.5.0 - Contexte visuel extrait de l'image (pour l'analyse, pas la recherche)
export interface VisualContext {
  color?: string;             // Couleur principale (rose, bleu, noir...)
  size?: string;              // Taille visible (42, M, L...)
  condition?: string;         // État visible (neuf, usé...)
  variant?: string;           // Variante (ex: "Low", "Pro", "Mini"...)
}

// Mapping catégorie → sites pertinents
const SITES_BY_CATEGORY: Record<string, SearchSite[]> = {
  tech: ['leboncoin', 'backmarket', 'amazon', 'ebay'],     // Tech = LBC + Back Market + Amazon + eBay
  mode: ['vinted', 'leboncoin', 'amazon', 'ebay'],         // Mode = Vinted + LBC + Amazon + eBay
  auto: ['leboncoin', 'ebay'],                             // Auto = LBC + eBay
  immo: ['leboncoin'],                                     // Immo = LBC seulement
  maison: ['leboncoin', 'vinted', 'amazon', 'ebay'],       // Maison = LBC + Vinted + Amazon + eBay
  loisirs: ['leboncoin', 'vinted', 'amazon', 'ebay'],      // Loisirs = LBC + Vinted + Amazon + eBay
  autre: ['leboncoin', 'vinted', 'backmarket', 'amazon', 'ebay'], // Autre = tous
};

// Briefing Pré-Chasse - Contenu affiché pendant le loading
export interface SearchBriefing {
  newProductPrice?: {
    price: number;
    label: string;            // Ex: "iPhone 13 neuf ~449€"
  };
  marketPriceRange?: {
    min: number;
    max: number;
    median?: number;
    count?: number;           // Nombre d'annonces utilisées pour le calcul
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

// Prix réels calculés à partir des résultats scrapés
export interface RealPriceStats {
  median: number;
  min: number;
  max: number;
  count: number;
}

// Calculer les stats de prix à partir des résultats scrapés
// Filtre les outliers via écart-type pour éviter de mélanger des populations différentes
// Ex: "macbook M4" → Air (~800€) vs Pro (~1500€+) → médiane faussée sans filtrage
export function computePriceStats(prices: number[]): RealPriceStats | null {
  const valid = prices.filter(p => p > 0).sort((a, b) => a - b);
  if (valid.length === 0) return null;

  let filtered = valid;

  // Filtrage outliers si assez de données (≥5 prix)
  if (valid.length >= 5) {
    const mean = valid.reduce((s, p) => s + p, 0) / valid.length;
    const variance = valid.reduce((s, p) => s + (p - mean) ** 2, 0) / valid.length;
    const stdDev = Math.sqrt(variance);

    // Garder uniquement les prix dans mean ± 1.5 écart-type
    const lo = mean - 1.5 * stdDev;
    const hi = mean + 1.5 * stdDev;
    const trimmed = valid.filter(p => p >= lo && p <= hi);

    // Utiliser le filtrage seulement si on garde au moins 3 prix
    if (trimmed.length >= 3) {
      filtered = trimmed;
    }
  }

  const mid = Math.floor(filtered.length / 2);
  const median = filtered.length % 2 === 0
    ? Math.round((filtered[mid - 1] + filtered[mid]) / 2)
    : filtered[mid];

  return {
    median,
    min: filtered[0],
    max: filtered[filtered.length - 1],
    count: filtered.length,
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

RÈGLE CRITIQUE - KNOWLEDGE CUTOFF:
Ton knowledge a une date de coupure. De nouveaux produits sortent régulièrement.
Ne dis JAMAIS qu'un produit "n'existe pas" ou "n'est pas encore disponible" — tu pourrais simplement ne pas le connaître.
Exemples de produits récents : Apple M4/M4 Pro/M4 Max (Mac mini, MacBook Pro, iMac), iPhone 16, PS5 Pro, RTX 5090, etc.
Si l'utilisateur cherche un produit que tu ne connais pas, estime le prix par rapport à la génération précédente (+10-20%).

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

2. AMBIGUÏTÉ: La requête est-elle VRAIMENT ambiguë?
   - "13 pro" → iPhone 13 Pro ou MacBook Pro 13" ? = AMBIGU → proposer des choix
   - "dunk" → Nike Dunk Low ou High ? = AMBIGU → proposer des choix
   - MAIS si le produit est clair, NE DEMANDE PAS de précisions inutiles
   - Tu es un AMI EXPERT : si l'utilisateur dit "macbook pour coder", TU recommandes le meilleur modèle, tu ne poses pas 4 questions
   - Pose UNE SEULE question avec des CHOIX CONCRETS, jamais de questions ouvertes

3. QUAND demander une clarification (STRICT):
   - SEULEMENT si le produit est ambigu (2 produits différents possibles)
   - SEULEMENT si la taille est indispensable (mode/chaussures)
   - JAMAIS pour le budget → estime toi-même un budget raisonnable
   - JAMAIS pour la RAM/stockage/taille écran → recommande le meilleur choix
   - JAMAIS pour la génération de puce → recommande la meilleure option qualité/prix

PARTIE 2 - MOTS-CLÉS INTELLIGENTS:

RÈGLE LINGUISTIQUE - ORDRE DES MOTS (CRITIQUE):
En français, l'ordre des mots dans la requête indique la hiérarchie d'importance:
- Le PREMIER nom significatif = le PRODUIT PRINCIPAL que l'utilisateur veut ACHETER
- Les mots qui suivent = CRITÈRES/SPÉCIFICATIONS du produit principal
- Les qualificatifs FILTRENT les résultats, ils ne CHANGENT PAS le produit cherché

Exemples:
- "Stratocaster micros doubles" = une GUITARE Stratocaster équipée de micros doubles (humbuckers), PAS des micros/pickups à acheter séparément
- "Nike Dunk Low bleu 42" = une CHAUSSURE Nike Dunk Low, couleur bleue, taille 42
- "MacBook M4 16Go" = un ORDINATEUR MacBook avec puce M4 et 16Go de RAM
- "collier Vanrycke" = un COLLIER de la marque Vanrycke
- "canapé cuir angle" = un CANAPÉ en cuir d'angle, PAS du cuir pour canapé

Le produit principal est TOUJOURS ce qu'on veut ACHETER. Les qualificatifs après le nom filtrent les résultats.

Génère des mots-clés OPTIMISÉS pour la recherche:
- Inclus le MODÈLE EXACT (iPhone 13, pas juste iPhone)
- Ajoute des SYNONYMES utiles entre parenthèses si pertinent
- Pour la mode: inclus la marque + type + taille si mentionnée
- Max 5 mots-clés, séparés par espaces
- Si l'utilisateur cherche PLUSIEURS produits ("X ou Y"), génère des mots-clés pour chaque variante

EXEMPLES:
- "iPhone 13 pas cher" → keywords: "iPhone 13"
- "MacBook M2 avec peu de cycles" → keywords: "MacBook M2"
- "Nike Dunk taille 42" → keywords: "Nike Dunk 42"
- "PS5 avec manette" → keywords: "PS5 manette" (garde "manette" car critère important)
- "macbook ou mac mini M4 16gb" → keywords: "MacBook M4 16Go, Mac Mini M4 16Go"

IMPORTANT: Maximum 2 variantes de mots-clés séparées par virgule.
Chaque variante ouvre un onglet de recherche, donc plus de 2 = trop lent.
Si l'utilisateur mentionne 3+ produits, choisis les 2 plus pertinents.

IMPORTANT - MOTS-CLÉS PAR SITE:
Back Market a un catalogue structuré (marque + modèle), pas du texte libre comme LeBonCoin.
Génère aussi des keywords simplifiés pour Back Market si la catégorie est tech.
Ex: LBC "MacBook Pro 14 M4 16Go" → Back Market "MacBook Pro M4"

PARTIE 3 - BRIEFING:
1. Prix de méfiance occasion (en dessous = arnaque probable)
2. 3 conseils SPÉCIFIQUES au produit (pas génériques!)
3. Prix reconditionné estimé (Back Market)
NOTE: NE PAS estimer le prix occasion ni le prix neuf — ils seront calculés automatiquement.

PARTIE 4 - CLARIFICATION (RARE, seulement si produit ambigu):
Si et SEULEMENT SI le produit est vraiment ambigu (ex: "13 pro" = iPhone ou MacBook ?), génère:
- UNE question courte (1 phrase)
- 2 à 4 options CONCRÈTES que l'utilisateur peut cliquer directement
- Chaque option = une réponse complète, pas une sous-question

EXEMPLES DE BONNES CLARIFICATIONS:
- Question: "Tu cherches quel type de produit ?"
  Options: ["iPhone 13 Pro", "MacBook Pro 13 pouces"]
- Question: "Quel modèle de Dunk ?"
  Options: ["Nike Dunk Low", "Nike Dunk High", "Nike Dunk SB"]

EXEMPLES DE MAUVAISES CLARIFICATIONS (NE FAIS JAMAIS ÇA):
- "Quel est votre budget ?" → NON, estime toi-même
- "Quelle taille d'écran préférez-vous ?" → NON, recommande le meilleur
- "Combien de RAM ?" → NON, recommande le minimum pour l'usage

Le format de sortie est forcé par le schéma JSON. Remplis TOUS les champs.

EXEMPLES matchCriteria:
- "Fender Stratocaster micros doubles" → mainProduct: "Fender Stratocaster", requiredInTitle: ["stratocaster", "strat"], boostIfPresent: ["humbucker", "hh", "hss", "double"], excludeIfPresent: ["micro seul", "pickup", "pickguard", "plaque", "mécanique", "ampli"]
- "Nike Dunk Low bleu 42" → mainProduct: "Nike Dunk Low", requiredInTitle: ["dunk"], boostIfPresent: ["bleu", "blue", "42"], excludeIfPresent: ["coque", "lacet", "semelle", "chaussette"]
- "MacBook M4 24Go" → mainProduct: "MacBook M4", requiredInTitle: ["macbook"], boostIfPresent: ["m4", "24go", "24gb"], excludeIfPresent: ["coque", "housse", "chargeur", "adaptateur"]`;
}

// Interface pour la réponse parsée incluant le briefing
interface ParsedGeminiResponse {
  criteria: Partial<SearchCriteria>;
  briefing?: SearchBriefing;
  visualContext?: VisualContext;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
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
      const warningPrice = b.warningPrice || 0;

      briefing = {
        // newProductPrice et marketPriceRange sont remplis APRÈS les résultats (prix réels)
        warningPrice: warningPrice,
        warningText: warningPrice > 0 ? `Méfiance sous ${warningPrice}€` : '',
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


    // v0.5.0 - Extraire le contexte visuel (pour l'analyse, pas la recherche)
    let visualContext: VisualContext | undefined;
    if (parsed.detectedSpecs) {
      const specs = parsed.detectedSpecs;
      visualContext = {
        color: specs.color || undefined,
        size: specs.size || undefined,
        condition: specs.condition || undefined,
        variant: specs.variant || undefined,
      };
      // Ne garder que si au moins un champ est défini
      if (!visualContext.color && !visualContext.size && !visualContext.condition && !visualContext.variant) {
        visualContext = undefined;
      }
    }

    // Extraire matchCriteria pour vérification code-side post-Gemini
    let matchCriteria: MatchCriteria | undefined;
    if (parsed.matchCriteria && parsed.matchCriteria.mainProduct) {
      matchCriteria = {
        mainProduct: String(parsed.matchCriteria.mainProduct),
        requiredInTitle: Array.isArray(parsed.matchCriteria.requiredInTitle)
          ? parsed.matchCriteria.requiredInTitle.map(String)
          : [],
        boostIfPresent: Array.isArray(parsed.matchCriteria.boostIfPresent)
          ? parsed.matchCriteria.boostIfPresent.map(String)
          : [],
        excludeIfPresent: Array.isArray(parsed.matchCriteria.excludeIfPresent)
          ? parsed.matchCriteria.excludeIfPresent.map(String)
          : [],
      };
    }

    return {
      criteria: {
        keywords: parsed.keywords || '',
        keywordsBM: parsed.keywordsBM || undefined,
        priceMin: parsed.priceMin || undefined,
        priceMax: parsed.priceMax || undefined,
        shippable: parsed.shippable || undefined,
        ownerType: parsed.ownerType || undefined,
        category,
        sites,
        excludeAccessories: parsed.excludeAccessories ?? true,
        acceptedModels: parsed.detectedSpecs?.acceptedModels || undefined,
        matchCriteria,
      },
      briefing,
      visualContext,
      needsClarification: parsed.needsClarification === true,
      clarificationQuestion: parsed.needsClarification ? (parsed.clarificationQuestion || '') : undefined,
      clarificationOptions: parsed.needsClarification && Array.isArray(parsed.clarificationOptions) ? parsed.clarificationOptions : undefined,
    };
  } catch (e) {
    console.error('[Gemini] Erreur parsing réponse:', e);
    return { criteria: {} };
  }
}

// Construire l'URL Back Market affiliée
function buildBackMarketUrl(query: string): string {
  const searchTerms = encodeURIComponent(query);
  return `https://www.backmarket.fr/fr-fr/search?q=${searchTerms}&utm_source=okaz&utm_medium=referral&utm_campaign=briefing`;
}

// Modèle Gemini à utiliser
// Voir: https://ai.google.dev/gemini-api/docs/models
// Migration fev 2026: gemini-2.0-flash deprecated 31 mars 2026
// gemini-2.5-flash-lite: ultra-rapide, optimisé extraction/classification JSON, pas de thinking
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_MODEL_FAST = 'gemini-2.5-flash-lite';

// Structured Output schema pour l'optimisation (force tous les champs requis)
const OPTIMIZE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    keywords: { type: SchemaType.STRING, description: 'Mots-clés optimisés pour LeBonCoin/Vinted' },
    keywordsBM: { type: SchemaType.STRING, description: 'Mots-clés simplifiés pour Back Market (tech)', nullable: true },
    category: { type: SchemaType.STRING, format: 'enum', description: 'Catégorie détectée', enum: ['tech', 'mode', 'auto', 'immo', 'maison', 'loisirs', 'autre'] },
    priceMin: { type: SchemaType.NUMBER, nullable: true },
    priceMax: { type: SchemaType.NUMBER, nullable: true },
    shippable: { type: SchemaType.BOOLEAN, nullable: true },
    ownerType: { type: SchemaType.STRING, format: 'enum', nullable: true, enum: ['private', 'pro'] },
    excludeAccessories: { type: SchemaType.BOOLEAN },
    needsClarification: { type: SchemaType.BOOLEAN },
    clarificationQuestion: { type: SchemaType.STRING, nullable: true },
    clarificationOptions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
    matchCriteria: {
      type: SchemaType.OBJECT,
      properties: {
        mainProduct: { type: SchemaType.STRING, description: 'Le produit principal recherché' },
        requiredInTitle: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Au moins un de ces mots doit apparaître dans le titre' },
        boostIfPresent: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Mots qui augmentent la pertinence' },
        excludeIfPresent: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Mots indiquant un mauvais résultat' },
      },
      required: ['mainProduct', 'requiredInTitle', 'boostIfPresent', 'excludeIfPresent'],
    },
    detectedSpecs: {
      type: SchemaType.OBJECT,
      properties: {
        size: { type: SchemaType.STRING, nullable: true },
        capacity: { type: SchemaType.STRING, nullable: true },
        condition: { type: SchemaType.STRING, nullable: true },
        color: { type: SchemaType.STRING, nullable: true },
        extras: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        minRAM: { type: SchemaType.STRING, nullable: true },
        acceptedModels: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      nullable: true,
    },
    briefing: {
      type: SchemaType.OBJECT,
      properties: {
        warningPrice: { type: SchemaType.NUMBER },
        tips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        refurbishedPrice: { type: SchemaType.NUMBER, nullable: true },
      },
      required: ['warningPrice', 'tips'],
    },
  },
  required: ['keywords', 'category', 'excludeAccessories', 'needsClarification', 'matchCriteria', 'briefing'],
};

// Structured Output schema pour l'analyse
const ANALYZE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    analyzed: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          relevant: { type: SchemaType.BOOLEAN },
          confidence: { type: SchemaType.INTEGER, description: '0-100: pertinence par rapport à la recherche' },
          matchDetails: { type: SchemaType.STRING },
          correctedPrice: { type: SchemaType.NUMBER },
          marketPrice: { type: SchemaType.NUMBER },
          dealScore: { type: SchemaType.INTEGER, description: '1-10, rapport qualité-prix' },
          dealType: { type: SchemaType.STRING, format: 'enum', enum: ['excellent', 'good', 'fair', 'overpriced', 'suspicious'] },
          explanation: { type: SchemaType.STRING },
          redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['id', 'relevant', 'confidence', 'matchDetails', 'correctedPrice', 'marketPrice', 'dealScore', 'dealType', 'explanation', 'redFlags'],
      },
    },
    topPick: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        confidence: { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
        headline: { type: SchemaType.STRING },
        reason: { type: SchemaType.STRING },
        highlights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['id', 'confidence', 'headline', 'reason', 'highlights'],
      nullable: true,
    },
  },
  required: ['analyzed'],
};

// Réponse de l'optimisation incluant le briefing
export interface OptimizeResult {
  criteria: SearchCriteria;
  briefing?: SearchBriefing;
  visualContext?: VisualContext;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
}

// v0.5.0 - Options d'optimisation enrichies
export interface OptimizeOptions {
  query: string;
  imageBase64?: string;      // Image produit (base64)
  referenceUrl?: string;     // URL de référence (Amazon, Fnac, Apple...)
  clarifications?: Array<{ question: string; answer: string }>;  // Réponses aux clarifications précédentes
}

// v0.5.0 - Fetch metadata from reference URL
async function fetchReferenceProduct(url: string): Promise<{ title?: string; price?: number; description?: string } | null> {
  try {
    // Parse l'URL pour extraire des infos basiques
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    // On ne fait pas de fetch réel (CORS, etc.) - on passe l'URL à Gemini
    // qui peut extraire des infos du format de l'URL
    return { title: `Produit depuis ${domain}` };

  } catch (error) {
    console.error('[Gemini] Error fetching reference:', error);
    return null;
  }
}

// Build prompt with image context and clarification history
function buildPromptWithContext(query: string, hasImage: boolean, referenceUrl?: string, clarifications?: Array<{ question: string; answer: string }>): string {
  let contextInfo = '';

  if (hasImage) {
    contextInfo += `\n\nCONTEXTE IMAGE: L'utilisateur a fourni une photo du produit. Identifie:
- Le type de produit exact (marque, modèle, taille, couleur, état)
- Les caractéristiques visibles (capacité, version, accessoires)
- Tout détail pertinent pour affiner la recherche`;
  }

  if (referenceUrl) {
    contextInfo += `\n\nURL DE RÉFÉRENCE: ${referenceUrl}
L'utilisateur veut trouver ce produit (ou équivalent) moins cher sur le marché de l'occasion.
Extrais le nom du produit et les specs de l'URL si possible.`;
  }

  if (clarifications && clarifications.length > 0) {
    contextInfo += `\n\nCLARIFICATIONS PRÉCÉDENTES (l'utilisateur a déjà répondu à ces questions, INTÈGRE ses réponses et NE REPOSE PAS ces questions):`;
    for (const c of clarifications) {
      contextInfo += `\n- Question: "${c.question}"\n  Réponse de l'utilisateur: "${c.answer}"`;
    }
    contextInfo += `\n\nIMPORTANT: Tu as DÉJÀ obtenu ces informations. Utilise-les pour générer les critères de recherche. Si tu as encore besoin d'une précision DIFFÉRENTE, tu peux poser UNE DERNIÈRE question. Sinon, génère directement les critères avec needsClarification: false.`;
  }

  return buildPrompt(query) + contextInfo;
}

// Fonction principale: optimiser une requête (v0.5.0 - enrichie)
export async function optimizeQuery(options: OptimizeOptions | string): Promise<OptimizeResult> {
  // Compatibilité: accepter string ou options object
  const opts: OptimizeOptions = typeof options === 'string' ? { query: options } : options;
  const { query, imageBase64, referenceUrl, clarifications } = opts;

  // Fallback si pas de clé API
  if (!process.env.GEMINI_API_KEY) {
    return {
      criteria: {
        keywords: query,
        originalQuery: query,
      },
    };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: OPTIMIZE_SCHEMA,
      },
    });

    // v0.5.0 - Build prompt with context (image + URL)
    const prompt = buildPromptWithContext(query, !!imageBase64, referenceUrl, clarifications);

    // v0.5.0 - Si image, utiliser Vision
    let result;
    if (imageBase64) {
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg', // Gemini accepte JPEG/PNG/GIF/WebP
        },
      };
      result = await model.generateContent([prompt, imagePart]);
    } else {
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    const text = response.text();

    const { criteria, briefing, visualContext, needsClarification, clarificationQuestion, clarificationOptions } = parseGeminiResponse(text, query);

    // Fallback code-side pour matchCriteria si Gemini ne l'a pas retourné
    let matchCriteria = criteria.matchCriteria;
    if (!matchCriteria) {
      const kw = (criteria.keywords || query).trim();
      const words = kw.split(/\s+/).filter(w => w.length > 1);
      // Premiers mots = produit principal, on prend les 2-3 premiers comme required
      const required = words.slice(0, Math.min(2, words.length)).map(w => w.toLowerCase());
      const boost = words.slice(2).map(w => w.toLowerCase());
      matchCriteria = {
        mainProduct: words.slice(0, Math.min(3, words.length)).join(' '),
        requiredInTitle: required,
        boostIfPresent: boost,
        excludeIfPresent: [],
      };
    }

    const finalCriteria: SearchCriteria = {
      keywords: criteria.keywords || query,
      keywordsBM: criteria.keywordsBM,
      priceMin: criteria.priceMin,
      priceMax: criteria.priceMax,
      shippable: criteria.shippable,
      ownerType: criteria.ownerType,
      category: criteria.category,
      sites: criteria.sites,
      excludeAccessories: criteria.excludeAccessories,
      acceptedModels: criteria.acceptedModels,
      matchCriteria,
      originalQuery: query,
    };

    return {
      criteria: finalCriteria,
      briefing,
      visualContext,
      needsClarification,
      clarificationQuestion,
      clarificationOptions,
    };

  } catch (error: unknown) {
    console.error('[Gemini] Optimize error:', error instanceof Error ? error.message : error);
    // Fallback: retourner la requête originale
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
  searchQuery: string,
  visualContext?: VisualContext,  // v0.5.0 - Contexte visuel pour ajuster le scoring
  priceStats?: RealPriceStats,   // Prix réels calculés des résultats scrapés
  matchCriteria?: MatchCriteria  // Critères de matching pour validation cohérence
): Promise<AnalysisResult> {
  if (!process.env.GEMINI_API_KEY || results.length === 0) {
    return { analyzed: [] };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_FAST,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: ANALYZE_SCHEMA,
      },
    });

    // Passer le contexte visuel + prix réels + matchCriteria
    const prompt = buildAnalysisPrompt(results, searchQuery, visualContext, priceStats, matchCriteria);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const analysisResult = parseAnalysisResponse(text, results);

    // Retry si Gemini retourne 0 résultats (rate limit ou erreur transitoire)
    if (analysisResult.analyzed.length === 0 && results.length > 0) {
      console.warn('[Gemini] Empty analysis, retrying in 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retryResult = await model.generateContent(prompt);
      const retryResponse = await retryResult.response;
      const retryText = retryResponse.text();
      const retryAnalysis = parseAnalysisResponse(retryText, results);
      if (retryAnalysis.analyzed.length > 0) {
        return retryAnalysis;
      }
      console.error('[Gemini] Retry failed, returning empty');
    }

    return analysisResult;

  } catch (error) {
    console.error('[Gemini] Erreur analyse:', error);
    return { analyzed: [] };
  }
}

// Prompt pour l'analyse des résultats
function buildAnalysisPrompt(results: RawResult[], query: string, visualContext?: VisualContext, priceStats?: RealPriceStats, matchCriteria?: MatchCriteria): string {
  const resultsJson = results.map(r => ({
    id: r.id,
    title: r.title,
    price: r.price
  }));

  // v0.5.0 - Ajouter le contexte visuel si disponible
  let visualContextSection = '';
  if (visualContext && (visualContext.color || visualContext.size || visualContext.variant)) {
    visualContextSection = `

=== CONTEXTE VISUEL (IMPORTANT pour le scoring) ===
L'utilisateur a fourni une image ou des détails spécifiques. Voici ce qu'il recherche EXACTEMENT:
${visualContext.color ? `- COULEUR: ${visualContext.color} (TRÈS IMPORTANT pour les vêtements/chaussures)` : ''}
${visualContext.size ? `- TAILLE: ${visualContext.size}` : ''}
${visualContext.variant ? `- VARIANTE: ${visualContext.variant}` : ''}
${visualContext.condition ? `- ÉTAT: ${visualContext.condition}` : ''}

RÈGLE CRITIQUE POUR LA COULEUR:
- Si la couleur recherchée est "${visualContext.color || 'non spécifiée'}", les annonces avec cette couleur doivent avoir un confidence PLUS ÉLEVÉ
- Une annonce avec la BONNE couleur mais un prix légèrement plus haut est MEILLEURE qu'une annonce moins chère avec la mauvaise couleur
- Exemple: Gazelle ROSE recherchée → Gazelle rose 50€ = confidence 90%, Gazelle bleue 35€ = confidence 60%
`;
  }

  // Section matchCriteria pour validation cohérence
  let matchCriteriaSection = '';
  if (matchCriteria) {
    matchCriteriaSection = `

=== CRITÈRES DE MATCHING (VÉRIFIE LA COHÉRENCE) ===
Notre système a compris que l'utilisateur cherche : "${matchCriteria.mainProduct}"
- Mots attendus dans le titre (au moins un) : [${matchCriteria.requiredInTitle.join(', ')}]
${matchCriteria.boostIfPresent.length > 0 ? `- Critères bonus si présents : [${matchCriteria.boostIfPresent.join(', ')}]` : ''}
${matchCriteria.excludeIfPresent.length > 0 ? `- Mots qui indiquent un MAUVAIS résultat (pièce détachée, accessoire) : [${matchCriteria.excludeIfPresent.join(', ')}]` : ''}

IMPORTANT: Vérifie que cette compréhension est COHÉRENTE avec les résultats que tu vois.
- Si la majorité des résultats correspondent au produit "${matchCriteria.mainProduct}" → les critères sont bons, score normalement
- Si beaucoup de résultats sont des PIÈCES DÉTACHÉES ou ACCESSOIRES au lieu du produit complet → baisse leur confidence fortement (<40%)
- Un MICRO isolé ou un PICKGUARD n'est PAS une guitare. Une COQUE n'est PAS un téléphone. Un LACET n'est PAS une chaussure.
`;
  }

  return `Analyse ces annonces pour "${query}".${visualContextSection}${matchCriteriaSection}
${priceStats ? `Prix marché RÉEL: médiane ${priceStats.median}€ (basé sur ${priceStats.count} annonces, min ${priceStats.min}€ - max ${priceStats.max}€). OBLIGATION: utilise ${priceStats.median}€ comme marketPrice pour TOUS les résultats. Ne jamais inventer un prix marché différent.` : ''}

ANNONCES:
${JSON.stringify(resultsJson)}

Pour CHAQUE annonce, évalue:
- confidence (0-100): pertinence par rapport à la recherche. 90+: bon produit, 60-89: probable, 40-59: douteux, <40: hors-sujet
- relevant: false seulement si accessoire/coque/câble ou produit totalement différent
- matchDetails: court résumé (ex: "✓ MacBook M3 comme demandé" ou "✗ Housse, pas un ordinateur")
- marketPrice: ${priceStats ? `utilise ${priceStats.median}€ (médiane réelle de ${priceStats.count} annonces). NE PAS inventer un prix différent.` : 'estime le prix marché occasion basé sur les annonces affichées.'}
- dealScore (1-10): rapport qualité/prix. Compare le prix de l'annonce à la médiane réelle (marketPrice). Prix < médiane = 7-10 (bonne affaire), prix ≈ médiane = 5-6 (correct), prix > médiane = 1-4 (cher)
- dealType: excellent/good/fair/overpriced/suspicious
- redFlags: ["Prix suspect"] si prix <60% du marché de CE modèle, sinon []

Identifie aussi le topPick: meilleure annonce parmi celles qui matchent EXACTEMENT la recherche (confidence>=80, bon dealScore, pas de red flags). Préfère le bon modèle à un prix correct plutôt qu'un mauvais modèle bradé.

RÈGLES: Fais confiance aux annonces (les produits récents existent même si tu ne les connais pas). Ne pénalise pas les variations de formulation dans les titres.
COHÉRENCE: Si matchDetails dit "✗ pas le bon produit", confidence DOIT être <40. Si matchDetails dit "✓ bon produit", confidence DOIT être >=70.

Le format de sortie est forcé par le schéma JSON. Remplis TOUS les champs pour CHAQUE annonce.`;
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
      const relevant = confidence >= 50; // Seuil minimum de pertinence

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
    }

    return { analyzed, topPick };
  } catch (e) {
    console.error('[Gemini] Erreur parsing analyse:', e);
    return { analyzed: [] };
  }
}

// === RECOMMANDATION PRODUIT NEUF ("Et en neuf ?") ===

export interface NewProductRecommendation {
  hasRecommendation: boolean;
  productName?: string;
  estimatedPrice?: number;
  reason?: string;
  searchQuery?: string;   // Requête optimisée pour Amazon
}

// Recommander un produit neuf alternatif via Gemini
export async function recommendNewProduct(
  query: string,
  priceMin: number,
  priceMax: number,
  topResults?: Array<{ title: string; price: number; site: string }>
): Promise<NewProductRecommendation> {
  if (!process.env.GEMINI_API_KEY) {
    return { hasRecommendation: false };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL_FAST,
      generationConfig: { temperature: 0.2 },
    });

    // Contexte des résultats occasion trouvés
    const resultsContext = topResults && topResults.length > 0
      ? `\nRésultats occasion trouvés (TOP ${topResults.length}) :\n${topResults.map(r => `- "${r.title}" : ${r.price}€ (${r.site})`).join('\n')}\n`
      : '';

    const prompt = `En tant qu'expert achat, analyse cette recherche : "${query}"
Les résultats occasion trouvés sont dans la fourchette ${priceMin}€ - ${priceMax}€.
${resultsContext}
IMPORTANT: Ton knowledge a une date de coupure. Si des résultats occasion montrent un produit (ex: Mac mini M4), ce produit EXISTE. Ne dis jamais qu'il "n'est pas encore disponible".

Recommande le produit NEUF équivalent. Réponds en JSON UNIQUEMENT (pas de markdown) :
{
  "hasRecommendation": true/false,
  "productName": "Nom exact du produit (modèle précis)",
  "estimatedPrice": number (prix de DÉPART officiel en France, config la moins chère),
  "reason": "Phrase courte expliquant pourquoi (ton ami expert, pas commercial)",
  "searchQuery": "requête optimisée pour trouver ce produit sur Amazon"
}

Règles :
- IMPORTANT: Base-toi sur les résultats occasion trouvés ci-dessus pour comprendre quel produit exact est recherché. Ne suppose PAS qu'un produit n'existe pas s'il apparaît dans les résultats.
- hasRecommendation: false UNIQUEMENT pour vintage/collection/voiture/immobilier. Pour TOUT le reste → true.
- Recommande la CONFIG LA MOINS CHÈRE en neuf (pas la version haut de gamme)
  Ex: "Mac mini M4" → Mac mini M4 256Go (699€), pas le 512Go.
  Ex: "macbook m4" → MacBook Air M4 13" (1299€), pas le Pro.
- estimatedPrice = prix catalogue officiel de DÉPART en France. Sois PRÉCIS.
- Le ton est celui d'un ami qui s'y connaît, pas d'un vendeur
- searchQuery doit être optimisée pour Amazon (nom produit précis, pas de phrases)`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return parseNewProductResponse(text);
  } catch (error) {
    console.error('[Gemini] Erreur recommandation neuf:', error);
    return { hasRecommendation: false };
  }
}

function parseNewProductResponse(text: string): NewProductRecommendation {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    if (!parsed.hasRecommendation) {
      return { hasRecommendation: false };
    }

    return {
      hasRecommendation: true,
      productName: String(parsed.productName || ''),
      estimatedPrice: Number(parsed.estimatedPrice) || undefined,
      reason: String(parsed.reason || ''),
      searchQuery: String(parsed.searchQuery || parsed.productName || ''),
    };
  } catch (e) {
    console.error('[Gemini] Erreur parsing recommandation:', e);
    return { hasRecommendation: false };
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

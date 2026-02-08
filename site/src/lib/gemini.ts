// OKAZ - Service Gemini pour optimisation des requêtes
// Transforme une requête en langage naturel en critères structurés pour LeBonCoin

import { GoogleGenerativeAI } from '@google/generative-ai';

// Sites disponibles pour la recherche
export type SearchSite = 'leboncoin' | 'vinted' | 'backmarket';

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
1. Prix du marché occasion (fourchette réaliste en bon état)
2. Prix de méfiance (en dessous = arnaque probable, -30% du min)
3. 3 conseils SPÉCIFIQUES au produit (pas génériques!)
4. Prix reconditionné estimé (Back Market)

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

RÉPONDS EN JSON UNIQUEMENT (pas de markdown):
{
  "keywords": "string (mots-clés optimisés pour LeBonCoin/Vinted)",
  "keywordsBM": "string | null (mots-clés simplifiés pour Back Market, si catégorie tech)",
  "category": "tech" | "mode" | "auto" | "immo" | "maison" | "loisirs" | "autre",
  "priceMin": number | null,
  "priceMax": number | null,
  "shippable": boolean | null,
  "ownerType": "private" | "pro" | null,
  "excludeAccessories": boolean (true si l'utilisateur cherche le produit principal, pas les accessoires),
  "needsClarification": boolean,
  "clarificationQuestion": "string | null (question COURTE, 1 phrase max)",
  "clarificationOptions": ["string", "string", "..."] | null (2-4 options cliquables, CONCRÈTES),
  "detectedSpecs": {
    "size": "string | null (taille détectée: 42, M, L...)",
    "capacity": "string | null (capacité: 128Go, 256Go...)",
    "condition": "string | null (neuf, comme neuf, bon état...)",
    "color": "string | null (couleur principale: rose, bleu, noir, blanc...)",
    "extras": ["string"] (accessoires mentionnés: manette, chargeur...),
    "minRAM": "string | null (RAM minimale: 8Go, 16Go...)",
    "acceptedModels": ["string"] (modèles acceptés si multi-produits: ["MacBook Pro", "Mac mini"])
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
      } else {
        console.log(`[Gemini] Contexte visuel détecté:`, visualContext);
      }
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
    console.log('[Gemini] Fetching reference URL:', url);

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

  console.log('[Gemini] ====== DÉBUT OPTIMISATION ======');
  console.log('[Gemini] Requête:', query);
  console.log('[Gemini] Image:', imageBase64 ? 'OUI (base64)' : 'NON');
  console.log('[Gemini] Reference URL:', referenceUrl || 'NON');
  console.log('[Gemini] Clarifications:', clarifications?.length || 0);
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

    // v0.5.0 - Build prompt with context (image + URL)
    const prompt = buildPromptWithContext(query, !!imageBase64, referenceUrl, clarifications);
    console.log('[Gemini] Envoi requête à l\'API...');

    // v0.5.0 - Si image, utiliser Vision
    let result;
    if (imageBase64) {
      console.log('[Gemini] Mode Vision activé');
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

    console.log('[Gemini] ✓ Réponse reçue');

    const response = await result.response;
    const text = response.text();

    console.log('[Gemini] Réponse brute:', text);

    const { criteria, briefing, visualContext, needsClarification, clarificationQuestion, clarificationOptions } = parseGeminiResponse(text, query);

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
      originalQuery: query,
    };

    console.log('[Gemini] ✓ Critères extraits:', JSON.stringify(finalCriteria));
    if (briefing) {
      console.log('[Gemini] ✓ Briefing généré:', JSON.stringify(briefing));
    }
    if (visualContext) {
      console.log('[Gemini] ✓ Contexte visuel:', JSON.stringify(visualContext));
    }
    if (needsClarification) {
      console.log('[Gemini] ⚠ Clarification nécessaire:', clarificationQuestion);
    }
    console.log('[Gemini] ====== FIN OPTIMISATION ======');

    return {
      criteria: finalCriteria,
      briefing,
      visualContext,
      needsClarification,
      clarificationQuestion,
      clarificationOptions,
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
  searchQuery: string,
  visualContext?: VisualContext  // v0.5.0 - Contexte visuel pour ajuster le scoring
): Promise<AnalysisResult> {
  console.log('[Gemini] ====== ANALYSE DES RÉSULTATS ======');
  console.log('[Gemini] Nombre de résultats à analyser:', results.length);
  if (visualContext) {
    console.log('[Gemini] Contexte visuel:', JSON.stringify(visualContext));
  }

  if (!process.env.GEMINI_API_KEY || results.length === 0) {
    console.log('[Gemini] Pas de clé API ou pas de résultats, skip analyse');
    return { analyzed: [] };
  }

  // Analyser TOUS les résultats - l'IA est la valeur ajoutée d'OKAZ
  // Pas de limite artificielle, on track les coûts pour optimiser plus tard
  console.log('[Gemini] Analyse de TOUS les', results.length, 'résultats');

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
    });

    // v0.5.0 - Passer le contexte visuel au prompt
    const prompt = buildAnalysisPrompt(results, searchQuery, visualContext);
    console.log('[Gemini] Envoi analyse (thinking désactivé)...');

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
function buildAnalysisPrompt(results: RawResult[], query: string, visualContext?: VisualContext): string {
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

  return `Tu es un expert du marché de l'occasion. Analyse ces annonces pour la recherche "${query}".${visualContextSection}

ANNONCES:
${JSON.stringify(resultsJson, null, 2)}

=== PARTIE 1: ÉVALUATION DE LA PERTINENCE ===

Pour CHAQUE annonce, évalue si c'est le BON PRODUIT pour l'utilisateur.

1. SCORE DE CONFIANCE (0-100) — "Est-ce le produit recherché ?"

   RÈGLE CRITIQUE - KNOWLEDGE CUTOFF:
   Ton knowledge a une date de coupure. De nouveaux produits sortent régulièrement (nouveaux processeurs, nouvelles générations).
   Si un produit apparaît sur Back Market, LeBonCoin ou Vinted, IL EXISTE. Ne le flag JAMAIS comme "non commercialisé" ou "suspect" juste parce que tu ne le connais pas.
   Exemples de produits récents que tu pourrais ne pas connaître : Apple M4, M4 Pro, M4 Max, iPhone 16, PS5 Pro, RTX 5090, etc.
   En cas de doute sur l'existence d'un produit, FAIS CONFIANCE à l'annonce.

   RÈGLE CLÉ: Les titres d'annonces ne sont JAMAIS formatés comme la recherche.
   Un titre "Mac mini (2024) M4 4.5 GHz - SSD 256 Go - 16Go" EST un Mac mini M4 16Go.
   Ne pénalise PAS les variations de formulation, specs supplémentaires, ou ordre des mots.

   - 90-100: C'est le bon produit (même famille + même génération/modèle + specs compatibles)
   - 75-89: Très probable (bon produit, une spec mineure diffère ou non précisée)
   - 60-74: Probable mais incertain (même famille, génération/specs pas clairs)
   - 40-59: Douteux (même catégorie mais modèle significativement différent)
   - 0-39: Hors-sujet (accessoire, autre produit, autre marque)

   RECHERCHE MULTI-PRODUITS: Si l'utilisateur cherche "X ou Y", les DEUX sont à 90%+ si match.
   Ex: "macbook ou mac mini M4" → un MacBook M4 = 92%, un Mac mini M4 = 92%

2. RELEVANT = false UNIQUEMENT SI:
   - C'est un ACCESSOIRE au lieu du produit (coque, câble, housse, protection écran)
   - C'est une catégorie TOTALEMENT différente
   - C'est clairement une autre marque que celle demandée

   IMPORTANT: En cas de doute, garde relevant: true. On préfère montrer un résultat discutable que masquer une bonne affaire.

3. MATCHDETAILS: Explique ce qui matche ou pas (court):
   - "✓ Mac mini M4 16Go comme demandé"
   - "✓ MacBook Pro M4, specs compatibles"
   - "⚠ MacBook M3 (pas M4 demandé)"
   - "✗ Coque pour MacBook, pas un ordinateur"

EXEMPLES DE SCORING:
- "iPhone 13 128Go" + "iPhone 13 128Go noir" → confidence: 95 (match parfait, couleur = bonus info)
- "iPhone 13 128Go" + "iPhone 13 Pro 256Go" → confidence: 80 (même famille, specs supérieures)
- "macbook ou mac mini M4 16gb" + "Mac mini M4 4.5GHz 16Go" → confidence: 95 (match exact malgré titre différent)
- "macbook ou mac mini M4 16gb" + "MacBook Pro 14 M4 16Go" → confidence: 93 (l'autre option demandée)
- "macbook ou mac mini M4 16gb" + "MacBook Air M2 8Go" → confidence: 45 (mauvaise génération + RAM insuffisante)
- "Nike Dunk 42" + "Nike Dunk Low 42" → confidence: 92 (match, "Low" est la variante standard)
- "Nike Dunk 42" + "Motorola Edge 40" → confidence: 5, relevant: false
- "iPhone 13" + "Coque iPhone 13" → confidence: 5, relevant: false
- "PS5" + "Manette PS5" → confidence: 8, relevant: false (accessoire)
- "PS5" + "PS5 Digital + manette" → confidence: 90 (c'est une PS5 avec bonus)

EXEMPLES AVEC COULEUR (si contexte visuel fourni):
- Recherche "Adidas Gazelle" + couleur ROSE → "Gazelle rose" = confidence 95%, "Gazelle bleue" = confidence 55%
- Recherche "Nike Air Force" + couleur BLANCHE → "AF1 blanches" = confidence 95%, "AF1 noires" = confidence 50%
- La couleur est un critère MAJEUR pour les vêtements/chaussures

=== PARTIE 2: ANALYSE DU DEAL ===

Pour chaque annonce PERTINENTE (relevant: true):
1. marketPrice: Prix du marché occasion en bon état — estime UN prix cohérent pour le même produit.
   IMPORTANT: Utilise le MÊME marketPrice pour toutes les annonces du même produit.

2. dealScore (1-10): Compare le prix de l'annonce au marketPrice.
   Tu n'as PAS besoin de calculer — utilise cette grille de lecture :
   - Le MOINS CHER parmi les annonces du même produit doit avoir le dealScore le PLUS HAUT
   - Le PLUS CHER doit avoir le dealScore le PLUS BAS
   - dealScore 10 : prix exceptionnel, bien en-dessous du marché (>20% moins cher)
   - dealScore 8-9 : très bonne affaire (10-20% moins cher)
   - dealScore 6-7 : bon prix, légèrement sous le marché
   - dealScore 5 : prix = marché, ni bon ni mauvais
   - dealScore 3-4 : un peu cher par rapport au marché
   - dealScore 1-2 : beaucoup trop cher

   RÈGLE ABSOLUE: Si l'annonce A coûte 605€ et l'annonce B coûte 745€ pour le MÊME produit,
   A DOIT avoir un dealScore SUPÉRIEUR à B. C'est obligatoire.
   Deux prix différents = deux dealScores différents. TOUJOURS.

3. dealType: excellent (dealScore 8-10), good (6-7), fair (4-5), overpriced (1-3), suspicious (prix bizarre)

RED FLAGS à détecter:
- Prix <60% du marché → "Prix suspect"
- "Urgent", "départ" → "Vente urgente"
- "PayPal amis", "virement" → "Paiement suspect"
- "Neuf sous blister" à prix cassé → "Arnaque probable"
- Tout en MAJUSCULES → "Titre suspect"

⚠️ NE SONT PAS DES RED FLAGS:
- Un modèle/processeur que tu ne connais pas (ton knowledge a une date de coupure, de nouveaux produits sortent régulièrement)
- Des specs inhabituelles sur un produit récent (ex: fréquence CPU différente de ce que tu connais)
- Un produit vendu sur Back Market ou un site marchand réputé — ces sites vérifient leurs produits

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
  console.log('[Gemini] ====== RECOMMANDATION NEUF ======');
  console.log('[Gemini] Recherche:', query, '| Fourchette:', priceMin, '-', priceMax, '€');

  if (!process.env.GEMINI_API_KEY) {
    return { hasRecommendation: false };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Contexte des résultats occasion trouvés
    const resultsContext = topResults && topResults.length > 0
      ? `\nRésultats occasion trouvés (TOP ${topResults.length}) :\n${topResults.map(r => `- "${r.title}" : ${r.price}€ (${r.site})`).join('\n')}\n`
      : '';

    const prompt = `En tant qu'expert achat, analyse cette recherche : "${query}"
Les résultats occasion trouvés sont dans la fourchette ${priceMin}€ - ${priceMax}€.
${resultsContext}
IMPORTANT: Ton knowledge a une date de coupure. Si des résultats occasion montrent un produit (ex: Mac mini M4), ce produit EXISTE. Ne dis jamais qu'il "n'est pas encore disponible".

Recommande-tu un produit NEUF comme alternative ? Réponds en JSON UNIQUEMENT (pas de markdown) :
{
  "hasRecommendation": true/false,
  "productName": "Nom exact du produit",
  "estimatedPrice": 29,
  "reason": "Phrase courte expliquant pourquoi (ton ami expert, pas commercial)",
  "searchQuery": "requête optimisée pour trouver ce produit sur Amazon"
}

Règles :
- IMPORTANT: Base-toi sur les résultats occasion trouvés ci-dessus pour comprendre quel produit exact est recherché. Ne suppose PAS qu'un produit n'existe pas s'il apparaît dans les résultats.
- Recommande uniquement si ça a du sens (pas de neuf pour du vintage/collection/voiture/immobilier)
- Recommande la CONFIG LA MOINS CHÈRE en neuf qui correspond à la recherche (pas la version haut de gamme)
  Ex: Si l'utilisateur cherche un Mac mini M4 16Go, recommande le modèle d'entrée (256Go SSD) pas le 512Go ou 1To
- Le prix estimé doit être le prix de DÉPART du modèle neuf, pas une config supérieure
- Compare ton prix neuf au MEILLEUR prix occasion trouvé (le plus bas dans les résultats ci-dessus)
  Si le neuf est plus de 40% plus cher que la meilleure occasion → hasRecommendation: false
- Le ton est celui d'un ami qui s'y connaît, pas d'un vendeur
- searchQuery doit être optimisée pour Amazon (nom produit précis, pas de phrases)`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('[Gemini] Réponse recommandation:', text.substring(0, 300));

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

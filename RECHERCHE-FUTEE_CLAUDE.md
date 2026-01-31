# 🔍 RECHERCHE FUTÉE - CLAUDE.MD

> **"Cherchez une fois, trouvez partout"**  
> Le comparateur intelligent de petites annonces avec analyse IA

---

## 📋 INFORMATIONS PROJET

| Élément | Valeur |
|---------|--------|
| **Nom** | Recherche Futée |
| **Type** | Site Web + Extension Chrome |
| **Statut** | 🟡 Prototype |
| **Parent** | Facile-IA (Lab Project) |
| **Repo** | `recherche-futee/` |
| **Durée estimée** | 5-7 jours |

---

## 🎯 VISION PRODUIT

### Problème résolu
Les sites de petites annonces (LeBonCoin, Vinted, Back Market) ont des moteurs de recherche limités qui ne comprennent pas les specs techniques. L'utilisateur doit :
1. Chercher sur 3-5 sites différents
2. Ouvrir des dizaines d'annonces pour vérifier les specs
3. Comparer mentalement les résultats

### Solution
Un site web centralisant la recherche + une extension Chrome qui :
1. Comprend les recherches en langage naturel ("MacBook 16GB M1 max 1000€")
2. Lance les recherches sur tous les sites EN PARALLÈLE (via extension)
3. Analyse chaque annonce avec l'IA (extraction specs, scoring)
4. Affiche les résultats triés par pertinence

### Proposition de valeur
- **Avant** : 15-30 min de recherche manuelle sur 3 sites
- **Après** : 6-8 secondes, résultats analysés et scorés

---

## 🏗️ ARCHITECTURE

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                 SITE WEB (Next.js)                          │
│              recherche-futee.facile-ia.fr                   │
├─────────────────────────────────────────────────────────────┤
│  • Interface de recherche (input langage naturel)          │
│  • Détection extension installée                           │
│  • Affichage résultats centralisés                         │
│  • Onboarding si extension manquante                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ chrome.runtime.sendMessage
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTENSION CHROME                            │
│              (Manifest V3)                                  │
├─────────────────────────────────────────────────────────────┤
│  BACKGROUND (Service Worker)                                │
│  • Reçoit requêtes du site web                             │
│  • Orchestre les recherches parallèles                     │
│  • Communique avec Gemini API                              │
│  • Renvoie résultats au site                               │
├─────────────────────────────────────────────────────────────┤
│  CONTENT SCRIPTS (injectés sur LBC, Vinted, etc.)          │
│  • Parse le DOM des pages de résultats                     │
│  • Extrait : titre, prix, image, description, lien         │
│  • Renvoie au background                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 GEMINI 1.5 FLASH API                        │
├─────────────────────────────────────────────────────────────┤
│  • Comprend la requête utilisateur                         │
│  • Extrait les critères (RAM, CPU, prix, état...)         │
│  • Score chaque annonce (0-100%)                           │
│  • Détecte les red flags (arnaques potentielles)          │
└─────────────────────────────────────────────────────────────┘
```

### Communication Site ↔ Extension

```javascript
// manifest.json
{
  "externally_connectable": {
    "matches": [
      "https://recherche-futee.facile-ia.fr/*",
      "http://localhost:3000/*"  // Dev
    ]
  }
}

// Depuis le site web
const EXTENSION_ID = "votre-extension-id";

// Vérifier si extension installée
async function checkExtension() {
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      resolve(false);
      return;
    }
    chrome.runtime.sendMessage(EXTENSION_ID, { type: "ping" }, (response) => {
      resolve(response?.installed === true);
    });
  });
}

// Lancer une recherche
async function search(query, sites, maxPrice) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: "search",
      payload: { query, sites, maxPrice }
    }, (response) => {
      if (response.error) reject(response.error);
      else resolve(response.results);
    });
  });
}
```

---

## 🛠️ STACK TECHNIQUE

### Site Web

| Techno | Version | Usage |
|--------|---------|-------|
| Next.js | 15+ | Framework React (App Router) |
| React | 19 | UI |
| Tailwind CSS | 4 | Styling |
| TypeScript | 5+ | Typage |
| Vercel | - | Hosting (gratuit) |

### Extension Chrome

| Techno | Version | Usage |
|--------|---------|-------|
| Manifest | V3 | Config extension |
| TypeScript | 5+ | Typage |
| Vite | 5+ | Build |
| CRXJS | - | Plugin Vite pour extensions |

### IA

| Techno | Usage | Coût |
|--------|-------|------|
| Gemini 1.5 Flash | Analyse + Scoring | ~0.00005€/annonce |
| Free tier | 1,500 req/jour | 0€ |

---

## 📁 STRUCTURE DES FICHIERS

### Extension Chrome

```
extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
│
├── src/
│   ├── background/
│   │   ├── index.ts              # Service Worker principal
│   │   ├── search-orchestrator.ts # Gère les recherches parallèles
│   │   ├── gemini-client.ts      # Client API Gemini
│   │   └── messaging.ts          # Communication avec site web
│   │
│   ├── content/
│   │   ├── index.ts              # Point d'entrée content script
│   │   ├── sites/
│   │   │   ├── leboncoin.ts      # Parser LeBonCoin
│   │   │   ├── vinted.ts         # Parser Vinted
│   │   │   ├── backmarket.ts     # Parser Back Market
│   │   │   └── index.ts          # Détection auto du site
│   │   └── types.ts
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── Popup.tsx             # UI popup (config clé API)
│   │   └── styles.css
│   │
│   ├── lib/
│   │   ├── types.ts              # Types partagés
│   │   ├── prompts.ts            # Prompts Gemini
│   │   ├── url-builders.ts       # Construction URLs recherche
│   │   └── storage.ts            # chrome.storage helpers
│   │
│   └── assets/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
└── dist/                         # Build production
```

### Site Web

```
site/
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Page d'accueil + recherche
│   ├── globals.css
│   │
│   └── components/
│       ├── SearchBar.tsx         # Input recherche
│       ├── ResultsList.tsx       # Liste des résultats
│       ├── ResultCard.tsx        # Carte d'une annonce
│       ├── SiteFilter.tsx        # Filtres par site
│       ├── LoadingState.tsx      # Skeleton + progression
│       ├── ExtensionPrompt.tsx   # CTA installation extension
│       └── ScoreBadge.tsx        # Badge score pertinence
│
├── lib/
│   ├── extension-bridge.ts       # Communication avec extension
│   ├── types.ts
│   └── utils.ts
│
└── public/
    └── images/
```

---

## 📊 TYPES TYPESCRIPT

```typescript
// lib/types.ts

// Requête de recherche
interface SearchRequest {
  query: string;           // "MacBook Pro 16GB M1 max 1000€"
  sites: Site[];           // ["leboncoin", "vinted", "backmarket"]
  maxResults?: number;     // Défaut: 35 par site
}

// Sites supportés
type Site = "leboncoin" | "vinted" | "backmarket" | "ebay";

// Critères extraits par Gemini
interface SearchCriteria {
  product: string;         // "MacBook Pro"
  brand?: string;          // "Apple"
  model?: string;          // "M1"
  specs: {
    ram?: number;          // 16 (GB)
    storage?: number;      // 512 (GB)
    cpu?: string;          // "M1"
    screenSize?: number;   // 14 (pouces)
  };
  maxPrice?: number;       // 1000
  minPrice?: number;
  condition?: "new" | "like_new" | "good" | "fair";
  keywords: string[];      // Mots-clés additionnels
}

// Annonce brute (parsée du DOM)
interface RawListing {
  site: Site;
  id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  description: string;
  location?: string;
  date?: string;
  seller?: {
    name: string;
    rating?: number;
    isPro?: boolean;
  };
}

// Annonce analysée par Gemini
interface AnalyzedListing extends RawListing {
  score: number;           // 0-100
  matchedCriteria: {
    [key: string]: {
      expected: string | number;
      found: string | number | null;
      match: boolean;
    };
  };
  redFlags: string[];      // ["Prix anormalement bas", "Photo stock"]
  confidence: number;      // 0-1
}

// Réponse complète
interface SearchResponse {
  query: string;
  criteria: SearchCriteria;
  results: AnalyzedListing[];
  meta: {
    totalFound: number;
    searchTime: number;     // ms
    sitesSearched: Site[];
    errors?: { site: Site; error: string }[];
  };
}

// Messages extension ↔ site
type ExtensionMessage =
  | { type: "ping" }
  | { type: "search"; payload: SearchRequest }
  | { type: "get_api_key" }
  | { type: "set_api_key"; payload: string };

type ExtensionResponse =
  | { installed: true; version: string }
  | { results: SearchResponse }
  | { error: string }
  | { apiKey: string | null };
```

---

## 🔧 PARSERS PAR SITE

### LeBonCoin

```typescript
// content/sites/leboncoin.ts

const SELECTORS = {
  listingContainer: '[data-qa-id="aditem_container"]',
  title: '[data-qa-id="aditem_title"]',
  price: '[data-qa-id="aditem_price"]',
  image: 'img[src*="leboncoin"]',
  location: '[data-qa-id="aditem_location"]',
  date: 'time',
  link: 'a[href*="/ad/"]',
};

export function parseLeBonCoin(): RawListing[] {
  const listings: RawListing[] = [];
  const items = document.querySelectorAll(SELECTORS.listingContainer);

  items.forEach((item, index) => {
    const titleEl = item.querySelector(SELECTORS.title);
    const priceEl = item.querySelector(SELECTORS.price);
    const imageEl = item.querySelector(SELECTORS.image) as HTMLImageElement;
    const linkEl = item.querySelector(SELECTORS.link) as HTMLAnchorElement;
    const locationEl = item.querySelector(SELECTORS.location);

    if (!titleEl || !linkEl) return;

    listings.push({
      site: "leboncoin",
      id: `lbc-${index}`,
      url: linkEl.href,
      title: titleEl.textContent?.trim() || "",
      price: parsePrice(priceEl?.textContent),
      currency: "EUR",
      imageUrl: imageEl?.src || null,
      description: "", // Nécessite d'ouvrir l'annonce
      location: locationEl?.textContent?.trim(),
    });
  });

  return listings;
}

function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/\s/g, "").match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
```

### Vinted

```typescript
// content/sites/vinted.ts

const SELECTORS = {
  listingContainer: '[data-testid*="product-item"]',
  title: '[data-testid*="description-title"]',
  price: '[data-testid*="price-text"]',
  image: 'img[src*="vinted"]',
  brand: '[data-testid*="description-subtitle"]',
  link: 'a[href*="/items/"]',
};

export function parseVinted(): RawListing[] {
  const listings: RawListing[] = [];
  const items = document.querySelectorAll(SELECTORS.listingContainer);

  items.forEach((item, index) => {
    const titleEl = item.querySelector(SELECTORS.title);
    const priceEl = item.querySelector(SELECTORS.price);
    const imageEl = item.querySelector(SELECTORS.image) as HTMLImageElement;
    const linkEl = item.querySelector(SELECTORS.link) as HTMLAnchorElement;
    const brandEl = item.querySelector(SELECTORS.brand);

    if (!titleEl || !linkEl) return;

    listings.push({
      site: "vinted",
      id: `vinted-${index}`,
      url: linkEl.href,
      title: titleEl.textContent?.trim() || "",
      price: parsePrice(priceEl?.textContent),
      currency: "EUR",
      imageUrl: imageEl?.src || null,
      description: brandEl?.textContent?.trim() || "",
      location: undefined,
    });
  });

  return listings;
}
```

### Back Market

```typescript
// content/sites/backmarket.ts

const SELECTORS = {
  listingContainer: '[data-qa="product-card"]',
  title: '[data-qa="product-card-title"]',
  price: '[data-qa="product-card-price"]',
  image: 'img[data-qa="product-card-image"]',
  condition: '[data-qa="product-card-condition"]',
  link: 'a[href*="/product/"]',
};

export function parseBackMarket(): RawListing[] {
  const listings: RawListing[] = [];
  const items = document.querySelectorAll(SELECTORS.listingContainer);

  items.forEach((item, index) => {
    const titleEl = item.querySelector(SELECTORS.title);
    const priceEl = item.querySelector(SELECTORS.price);
    const imageEl = item.querySelector(SELECTORS.image) as HTMLImageElement;
    const linkEl = item.querySelector(SELECTORS.link) as HTMLAnchorElement;
    const conditionEl = item.querySelector(SELECTORS.condition);

    if (!titleEl || !linkEl) return;

    listings.push({
      site: "backmarket",
      id: `bm-${index}`,
      url: linkEl.href,
      title: titleEl.textContent?.trim() || "",
      price: parsePrice(priceEl?.textContent),
      currency: "EUR",
      imageUrl: imageEl?.src || null,
      description: conditionEl?.textContent?.trim() || "",
      location: undefined,
      seller: {
        name: "Back Market",
        isPro: true,
      },
    });
  });

  return listings;
}
```

---

## 🤖 PROMPTS GEMINI

### Extraction des critères

```typescript
// lib/prompts.ts

export const EXTRACT_CRITERIA_PROMPT = `
Tu es un expert en extraction de critères de recherche pour des produits d'occasion.

À partir de la requête utilisateur suivante, extrais les critères de recherche au format JSON.

REQUÊTE : "{query}"

RÉPONDS UNIQUEMENT avec un JSON valide (pas de markdown, pas d'explication) :
{
  "product": "nom du produit recherché",
  "brand": "marque ou null",
  "model": "modèle ou null",
  "specs": {
    "ram": nombre en GB ou null,
    "storage": nombre en GB ou null,
    "cpu": "processeur ou null",
    "screenSize": nombre en pouces ou null
  },
  "maxPrice": nombre ou null,
  "minPrice": nombre ou null,
  "condition": "new" | "like_new" | "good" | "fair" | null,
  "keywords": ["mots", "clés", "additionnels"]
}
`;
```

### Scoring des annonces

```typescript
export const SCORE_LISTINGS_PROMPT = `
Tu es un expert en évaluation d'annonces de produits d'occasion.

CRITÈRES RECHERCHÉS :
{criteria}

ANNONCES À ÉVALUER (JSON array) :
{listings}

Pour CHAQUE annonce, évalue la pertinence (0-100) et identifie les red flags.

RÉPONDS UNIQUEMENT avec un JSON array (pas de markdown) :
[
  {
    "id": "id de l'annonce",
    "score": 0-100,
    "matchedCriteria": {
      "ram": { "expected": 16, "found": 16, "match": true },
      "cpu": { "expected": "M1", "found": "M1", "match": true },
      "price": { "expected": "<=1000", "found": 850, "match": true }
    },
    "redFlags": ["Prix anormalement bas", "Description vague"],
    "confidence": 0.95
  }
]

RÈGLES DE SCORING :
- 100 = Tous les critères correspondent parfaitement
- 80-99 = Critères principaux OK, mineurs manquants
- 50-79 = Certains critères importants ne correspondent pas
- 0-49 = Ne correspond pas du tout

RED FLAGS À DÉTECTER :
- Prix anormalement bas (< 50% du marché)
- Photos de stock / professionnelles suspectes
- Description trop vague ou copié-collé
- Vendeur sans historique
- Demande de paiement hors plateforme
`;
```

---

## ⚡ ORCHESTRATION DES RECHERCHES

```typescript
// background/search-orchestrator.ts

import { parseLeBonCoin } from "../content/sites/leboncoin";
import { parseVinted } from "../content/sites/vinted";
import { parseBackMarket } from "../content/sites/backmarket";

const SITE_CONFIGS: Record<Site, SiteConfig> = {
  leboncoin: {
    searchUrl: (q, maxPrice) => 
      `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(q)}${maxPrice ? `&price=0-${maxPrice}` : ""}`,
    parser: parseLeBonCoin,
    timeout: 10000,
  },
  vinted: {
    searchUrl: (q, maxPrice) =>
      `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(q)}${maxPrice ? `&price_to=${maxPrice}` : ""}`,
    parser: parseVinted,
    timeout: 15000, // Vinted est plus lent (SPA)
  },
  backmarket: {
    searchUrl: (q) =>
      `https://www.backmarket.fr/fr-fr/search?q=${encodeURIComponent(q)}`,
    parser: parseBackMarket,
    timeout: 10000,
  },
};

export async function orchestrateSearch(
  request: SearchRequest
): Promise<SearchResponse> {
  const startTime = Date.now();
  
  // 1. Extraire les critères via Gemini
  const criteria = await extractCriteria(request.query);
  
  // 2. Lancer les recherches EN PARALLÈLE
  const searchPromises = request.sites.map((site) =>
    searchSite(site, criteria).catch((error) => ({
      site,
      error: error.message,
      listings: [],
    }))
  );
  
  const results = await Promise.all(searchPromises);
  
  // 3. Collecter toutes les annonces
  const allListings: RawListing[] = [];
  const errors: { site: Site; error: string }[] = [];
  
  results.forEach((result) => {
    if ("error" in result && result.error) {
      errors.push({ site: result.site, error: result.error });
    }
    allListings.push(...result.listings);
  });
  
  // 4. Scorer avec Gemini
  const analyzedListings = await scoreListings(allListings, criteria);
  
  // 5. Trier par score décroissant
  analyzedListings.sort((a, b) => b.score - a.score);
  
  return {
    query: request.query,
    criteria,
    results: analyzedListings,
    meta: {
      totalFound: analyzedListings.length,
      searchTime: Date.now() - startTime,
      sitesSearched: request.sites,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}

async function searchSite(
  site: Site,
  criteria: SearchCriteria
): Promise<{ site: Site; listings: RawListing[] }> {
  const config = SITE_CONFIGS[site];
  const searchUrl = config.searchUrl(
    criteria.keywords.join(" "),
    criteria.maxPrice
  );
  
  // Ouvrir un onglet en background
  const tab = await chrome.tabs.create({
    url: searchUrl,
    active: false,
  });
  
  try {
    // Attendre le chargement
    await waitForTabLoad(tab.id!, config.timeout);
    
    // Exécuter le parser via content script
    const listings = await chrome.tabs.sendMessage(tab.id!, {
      type: "PARSE_PAGE",
      site,
    });
    
    return { site, listings };
  } finally {
    // Toujours fermer l'onglet
    await chrome.tabs.remove(tab.id!);
  }
}

function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout"));
    }, timeout);
    
    const listener = (
      id: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (id === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // Petit délai pour le JS
        setTimeout(resolve, 500);
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}
```

---

## 🎨 UI COMPONENTS

### SearchBar

```tsx
// app/components/SearchBar.tsx
"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: MacBook Pro 16GB RAM M1 max 1000€"
          className="
            w-full px-6 py-4 pr-14
            text-lg
            bg-white/10 backdrop-blur-xl
            border border-white/20
            rounded-2xl
            text-white placeholder:text-white/50
            focus:outline-none focus:ring-2 focus:ring-primary/50
            transition-all
          "
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="
            absolute right-2 top-1/2 -translate-y-1/2
            p-3 rounded-xl
            bg-primary hover:bg-primary/80
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all
          "
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <p className="mt-3 text-sm text-white/60 text-center">
        Décrivez ce que vous cherchez en langage naturel
      </p>
    </form>
  );
}
```

### ScoreBadge

```tsx
// app/components/ScoreBadge.tsx

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getEmoji = () => {
    if (score >= 80) return "🟢";
    if (score >= 50) return "🟡";
    return "🔴";
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2",
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5
      ${sizes[size]}
      ${getColor()}
      text-white font-semibold
      rounded-full
    `}>
      {getEmoji()} {score}%
    </span>
  );
}
```

### LoadingState (Affichage progressif)

```tsx
// app/components/LoadingState.tsx

interface LoadingStateProps {
  sites: Array<{
    name: string;
    status: "pending" | "loading" | "done" | "error";
    resultsCount?: number;
  }>;
}

export function LoadingState({ sites }: LoadingStateProps) {
  return (
    <div className="space-y-3 p-6 bg-white/5 rounded-2xl">
      <p className="text-white/80 font-medium">
        🔍 Recherche en cours...
      </p>
      
      <div className="space-y-2">
        {sites.map((site) => (
          <div
            key={site.name}
            className="flex items-center gap-3 text-sm"
          >
            {site.status === "pending" && (
              <span className="text-white/40">○</span>
            )}
            {site.status === "loading" && (
              <span className="animate-pulse">⏳</span>
            )}
            {site.status === "done" && (
              <span className="text-green-400">✓</span>
            )}
            {site.status === "error" && (
              <span className="text-red-400">✗</span>
            )}
            
            <span className={
              site.status === "done" ? "text-white" : "text-white/60"
            }>
              {site.name}
              {site.status === "done" && site.resultsCount !== undefined && (
                <span className="ml-2 text-white/40">
                  ({site.resultsCount} résultats)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 💰 MODÈLE ÉCONOMIQUE

### Options utilisateur

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🆓 GRATUIT                                                 │
│  ├── User fournit sa clé Gemini (gratuite)                 │
│  ├── 1,500 recherches/jour (tier gratuit Gemini)           │
│  └── Toutes les fonctionnalités                            │
│                                                             │
│  💳 CRÉDITS (optionnel)                                    │
│  ├── Pour ceux qui ne veulent pas créer de clé API         │
│  ├── 100 recherches = 1.99€                                │
│  ├── 300 recherches = 4.99€                                │
│  └── N'expire jamais                                        │
│                                                             │
│  🔗 AFFILIATION                                             │
│  ├── Liens trackés vers Back Market (2-5% commission)      │
│  └── Revenus passifs sur les achats                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Coûts

| Poste | Coût |
|-------|------|
| Chrome Web Store | 5€ (one-time) |
| Hébergement site | 0€ (Vercel free) |
| Gemini API | ~0.00005€/annonce |
| **Total mensuel** | **< 5€** |

---

## 📅 ROADMAP

### Phase 1 : MVP Extension (2 jours)

- [ ] Structure projet extension
- [ ] Manifest V3 + permissions
- [ ] Parser LeBonCoin
- [ ] Service Worker basique
- [ ] Communication externally_connectable
- [ ] Intégration Gemini

### Phase 2 : Site Web (2 jours)

- [ ] Setup Next.js
- [ ] Page recherche
- [ ] Bridge extension
- [ ] Affichage résultats
- [ ] Loading progressif
- [ ] Détection extension + onboarding

### Phase 3 : Multi-sites (1-2 jours)

- [ ] Parser Vinted
- [ ] Parser Back Market
- [ ] Recherches parallèles
- [ ] Gestion erreurs/timeouts

### Phase 4 : Polish (1 jour)

- [ ] UI/UX responsive
- [ ] Cache recherches
- [ ] Rate limiting
- [ ] Tests

### Phase 5 : Publication (1 jour)

- [ ] Build production
- [ ] Chrome Web Store
- [ ] Déploiement Vercel
- [ ] Documentation utilisateur

---

## 🔐 SÉCURITÉ ET LIMITES

### Rate Limiting

```typescript
// lib/rate-limiter.ts

const LIMITS = {
  searchesPerMinute: 2,
  searchesPerHour: 20,
  searchesPerDay: 100,
};

export class RateLimiter {
  private searches: number[] = [];

  canSearch(): boolean {
    const now = Date.now();
    this.searches = this.searches.filter((t) => now - t < 86400000);

    const lastMinute = this.searches.filter((t) => now - t < 60000).length;
    const lastHour = this.searches.filter((t) => now - t < 3600000).length;
    const lastDay = this.searches.length;

    return (
      lastMinute < LIMITS.searchesPerMinute &&
      lastHour < LIMITS.searchesPerHour &&
      lastDay < LIMITS.searchesPerDay
    );
  }

  recordSearch(): void {
    this.searches.push(Date.now());
  }
}
```

### Stockage clé API

```typescript
// lib/storage.ts

export async function saveApiKey(key: string): Promise<void> {
  // Stockage local uniquement (pas de serveur)
  await chrome.storage.local.set({ geminiApiKey: key });
}

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get("geminiApiKey");
  return result.geminiApiKey || null;
}

// La clé ne quitte JAMAIS le navigateur de l'utilisateur
// Pas de transmission à nos serveurs
```

---

## 🧪 TESTS MANUELS

### Checklist pré-publication

```
EXTENSION
─────────

[ ] Installation depuis fichier ZIP
[ ] Popup s'ouvre correctement
[ ] Configuration clé API fonctionne
[ ] Parser LBC extrait les annonces
[ ] Parser Vinted extrait les annonces
[ ] Parser Back Market extrait les annonces
[ ] Onglets se ferment après parsing
[ ] Pas de fuite mémoire (onglets fantômes)

SITE WEB
────────

[ ] Détection extension installée
[ ] Détection extension non installée
[ ] Recherche déclenche l'extension
[ ] Affichage progressif fonctionne
[ ] Résultats triés par score
[ ] Liens vers annonces fonctionnent
[ ] Mobile responsive

GEMINI
──────

[ ] Extraction critères correcte
[ ] Scoring cohérent
[ ] Red flags détectés
[ ] Gestion erreur API

EDGE CASES
──────────

[ ] Recherche sans résultat
[ ] Site qui timeout
[ ] Clé API invalide
[ ] Rate limit atteint
```

---

## 📚 RESSOURCES

### Documentation officielle

- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [externally_connectable](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)

### Exemples de code

- [Chrome Extension TypeScript Starter](https://github.com/AlinaLoz/chrome-extension-typescript-starter)
- [Vite + React + Chrome Extension](https://github.com/nichmor/vite-react-crx-mv3)

---

## ⚠️ AVERTISSEMENTS

### Ce qu'on NE fait PAS

```
❌ Scraping côté serveur (risque de ban)
❌ Stockage des annonces (données des sites)
❌ Revente des données utilisateurs
❌ Contournement de login/paywall
❌ Requêtes automatiques massives
```

### Ce qu'on FAIT

```
✅ Extension côté client (comportement humain)
✅ L'utilisateur contrôle ses recherches
✅ Pas de stockage serveur des résultats
✅ Respect des CGU (lecture seule, pas de modification)
✅ Redirection vers les sites originaux pour l'achat
```

---

## 🚀 COMMANDES

```bash
# Extension - Développement
cd extension
npm install
npm run dev

# Extension - Build production
npm run build

# Site - Développement
cd site
npm install
npm run dev

# Site - Build production
npm run build

# Déploiement site (Vercel)
vercel --prod
```

---

*Document créé le 25 janvier 2026 - Facile-IA Lab Project*

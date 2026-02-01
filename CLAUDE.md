# CLAUDE.md - OKAZ (Recherche Futee)

> Configuration Claude Code pour le projet OKAZ - Comparateur intelligent de petites annonces

---

## ARCHITECTURE CRITIQUE - A LIRE EN PREMIER

### L'Extension Chrome est la PIECE MAITRESSE

```
⚠️ REGLE ABSOLUE: NE JAMAIS UTILISER PUPPETEER/PLAYWRIGHT COTE SERVEUR ⚠️

Pourquoi: Les sites (LeBonCoin, Vinted, Back Market) detectent et bloquent
le scraping serveur apres quelques requetes. L'IP est bannie temporairement.

SOLUTION: L'extension Chrome fait le scraping dans le navigateur de l'utilisateur.
- Vrai navigateur = pas de detection anti-bot
- Session utilisateur reelle = pas de CAPTCHA
- Pas de blocage IP
```

### Architecture Actuelle (v0.4.0)

```
┌─────────────────────────────────────────────────────────────┐
│                     SITE WEB (Next.js)                      │
│                     Interface utilisateur                    │
│                                                             │
│  1. Utilisateur tape: "iPhone 13 pas cher livrable"        │
│  2. POST /api/optimize → Gemini optimise la requete        │
│  3. Recoit: {keywords, priceMax, shippable, category}      │
│  4. Envoie criteres a l'extension                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ chrome.runtime.sendMessage()
                          │ (via externally_connectable)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTENSION CHROME v0.4.0                   │
│                   Le moteur de scraping                     │
│                                                             │
│  1. Recoit les criteres structures                          │
│  2. Construit URLs optimisees pour chaque site             │
│  3. Ouvre LeBonCoin + Vinted + Back Market en parallele    │
│  4. Parse les resultats, combine et renvoie au site        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   FILTRAGE PERTINENCE IA                    │
│                                                             │
│  1. POST /api/analyze → Gemini analyse CHAQUE resultat     │
│  2. Score confidence 0-100% (pertinence vs recherche)      │
│  3. Filtrage: confidence < 30% = resultat masque           │
│  4. Ponderation: scoreFinal = score × (confidence / 100)   │
└─────────────────────────────────────────────────────────────┘
```

### CE QU'IL NE FAUT JAMAIS FAIRE

❌ Installer Puppeteer/Playwright dans le site
❌ Creer une API `/api/search` qui scrape directement
❌ Utiliser un serveur headless Chrome
❌ Contourner l'extension avec du scraping serveur

### CE QU'IL FAUT FAIRE

✅ Le site communique UNIQUEMENT avec l'extension pour le scraping
✅ L'extension fait TOUT le scraping
✅ Utiliser `externally_connectable` pour la communication
✅ Gemini optimise les requetes AVANT envoi a l'extension
✅ Gerer le cas ou l'extension n'est pas installee (onboarding)

---

## Integration Gemini (NOUVEAU)

### Role de Gemini

Gemini 2.0 Flash optimise les requetes utilisateur en langage naturel:

```
AVANT: "iPhone 13 pas cher livrable"
        ↓ Gemini
APRES: { keywords: "iPhone 13", priceMax: 450, shippable: true }
        ↓ Extension
URL:   ?text=iPhone+13&price_max=450&shippable=1
```

### Fichiers Gemini

| Fichier | Role |
|---------|------|
| `site/src/lib/gemini.ts` | Service Gemini + prix du marche |
| `site/src/app/api/optimize/route.ts` | API POST /api/optimize |

### Configuration

```bash
# site/.env.local
GEMINI_API_KEY=votre_cle_api
```

Obtenir une cle: https://aistudio.google.com/app/apikey

### Prix du Marche Integres

Le service Gemini contient 30+ references de prix pour:
- iPhone (11-15 Pro Max)
- MacBook (Air/Pro M1-M3)
- Consoles (PS5, Xbox, Switch)
- AirPods, iPad, Dyson, Samsung...

Ces prix permettent a Gemini d'interpreter "pas cher" correctement.

---

## Filtrage Pertinence IA (v0.4.0)

### Principe: 100% IA, Zero Regle en Dur

```
⚠️ REGLE ABSOLUE: PAS DE FILTRAGE HARDCODE ⚠️

Le filtrage des resultats non pertinents est ENTIEREMENT gere par Gemini.
Aucune liste de mots-cles, aucune regex, aucune regle en dur.
L'IA comprend le contexte et decide.

⚠️ REGLE ABSOLUE: ANALYSER TOUS LES RESULTATS ⚠️

Gemini DOIT analyser 100% des resultats, sans limite.
Pas de "limite pour reduire les couts" - l'IA est la valeur ajoutee.
On track les couts et on optimise APRES, pas en degradant la qualite.
```

### Score de Confidence (0-100%)

Gemini evalue chaque resultat:

| Score | Signification | Action |
|-------|---------------|--------|
| 90-100 | Match parfait | Affiche, score eleve |
| 70-89 | Match probable | Affiche |
| 50-69 | Match partiel | Affiche, score reduit |
| 30-49 | Match incertain | Affiche, score bas |
| 0-29 | Hors-sujet | **FILTRE (masque)** |

### Ponderation du Score

```typescript
// Le score final integre la pertinence
const MIN_CONFIDENCE = 30;
const isRelevant = confidence >= MIN_CONFIDENCE;
const weightedScore = Math.round(originalScore * (confidence / 100));
```

Exemple:
- Resultat avec score 80% et confidence 90% → score final 72%
- Resultat avec score 80% et confidence 40% → score final 32%
- Resultat avec confidence 25% → **filtre, non affiche**

### Exemples de Filtrage

```
Recherche: "PS5"
✅ "PlayStation 5 avec 2 manettes" → confidence 85%, GARDE
✅ "PS5 Digital + God of War" → confidence 90%, GARDE
❌ "Volant Thrustmaster PS5" → confidence 15%, FILTRE
❌ "Casque Sony Pulse 3D" → confidence 20%, FILTRE

Recherche: "iPhone 13"
✅ "iPhone 13 128Go noir" → confidence 95%, GARDE
❌ "Coque iPhone 13 silicone" → confidence 10%, FILTRE
❌ "Protection ecran iPhone 13" → confidence 15%, FILTRE
```

### Fichiers Cles

| Fichier | Role |
|---------|------|
| `site/src/app/api/analyze/route.ts` | API POST /api/analyze |
| `site/src/lib/gemini.ts` | Prompt Gemini + parsing reponse |
| `site/src/app/page.tsx` | Application filtrage + ponderation |

---

## Recherche Geolocalisee (v0.4.0)

### Double Recherche LeBonCoin

Quand la geolocation est activee, l'extension fait 2 recherches LeBonCoin en parallele:

```
┌─────────────────────────────────────────────────────────────┐
│  RECHERCHE LOCALE (30km)     │  RECHERCHE NATIONALE        │
│  → Resultats proches         │  → Tous les resultats       │
│  → Badge "Local"             │  → Livraison possible       │
└─────────────────────────────────────────────────────────────┘
```

Parametres URL LeBonCoin:
- `lat` / `lng` : Coordonnees GPS
- `radius` : Rayon en metres (30000 = 30km)

---

## Tests Automatises (v0.4.0)

### Framework de Test Pertinence

```bash
npm run test:relevance
```

Analyse les fixtures de test pour valider la qualite du filtrage:

```
┌─────────────────┬───────┬───────────┬─────────────┬──────────────┐
│ Recherche       │ Total │ Pertinent │ Accessoires │ Hors-categ.  │
├─────────────────┼───────┼───────────┼─────────────┼──────────────┤
│ PS5             │    12 │         5 │           7 │            0 │
│ iPhone 13       │    11 │         7 │           4 │            0 │
│ Nike Dunk       │    10 │         7 │           0 │            3 │
└─────────────────┴───────┴───────────┴─────────────┴──────────────┘
```

### Fichiers de Test

| Fichier | Role |
|---------|------|
| `site/scripts/test-relevance.ts` | Script de test |
| `site/scripts/fixtures/ps5.json` | Fixture PS5 |
| `site/scripts/fixtures/iphone13.json` | Fixture iPhone |
| `site/scripts/fixtures/nikedunk.json` | Fixture Nike Dunk |
| `site/scripts/fixtures/macbook.json` | Fixture MacBook |
| `site/scripts/fixtures/switch.json` | Fixture Switch |

---

## Projet

**OKAZ** est un comparateur de petites annonces (LeBonCoin, Vinted, Back Market) avec:
- Site web Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + TypeScript
- Extension Chrome Manifest V3 (le moteur de scraping)
- Integration IA Gemini 2.0 Flash pour optimisation des requetes

**Parent**: Facile-IA (Lab Project)

---

## Fichiers Cles du Projet

### Site Web (Next.js)

| Fichier | Role |
|---------|------|
| `site/src/app/page.tsx` | Interface principale + filtrage pertinence |
| `site/src/app/api/optimize/route.ts` | API Gemini pour optimiser requetes |
| `site/src/app/api/analyze/route.ts` | API Gemini pour analyser pertinence |
| `site/src/lib/gemini.ts` | Service Gemini + prompts + parsing |
| `site/src/lib/scoring.ts` | Analyse et categorisation des resultats |
| `site/scripts/test-relevance.ts` | Tests automatises pertinence |
| `site/scripts/fixtures/*.json` | Donnees de test (PS5, iPhone, etc.) |

### Extension Chrome

| Fichier | Role |
|---------|------|
| `extension/manifest.json` | Config v0.3.6 + externally_connectable |
| `extension/src/background/service-worker.js` | Orchestrateur + recherches paralleles 3 sites |
| `extension/src/content/leboncoin.js` | Parser DOM LeBonCoin |
| `extension/src/content/vinted.js` | Parser DOM Vinted |
| `extension/src/content/backmarket.js` | Parser DOM Back Market |

---

## Skills Facile-IA (Locaux)

Les skills Facile-IA sont installes dans `~/.claude/skills/`. Voici ceux pertinents pour ce projet:

### Skills Techniques (Prioritaires)

| Skill | Chemin | Usage pour Recherche Futee |
|-------|--------|---------------------------|
| `frontend-design` | `~/.claude/skills/technique/frontend-design/` | **ESSENTIEL** - Next.js 16 + React 19 + Tailwind 4, glassmorphism, anti-AI slop |
| `integrations` | `~/.claude/skills/technique/integrations/` | **ESSENTIEL** - APIs externes (Gemini), monitoring couts, rate limiting |
| `devops` | `~/.claude/skills/technique/devops/` | Deploiement Vercel, CI/CD GitHub Actions |
| `backend-data` | `~/.claude/skills/technique/backend-data/` | Supabase si besoin de persistence |

### Skills Strategiques

| Skill | Chemin | Usage |
|-------|--------|-------|
| `strategic-advisor` | `~/.claude/skills/core/strategic-advisor/` | Priorisation taches, decisions Go/No-Go |
| `chef-produit` | `~/.claude/skills/produits/chef-produit/` | Specs produit, roadmap, UX coherente |
| `skills-manager` | `~/.claude/skills/core/skills-manager/` | Gestion des agents |

### Design System Facile-IA (a appliquer)

```css
/* Couleurs */
--primary: #6366f1;        /* Indigo */
--accent: #8b5cf6;         /* Violet */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);

/* Polices INTERDITES: Inter, Roboto, Arial, Space Grotesk */
/* Polices APPROUVEES: Geist, DM Sans, Plus Jakarta Sans, Satoshi */
```

---

## Stack Technique du Projet

```
Site Web:
- Next.js 16+ (App Router)
- React 19
- Tailwind CSS 4
- TypeScript 5+
- Vercel (hosting)

Extension Chrome:
- Manifest V3
- JavaScript (vanilla)
- externally_connectable

IA:
- Gemini 2.0 Flash API
- @google/generative-ai SDK
```

---

## Commandes Projet

```bash
# Site - Dev
cd site && npm run dev

# Extension - Recharger dans chrome://extensions apres modifications

# Site - Build & Deploy
cd site && npm run build && vercel --prod
```

---

## Checklist Projet

### Phase 1: MVP Extension ✅
- [x] Manifest V3 + permissions
- [x] Parser LeBonCoin
- [x] Service Worker orchestrateur
- [x] Communication externally_connectable

### Phase 1.5: Integration Gemini ✅
- [x] Service Gemini (lib/gemini.ts)
- [x] API /api/optimize
- [x] Prix du marche integres
- [x] Extension accepte criteres structures
- [x] URL LeBonCoin optimisee avec filtres

### Phase 2: Site Web ✅
- [x] Setup Next.js 15 + Tailwind 4
- [x] Page recherche glassmorphism
- [x] Bridge extension (chrome.runtime.sendMessage)
- [x] Affichage resultats (ResultCard, ScoreBadge)
- [x] Loading progressif avec etapes IA
- [x] Detection extension + onboarding

### Phase 3: Multi-sites ✅
- [x] Parser Vinted
- [x] Parser Back Market
- [x] Recherches paralleles (Promise.all)
- [x] Filtrage pertinence par Gemini (relevant: true/false)

### Phase 3.5: Filtrage IA Avance ✅
- [x] API /api/analyze pour analyse Gemini
- [x] Score confidence 0-100% par resultat
- [x] Ponderation score: scoreFinal = score × (confidence/100)
- [x] Seuil minimum: confidence < 30% = filtre
- [x] Double recherche LeBonCoin (locale 30km + nationale)
- [x] Tests automatises pertinence (npm run test:relevance)
- [x] Fixtures de test (PS5, iPhone, Nike Dunk, MacBook, Switch)

### Phase 4: Polish & Deploy (A FAIRE)
- [ ] UI responsive mobile
- [ ] Cache recherches
- [ ] Deploiement Vercel
- [ ] Chrome Web Store

### Phase 5: Sites par Categorie (ROADMAP)

Gemini detecte la categorie de recherche et selectionne les sites pertinents:

```
┌─────────────────────────────────────────────────────────────┐
│  🖥️ TECH     → LBC, BackMarket, Amazon, Fnac, Rakuten, eBay │
│  👗 MODE     → Vinted, LBC, Vestiaire, Videdressing         │
│  🚗 AUTO     → LBC, La Centrale, Autoscout24, ParuVendu     │
│  🏠 IMMO     → LBC, SeLoger, PAP, Bien'ici                  │
│  🎮 GAMING   → LBC, BackMarket, Rakuten, eBay               │
│  📚 CULTURE  → LBC, Rakuten, Momox, Gibert                  │
└─────────────────────────────────────────────────────────────┘
```

#### Sites a implementer par priorite

**REGLE: Prioriser les sites avec affiliation (revenus) mais le SCORING reste neutre et honnete.**

| Categorie | Site | Affiliation | Commission | Priorite | Statut |
|-----------|------|-------------|------------|----------|--------|
| TECH | LeBonCoin | Non | - | ⭐⭐⭐ | ✅ Done |
| TECH | Back Market | **OUI** | 2-5% | ⭐⭐⭐ | ✅ Done |
| MODE | Vinted | Non | - | ⭐⭐⭐ | ✅ Done |
| TECH | Amazon | **OUI** | 1-10% | ⭐⭐⭐ | A faire |
| TECH | Rakuten | **OUI** | 2-7% | ⭐⭐⭐ | A faire |
| ALL | eBay | **OUI** | 1-4% | ⭐⭐⭐ | A faire |
| TECH | Fnac/Darty | A verifier | ? | ⭐⭐ | A faire |
| MODE | Vestiaire Collective | A verifier | ? | ⭐⭐ | A faire |
| MODE | Videdressing | A verifier | ? | ⭐⭐ | A faire |
| AUTO | La Centrale | A verifier | ? | ⭐⭐ | A faire |
| AUTO | Autoscout24 | A verifier | ? | ⭐ | A faire |
| AUTO | ParuVendu | A verifier | ? | ⭐ | A faire |
| IMMO | SeLoger | A verifier | ? | ⭐⭐ | A faire |
| IMMO | PAP | A verifier | ? | ⭐ | A faire |
| IMMO | Bien'ici | A verifier | ? | ⭐ | A faire |

#### Implementation prevue

1. **Gemini detecte la categorie** dans `/api/optimize`:
   ```json
   { "category": "tech", "keywords": "iPhone 13", ... }
   ```

2. **Extension filtre les sites** selon la categorie:
   ```javascript
   const SITES_BY_CATEGORY = {
     tech: ['leboncoin', 'backmarket', 'amazon', 'fnac', 'rakuten'],
     mode: ['vinted', 'leboncoin', 'vestiaire', 'videdressing'],
     auto: ['leboncoin', 'lacentrale', 'autoscout24'],
     immo: ['leboncoin', 'seloger', 'pap', 'bienici']
   };
   ```

3. **Recherches paralleles** uniquement sur les sites de la categorie

### Phase 6: App Mobile (A TESTER)

**Concept** : App React Native avec WebViews cachées (0x0) pour scraper comme l'extension Chrome.

```
┌─────────────────────────────────────────────────────────────┐
│                    APP MOBILE (React Native)                │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ WebView 0x0 │ │ WebView 0x0 │ │ WebView 0x0 │           │
│  │  LeBonCoin  │ │   Vinted    │ │ Back Market │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │                   │
│         └───────────────┼───────────────┘                   │
│                         ▼                                   │
│              Injection JS → Parse DOM                       │
│                         ▼                                   │
│                   Résultats combinés                        │
└─────────────────────────────────────────────────────────────┘
```

**Pourquoi ça devrait marcher** :
- C'est le navigateur de l'utilisateur (son IP, ses cookies)
- Comme ouvrir 3 onglets Safari en arrière-plan
- Même principe que l'extension Chrome

**Risques identifiés par l'équipe** :
- Detection WebView possible (user-agent "wv")
- App Store pourrait rejeter (à tester)
- WebView isolée = pas de cookies Safari partagés

**Plan** :
1. ✅ Finir desktop d'abord (Phase 4)
2. Prototype React Native rapide
3. Tester si ça passe les stores
4. Si rejet → fallback PWA ou Extension Safari iOS

---

## Ressources

### Documentation Technique
- [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3/)
- [externally_connectable](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Next.js Docs](https://nextjs.org/docs)

### Design Inspiration (NO AI Slop)
- [Vercel Design](https://vercel.com/design)
- [Linear Design](https://linear.app)
- [Stripe Design](https://stripe.com)

---

---

## Roadmap IA - Idées à implémenter

### PRÉ-TRAITEMENT (Avant la recherche)

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| **Compréhension intention** | "iPhone pour ma fille ado" → budget 150-300€, modèles adaptés | ⭐⭐⭐ |
| **Questions intelligentes** | Dialogue naturel : "Livraison ou main propre ?" | ⭐⭐⭐ |
| **Recherche par photo** | "Trouve-moi ça moins cher" (upload image) | ⭐⭐ |
| **Mémoire utilisateur** | "La dernière fois tu cherchais un vélo..." | ⭐⭐ |
| **Alerte Sniper** | Notification quand une annonce matche les critères | ⭐⭐⭐ |

### POST-TRAITEMENT (Après les résultats)

| Fonctionnalité | Description | Priorité |
|----------------|-------------|----------|
| **Deal Score expressif** | "Prix 23% sous le marché - fonce !" | ⭐⭐⭐ |
| **Détection arnaques** | Photos stock, compte récent, prix trop bas | ⭐⭐⭐ |
| **Historique des prix** | Graphique : "Ce modèle était à 180€ il y a 2 mois" | ⭐⭐⭐ |
| **Score vendeur contextuel** | "10 ventes de livres" vs "10 ventes d'iPhone" | ⭐⭐ |
| **Nego-Coach** | "Ce vendeur a baissé 2x cette semaine, propose -15%" | ⭐⭐ |
| **Comparaison neuf/reconditionné** | "Pour 30€ de plus → garantie Back Market" | ⭐⭐ |
| **LA recommandation** | "Celle-ci est faite pour toi, voilà pourquoi" | ⭐⭐⭐ |

### Fonctionnalités "WOW"

| Idée | Impact | Complexité |
|------|--------|------------|
| **"Coup de cœur IA"** | Badge doré sur LA bonne affaire | Faible |
| **Transparence "Pourquoi ce score ?"** | Cliquable, expliqué simplement | Faible |
| **Alerte temps réel** | "Nouvelle annonce il y a 3 min !" | Moyenne |
| **Recherche par photo** | Upload → trouve similaire moins cher | Élevée |
| **Nego-Coach** | Analyse comportement vendeur | Élevée |

### Modele economique - STRATEGIE VALIDEE

```
⚠️ REGLE ABSOLUE: LE SCORING RESTE HONNETE ET NON BIAISE ⚠️
On priorise l'INTEGRATION des sites affilies, pas leur classement.
Le meilleur deal = le meilleur deal, affilie ou pas.
```

**1. AFFILIATION (revenu principal)**
```
┌─────────────────────────────────────────────────────────────┐
│  Quand l'utilisateur clique sur un lien vers un site       │
│  affilie (Back Market, Amazon, Rakuten, eBay), on touche   │
│  une commission sur l'achat (1-10% selon le site).         │
│                                                             │
│  → Pas de biais dans le classement                         │
│  → Revenu genere naturellement par les clics               │
└─────────────────────────────────────────────────────────────┘
```

| Site | Commission | Programme |
|------|------------|-----------|
| Back Market | 2-5% | Actif |
| Amazon | 1-10% | Actif |
| Rakuten | 2-7% | Actif |
| eBay | 1-4% | Actif |
| LeBonCoin | - | Pas d'affiliation |
| Vinted | - | Pas d'affiliation |

**2. PUBLICITE (revenus complementaires)**
```
┌─────────────────────────────────────────────────────────────┐
│  ZONE SECONDAIRE: Media.net (CPC)                          │
│  → Pub contextuelle basee sur mots-cles Gemini             │
│  → 0.30-0.80€ par clic                                     │
├─────────────────────────────────────────────────────────────┤
│  SIDEBAR/FOOTER: AdSense (CPM backup)                      │
│  → Revenus complementaires                                 │
└─────────────────────────────────────────────────────────────┘
```

**3. FREEMIUM (futur)**
- Gratuit: 10 recherches/jour, resultats basiques
- Premium (4.99€/mois): Illimite, scoring avance, alertes, historique prix, Nego-Coach

**Partenariats potentiels:**
- Assurance colis (Cocolis, Mondial Relay) → commission 5-10%
- Paiement securise (Obvy, Paycar) → commission 2-3%

### Insights clés de l'équipe

- **UX**: "Accompagner comme un ami expert, pas juger comme un algo"
- **Business**: "Prouver l'engagement avant de monétiser"
- **Terrain**: "Dis-moi juste laquelle acheter"

---

*Mis a jour le 1 fevrier 2026 - v0.4.0 avec filtrage pertinence IA + tests automatises*

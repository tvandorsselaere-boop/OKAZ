# CLAUDE.md - OKAZ (okaz-ia.fr)

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

### Architecture Actuelle (v0.8.0)

```
┌─────────────────────────────────────────────────────────────┐
│                     SITE WEB (Next.js 16)                   │
│                                                             │
│  1. Utilisateur tape ou uploade une photo                   │
│  2. POST /api/optimize → Gemini optimise + detecte categorie│
│  3. Si ambigu → questions de clarification (chips)          │
│  4. Recoit: {keywords, priceMax, shippable, category, ...}  │
│  5. Verifie quota (Supabase) avant envoi                    │
│  6. Envoie criteres a l'extension                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ chrome.runtime.sendMessage()
                          │ (via externally_connectable)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTENSION CHROME v0.5.0                   │
│                   Le moteur de scraping                     │
│                                                             │
│  1. Recoit les criteres structures                          │
│  2. Construit URLs optimisees pour chaque site             │
│  3. Ouvre LBC + Vinted + BackMarket + Amazon en parallele  │
│     (Amazon: neuf + seconde main warehouse-deals)           │
│  4. Parse les resultats, combine et renvoie au site        │
│  5. amazonNewResults separes pour prix neuf de reference    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   ANALYSE IA (Gemini 2.5 Flash)            │
│                                                             │
│  1. POST /api/analyze → Gemini analyse CHAQUE resultat     │
│  2. Score confidence 0-100% + dealScore + topPick          │
│  3. Filtrage: confidence < 30% = resultat masque           │
│  4. Ponderation: scoreFinal = score × (confidence / 100)   │
│  5. TopPick: LA recommandation mise en avant (carte doree) │
│  6. Prix neuf = Amazon scrape (fallback: /api/recommend-new)│
└─────────────────────────────────────────────────────────────┘
```

### CE QU'IL NE FAUT JAMAIS FAIRE

❌ Installer Puppeteer/Playwright dans le site
❌ Creer une API `/api/search` qui scrape directement
❌ Utiliser un serveur headless Chrome
❌ Contourner l'extension avec du scraping serveur
❌ Biaiser le scoring en faveur des sites affilies

### CE QU'IL FAUT FAIRE

✅ Le site communique UNIQUEMENT avec l'extension pour le scraping
✅ L'extension fait TOUT le scraping
✅ Utiliser `externally_connectable` pour la communication
✅ Gemini optimise les requetes AVANT envoi a l'extension
✅ Gerer le cas ou l'extension n'est pas installee (onboarding)
✅ Verifier le quota utilisateur avant chaque recherche

---

## Integration Gemini

### Modele: gemini-2.5-flash

Gemini gere 4 fonctions principales :

| Fonction | API Route | Description |
|----------|-----------|-------------|
| Optimisation requete | POST /api/optimize | Langage naturel → criteres structures + categorie + questions |
| Analyse resultats | POST /api/analyze | Confidence 0-100%, dealScore, topPick par resultat |
| Recommandation neuf | POST /api/recommend-new | Prix neuf officiel + bandeau "Et en neuf ?" (Amazon affilie) |
| Vision (image) | Via /api/optimize | Extraction contexte visuel (couleur, taille, modele) |

### Flux Gemini complet

```
ENTREE: "iPhone 13 pas cher livrable" + [photo optionnelle]
        ↓ Gemini (optimisation)
        Si ambigu → { needsClarification: true, questions: [...] }
        ↓ Utilisateur repond
SORTIE: { keywords: "iPhone 13", priceMax: 450, shippable: true, category: "tech" }
        ↓ Extension scrape
        ↓ Gemini (analyse)
SORTIE: { results: [...], topPick: { index, headline, reason }, filteredCount: N }
        ↓ Prix marché = médiane des prix scrapés (pas Gemini)
        ↓ Gemini (recommandation neuf, async)
SORTIE: { productName, estimatedPrice, reason, searchUrl (Amazon affilie) }
        → Badge "Neuf" + bandeau "Et en neuf ?" + lien affilié
```

### Configuration

```bash
# site/.env.local
GEMINI_API_KEY=votre_cle_api
```

### Estimation des Prix (v0.8.0)

```
⚠️ REGLE ABSOLUE: PRIX ANCRES SUR LES DONNEES REELLES ⚠️

- Prix occasion = médiane des prix scrapés (calculé client-side, pas Gemini)
- Prix neuf = retourné par /api/recommend-new (Gemini avec contexte résultats réels)
- Gemini NE DOIT PAS estimer les prix occasion ni neuf dans /api/optimize
- Temperature 0.2 sur tous les appels Gemini (reduce hallucinations)
- Zero données en dur, zero table de prix statique
```

Flux des prix :
1. Extension scrape → prix bruts des annonces
2. Client calcule la médiane/min/max des prix scrapés (priceStats)
3. priceStats passé à /api/analyze → Gemini utilise la médiane comme marketPrice
4. /api/recommend-new → prix neuf officiel (toujours retourné sauf vintage/auto/immo)
5. Badges persistants sur la page résultats : "Neuf" (vert) + "Occasion médiane" (bleu)

---

## Recherche Visuelle (v0.5.0)

Upload d'image via le bouton camera dans la barre de recherche :
- Conversion base64, max 4MB
- Gemini Vision extrait : couleur, taille, variante, etat, modele
- Contexte visuel passe a l'analyse pour meilleur scoring
- Fichier cle : `site/src/app/page.tsx` (imageInputRef, handleImageUpload)

---

## Questions de Clarification (v0.5.0)

Quand la requete est ambigue, Gemini pose des questions :

```
Utilisateur: "dunk"
Gemini: needsClarification: true
        question: "Quel type de Dunk cherchez-vous ?"
        options: ["Nike Dunk Low", "Nike Dunk High", "Autre"]
→ Modal avec chips cliquables
→ L'utilisateur choisit, la recherche continue
```

Fichiers cles : `site/src/lib/gemini.ts` (optimizeQuery), `site/src/app/page.tsx` (ClarificationModal)

---

## TopPick - "LA Recommandation" (v0.5.0)

Gemini identifie LE meilleur resultat parmi tous les sites :
- Carte doree spotlight en haut des resultats
- Affiche : headline, raison, score de confiance, highlights
- Composant : TopRecommendation dans `page.tsx`
- Donnees : champ `topPick` dans la reponse de `/api/analyze`

---

## Filtrage Pertinence IA

### Principe: 100% IA, Zero Donnee en Dur

```
⚠️ REGLE ABSOLUE: PAS DE FILTRAGE HARDCODE ⚠️
Le filtrage est ENTIEREMENT gere par Gemini. Aucune regex, aucune regle en dur.

⚠️ REGLE ABSOLUE: ANALYSER TOUS LES RESULTATS ⚠️
Gemini DOIT analyser 100% des resultats, sans limite.

⚠️ REGLE ABSOLUE: JAMAIS DE DONNEES EN DUR ⚠️
Pas de table de prix, pas de liste de produits, pas de references statiques.
Gemini estime tout dynamiquement. Les resultats reels des sites corrigent
ses estimations si elles sont obsoletes. Zero hardcode.
```

### Score de Confidence (0-100%)

| Score | Signification | Action |
|-------|---------------|--------|
| 90-100 | Match parfait | Affiche, score eleve |
| 70-89 | Match probable | Affiche |
| 50-69 | Match partiel | Affiche, score reduit |
| 30-49 | Match incertain | Affiche, score bas |
| 0-29 | Hors-sujet | **FILTRE (masque)** |

### Ponderation du Score

```typescript
const MIN_CONFIDENCE = 30;
const isRelevant = confidence >= MIN_CONFIDENCE;
const weightedScore = Math.round(originalScore * (confidence / 100));
```

---

## Systeme Freemium (v0.5.0)

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Extension   │────▶│  Supabase    │◀────│  Site Web    │
│  (quota.js)  │     │  (users,     │     │  (API routes)│
│              │     │   searches)  │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     │   Stripe    │
                     │  (paiement) │
                     └─────────────┘
```

### Quotas

- **Gratuit** : 5 recherches/jour (reset quotidien)
- **Boost** : +20 recherches (achat unique via Stripe)
- **Premium** : Illimite (abonnement mensuel via Stripe)

### Auth : Magic Link

1. Utilisateur entre son email
2. POST /api/auth/magic-link → envoie email via Resend
3. Clic sur le lien → POST /api/auth/verify → token JWT
4. Extension stocke UUID + auth via chrome.storage

### API Routes Freemium

| Route | Role |
|-------|------|
| POST /api/quota/consume | Decremente le quota apres recherche |
| GET /api/quota/status | Retourne l'etat du quota |
| POST /api/auth/magic-link | Envoie le magic link |
| POST /api/auth/verify | Verifie le token |
| POST /api/checkout/boost | Cree session Stripe (boost) |
| POST /api/checkout/premium | Cree session Stripe (premium) |
| POST /api/checkout/portal | Stripe Billing Portal (gestion abo) |
| POST /api/webhooks/stripe | Webhook Stripe (checkout, sub update/delete, payment_failed) |

### Emails (Resend)
- Domaine: `okaz-ia.fr` (verifie dans Resend via DNS OVH)
- From: `OKAZ <noreply@okaz-ia.fr>`
- Magic link + Email bienvenue Premium

---

## Recherche Geolocalisee

Double recherche LeBonCoin quand geolocation activee :

```
RECHERCHE LOCALE (30km)     │  RECHERCHE NATIONALE
→ Resultats proches          │  → Tous les resultats
→ Badge "Pres de vous"       │  → Livraison possible
```

### Format URL LeBonCoin geoloc
```
locations=Ville_CodePostal__lat_lng_5000_rayon
Exemple: locations=Puyloubier_13114__43.52492_5.67334_5000_30000
```

### Geocoding (geo.ts)
Ordre de resolution d'une localisation :
1. Nom de ville exact dans FRENCH_CITIES (~100 villes)
2. Code postal exact dans CITY_POSTAL_CODES
3. Departement (2 premiers chiffres) → ville principale du departement

Fichiers cles :
- `site/src/lib/geo.ts` (geocoding, calcul distance, reverse geocode)
- `extension/src/content/leboncoin.js` (extraction localisation via regex noms composes)
- `extension/src/background/service-worker.js` (construction URL `locations=`)

---

## Monetisation

### Canal 1 : AFFILIATION (revenu principal)

```
⚠️ REGLE ABSOLUE: LE SCORING RESTE HONNETE ET NON BIAISE ⚠️
On priorise l'INTEGRATION des sites affilies, pas leur classement.
Le meilleur deal = le meilleur deal, affilie ou pas.
```

**Couche 1 — Wrapping automatique des liens :**
- Back Market → Awin : `cread.php?awinmid={MID}&awinaffid={AFFID}&ued={URL}`
- Rakuten/Fnac → Awin (meme format)
- Amazon → `?tag={AMAZON_TAG}`
- LeBonCoin / Vinted → liens inchanges (pas d'affiliation)

**Couche 2 — Bandeau "Et en neuf ?" :**
- Gemini recommande un produit neuf si pertinent
- Lien Amazon affilie
- Ton "ami expert", pas commercial

**Couche 3 — Recommandations contextuelles (futur)**

Variables d'environnement :
```bash
NEXT_PUBLIC_AWIN_AFFID=              # Awin Publisher ID
NEXT_PUBLIC_AWIN_MID_BACKMARKET=     # Awin Merchant ID (30853)
NEXT_PUBLIC_AWIN_MID_RAKUTEN=        # Awin Merchant ID (55615)
NEXT_PUBLIC_AWIN_MID_FNAC=           # Awin Merchant ID
NEXT_PUBLIC_AMAZON_TAG=              # Amazon Partenaires Tag (ex: okaz-21)
```

| Programme | Plateforme | Commission | Statut |
|-----------|-----------|------------|--------|
| Amazon Partenaires | Direct | 1-12% | A creer |
| Back Market | Awin | 2-5% | A postuler |
| Rakuten FR | Awin | jusqu'a 9% | A postuler |
| Fnac | Awin | A verifier | A postuler |

### Canal 2 : Google AdSense

- Sidebar droite (desktop) pendant loading + resultats
- Sans config → Placeholders elegants "Espace partenaire"
- Avec config → Pubs reelles chargees dynamiquement

```bash
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXX...
NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE=1234...
```

### Canal 3 : FREEMIUM

- Voir section "Systeme Freemium" ci-dessus

---

## Projet

**OKAZ** est un comparateur de petites annonces avec:
- Site web Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + TypeScript
- Extension Chrome Manifest V3 (moteur de scraping)
- IA Gemini 2.5 Flash (optimisation, analyse, vision, recommandations)
- Supabase (auth, quotas, users)
- Stripe (paiements boost/premium)
- Resend (emails magic link)

**Parent**: Facile-IA (Lab Project)

---

## Domaine & Hebergement

| Element | Detail |
|---------|--------|
| **Domaine** | okaz-ia.fr (OVH, 5,99€/an) |
| **DNS** | Pointe vers Vercel (A record: 76.76.21.21) |
| **Mail** | contact@okaz-ia.fr via Zimbra Starter OVH |
| **Hebergement** | Vercel Hobby → Vercel Pro des monetisation active |

---

## Fichiers Cles du Projet

### Site Web — API Routes

| Fichier | Role |
|---------|------|
| `site/src/app/api/optimize/route.ts` | Gemini optimisation requete + categorie + questions |
| `site/src/app/api/analyze/route.ts` | Gemini analyse pertinence + topPick |
| `site/src/app/api/recommend-new/route.ts` | Gemini recommandation produit neuf |
| `site/src/app/api/quota/consume/route.ts` | Consommation quota |
| `site/src/app/api/quota/status/route.ts` | Etat du quota |
| `site/src/app/api/quota/reset/route.ts` | Reset quota (admin) |
| `site/src/app/api/auth/magic-link/route.ts` | Envoi magic link email |
| `site/src/app/api/auth/verify/route.ts` | Verification magic link |
| `site/src/app/api/checkout/boost/route.ts` | Session Stripe boost |
| `site/src/app/api/checkout/premium/route.ts` | Session Stripe premium |
| `site/src/app/api/checkout/portal/route.ts` | Stripe Billing Portal (gestion abo) |
| `site/src/app/api/webhooks/stripe/route.ts` | Webhook Stripe (checkout, subscription.updated/deleted, payment_failed) |

### Site Web — Libraries

| Fichier | Role |
|---------|------|
| `site/src/lib/gemini.ts` | Service Gemini (optimisation, analyse, vision, recommandation) |
| `site/src/lib/scoring.ts` | Scoring multi-criteres + categorisation |
| `site/src/lib/affiliate.ts` | Wrapping liens affilies (Awin + Amazon) |
| `site/src/lib/geo.ts` | Geolocation, geocoding (ville + code postal + dept), calcul distance |
| `site/src/lib/highlights.ts` | Systeme de highlights (best_deal, near_you, guaranteed, just_posted) |
| `site/src/lib/stripe.ts` | Configuration Stripe |
| `site/src/lib/supabase.ts` | Client Supabase |
| `site/src/lib/email.ts` | Envoi emails via Resend |

### Site Web — Composants

| Fichier | Role |
|---------|------|
| `site/src/app/page.tsx` | Page principale (~2300 lignes) — UI, search flow, resultats, modals |
| `site/src/app/layout.tsx` | Layout + script AdSense |
| `site/src/components/NewProductBanner.tsx` | Bandeau "Et en neuf ?" |
| `site/src/components/ui/glass-card.tsx` | Carte glassmorphism |
| `site/src/components/ui/liquid-button.tsx` | Bouton anime |
| `site/src/components/ui/upgrade-modal.tsx` | Modal upgrade + compteur recherches |
| `site/src/components/ui/spotlight-card.tsx` | Carte avec effet spotlight |
| `site/src/components/ads/AdSlot.tsx` | Composant generique pub |
| `site/src/components/ads/AdSidebar.tsx` | Sidebar pubs |

### Extension Chrome

| Fichier | Role |
|---------|------|
| `extension/manifest.json` | Config v0.5.0 + externally_connectable |
| `extension/src/background/service-worker.js` | Orchestrateur (SEARCH, PING, GET_QUOTA, GET_UUID, SAVE_AUTH, CLEAR_AUTH) |
| `extension/src/content/leboncoin.js` | Parser DOM LeBonCoin |
| `extension/src/content/vinted.js` | Parser DOM Vinted |
| `extension/src/content/backmarket.js` | Parser DOM Back Market |
| `extension/src/content/amazon.js` | Parser DOM Amazon (neuf + seconde main) |
| `extension/src/lib/quota.js` | Gestion quota cote extension |
| `extension/src/popup/popup.js` | Popup extension |

### Tests

| Fichier | Role |
|---------|------|
| `site/scripts/test-relevance.ts` | Tests automatises pertinence |
| `site/scripts/fixtures/*.json` | Fixtures (PS5, iPhone, Nike Dunk, MacBook, Switch) |

---

## Stack Technique

```
Site Web:
- Next.js 16.1 (App Router)
- React 19.2
- Tailwind CSS 4
- TypeScript 5+
- Framer Motion 12
- Vercel (hosting)

Backend / Services:
- Supabase (auth, database, quotas)
- Stripe (paiements)
- Resend (emails)

Extension Chrome:
- Manifest V3
- JavaScript (vanilla)
- externally_connectable

IA:
- Gemini 2.5 Flash
- @google/generative-ai SDK v0.24
- Vision (analyse d'images)
```

---

## Design System Facile-IA

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

## Commandes Projet

```bash
# Site - Dev
cd site && npm run dev

# Site - Type check
cd site && npx tsc --noEmit

# Site - Build
cd site && npm run build

# Site - Deploy
cd site && vercel --prod

# Tests pertinence
cd site && npm run test:relevance

# Extension - Recharger dans chrome://extensions apres modifications
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
- [x] Setup Next.js + Tailwind 4
- [x] Page recherche glassmorphism
- [x] Bridge extension (chrome.runtime.sendMessage)
- [x] Affichage resultats (ResultCard, ScoreBadge)
- [x] Loading progressif avec etapes IA
- [x] Detection extension + onboarding

### Phase 3: Multi-sites ✅
- [x] Parser Vinted
- [x] Parser Back Market
- [x] Recherches paralleles (Promise.all)
- [x] Filtrage pertinence par Gemini

### Phase 3.5: Filtrage IA Avance ✅
- [x] API /api/analyze pour analyse Gemini
- [x] Score confidence 0-100% par resultat
- [x] Ponderation score + seuil minimum 30%
- [x] Double recherche LeBonCoin (locale + nationale)
- [x] Tests automatises pertinence + fixtures

### Phase 3.7: Monetisation Affiliation ✅
- [x] Wrapping automatique liens affilies (Awin + Amazon)
- [x] Bandeau "Et en neuf ?" alimente par Gemini
- [x] API /api/recommend-new
- [x] Mention legale affiliation
- [x] AdSense + placeholders
- [ ] S'inscrire Amazon Partenaires
- [ ] S'inscrire Awin editeur + postuler programmes
- [ ] S'inscrire AdSense

### Phase 3.8: Fonctionnalites IA Avancees ✅
- [x] Recherche visuelle (upload image + Gemini Vision)
- [x] Questions de clarification (dialog Gemini → chips)
- [x] TopPick "LA recommandation" (carte doree spotlight)
- [x] Highlights systeme (best_deal, near_you, guaranteed, just_posted)
- [x] Geolocation + calcul distance

### Phase 3.9: Systeme Freemium ✅
- [x] Supabase (users, searches, quotas)
- [x] Auth magic link (Resend, domaine okaz-ia.fr)
- [x] Quota check/consume/status APIs
- [x] Stripe checkout (boost + premium)
- [x] Webhook Stripe (checkout, subscription.updated, subscription.deleted, payment_failed)
- [x] Stripe Billing Portal (gestion/annulation abonnement)
- [x] Email bienvenue Premium (Resend)
- [x] Extension: quota sync + UUID storage
- [x] Modal upgrade + compteur recherches + bouton "Gérer" pour premium

### Phase 4: Demo & Debug (EN COURS)
- [x] Geolocalisation LBC: format URL `locations=Ville_CP__lat_lng_5000_rayon`
- [x] Geocoding par code postal (fallback quand nom de ville pas reconnu)
- [x] Extraction localisation LBC (noms composés: Aix-en-Provence, Saint-Maximin...)
- [x] Tri par distance dans "Plus de résultats"
- [x] Webhook Stripe: gestion annulation (cancel_at_period_end)
- [x] Email: domaine vérifié okaz-ia.fr (Resend)
- [x] Intégration Amazon (neuf + seconde main warehouse-deals)
- [x] Sélection intelligente produit neuf (filtrage pertinence titre)
- [x] Prix neuf réel Amazon (remplace estimation Gemini)
- [x] Couleur Amazon jaune foncé (#DAA520) distincte de LBC
- [ ] Finaliser extension pour Chrome Web Store
- [ ] UI responsive mobile
- [ ] Deploiement Vercel (okaz-ia.fr)

### Phase 5: Sites par Categorie + Musique (ROADMAP)

Gemini detecte la categorie de recherche et selectionne les sites pertinents :

```
┌─────────────────────────────────────────────────────────────┐
│  TECH     → LBC, BackMarket, Amazon, Fnac, Rakuten, eBay  │
│  MODE     → Vinted, LBC, Vestiaire, Videdressing          │
│  MUSIQUE  → LBC, Zikinf, Audiofanzine, Reverb (occasion)  │
│            → Thomann, Woodbrass, Gear4music, Amazon (neuf) │
│  GAMING   → LBC, BackMarket, Rakuten, eBay                │
│  AUTO     → LBC, La Centrale, Autoscout24, ParuVendu      │
│  IMMO     → LBC, SeLoger, PAP, Bien'ici                   │
└─────────────────────────────────────────────────────────────┘
```

#### Sites a implementer par priorite

**REGLE: Prioriser les sites avec affiliation mais le SCORING reste neutre.**

| Categorie | Site | Affiliation | Priorite | Statut |
|-----------|------|-------------|----------|--------|
| TECH | LeBonCoin | Non | ⭐⭐⭐ | ✅ Done |
| TECH | Back Market | Awin 2-5% | ⭐⭐⭐ | ✅ Done |
| MODE | Vinted | Non | ⭐⭐⭐ | ✅ Done |
| TECH | Amazon | Direct 1-12% | ⭐⭐⭐ | ✅ Done |
| TECH | Rakuten | Awin 2-9% | ⭐⭐⭐ | A faire |
| ALL | eBay | Awin 1-4% | ⭐⭐⭐ | A faire |
| TECH | Fnac | Awin | ⭐⭐ | A faire |
| MUSIQUE | Zikinf | Non | ⭐⭐⭐ | A faire |
| MUSIQUE | Audiofanzine | Non | ⭐⭐ | A faire |
| MUSIQUE | Reverb | PartnerStack | ⭐⭐ | A faire |
| MUSIQUE | Thomann | Clickfire | ⭐⭐ | A faire (neuf) |
| MUSIQUE | Woodbrass | Affilae | ⭐ | A faire (neuf) |
| MUSIQUE | Gear4music | Awin | ⭐ | A faire (neuf) |

#### Implementation prevue

1. **Gemini detecte la categorie** dans `/api/optimize`
2. **Extension filtre les sites** selon la categorie via `SITES_BY_CATEGORY`
3. **Recherches paralleles** uniquement sur les sites de la categorie
4. **Nouveaux parsers** : un content script par site (DOM parsing)
5. **Affiliate wrapper** etendu pour les nouveaux sites

### Phase 6: App Mobile (A TESTER)

Concept : App React Native avec WebViews cachees (0x0) pour scraper.
Plan : Finir desktop → Prototype RN → Tester stores → Fallback PWA si rejet.

---

## Roadmap IA

### PRE-TRAITEMENT (Avant la recherche)

| Fonctionnalite | Statut |
|----------------|--------|
| Comprehension intention ("iPhone pour ma fille ado") | ✅ Via Gemini |
| Questions intelligentes (clarification) | ✅ Implemente |
| Recherche par photo (upload image) | ✅ Implemente |
| Memoire utilisateur | A faire |
| Alerte Sniper (notification) | A faire |

### POST-TRAITEMENT (Apres les resultats)

| Fonctionnalite | Statut |
|----------------|--------|
| Deal Score expressif ("23% sous le marche") | ✅ Via dealScore Gemini |
| "LA recommandation" (TopPick carte doree) | ✅ Implemente |
| Bandeau "Et en neuf ?" | ✅ Implemente |
| Detection arnaques | A faire |
| Historique des prix | A faire |
| Nego-Coach | A faire |

---

## Ressources

- [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3/)
- [externally_connectable](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://docs.stripe.com/)

### Design Inspiration (NO AI Slop)
- Vercel, Linear, Stripe

---

### Insights cles

- **UX**: "Accompagner comme un ami expert, pas juger comme un algo"
- **Business**: "Prouver l'engagement avant de monetiser"
- **Terrain**: "Dis-moi juste laquelle acheter"

---

*Mis a jour le 8 fevrier 2026 - v0.8.0*

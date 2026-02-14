// OKAZ Service Worker - Background Script v0.5.0
// Orchestre les recherches sur les différents sites (LeBonCoin, Vinted, Back Market, Amazon)

// Importer le module de gestion des quotas
importScripts('../lib/quota.js');

let pendingSearches = new Map();
let searchResults = new Map();
let pendingResolvers = new Map();
let pendingVintedResolvers = new Map();
let pendingBackMarketResolvers = new Map();
let pendingAmazonNewResolvers = new Map();
let pendingAmazonUsedResolvers = new Map();
let pendingEbayResolvers = new Map();
let amazonTabTypes = new Map(); // tabId -> 'new' | 'used'

// Tracking centralisé des onglets ouverts par OKAZ pour cleanup fiable
const okazTabs = new Set();

function trackTab(tabId) {
  okazTabs.add(tabId);
}

function untrackTab(tabId) {
  okazTabs.delete(tabId);
}

// Cleanup global : fermer tous les onglets OKAZ restants
function cleanupAllTabs() {
  for (const tabId of okazTabs) {
    try {
      chrome.tabs.remove(tabId);
    } catch (e) { /* tab already closed */ }
  }
  okazTabs.clear();
}

// Nettoyage périodique des onglets zombies (toutes les 2 minutes)
setInterval(() => {
  if (okazTabs.size === 0) return;
  // Vérifier si les onglets existent encore
  for (const tabId of okazTabs) {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        okazTabs.delete(tabId);
      }
    });
  }
}, 120_000);

// Initialiser l'UUID au démarrage
(async () => {
  const uuid = await self.OkazQuota.getOrCreateUUID();
  console.log('OKAZ SW: UUID initialisé:', uuid.substring(0, 8) + '...');
})();

// Écouter les messages externes (depuis le site web)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('OKAZ SW: Message EXTERNE reçu de', sender.origin, request.type);

  // Mettre à jour l'API_BASE avec l'origin du site (gère localhost:3000, 3001, etc.)
  if (sender.origin) {
    self.OkazQuota.setApiBaseFromOrigin(sender.origin);
  }

  switch (request.type) {
    case 'PING':
      // Le site verifie si l'extension est installee
      sendResponse({ success: true, version: '0.5.0' });
      break;

    case 'SEARCH':
      // Vérifier le quota avant de lancer la recherche
      handleSearchWithQuota(request.query, request.criteria, sendResponse);
      return true; // Réponse asynchrone

    case 'GET_QUOTA':
      // Récupérer l'état du quota
      handleGetQuota(sendResponse);
      return true;

    case 'GET_UUID':
      // Récupérer l'UUID de l'extension
      handleGetUUID(sendResponse);
      return true;

    case 'SAVE_AUTH':
      // Sauvegarder l'auth après connexion Magic Link
      handleSaveAuth(request.jwt, request.email, request.premiumUntil, sendResponse);
      return true;

    case 'CLEAR_AUTH':
      // Déconnexion
      handleClearAuth(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handler pour obtenir le quota
async function handleGetQuota(sendResponse) {
  try {
    const quota = await self.OkazQuota.getQuotaStatus();
    sendResponse({ success: true, quota });
  } catch (error) {
    console.error('OKAZ SW: Erreur getQuota:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handler pour obtenir l'UUID
async function handleGetUUID(sendResponse) {
  try {
    const uuid = await self.OkazQuota.getOrCreateUUID();
    sendResponse({ success: true, uuid });
  } catch (error) {
    console.error('OKAZ SW: Erreur getUUID:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handler pour sauvegarder l'auth
async function handleSaveAuth(jwt, email, premiumUntil, sendResponse) {
  try {
    await self.OkazQuota.saveAuth(jwt, email, premiumUntil);
    sendResponse({ success: true });
  } catch (error) {
    console.error('OKAZ SW: Erreur saveAuth:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handler pour effacer l'auth
async function handleClearAuth(sendResponse) {
  try {
    await self.OkazQuota.clearAuth();
    sendResponse({ success: true });
  } catch (error) {
    console.error('OKAZ SW: Erreur clearAuth:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handler de recherche avec vérification du quota
async function handleSearchWithQuota(query, criteria, sendResponse) {
  try {
    // Vérifier si la recherche est autorisée
    const canSearchResult = await self.OkazQuota.canSearch();

    if (!canSearchResult.allowed) {
      console.log('OKAZ SW: Quota épuisé');
      const quota = await self.OkazQuota.getQuotaStatus();
      sendResponse({
        success: false,
        error: 'quota_exhausted',
        quota: quota
      });
      return;
    }

    // Consommer une recherche
    const consumeResult = await self.OkazQuota.consumeSearch();
    console.log('OKAZ SW: Recherche consommée:', consumeResult.source);

    // Lancer la recherche
    handleSearch(query, criteria, sendResponse);

  } catch (error) {
    console.error('OKAZ SW: Erreur recherche avec quota:', error);
    // En cas d'erreur, lancer quand même la recherche (fail-open)
    handleSearch(query, criteria, sendResponse);
  }
}

// Écouter les messages internes (depuis popup/content scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('OKAZ SW: Message reçu', request.type);

  const senderTabId = sender.tab?.id;

  switch (request.type) {
    case 'SEARCH':
      handleSearch(request.query, sendResponse);
      return true; // Réponse asynchrone

    case 'LEBONCOIN_RESULTS':
      console.log('OKAZ SW: Résultats LeBonCoin auto reçus:', request.results?.length, 'tab:', senderTabId);
      handleLeBonCoinResults(request.results, senderTabId);
      break;

    case 'VINTED_RESULTS':
      console.log('OKAZ SW: Résultats Vinted auto reçus:', request.results?.length, 'tab:', senderTabId);
      handleVintedResults(request.results, senderTabId);
      break;

    case 'BACKMARKET_RESULTS':
      console.log('OKAZ SW: Résultats Back Market auto reçus:', request.results?.length, 'tab:', senderTabId);
      handleBackMarketResults(request.results, senderTabId);
      break;

    case 'AMAZON_RESULTS':
      console.log('OKAZ SW: Résultats Amazon auto reçus:', request.results?.length, 'tab:', senderTabId);
      handleAmazonResults(request.results, senderTabId);
      break;

    case 'EBAY_RESULTS':
      console.log('OKAZ SW: Résultats eBay auto reçus:', request.results?.length, 'tab:', senderTabId);
      handleEbayResults(request.results, senderTabId);
      break;

    case 'GET_RESULTS':
      sendResponse({ results: Array.from(searchResults.values()).flat() });
      break;
  }
});

async function handleSearch(query, criteria, sendResponse) {
  console.log('OKAZ SW: Recherche:', query);
  if (criteria) {
    console.log('OKAZ SW: Critères reçus:', criteria);
  }
  searchResults.clear();

  // Déterminer quels sites interroger (par défaut: tous)
  // Toujours inclure Amazon (prix neuf de référence), même si Gemini ne le spécifie pas
  const baseSites = criteria?.sites || ['leboncoin', 'vinted', 'backmarket', 'ebay'];
  const sitesToSearch = baseSites.includes('amazon') ? baseSites : [...baseSites, 'amazon'];
  console.log('OKAZ SW: Sites à interroger:', sitesToSearch.join(', '));

  try {
    // Lancer les recherches en PARALLÈLE uniquement sur les sites sélectionnés
    const searchPromises = [];
    const hasUserLocation = criteria?.userLocation?.lat && criteria?.userLocation?.lng;

    // LeBonCoin : si multi-keywords (virgule), faire une recherche par variante
    if (sitesToSearch.includes('leboncoin')) {
      // Détecter les keywords multi-produits (séparés par virgule)
      const rawKeywords = criteria?.keywords || query;
      const allVariants = rawKeywords.includes(',')
        ? rawKeywords.split(',').map(v => v.trim()).filter(v => v.length > 0)
        : [rawKeywords];
      // Max 2 variantes pour éviter d'ouvrir trop d'onglets
      const variants = allVariants.slice(0, 2);

      console.log(`OKAZ SW: LeBonCoin - ${variants.length} variante(s) (${allVariants.length} détectées):`, variants);

      if (hasUserLocation) {
        // Recherche LOCALE + NATIONALE pour chaque variante
        console.log('OKAZ SW: LeBonCoin avec géoloc - recherches locale + nationale par variante');
        searchPromises.push(
          Promise.all(
            variants.flatMap(variant => [
              searchLeBonCoin(query, { ...criteria, _searchVariant: variant }, true).catch(err => {
                console.error('OKAZ SW: Erreur LeBonCoin LOCAL:', err.message);
                return [];
              }),
              searchLeBonCoin(query, { ...criteria, _searchVariant: variant }, false).catch(err => {
                console.error('OKAZ SW: Erreur LeBonCoin NATIONAL:', err.message);
                return [];
              })
            ])
          ).then(allResults => {
            // Séparer résultats locaux (index pairs) et nationaux (index impairs)
            const localResults = [];
            const nationalResults = [];
            allResults.forEach((results, i) => {
              if (i % 2 === 0) {
                results.forEach(r => r.isLocal = true);
                localResults.push(...results);
              } else {
                nationalResults.push(...results);
              }
            });
            // Combiner en évitant les doublons (par URL)
            const seenUrls = new Set(localResults.map(r => r.url));
            const uniqueNational = nationalResults.filter(r => !seenUrls.has(r.url));
            console.log(`OKAZ SW: LBC local=${localResults.length}, national unique=${uniqueNational.length}`);
            return [...localResults, ...uniqueNational];
          })
        );
      } else {
        // Pas de géoloc : recherche nationale par variante
        searchPromises.push(
          Promise.all(
            variants.map(variant =>
              searchLeBonCoin(query, { ...criteria, _searchVariant: variant }, false).catch(err => {
                console.error('OKAZ SW: Erreur LeBonCoin:', err.message);
                return [];
              })
            )
          ).then(allResults => {
            // Combiner et dédupliquer par URL
            const seenUrls = new Set();
            const combined = [];
            allResults.flat().forEach(r => {
              if (!seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                combined.push(r);
              }
            });
            console.log(`OKAZ SW: LBC ${variants.length} variantes → ${combined.length} résultats uniques`);
            return combined;
          })
        );
      }
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    if (sitesToSearch.includes('vinted')) {
      // Multi-keywords : recherche par variante sur Vinted aussi
      const rawKw = criteria?.keywords || query;
      const vintedVariants = rawKw.includes(',')
        ? rawKw.split(',').map(v => v.trim()).filter(v => v.length > 0)
        : [rawKw];

      searchPromises.push(
        Promise.all(
          vintedVariants.map(variant =>
            searchVinted(query, { ...criteria, _searchVariant: variant }).catch(err => {
              console.error('OKAZ SW: Erreur Vinted:', err.message);
              return [];
            })
          )
        ).then(allResults => {
          const seenUrls = new Set();
          const combined = [];
          allResults.flat().forEach(r => {
            if (!seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              combined.push(r);
            }
          });
          if (vintedVariants.length > 1) {
            console.log(`OKAZ SW: Vinted ${vintedVariants.length} variantes → ${combined.length} résultats uniques`);
          }
          return combined;
        })
      );
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    if (sitesToSearch.includes('backmarket')) {
      searchPromises.push(
        searchBackMarket(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur Back Market:', err.message);
          return [];
        })
      );
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    // Amazon : deux recherches parallèles (neuf + seconde main warehouse-deals)
    if (sitesToSearch.includes('amazon')) {
      searchPromises.push(
        searchAmazonNew(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur Amazon Neuf:', err.message);
          return [];
        })
      );
      searchPromises.push(
        searchAmazonUsed(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur Amazon Seconde Main:', err.message);
          return [];
        })
      );
    } else {
      searchPromises.push(Promise.resolve([]));
      searchPromises.push(Promise.resolve([]));
    }

    // eBay
    if (sitesToSearch.includes('ebay')) {
      searchPromises.push(
        searchEbay(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur eBay:', err.message);
          return [];
        })
      );
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    const results = await Promise.all(searchPromises);
    const [lbcResults, vintedResults, bmResults, amazonNewResults, amazonUsedResults, ebayResults] = results;

    console.log(`OKAZ SW: LeBonCoin=${lbcResults.length}, Vinted=${vintedResults.length}, BackMarket=${bmResults.length}, AmazonNeuf=${amazonNewResults.length}, AmazonSecondMain=${amazonUsedResults.length}, eBay=${ebayResults.length}`);

    // Résultats principaux : LBC + Vinted + BM + Amazon Seconde Main + Amazon Neuf + eBay
    const allResults = [...lbcResults, ...vintedResults, ...bmResults, ...amazonUsedResults, ...amazonNewResults, ...ebayResults].sort((a, b) => b.score - a.score);

    // Top 5 Amazon Neuf les moins chers → prix neuf de référence pour le bandeau
    const amazonNewForBanner = [...amazonNewResults]
      .filter(r => r.price > 0)
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    console.log(`OKAZ SW: ${allResults.length} résultats totaux, ${amazonNewForBanner.length} Amazon Neuf pour bandeau`);

    const completedSites = [];
    if (lbcResults.length > 0) completedSites.push('leboncoin');
    if (vintedResults.length > 0) completedSites.push('vinted');
    if (bmResults.length > 0) completedSites.push('backmarket');
    if (amazonNewResults.length > 0 || amazonUsedResults.length > 0) completedSites.push('amazon');
    if (ebayResults.length > 0) completedSites.push('ebay');

    sendResponse({
      success: true,
      results: allResults,
      amazonNewResults: amazonNewForBanner,
      completedSites
    });

  } catch (error) {
    console.error('OKAZ SW: Erreur recherche', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Construire l'URL LeBonCoin à partir des critères
// Si localSearch=true et userLocation fourni, ajoute les filtres géo
function buildLeBonCoinUrl(query, criteria, localSearch = false) {
  const params = new URLSearchParams();

  // Utiliser les keywords optimisés si disponibles, sinon la query brute
  // Si multi-keywords (virgule), prendre le variant spécifié ou le premier
  const rawKeywords = criteria?.keywords || query;
  const keywords = criteria?._searchVariant || rawKeywords.split(',')[0].trim();
  console.log('OKAZ SW: LBC keywords =', keywords, '(raw:', rawKeywords, ')');
  params.set('text', keywords);

  // Ajouter les filtres optionnels
  if (criteria?.priceMin) {
    params.set('price_min', criteria.priceMin.toString());
  }
  if (criteria?.priceMax) {
    params.set('price_max', criteria.priceMax.toString());
  }
  // shippable uniquement sur la recherche NATIONALE — le local c'est la remise en main propre
  if (criteria?.shippable && !localSearch) {
    params.set('shippable', '1');
  }
  if (criteria?.ownerType && criteria.ownerType !== 'all') {
    params.set('owner_type', criteria.ownerType);
  }

  // Recherche LOCALE : utiliser le paramètre `locations` de LeBonCoin
  // Format LBC : locations=Ville_CodePostal__lat_lng_5000_rayon
  if (localSearch && criteria?.userLocation) {
    const { lat, lng } = criteria.userLocation;
    const cityName = criteria?.userCityName || 'Localisation';
    const postalCode = criteria?.userPostalCode || '';
    const radius = 30000; // 30km en mètres
    const cityPart = postalCode ? `${cityName}_${postalCode}` : cityName;
    const locationsParam = `${cityPart}__${lat.toFixed(5)}_${lng.toFixed(5)}_5000_${radius}`;
    params.set('locations', locationsParam);
    console.log(`OKAZ SW: Recherche LOCALE LBC - locations=${locationsParam}`);
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

async function searchLeBonCoin(query, criteria, localSearch = false) {
  const searchUrl = buildLeBonCoinUrl(query, criteria, localSearch);
  console.log(`OKAZ SW: Ouverture LeBonCoin ${localSearch ? '(LOCAL)' : '(NATIONAL)'}...`, searchUrl);

  return new Promise(async (resolve, reject) => {
    let tab = null;
    let resolved = false;
    let tabId = null;

    const cleanup = () => {
      if (tabId) {
        pendingResolvers.delete(tabId);
        untrackTab(tabId);
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }
    };

    const resolveWith = (results) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`OKAZ SW: Résolution avec ${results.length} résultats`);
        resolve(results);
      }
    };

    try {
      // Créer un onglet en ARRIÈRE-PLAN pour ne pas perturber l'utilisateur
      tab = await chrome.tabs.create({
        url: searchUrl,
        active: false  // Onglet en arrière-plan
      });

      tabId = tab.id;
      trackTab(tabId);
      console.log('OKAZ SW: Onglet créé', tabId);

      // Stocker le resolver pour les résultats auto du content script
      pendingResolvers.set(tabId, resolveWith);

      // Timeout de sécurité (30s - LBC peut être lent à charger)
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('OKAZ SW: Timeout après 30s');
          resolved = true;
          cleanup();
          reject(new Error('Timeout - aucun résultat après 30s'));
        }
      }, 30000);

      // Essayer PARSE_PAGE après chargement complet
      const checkAndParse = async (attempts = 0) => {
        if (resolved) return;
        if (attempts > 30) {
          console.log('OKAZ SW: Max tentatives atteint');
          return;
        }

        try {
          const tabInfo = await chrome.tabs.get(tabId);
          console.log(`OKAZ SW: Tab status = ${tabInfo.status} (tentative ${attempts})`);

          if (tabInfo.status === 'complete') {
            // Attendre que le JS de la page charge les annonces
            await new Promise(r => setTimeout(r, 2000));

            if (resolved) return;

            // Essayer PARSE_PAGE
            try {
              console.log('OKAZ SW: Envoi PARSE_PAGE au content script...');
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PARSE_PAGE' });

              if (!resolved && response && response.success) {
                clearTimeout(timeoutId);
                console.log(`OKAZ SW: ${response.results.length} résultats via PARSE_PAGE`);
                resolveWith(response.results);
              } else if (response && !response.success) {
                console.log('OKAZ SW: PARSE_PAGE a retourné une erreur:', response.error);
              }
            } catch (e) {
              console.log('OKAZ SW: PARSE_PAGE échoué:', e.message);
              // Réessayer dans 2s
              if (!resolved && attempts < 10) {
                setTimeout(() => checkAndParse(attempts + 1), 2000);
              }
            }
          } else {
            // Page pas encore chargée, réessayer
            setTimeout(() => checkAndParse(attempts + 1), 500);
          }
        } catch (e) {
          console.error('OKAZ SW: Erreur checkAndParse', e);
        }
      };

      // Commencer à vérifier après 1s
      setTimeout(() => checkAndParse(), 1000);

    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function handleLeBonCoinResults(results, senderTabId) {
  console.log('OKAZ SW: Traitement résultats LBC auto:', results?.length, 'from tab:', senderTabId);
  searchResults.set('leboncoin', results || []);

  // Résoudre UNIQUEMENT l'onglet qui a envoyé les résultats
  if (senderTabId && pendingResolvers.has(senderTabId)) {
    const resolver = pendingResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution LBC pour tab', senderTabId);
    resolver(results || []);
  } else {
    // Fallback: si pas de senderTabId, chercher le bon onglet
    chrome.tabs.query({ url: '*://www.leboncoin.fr/recherche*' }, (tabs) => {
      tabs.forEach(tab => {
        const resolver = pendingResolvers.get(tab.id);
        if (resolver) {
          console.log('OKAZ SW: Résolution LBC fallback pour tab', tab.id);
          resolver(results || []);
        }
      });
    });
  }
}

// ============ VINTED ============

// Construire l'URL Vinted à partir des critères
function buildVintedUrl(query, criteria) {
  const params = new URLSearchParams();

  // Utiliser les keywords optimisés, splitter si virgule (multi-produits)
  const rawKeywords = criteria?.keywords || query;
  const keywords = criteria?._searchVariant || rawKeywords.split(',')[0].trim();
  console.log('OKAZ SW: Vinted keywords =', keywords);
  params.set('search_text', keywords);

  // Ajouter les filtres optionnels
  if (criteria?.priceMin) {
    params.set('price_from', criteria.priceMin.toString());
  }
  if (criteria?.priceMax) {
    params.set('price_to', criteria.priceMax.toString());
  }

  // Tri par pertinence
  params.set('order', 'relevance');

  return `https://www.vinted.fr/catalog?${params.toString()}`;
}

async function searchVinted(query, criteria) {
  const searchUrl = buildVintedUrl(query, criteria);
  console.log('OKAZ SW: Ouverture Vinted...', searchUrl);

  return new Promise(async (resolve, reject) => {
    let tab = null;
    let resolved = false;
    let tabId = null;

    const cleanup = () => {
      if (tabId) {
        pendingVintedResolvers.delete(tabId);
        untrackTab(tabId);
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }
    };

    const resolveWith = (results) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`OKAZ SW: Résolution Vinted avec ${results.length} résultats`);
        resolve(results);
      }
    };

    try {
      // Créer un onglet en arrière-plan
      tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

      tabId = tab.id;
      trackTab(tabId);
      console.log('OKAZ SW: Onglet Vinted créé', tabId);

      // Stocker le resolver
      pendingVintedResolvers.set(tabId, resolveWith);

      // Timeout de sécurité (25s pour Vinted - un peu plus rapide que LBC)
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('OKAZ SW: Timeout Vinted après 25s');
          resolved = true;
          cleanup();
          resolve([]); // Résoudre avec tableau vide au lieu de rejeter
        }
      }, 25000);

      // Essayer PARSE_PAGE après chargement
      const checkAndParse = async (attempts = 0) => {
        if (resolved) return;
        if (attempts > 20) {
          console.log('OKAZ SW: Max tentatives Vinted atteint');
          return;
        }

        try {
          const tabInfo = await chrome.tabs.get(tabId);
          console.log(`OKAZ SW: Vinted tab status = ${tabInfo.status} (tentative ${attempts})`);

          if (tabInfo.status === 'complete') {
            // Attendre le chargement JS
            await new Promise(r => setTimeout(r, 2500));

            if (resolved) return;

            try {
              console.log('OKAZ SW: Envoi PARSE_PAGE à Vinted...');
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PARSE_PAGE' });

              if (!resolved && response && response.success) {
                clearTimeout(timeoutId);
                console.log(`OKAZ SW: ${response.results.length} résultats Vinted via PARSE_PAGE`);
                resolveWith(response.results);
              }
            } catch (e) {
              console.log('OKAZ SW: PARSE_PAGE Vinted échoué:', e.message);
              if (!resolved && attempts < 8) {
                setTimeout(() => checkAndParse(attempts + 1), 1500);
              }
            }
          } else {
            setTimeout(() => checkAndParse(attempts + 1), 400);
          }
        } catch (e) {
          console.error('OKAZ SW: Erreur checkAndParse Vinted', e);
        }
      };

      // Commencer à vérifier après 1.5s
      setTimeout(() => checkAndParse(), 1500);

    } catch (error) {
      cleanup();
      resolve([]); // Résoudre avec tableau vide au lieu de rejeter
    }
  });
}

function handleVintedResults(results, senderTabId) {
  console.log('OKAZ SW: Traitement résultats Vinted auto:', results?.length, 'from tab:', senderTabId);
  searchResults.set('vinted', results || []);

  // Résoudre UNIQUEMENT l'onglet qui a envoyé les résultats
  if (senderTabId && pendingVintedResolvers.has(senderTabId)) {
    const resolver = pendingVintedResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution Vinted pour tab', senderTabId);
    resolver(results || []);
  } else {
    chrome.tabs.query({ url: '*://www.vinted.fr/*' }, (tabs) => {
      tabs.forEach(tab => {
        const resolver = pendingVintedResolvers.get(tab.id);
        if (resolver) {
          console.log('OKAZ SW: Résolution Vinted fallback pour tab', tab.id);
          resolver(results || []);
        }
      });
    });
  }
}

// ============ BACK MARKET ============

// Construire l'URL Back Market à partir des critères
function buildBackMarketUrl(query, criteria) {
  const params = new URLSearchParams();

  // Utiliser keywordsBM si disponible (optimisé pour Back Market), sinon premier keyword
  const rawKeywords = criteria?.keywords || query;
  const keywords = criteria?.keywordsBM || criteria?._searchVariant || rawKeywords.split(',')[0].trim();
  console.log('OKAZ SW: Back Market keywords =', keywords);
  params.set('q', keywords);

  return `https://www.backmarket.fr/fr-fr/search?${params.toString()}`;
}

async function searchBackMarket(query, criteria) {
  const searchUrl = buildBackMarketUrl(query, criteria);
  console.log('OKAZ SW: Ouverture Back Market...', searchUrl);

  return new Promise(async (resolve, reject) => {
    let tab = null;
    let resolved = false;
    let tabId = null;

    const cleanup = () => {
      if (tabId) {
        pendingBackMarketResolvers.delete(tabId);
        untrackTab(tabId);
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }
    };

    const resolveWith = (results) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`OKAZ SW: Résolution Back Market avec ${results.length} résultats`);
        resolve(results);
      }
    };

    try {
      // Créer un onglet en arrière-plan
      tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

      tabId = tab.id;
      trackTab(tabId);
      console.log('OKAZ SW: Onglet Back Market créé', tabId);

      // Stocker le resolver
      pendingBackMarketResolvers.set(tabId, resolveWith);

      // Timeout de sécurité (25s)
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('OKAZ SW: Timeout Back Market après 25s');
          resolved = true;
          cleanup();
          resolve([]); // Résoudre avec tableau vide au lieu de rejeter
        }
      }, 25000);

      // Essayer PARSE_PAGE après chargement
      const checkAndParse = async (attempts = 0) => {
        if (resolved) return;
        if (attempts > 20) {
          console.log('OKAZ SW: Max tentatives Back Market atteint');
          return;
        }

        try {
          const tabInfo = await chrome.tabs.get(tabId);
          console.log(`OKAZ SW: Back Market tab status = ${tabInfo.status} (tentative ${attempts})`);

          if (tabInfo.status === 'complete') {
            // Attendre le chargement JS
            await new Promise(r => setTimeout(r, 2500));

            if (resolved) return;

            try {
              console.log('OKAZ SW: Envoi PARSE_PAGE à Back Market...');
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PARSE_PAGE' });

              if (!resolved && response && response.success) {
                clearTimeout(timeoutId);
                console.log(`OKAZ SW: ${response.results.length} résultats Back Market via PARSE_PAGE`);
                resolveWith(response.results);
              }
            } catch (e) {
              console.log('OKAZ SW: PARSE_PAGE Back Market échoué:', e.message);
              if (!resolved && attempts < 8) {
                setTimeout(() => checkAndParse(attempts + 1), 1500);
              }
            }
          } else {
            setTimeout(() => checkAndParse(attempts + 1), 400);
          }
        } catch (e) {
          console.error('OKAZ SW: Erreur checkAndParse Back Market', e);
        }
      };

      // Commencer à vérifier après 1.5s
      setTimeout(() => checkAndParse(), 1500);

    } catch (error) {
      cleanup();
      resolve([]); // Résoudre avec tableau vide au lieu de rejeter
    }
  });
}

function handleBackMarketResults(results, senderTabId) {
  console.log('OKAZ SW: Traitement résultats Back Market auto:', results?.length, 'from tab:', senderTabId);
  searchResults.set('backmarket', results || []);

  // Résoudre UNIQUEMENT l'onglet qui a envoyé les résultats
  if (senderTabId && pendingBackMarketResolvers.has(senderTabId)) {
    const resolver = pendingBackMarketResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution Back Market pour tab', senderTabId);
    resolver(results || []);
  } else {
    chrome.tabs.query({ url: '*://www.backmarket.fr/*' }, (tabs) => {
      tabs.forEach(tab => {
        const resolver = pendingBackMarketResolvers.get(tab.id);
        if (resolver) {
          console.log('OKAZ SW: Résolution Back Market fallback pour tab', tab.id);
          resolver(results || []);
        }
      });
    });
  }
}

// ============ AMAZON ============

// Construire l'URL Amazon Neuf
function buildAmazonNewUrl(query, criteria) {
  const rawKeywords = criteria?.keywords || query;
  const keywords = (criteria?._searchVariant || rawKeywords.split(',')[0]).trim();
  console.log('OKAZ SW: Amazon Neuf keywords =', keywords);
  // Utiliser encodeURIComponent au lieu de URLSearchParams (fix bug intermittent
  // où URLSearchParams coupait le premier mot des keywords)
  const encodedKw = encodeURIComponent(keywords).replace(/%20/g, '+');
  const url = `https://www.amazon.fr/s?k=${encodedKw}&condition=new`;
  console.log('OKAZ SW: Amazon Neuf URL =', url);
  return url;
}

// Construire l'URL Amazon Seconde Main (Warehouse Deals)
function buildAmazonUsedUrl(query, criteria) {
  const rawKeywords = criteria?.keywords || query;
  const keywords = (criteria?._searchVariant || rawKeywords.split(',')[0]).trim();
  console.log('OKAZ SW: Amazon Seconde Main keywords =', keywords);
  const encodedKw = encodeURIComponent(keywords).replace(/%20/g, '+');
  // __mk_fr_FR nécessaire pour obtenir les résultats en français
  const url = `https://www.amazon.fr/s?k=${encodedKw}&i=warehouse-deals&__mk_fr_FR=%C3%85M%C3%85%C5%BD%C3%95%C3%91`;
  console.log('OKAZ SW: Amazon Seconde Main URL =', url);
  return url;
}

// Fonction générique de recherche Amazon (réutilisée pour neuf et occasion)
function _searchAmazon(searchUrl, label, resolverMap, maxResults, tabType) {
  console.log(`OKAZ SW: Ouverture Amazon ${label}...`, searchUrl);

  return new Promise(async (resolve, reject) => {
    let tab = null;
    let resolved = false;
    let tabId = null;

    const cleanup = () => {
      if (tabId) {
        resolverMap.delete(tabId);
        amazonTabTypes.delete(tabId);
        untrackTab(tabId);
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }
    };

    const resolveWith = (results) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`OKAZ SW: Résolution Amazon ${label} avec ${results.length} résultats`);
        resolve(results);
      }
    };

    try {
      tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

      tabId = tab.id;
      trackTab(tabId);
      console.log(`OKAZ SW: Onglet Amazon ${label} créé`, tabId);

      resolverMap.set(tabId, resolveWith);
      amazonTabTypes.set(tabId, tabType);

      // Timeout 20s
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log(`OKAZ SW: Timeout Amazon ${label} après 20s`);
          resolved = true;
          cleanup();
          resolve([]);
        }
      }, 20000);

      const checkAndParse = async (attempts = 0) => {
        if (resolved) return;
        if (attempts > 20) return;

        try {
          const tabInfo = await chrome.tabs.get(tabId);

          if (tabInfo.status === 'complete') {
            await new Promise(r => setTimeout(r, 2000));
            if (resolved) return;

            // Si déjà résolu par auto-parse, ne pas envoyer PARSE_PAGE
            if (resolved) return;

            try {
              const response = await chrome.tabs.sendMessage(tabId, { type: 'PARSE_PAGE', maxResults });

              if (!resolved && response && response.success) {
                clearTimeout(timeoutId);
                console.log(`OKAZ SW: ${response.results.length} résultats Amazon ${label} via PARSE_PAGE`);
                resolveWith(response.results);
              }
            } catch (e) {
              // "message channel closed" = auto-parse a déjà résolu + fermé l'onglet (bénin)
              if (!resolved) {
                console.log(`OKAZ SW: PARSE_PAGE Amazon ${label} échoué:`, e.message);
                if (attempts < 8) {
                  setTimeout(() => checkAndParse(attempts + 1), 1500);
                }
              }
            }
          } else {
            setTimeout(() => checkAndParse(attempts + 1), 400);
          }
        } catch (e) {
          console.error(`OKAZ SW: Erreur checkAndParse Amazon ${label}`, e);
        }
      };

      setTimeout(() => checkAndParse(), 1500);

    } catch (error) {
      cleanup();
      resolve([]);
    }
  });
}

function searchAmazonNew(query, criteria) {
  return _searchAmazon(buildAmazonNewUrl(query, criteria), 'Neuf', pendingAmazonNewResolvers, 10, 'new');
}

function searchAmazonUsed(query, criteria) {
  return _searchAmazon(buildAmazonUsedUrl(query, criteria), 'Seconde Main', pendingAmazonUsedResolvers, 10, 'used');
}

function handleAmazonResults(results, senderTabId) {
  console.log('OKAZ SW: Résultats Amazon auto reçus:', results?.length, 'tab:', senderTabId);
  searchResults.set('amazon', results || []);

  const tabType = senderTabId ? amazonTabTypes.get(senderTabId) : null;

  if (senderTabId && tabType === 'new' && pendingAmazonNewResolvers.has(senderTabId)) {
    const resolver = pendingAmazonNewResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution Amazon Neuf pour tab', senderTabId);
    resolver(results || []);
  } else if (senderTabId && tabType === 'used' && pendingAmazonUsedResolvers.has(senderTabId)) {
    const resolver = pendingAmazonUsedResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution Amazon Seconde Main pour tab', senderTabId);
    resolver(results || []);
  } else if (senderTabId) {
    // Fallback: essayer les deux maps
    const newResolver = pendingAmazonNewResolvers.get(senderTabId);
    const usedResolver = pendingAmazonUsedResolvers.get(senderTabId);
    if (newResolver) newResolver(results || []);
    else if (usedResolver) usedResolver(results || []);
  }
}

// ============ EBAY ============

// Construire l'URL eBay.fr à partir des critères
function buildEbayUrl(query, criteria) {
  const rawKeywords = criteria?.keywords || query;
  const keywords = criteria?._searchVariant || rawKeywords.split(',')[0].trim();
  console.log('OKAZ SW: eBay keywords =', keywords);
  const params = new URLSearchParams();
  params.set('_nkw', keywords);
  params.set('rt', 'nc');
  // Filtrer par prix si spécifié
  if (criteria?.priceMin) {
    params.set('_udlo', criteria.priceMin.toString());
  }
  if (criteria?.priceMax) {
    params.set('_udhi', criteria.priceMax.toString());
  }
  return `https://www.ebay.fr/sch/i.html?${params.toString()}`;
}

async function searchEbay(query, criteria) {
  const searchUrl = buildEbayUrl(query, criteria);
  console.log('OKAZ SW: Ouverture eBay...', searchUrl);

  return new Promise(async (resolve, reject) => {
    let tab = null;
    let resolved = false;
    let tabId = null;

    const cleanup = () => {
      if (tabId) {
        pendingEbayResolvers.delete(tabId);
        untrackTab(tabId);
        try { chrome.tabs.remove(tabId); } catch (e) {}
      }
    };

    const resolveWith = (results) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log(`OKAZ SW: Résolution eBay avec ${results.length} résultats`);
        resolve(results);
      }
    };

    // Fonction de parsing injectée via chrome.scripting.executeScript
    // Retourne { results, diag } pour que le SW puisse logger les diagnostics
    async function parseEbayPage() {
      const MAX = 10;
      const results = [];
      const seenUrls = new Set();
      const diag = { strategy: 'none', htmlKB: 0, itmInHtml: 0, aCount: 0, shadows: 0, iframes: 0, sample: '' };

      function extractPrice(text) {
        // Support: "149,99 €", "149,99 EUR", "EUR 149,99", "1 079,00 €"
        const patterns = [
          /([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/,
          /(?:EUR|€)\s*([\d\s]+(?:[.,]\d{2})?)/
        ];
        for (const pat of patterns) {
          const m = (text || '').match(pat);
          if (m) {
            const v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
            if (v > 0 && v < 50000) return Math.round(v);
          }
        }
        return 0;
      }

      function makeResult(title, price, url, image) {
        results.push({
          id: `ebay-${results.length}-${Date.now()}`,
          title: title.substring(0, 100), price, site: 'eBay', siteColor: '#E53238',
          image, url, location: '',
          handDelivery: false, hasShipping: true, hasWarranty: false,
          score: 70, redFlags: []
        });
      }

      // Diagnostics communs
      const html = document.documentElement.outerHTML;
      diag.htmlKB = Math.round(html.length / 1024);
      diag.itmInHtml = (html.match(/\/itm\//g) || []).length;
      diag.aCount = document.querySelectorAll('a').length;
      diag.iframes = document.querySelectorAll('iframe').length;
      let sc = 0;
      document.querySelectorAll('*').forEach(el => { if (el.shadowRoot) sc++; });
      diag.shadows = sc;
      const itmIdx = html.indexOf('/itm/');
      if (itmIdx > -1) {
        diag.sample = html.substring(Math.max(0, itmIdx - 200), itmIdx + 300).replace(/\n/g, ' ').substring(0, 500);
      }
      diag.url = window.location.href;
      diag.title = document.title;

      // ===== STRATÉGIE 1 : s-card DOM (eBay 2025) =====
      // eBay utilise des éléments .s-card avec .s-card__link pour les résultats
      const cards = document.querySelectorAll('.s-card');
      diag.sCards = cards.length;

      if (cards.length > 0) {
        diag.strategy = cards.length + ' s-cards DOM';
        for (const card of cards) {
          if (results.length >= MAX) break;
          try {
            // Trouver le lien principal
            const link = card.querySelector('a.s-card__link, a[href*="/itm/"], a[href*="ebay"]');
            if (!link) continue;
            let url = link.href || '';
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            // Titre: chercher dans le texte de la card
            let title = '';
            const titleEl = card.querySelector('[class*="title"], [role="heading"], h3, .s-card__title');
            if (titleEl) title = titleEl.textContent?.trim() || '';
            if (!title) title = link.textContent?.trim() || '';
            if (!title) title = link.title || '';
            title = title.replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '').replace(/^Sponsorisé\s*/i, '').trim();
            if (!title || title.length < 5) continue;

            // Prix
            const cardText = card.textContent || '';
            const price = extractPrice(cardText);
            if (price === 0) continue;

            // Image
            let image = null;
            const imgEl = card.querySelector('img[src*="ebayimg"], img[src*="ebay"]');
            if (imgEl) {
              image = imgEl.src || imgEl.dataset?.src || null;
              if (image && (image.includes('placeholder') || image.includes('data:image'))) image = null;
            }

            // Normaliser l'URL
            if (!url.includes('ebay.fr') && url.includes('ebay.com')) {
              url = url.replace('ebay.com', 'ebay.fr');
            }
            try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}

            makeResult(title, price, url, image);
          } catch (e) {}
        }
      }

      // ===== STRATÉGIE 2 : Tous les liens /itm/ dans le DOM =====
      if (results.length === 0) {
        // Essayer plusieurs sélecteurs pour trouver les liens
        let links = document.querySelectorAll('a[href*="/itm/"]');
        if (links.length === 0) {
          // Fallback: chercher tous les <a> et filtrer manuellement
          const allLinks = document.querySelectorAll('a');
          const itmLinks = [];
          allLinks.forEach(a => {
            const href = a.href || a.getAttribute('href') || '';
            if (href.includes('/itm/')) itmLinks.push(a);
          });
          links = itmLinks;
        }
        diag.linksItm = links.length;

        if (links.length > 0) {
          diag.strategy = (diag.strategy === 'none' ? '' : diag.strategy + ' + ') + links.length + ' liens /itm/';
          for (const link of links) {
            if (results.length >= MAX) break;
            try {
              let url = link.href || link.getAttribute('href') || '';
              if (!url.includes('/itm/')) continue;
              if (seenUrls.has(url)) continue;
              seenUrls.add(url);

              // Remonter au container card
              let container = link.closest('.s-card') || link.closest('[class*="card"]');
              if (!container) {
                container = link.parentElement;
                for (let i = 0; i < 6 && container; i++) {
                  if ((container.textContent || '').match(/[\d,.]+\s*(?:EUR|€)/) && (container.textContent || '').length > 50) break;
                  container = container.parentElement;
                }
              }
              if (!container) container = link.parentElement;

              let title = link.title || '';
              if (!title) {
                const h = container?.querySelector('[role="heading"], h3, [class*="title"]');
                title = h?.textContent?.trim() || link.textContent?.trim() || '';
              }
              title = title.replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '').replace(/^Sponsorisé\s*/i, '').trim();
              if (!title || title.length < 5) continue;

              const price = extractPrice(container?.textContent || '');
              if (price === 0) continue;

              let image = null;
              const imgEl = container?.querySelector('img[src*="ebayimg"]');
              if (imgEl) image = imgEl.src || null;

              if (!url.includes('ebay.fr') && url.includes('ebay.com')) url = url.replace('ebay.com', 'ebay.fr');
              try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}

              makeResult(title, price, url, image);
            } catch (e) {}
          }
        }
      }

      // ===== STRATÉGIE 3 : HTML brut regex (IDs 5+ chiffres) =====
      if (results.length === 0 && diag.itmInHtml > 0) {
        diag.strategy = (diag.strategy === 'none' ? '' : diag.strategy + ' + ') + 'HTML regex';
        // Match /itm/ suivi de chiffres (5-15) OU d'un slug puis chiffres
        const itemRegex = /\/itm\/(?:[a-zA-Z0-9-]+\/)?(\d{5,15})/g;
        let match;
        const itemIds = [];
        while ((match = itemRegex.exec(html)) !== null) {
          if (!seenUrls.has(match[1])) {
            seenUrls.add(match[1]);
            itemIds.push({ id: match[1], pos: match.index });
          }
        }
        diag.uniqueItems = itemIds.length;
        diag.noTitle = 0;
        diag.noPrice = 0;

        for (const item of itemIds.slice(0, MAX)) {
          const start = Math.max(0, item.pos - 1500);
          const end = Math.min(html.length, item.pos + 1500);
          const ctx = html.substring(start, end);

          if (item === itemIds[0]) {
            diag.firstCtx = ctx.substring(0, 500).replace(/\n/g, ' ');
          }

          let title = '';
          const titlePatterns = [
            /title="([^"]{10,120})"/,
            /aria-label="([^"]{10,120})"/,
            /alt="([^"]{10,120})"/,
            /role="heading"[^>]*>([^<]{10,120})</,
            /<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]{10,120})<\/span>/,
            /<span[^>]*>([^<]{15,120})<\/span>/,
            /<h3[^>]*>([^<]{10,120})<\/h3>/
          ];
          for (const pat of titlePatterns) {
            const tm = ctx.match(pat);
            if (tm && !tm[1].includes('<') && !tm[1].includes('http') && !tm[1].includes('function')) {
              title = tm[1].trim();
              break;
            }
          }
          if (!title) { diag.noTitle++; continue; }
          title = title.replace(/^(Neuf|D&#39;occasion|D'occasion|Nouveau)\s*[–-]\s*/i, '')
                       .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                       .substring(0, 100);
          if (title.length < 5) { diag.noTitle++; continue; }

          const price = extractPrice(ctx);
          if (price === 0) { diag.noPrice++; continue; }

          let image = null;
          const imgMatch = ctx.match(/src="(https?:\/\/i\.ebayimg\.com\/[^"]+)"/);
          if (imgMatch) image = imgMatch[1];

          makeResult(title, price, `https://www.ebay.fr/itm/${item.id}`, image);
        }
      }

      // ===== STRATÉGIE 4 : JSON embarqué (plus flexible) =====
      if (results.length === 0) {
        diag.strategy = (diag.strategy === 'none' ? '' : diag.strategy + ' + ') + 'JSON';
        const scripts = document.querySelectorAll('script');
        let jsonScriptCount = 0;
        for (const script of scripts) {
          const text = script.textContent || '';
          if (text.length < 100) continue;
          // Chercher des patterns JSON avec itemId/listingId
          const hasItemData = text.includes('itemId') || text.includes('listingId') || text.includes('"title"');
          if (!hasItemData) continue;
          jsonScriptCount++;
          try {
            // Pattern 1: {"itemId":"123","title":"...","price":{"value":"99.99"}}
            const p1 = /"(?:itemId|listingId)"\s*:\s*"(\d+)"[\s\S]*?"title"\s*:\s*"([^"]{10,150})"[\s\S]*?"(?:price|convertedFromValue)"\s*:\s*(?:\{[^}]*"value"\s*:\s*)?"?([\d.]+)"?/g;
            let m;
            while ((m = p1.exec(text)) !== null && results.length < MAX) {
              if (seenUrls.has(m[1])) continue;
              seenUrls.add(m[1]);
              const price = Math.round(parseFloat(m[3]));
              if (price <= 0 || price > 50000) continue;
              makeResult(m[2], price, `https://www.ebay.fr/itm/${m[1]}`, null);
            }
            // Pattern 2: chercher les objets un par un
            if (results.length === 0) {
              const idMatches = [...text.matchAll(/"(?:itemId|listingId)"\s*:\s*"(\d+)"/g)];
              for (const idM of idMatches.slice(0, MAX)) {
                if (seenUrls.has(idM[1])) continue;
                const pos = idM.index;
                const chunk = text.substring(Math.max(0, pos - 500), Math.min(text.length, pos + 2000));
                const titleM = chunk.match(/"title"\s*:\s*"([^"]{10,150})"/);
                const priceM = chunk.match(/"value"\s*:\s*"?([\d.]+)"?/);
                if (titleM && priceM) {
                  seenUrls.add(idM[1]);
                  const price = Math.round(parseFloat(priceM[1]));
                  if (price > 0 && price < 50000) {
                    makeResult(titleM[1], price, `https://www.ebay.fr/itm/${idM[1]}`, null);
                  }
                }
              }
            }
          } catch (e) {}
          if (results.length > 0) break;
        }
        diag.jsonScripts = jsonScriptCount;
      }

      return { results, diag };
    }

    try {
      // eBay : ouvrir en background, attendre que la page soit chargée,
      // puis parser en UNE seule tentative (multi-stratégie : DOM + Shadow DOM + HTML regex + JSON)
      tab = await chrome.tabs.create({
        url: searchUrl,
        active: false
      });

      tabId = tab.id;
      trackTab(tabId);
      console.log('OKAZ SW: Onglet eBay créé', tabId);

      pendingEbayResolvers.set(tabId, resolveWith);

      // Timeout 25s
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('OKAZ SW: Timeout eBay après 25s');
          resolved = true;
          cleanup();
          resolve([]);
        }
      }, 25000);

      // Attendre page complete puis parser UNE fois
      const waitAndParse = async (attempts = 0) => {
        if (resolved) return;
        if (attempts > 30) return;

        try {
          const tabInfo = await chrome.tabs.get(tabId);
          const tabUrl = tabInfo.url || '';
          const isSearchPage = tabUrl.includes('/sch/');

          if (attempts % 10 === 0) {
            console.log(`OKAZ SW: eBay tab [${attempts}] status=${tabInfo.status} isSearch=${isSearchPage}`);
          }

          // Attendre page de résultats complete
          if (!isSearchPage || tabInfo.status !== 'complete') {
            setTimeout(() => waitAndParse(attempts + 1), 500);
            return;
          }

          // Page chargée — activer brièvement pour déclencher le rendu lazy
          console.log('OKAZ SW: eBay page chargée, activation pour rendu...');
          let originalTabId = null;
          try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            originalTabId = activeTab?.id;
            await chrome.tabs.update(tabId, { active: true });
          } catch {}
          await new Promise(r => setTimeout(r, 3000));
          // Revenir à l'onglet d'origine
          if (originalTabId) {
            try { await chrome.tabs.update(originalTabId, { active: true }); } catch {}
          }
          if (resolved) return;

          // Parser via executeScript (multi-stratégie intégrée)
          try {
            const injectionResults = await chrome.scripting.executeScript({
              target: { tabId },
              func: parseEbayPage
            });

            const rawResult = injectionResults?.[0]?.result;
            if (!resolved && rawResult) {
              const ebayResults = rawResult.results || rawResult;
              const diag = rawResult.diag || {};
              console.log(`OKAZ SW: eBay DIAG: HTML=${diag.htmlKB}KB, /itm/=${diag.itmInHtml}, <a>=${diag.aCount}, shadows=${diag.shadows}, iframes=${diag.iframes}, strategy=${diag.strategy}`);
              console.log(`OKAZ SW: eBay DIAG2: uniqueItems=${diag.uniqueItems}, noTitle=${diag.noTitle}, noPrice=${diag.noPrice}, jsonScripts=${diag.jsonScripts}, title="${diag.title}"`);
              if (diag.sample) console.log(`OKAZ SW: eBay SAMPLE: ${diag.sample}`);
              if (diag.firstCtx) console.log(`OKAZ SW: eBay FIRST_CTX: ${diag.firstCtx}`);
              clearTimeout(timeoutId);
              console.log(`OKAZ SW: ${ebayResults.length} résultats eBay (multi-stratégie)`);
              resolveWith(ebayResults);
              return;
            } else if (!resolved) {
              console.log('OKAZ SW: eBay executeScript result is NULL/undefined — function crashed inside tab');
              console.log('OKAZ SW: eBay raw injectionResults:', JSON.stringify(injectionResults?.map(r => ({ result: r.result === undefined ? 'UNDEFINED' : typeof r.result, frameId: r.frameId }))));
            }
          } catch (e) {
            console.log('OKAZ SW: executeScript eBay échoué:', e.message);
          }

          // Si 0 résultats, c'est fini — pas de retry
          if (!resolved) {
            clearTimeout(timeoutId);
            console.log('OKAZ SW: eBay 0 résultats après parsing unique');
            resolveWith([]);
          }
        } catch (e) {
          if (!resolved) setTimeout(() => waitAndParse(attempts + 1), 1000);
        }
      };

      setTimeout(() => waitAndParse(), 1000);

    } catch (error) {
      cleanup();
      resolve([]);
    }
  });
}

function handleEbayResults(results, senderTabId) {
  console.log('OKAZ SW: Traitement résultats eBay auto:', results?.length, 'from tab:', senderTabId);
  searchResults.set('ebay', results || []);

  // Ne résoudre auto que si on a des résultats réels
  // Sinon laisser checkAndParse retenter avec executeScript
  if (!results || results.length === 0) {
    console.log('OKAZ SW: eBay auto 0 résultats, on laisse checkAndParse retenter');
    return;
  }

  if (senderTabId && pendingEbayResolvers.has(senderTabId)) {
    const resolver = pendingEbayResolvers.get(senderTabId);
    console.log('OKAZ SW: Résolution eBay pour tab', senderTabId);
    resolver(results);
  } else {
    chrome.tabs.query({ url: '*://www.ebay.fr/*' }, (tabs) => {
      tabs.forEach(tab => {
        const resolver = pendingEbayResolvers.get(tab.id);
        if (resolver) {
          console.log('OKAZ SW: Résolution eBay fallback pour tab', tab.id);
          resolver(results);
        }
      });
    });
  }
}

console.log('OKAZ Service Worker v0.5.0 chargé - LBC + Vinted + Back Market + Amazon + eBay');

// OKAZ Service Worker - Background Script v0.3.9
// Orchestre les recherches sur les différents sites (LeBonCoin, Vinted, Back Market)

// Importer le module de gestion des quotas
importScripts('../lib/quota.js');

let pendingSearches = new Map();
let searchResults = new Map();
let pendingResolvers = new Map();
let pendingVintedResolvers = new Map();
let pendingBackMarketResolvers = new Map();

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
      sendResponse({ success: true, version: '0.4.0' });
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
  const sitesToSearch = criteria?.sites || ['leboncoin', 'vinted', 'backmarket'];
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

    const results = await Promise.all(searchPromises);
    const [lbcResults, vintedResults, bmResults] = results;

    console.log(`OKAZ SW: LeBonCoin=${lbcResults.length}, Vinted=${vintedResults.length}, BackMarket=${bmResults.length}`);

    // Combiner et trier par score
    const allResults = [...lbcResults, ...vintedResults, ...bmResults].sort((a, b) => b.score - a.score);

    console.log(`OKAZ SW: ${allResults.length} résultats totaux combinés`);

    const completedSites = [];
    if (lbcResults.length > 0) completedSites.push('leboncoin');
    if (vintedResults.length > 0) completedSites.push('vinted');
    if (bmResults.length > 0) completedSites.push('backmarket');

    sendResponse({
      success: true,
      results: allResults,
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
  if (criteria?.shippable) {
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

console.log('OKAZ Service Worker v0.4.0 chargé - Sélection intelligente des sites par catégorie');

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

  switch (request.type) {
    case 'SEARCH':
      handleSearch(request.query, sendResponse);
      return true; // Réponse asynchrone

    case 'LEBONCOIN_RESULTS':
      console.log('OKAZ SW: Résultats LeBonCoin auto reçus:', request.results?.length);
      handleLeBonCoinResults(request.results, request.url);
      break;

    case 'VINTED_RESULTS':
      console.log('OKAZ SW: Résultats Vinted auto reçus:', request.results?.length);
      handleVintedResults(request.results, request.url);
      break;

    case 'BACKMARKET_RESULTS':
      console.log('OKAZ SW: Résultats Back Market auto reçus:', request.results?.length);
      handleBackMarketResults(request.results, request.url);
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

    if (sitesToSearch.includes('leboncoin')) {
      searchPromises.push(
        searchLeBonCoin(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur LeBonCoin:', err.message);
          return [];
        })
      );
    } else {
      searchPromises.push(Promise.resolve([]));
    }

    if (sitesToSearch.includes('vinted')) {
      searchPromises.push(
        searchVinted(query, criteria).catch(err => {
          console.error('OKAZ SW: Erreur Vinted:', err.message);
          return [];
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
function buildLeBonCoinUrl(query, criteria) {
  const params = new URLSearchParams();

  // Utiliser les keywords optimisés si disponibles, sinon la query brute
  const keywords = criteria?.keywords || query;
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

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

async function searchLeBonCoin(query, criteria) {
  const searchUrl = buildLeBonCoinUrl(query, criteria);
  console.log('OKAZ SW: Ouverture LeBonCoin...', searchUrl);

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

      // Timeout de sécurité (30s pour laisser le temps au parsing)
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
            await new Promise(r => setTimeout(r, 4000));

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

      // Commencer à vérifier après 2s
      setTimeout(() => checkAndParse(), 2000);

    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function handleLeBonCoinResults(results, url) {
  console.log('OKAZ SW: Traitement résultats LBC auto:', results?.length);
  searchResults.set('leboncoin', results || []);

  // Trouver le tab correspondant et résoudre
  chrome.tabs.query({ url: '*://www.leboncoin.fr/recherche*' }, (tabs) => {
    tabs.forEach(tab => {
      const resolver = pendingResolvers.get(tab.id);
      if (resolver) {
        console.log('OKAZ SW: Résolution LBC pour tab', tab.id);
        resolver(results || []);
      }
    });
  });
}

// ============ VINTED ============

// Construire l'URL Vinted à partir des critères
function buildVintedUrl(query, criteria) {
  const params = new URLSearchParams();

  // Utiliser les keywords optimisés si disponibles
  const keywords = criteria?.keywords || query;
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

function handleVintedResults(results, url) {
  console.log('OKAZ SW: Traitement résultats Vinted auto:', results?.length);
  searchResults.set('vinted', results || []);

  // Trouver le tab correspondant et résoudre
  chrome.tabs.query({ url: '*://www.vinted.fr/*' }, (tabs) => {
    tabs.forEach(tab => {
      const resolver = pendingVintedResolvers.get(tab.id);
      if (resolver) {
        console.log('OKAZ SW: Résolution Vinted pour tab', tab.id);
        resolver(results || []);
      }
    });
  });
}

// ============ BACK MARKET ============

// Construire l'URL Back Market à partir des critères
function buildBackMarketUrl(query, criteria) {
  const params = new URLSearchParams();

  // Utiliser les keywords optimisés si disponibles
  const keywords = criteria?.keywords || query;
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

function handleBackMarketResults(results, url) {
  console.log('OKAZ SW: Traitement résultats Back Market auto:', results?.length);
  searchResults.set('backmarket', results || []);

  // Trouver le tab correspondant et résoudre
  chrome.tabs.query({ url: '*://www.backmarket.fr/*' }, (tabs) => {
    tabs.forEach(tab => {
      const resolver = pendingBackMarketResolvers.get(tab.id);
      if (resolver) {
        console.log('OKAZ SW: Résolution Back Market pour tab', tab.id);
        resolver(results || []);
      }
    });
  });
}

console.log('OKAZ Service Worker v0.4.0 chargé - Sélection intelligente des sites par catégorie');

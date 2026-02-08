// OKAZ Extension - Gestion Quota et Identification
// Gère UUID, quota local, sync serveur, et statut premium

// API_BASE dynamique — mis à jour par le service worker quand le site se connecte
// En prod (Chrome Web Store) → okaz-ia.fr, en dev → origin du site (localhost:3000 ou 3001, etc.)
let API_BASE = (() => {
  try {
    if (chrome.runtime.getManifest().update_url) {
      return 'https://okaz-ia.fr/api';
    }
  } catch (e) {}
  return 'http://localhost:3000/api';
})();

// Mettre à jour l'API_BASE depuis l'origin du site (appelé par le service worker)
function setApiBaseFromOrigin(origin) {
  if (origin && origin.startsWith('http')) {
    API_BASE = origin + '/api';
    console.log('[OKAZ Quota] API_BASE mis à jour:', API_BASE);
  }
}

// Générer un UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Récupérer ou créer l'UUID de l'extension
async function getOrCreateUUID() {
  const result = await chrome.storage.local.get(['okaz_uuid']);

  if (result.okaz_uuid) {
    return result.okaz_uuid;
  }

  const newUUID = generateUUID();
  await chrome.storage.local.set({ okaz_uuid: newUUID });
  console.log('[OKAZ Quota] Nouvel UUID généré:', newUUID.substring(0, 8) + '...');

  return newUUID;
}

// Récupérer le stockage complet
async function getStorage() {
  const result = await chrome.storage.local.get([
    'okaz_uuid',
    'okaz_jwt',
    'okaz_email',
    'okaz_premium_until',
    'okaz_quota_cache',
    'okaz_quota_updated'
  ]);

  return {
    uuid: result.okaz_uuid,
    jwt: result.okaz_jwt,
    email: result.okaz_email,
    premiumUntil: result.okaz_premium_until,
    quotaCache: result.okaz_quota_cache,
    quotaUpdated: result.okaz_quota_updated
  };
}

// Sauvegarder le JWT après connexion
async function saveAuth(jwt, email, premiumUntil) {
  await chrome.storage.local.set({
    okaz_jwt: jwt,
    okaz_email: email,
    okaz_premium_until: premiumUntil
  });
  console.log('[OKAZ Quota] Auth sauvegardée pour:', email);
}

// Supprimer l'auth (déconnexion)
async function clearAuth() {
  await chrome.storage.local.remove([
    'okaz_jwt',
    'okaz_email',
    'okaz_premium_until'
  ]);
  console.log('[OKAZ Quota] Auth effacée');
}

// Vérifier le quota auprès du serveur
async function checkQuotaFromServer(uuid) {
  try {
    const response = await fetch(`${API_BASE}/quota/status?uuid=${uuid}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const quota = await response.json();

    // Mettre en cache
    await chrome.storage.local.set({
      okaz_quota_cache: quota,
      okaz_quota_updated: Date.now()
    });

    return quota;

  } catch (error) {
    console.error('[OKAZ Quota] Erreur sync serveur:', error);

    // Fallback sur le cache
    const storage = await getStorage();
    if (storage.quotaCache) {
      return storage.quotaCache;
    }

    // Fallback par défaut
    return {
      isPremium: false,
      dailyUsed: 0,
      dailyLimit: 5,
      dailyRemaining: 5,
      boostCredits: 0,
      totalRemaining: 5
    };
  }
}

// Consommer une recherche
async function consumeSearch() {
  const uuid = await getOrCreateUUID();

  try {
    const response = await fetch(`${API_BASE}/quota/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // Mettre à jour le cache local
    const storage = await getStorage();
    if (storage.quotaCache) {
      storage.quotaCache.dailyRemaining = result.remaining;
      storage.quotaCache.boostCredits = result.boostRemaining;
      storage.quotaCache.totalRemaining = result.remaining + result.boostRemaining;

      if (result.source === 'premium') {
        storage.quotaCache.isPremium = true;
        storage.quotaCache.totalRemaining = -1;
      }

      await chrome.storage.local.set({
        okaz_quota_cache: storage.quotaCache,
        okaz_quota_updated: Date.now()
      });
    }

    return result;

  } catch (error) {
    console.error('[OKAZ Quota] Erreur consume:', error);

    // En cas d'erreur réseau, autoriser quand même (fail-open)
    // Le serveur rattrapera au prochain sync
    return {
      allowed: true,
      source: 'offline',
      remaining: -1,
      boostRemaining: -1
    };
  }
}

// Vérifier si une recherche est autorisée (local + serveur)
async function canSearch() {
  const uuid = await getOrCreateUUID();
  const storage = await getStorage();

  // Si premium avec JWT valide, toujours autorisé
  if (storage.jwt && storage.premiumUntil) {
    if (new Date(storage.premiumUntil) > new Date()) {
      return { allowed: true, reason: 'premium' };
    }
  }

  // Vérifier le cache local d'abord (évite les appels réseau)
  if (storage.quotaCache && storage.quotaUpdated) {
    const cacheAge = Date.now() - storage.quotaUpdated;
    const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes

    if (cacheValid && storage.quotaCache.totalRemaining > 0) {
      return { allowed: true, reason: 'cache' };
    }

    if (cacheValid && storage.quotaCache.totalRemaining === 0) {
      return { allowed: false, reason: 'quota_exhausted' };
    }
  }

  // Sinon, vérifier avec le serveur
  const quota = await checkQuotaFromServer(uuid);

  if (quota.isPremium) {
    return { allowed: true, reason: 'premium' };
  }

  if (quota.totalRemaining > 0) {
    return { allowed: true, reason: 'quota_available' };
  }

  return { allowed: false, reason: 'quota_exhausted' };
}

// Obtenir l'état actuel du quota
async function getQuotaStatus() {
  const uuid = await getOrCreateUUID();
  const storage = await getStorage();

  // Rafraîchir si cache vieux de plus de 1 minute
  if (!storage.quotaUpdated || Date.now() - storage.quotaUpdated > 60 * 1000) {
    return await checkQuotaFromServer(uuid);
  }

  return storage.quotaCache || await checkQuotaFromServer(uuid);
}

// Export des fonctions
if (typeof module !== 'undefined') {
  module.exports = {
    getOrCreateUUID,
    getStorage,
    saveAuth,
    clearAuth,
    checkQuotaFromServer,
    consumeSearch,
    canSearch,
    getQuotaStatus
  };
}

// Exposer globalement pour le service worker
if (typeof self !== 'undefined') {
  self.OkazQuota = {
    getOrCreateUUID,
    getStorage,
    saveAuth,
    clearAuth,
    checkQuotaFromServer,
    consumeSearch,
    canSearch,
    getQuotaStatus,
    setApiBaseFromOrigin
  };
}

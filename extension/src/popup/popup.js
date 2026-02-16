// OKAZ Popup v1.0.0 - Interface épurée avec scoring intelligent + auth email

const authScreen = document.getElementById('authScreen');
const authEmailInput = document.getElementById('authEmailInput');
const authSendBtn = document.getElementById('authSendBtn');
const authMessage = document.getElementById('authMessage');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const homeScreen = document.getElementById('homeScreen');
const resultsScreen = document.getElementById('resultsScreen');
const resultsContent = document.getElementById('resultsContent');
const searchQueryDisplay = document.getElementById('searchQueryDisplay');
const backBtn = document.getElementById('backBtn');

let isSearching = false;
let currentQuery = '';

// === AUTH : vérifier si JWT existe ===
async function checkAuth() {
  try {
    const result = await chrome.storage.local.get(['okaz_jwt']);
    if (result.okaz_jwt) {
      showHomeScreenDirect();
    } else {
      showAuthScreen();
    }
  } catch (e) {
    console.error('Auth check error:', e);
    showAuthScreen();
  }
}

function showAuthScreen() {
  authScreen.style.display = 'flex';
  homeScreen.style.display = 'none';
  resultsScreen.style.display = 'none';
  authEmailInput.focus();
}

function showHomeScreenDirect() {
  authScreen.style.display = 'none';
  homeScreen.style.display = 'flex';
  resultsScreen.style.display = 'none';
  searchInput.focus();
}

function showAuthMessage(text, type) {
  authMessage.style.display = 'block';
  authMessage.className = 'auth-message ' + type;
  authMessage.textContent = text;
}

// Envoyer magic link
async function handleAuthSend() {
  const email = authEmailInput.value.trim();
  if (!email || !email.includes('@')) {
    showAuthMessage('Entre une adresse email valide', 'error');
    return;
  }

  authSendBtn.disabled = true;
  authSendBtn.textContent = 'Envoi en cours...';
  authMessage.style.display = 'none';

  try {
    // Détecter l'API base (prod ou dev)
    let apiBase = 'https://okaz-ia.fr/api';
    try {
      if (!chrome.runtime.getManifest().update_url) {
        apiBase = 'http://localhost:3000/api';
      }
    } catch (e) {}

    const response = await fetch(`${apiBase}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok && data.sent) {
      showAuthMessage('Email envoye ! Clique sur le lien dans ton email pour te connecter.', 'success');
    } else {
      showAuthMessage(data.error || 'Erreur lors de l\'envoi', 'error');
    }
  } catch (error) {
    console.error('Auth send error:', error);
    showAuthMessage('Erreur de connexion au serveur', 'error');
  }

  authSendBtn.disabled = false;
  authSendBtn.textContent = 'Recevoir mon lien de connexion';
}

// Écouter les changements de storage (retour auth depuis le site)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.okaz_jwt && changes.okaz_jwt.newValue) {
    console.log('OKAZ Popup: JWT détecté, passage à l\'écran de recherche');
    showHomeScreenDirect();
  }
});

// Events auth
authSendBtn.addEventListener('click', handleAuthSend);
authEmailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleAuthSend();
});

// Events search
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
backBtn.addEventListener('click', showHomeScreen);

// Examples clicks
document.querySelectorAll('.example').forEach(el => {
  el.addEventListener('click', () => {
    searchInput.value = el.dataset.query;
    handleSearch();
  });
});

// Lancer la vérification auth au chargement
checkAuth();

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query || isSearching) return;

  currentQuery = query;
  isSearching = true;
  searchBtn.disabled = true;

  showResultsScreen();
  showLoading(query);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH',
      query: query
    });

    if (response && response.success) {
      const analyzedResults = analyzeResults(response.results, query);
      displayResults(analyzedResults, query);
    } else if (response?.error === 'auth_required') {
      showAuthScreen();
    } else {
      showError(response?.error || 'Erreur de recherche');
    }
  } catch (error) {
    console.error('Search error:', error);
    showError('Erreur de connexion');
  }

  isSearching = false;
  searchBtn.disabled = false;
}

function showHomeScreen() {
  homeScreen.style.display = 'flex';
  resultsScreen.style.display = 'none';
  authScreen.style.display = 'none';
  searchInput.focus();
}

function showResultsScreen() {
  homeScreen.style.display = 'none';
  resultsScreen.style.display = 'block';
  authScreen.style.display = 'none';
  searchQueryDisplay.querySelector('strong').textContent = currentQuery;
}

function showLoading(query) {
  resultsContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">Recherche en cours...</div>
      <div class="loading-sub">Analyse des annonces sur LeBonCoin</div>
    </div>
  `;
}

function showError(message) {
  resultsContent.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-text">${escapeHtml(message)}</div>
    </div>
  `;
}

// Analyser et catégoriser les résultats
function analyzeResults(results, query) {
  if (!results || results.length === 0) return { recommended: [], others: [], avoid: [] };

  const queryLower = query.toLowerCase();
  const marketRef = computeMarketReference(results);

  return results.map(result => {
    const analysis = analyzeResult(result, marketRef, queryLower);
    return { ...result, analysis };
  }).reduce((acc, result) => {
    if (result.analysis.category === 'recommended') {
      acc.recommended.push(result);
    } else if (result.analysis.category === 'avoid') {
      acc.avoid.push(result);
    } else {
      acc.others.push(result);
    }
    return acc;
  }, { recommended: [], others: [], avoid: [] });
}

// Calcule les prix de référence à partir des résultats réels (médiane)
function computeMarketReference(results) {
  const prices = results.map(r => r.price).filter(p => p > 0).sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  const avg = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
  return { min: prices[0], avg, max: prices[prices.length - 1] };
}

function analyzeResult(result, marketRef, query) {
  const analysis = {
    category: 'others',
    dealType: 'neutral',
    dealText: 'Prix standard',
    badges: []
  };

  const price = result.price;
  const titleLower = result.title.toLowerCase();

  // Analyse du prix par rapport au marché
  if (marketRef && price > 0) {
    const priceDiff = ((price - marketRef.avg) / marketRef.avg) * 100;

    if (price <= marketRef.min * 0.7) {
      // Prix anormalement bas = suspect
      analysis.category = 'avoid';
      analysis.dealType = 'bad';
      analysis.dealText = `Prix suspect (${Math.abs(Math.round(priceDiff))}% sous le marché)`;
      analysis.badges.push({ type: 'danger', text: 'Prix anormal' });
    } else if (price <= marketRef.avg * 0.85) {
      // Bonne affaire
      analysis.category = 'recommended';
      analysis.dealType = 'good';
      analysis.dealText = `Bonne affaire (${Math.abs(Math.round(priceDiff))}% sous le marché)`;
      analysis.badges.push({ type: 'positive', text: `${Math.abs(Math.round(priceDiff))}% économisé` });
    } else if (price <= marketRef.avg * 1.1) {
      // Prix correct
      analysis.dealType = 'neutral';
      analysis.dealText = 'Prix dans la moyenne';
    } else {
      // Prix élevé
      analysis.dealType = 'neutral';
      analysis.dealText = `Prix élevé (+${Math.round(priceDiff)}%)`;
      analysis.badges.push({ type: 'warning', text: 'Au-dessus du marché' });
    }
  }

  // Red flags
  if (result.redFlags && result.redFlags.length > 0) {
    if (analysis.category !== 'avoid') {
      analysis.category = result.redFlags.length >= 2 ? 'avoid' : 'others';
    }
    result.redFlags.forEach(flag => {
      analysis.badges.push({ type: 'danger', text: flag });
    });
  }

  // Bonus pour mots-clés positifs
  if (titleLower.includes('facture') || titleLower.includes('garantie')) {
    analysis.badges.push({ type: 'positive', text: 'Facture/Garantie' });
    if (analysis.category === 'others' && analysis.dealType !== 'bad') {
      analysis.category = 'recommended';
    }
  }

  if (titleLower.includes('comme neuf') || titleLower.includes('excellent état')) {
    analysis.badges.push({ type: 'positive', text: 'Excellent état' });
  }

  // Si score original élevé et pas de red flags -> recommended
  if (result.score >= 85 && analysis.category === 'others' && result.redFlags?.length === 0) {
    analysis.category = 'recommended';
  }

  return analysis;
}

function displayResults(categorized, query) {
  const { recommended, others, avoid } = categorized;
  const total = recommended.length + others.length + avoid.length;

  if (total === 0) {
    resultsContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <div class="empty-text">Aucun résultat trouvé pour "${escapeHtml(query)}"</div>
      </div>
    `;
    return;
  }

  let html = '';

  // Section Recommandé
  if (recommended.length > 0) {
    html += `
      <div class="results-section">
        <div class="section-title recommended">
          <span>🎯</span> Recommandé pour vous
          <span class="section-count">(${recommended.length})</span>
        </div>
        <div class="results-list">
          ${recommended.slice(0, 3).map(r => renderCard(r, 'recommended')).join('')}
        </div>
      </div>
    `;
  }

  // Section Autres
  if (others.length > 0) {
    html += `
      <div class="results-section">
        <div class="section-title others">
          Autres résultats
          <span class="section-count">(${others.length})</span>
        </div>
        <div class="results-list">
          ${others.slice(0, 5).map(r => renderCard(r, 'normal')).join('')}
        </div>
      </div>
    `;
  }

  // Section À éviter (collapsed)
  if (avoid.length > 0) {
    html += `
      <div class="avoid-section">
        <button class="avoid-toggle" onclick="toggleAvoid()">
          <span>⚠️</span>
          ${avoid.length} annonce${avoid.length > 1 ? 's' : ''} suspecte${avoid.length > 1 ? 's' : ''}
          <span style="margin-left: auto; opacity: 0.6;">Voir</span>
        </button>
        <div class="avoid-content" id="avoidContent">
          ${avoid.map(r => renderCard(r, 'avoid')).join('')}
        </div>
      </div>
    `;
  }

  resultsContent.innerHTML = html;

  // Ajouter les event listeners pour les cartes
  document.querySelectorAll('.result-card[data-url]').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
  });
}

function renderCard(result, type) {
  const analysis = result.analysis || {};
  const cardClass = type === 'recommended' ? 'recommended' : (type === 'avoid' ? 'avoid' : '');
  const siteClass = result.site.toLowerCase().replace(/\s/g, '');

  const dealIndicatorClass = analysis.dealType === 'good' ? 'good' :
                             analysis.dealType === 'bad' ? 'bad' : 'neutral';

  const dealIcon = analysis.dealType === 'good' ? '✓' :
                   analysis.dealType === 'bad' ? '⚠' : '•';

  return `
    <div class="result-card ${cardClass}" data-url="${escapeHtml(result.url)}">
      <div class="card-top">
        ${result.image ?
          `<img class="result-image" src="${escapeHtml(result.image)}" alt="" onerror="this.style.background='linear-gradient(135deg, #6366f1, #8b5cf6)'; this.onerror=null;">` :
          `<div class="result-image" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 24px; color: white;">📦</div>`
        }
        <div class="result-main">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-meta">
            <span class="result-price">${result.price > 0 ? result.price.toLocaleString('fr-FR') + ' €' : 'Prix non indiqué'}</span>
            <span class="result-site site-${siteClass}">${escapeHtml(result.site)}</span>
          </div>
        </div>
      </div>

      <div class="deal-indicator ${dealIndicatorClass}">
        <span class="deal-icon">${dealIcon}</span>
        <span>${escapeHtml(analysis.dealText || 'Analyse en cours')}</span>
      </div>

      ${analysis.badges && analysis.badges.length > 0 ? `
        <div class="trust-badges">
          ${analysis.badges.map(b => `
            <span class="trust-badge ${b.type}">${escapeHtml(b.text)}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Toggle avoid section
window.toggleAvoid = function() {
  const content = document.getElementById('avoidContent');
  content.classList.toggle('open');
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('OKAZ Popup v1.0.0 loaded');

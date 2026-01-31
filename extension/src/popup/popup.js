// OKAZ Popup v0.3.0 - Interface épurée avec scoring intelligent

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const homeScreen = document.getElementById('homeScreen');
const resultsScreen = document.getElementById('resultsScreen');
const resultsContent = document.getElementById('resultsContent');
const searchQueryDisplay = document.getElementById('searchQueryDisplay');
const backBtn = document.getElementById('backBtn');

let isSearching = false;
let currentQuery = '';

// Prix moyens de référence (à améliorer avec des données réelles)
const MARKET_PRICES = {
  'iphone 13': { min: 350, avg: 450, max: 550 },
  'iphone 14': { min: 500, avg: 650, max: 800 },
  'iphone 15': { min: 700, avg: 850, max: 1000 },
  'macbook pro': { min: 800, avg: 1200, max: 1800 },
  'macbook air': { min: 600, avg: 900, max: 1200 },
  'ps5': { min: 350, avg: 420, max: 500 },
  'nintendo switch': { min: 180, avg: 250, max: 320 }
};

// Events
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

// Focus auto
searchInput.focus();

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
  searchInput.focus();
}

function showResultsScreen() {
  homeScreen.style.display = 'none';
  resultsScreen.style.display = 'block';
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
  const marketRef = findMarketReference(queryLower);

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

function findMarketReference(query) {
  for (const [key, value] of Object.entries(MARKET_PRICES)) {
    if (query.includes(key)) {
      return value;
    }
  }
  return null;
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

console.log('OKAZ Popup v0.3.0 loaded');

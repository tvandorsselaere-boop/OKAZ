// OKAZ Content Script - eBay.fr Parser v0.7.0
// Multi-stratégie : DOM → Shadow DOM → HTML brut regex → JSON embarqué

(function() {
  console.log('OKAZ: eBay parser v0.7.0 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Accepter le consentement GDPR si présent
  function acceptConsent() {
    const selectors = [
      '#gdpr-banner-accept', 'button#consent-page-btn-accept',
      '[data-testid="gdpr-banner-accept"]', 'button.gdpr-banner__accept',
      '#consent_prompt_submit', 'button[id*="accept"]',
      'button[name="accept"]', '#accept'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return true; }
    }
    const btns = document.querySelectorAll('button, [role="button"], input[type="submit"]');
    for (const btn of btns) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('accepter') || text.includes('accept') || text.includes('agree')) {
        btn.click(); return true;
      }
    }
    return false;
  }

  acceptConsent();
  setTimeout(acceptConsent, 500);
  setTimeout(acceptConsent, 1500);

  // Helper : extraire prix depuis texte (supporte EUR et €)
  function extractPrice(text) {
    const m = (text || '').match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
    if (m) {
      const v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (v > 0 && v < 50000) return Math.round(v);
    }
    return 0;
  }

  // Helper : chercher liens /itm/ récursivement dans le Shadow DOM
  function findLinksInShadow(root) {
    const found = [];
    const links = root.querySelectorAll('a[href*="/itm/"]');
    found.push(...links);
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) {
        found.push(...findLinksInShadow(el.shadowRoot));
      }
    });
    return found;
  }

  // Parser multi-stratégie
  async function parseResults(maxResults = 10) {
    const results = [];
    const seenIds = new Set();

    // ===== STRATÉGIE 1 : DOM classique + Shadow DOM =====
    let links = document.querySelectorAll('a[href*="/itm/"]');
    if (links.length === 0) {
      links = findLinksInShadow(document);
      if (links.length > 0) console.log(`OKAZ EBAY: ${links.length} liens via Shadow DOM`);
    }

    if (links.length > 0) {
      console.log(`OKAZ EBAY: ${links.length} liens /itm/ trouvés (DOM)`);
      for (const link of links) {
        if (results.length >= maxResults) break;
        try {
          let url = link.href || '';
          if (!url.includes('/itm/')) continue;
          const itemIdMatch = url.match(/\/itm\/(\d+)/);
          const itemId = itemIdMatch ? itemIdMatch[1] : url;
          if (seenIds.has(itemId)) continue;
          seenIds.add(itemId);
          try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}

          let title = link.title || '';
          if (!title) {
            const h = link.querySelector('span[role="heading"], h3, span');
            title = h?.textContent?.trim() || link.textContent?.trim() || '';
          }
          title = title.replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '').replace(/^Sponsorisé\s*/i, '').substring(0, 100);
          if (!title || title.length < 5) continue;

          let container = link.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!container) break;
            if ((container.textContent || '').match(/[\d,.]+\s*(?:EUR|€)/) && (container.textContent || '').length > 50) break;
            container = container.parentElement;
          }
          if (!container) container = link.parentElement?.parentElement?.parentElement || link.parentElement;

          const price = extractPrice(container?.textContent || '');
          if (price === 0) continue;

          let image = null;
          const imgEl = container?.querySelector('img[src*="ebayimg"]') || container?.querySelector('img:not([src*="ebaystatic"])');
          if (imgEl) {
            image = imgEl.src || imgEl.dataset?.src || null;
            if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank'))) image = null;
          }

          results.push({
            id: `ebay-${results.length}-${Date.now()}`,
            title, price, site: 'eBay', siteColor: '#E53238',
            image, url, location: '',
            handDelivery: false, hasShipping: true, hasWarranty: false,
            score: 70, redFlags: []
          });
        } catch (e) {}
      }
    }

    // ===== STRATÉGIE 2 : HTML brut regex =====
    if (results.length === 0) {
      console.log('OKAZ EBAY: DOM vide, extraction HTML brut...');
      const html = document.documentElement.outerHTML;
      const itmCount = (html.match(/\/itm\//g) || []).length;
      let shadowCount = 0;
      document.querySelectorAll('*').forEach(el => { if (el.shadowRoot) shadowCount++; });
      console.log(`OKAZ EBAY DIAG: HTML=${(html.length/1024).toFixed(0)}KB, /itm/=${itmCount}, <a>=${document.querySelectorAll('a').length}, shadows=${shadowCount}`);

      if (itmCount > 0) {
        const itemRegex = /\/itm\/(\d{10,15})/g;
        let match;
        const itemIds = [];
        while ((match = itemRegex.exec(html)) !== null) {
          if (!seenIds.has(match[1])) {
            seenIds.add(match[1]);
            itemIds.push({ id: match[1], pos: match.index });
          }
        }

        for (const item of itemIds.slice(0, maxResults)) {
          const start = Math.max(0, item.pos - 1000);
          const end = Math.min(html.length, item.pos + 1000);
          const ctx = html.substring(start, end);

          let title = '';
          const titlePatterns = [
            /title="([^"]{10,120})"/,
            /aria-label="([^"]{10,120})"/,
            /alt="([^"]{10,120})"/,
            /role="heading"[^>]*>([^<]{10,120})</,
            /<span[^>]*>([^<]{15,120})<\/span>/
          ];
          for (const pat of titlePatterns) {
            const tm = ctx.match(pat);
            if (tm && !tm[1].includes('<') && !tm[1].includes('http')) {
              title = tm[1].trim();
              break;
            }
          }
          if (!title) continue;
          title = title.replace(/^(Neuf|D&#39;occasion|D'occasion|Nouveau)\s*[–-]\s*/i, '')
                       .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                       .substring(0, 100);
          if (title.length < 5) continue;

          const price = extractPrice(ctx);
          if (price === 0) continue;

          let image = null;
          const imgMatch = ctx.match(/src="(https?:\/\/i\.ebayimg\.com\/[^"]+)"/);
          if (imgMatch) image = imgMatch[1];

          results.push({
            id: `ebay-${results.length}-${Date.now()}`,
            title, price, site: 'eBay', siteColor: '#E53238',
            image, url: `https://www.ebay.fr/itm/${item.id}`,
            location: '',
            handDelivery: false, hasShipping: true, hasWarranty: false,
            score: 70, redFlags: []
          });
        }
        console.log(`OKAZ EBAY: ${results.length} résultats via HTML brut`);
      }
    }

    console.log(`OKAZ EBAY: TOTAL ${results.length} résultats`);
    return results;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ EBAY: PARSE_PAGE reçue');

      (async () => {
        // Scroll pour lazy loading
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults(request.maxResults || 10);
        sendResponse({ success: true, results });
      })().catch(error => {
        console.error('OKAZ EBAY: Erreur PARSE_PAGE', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Auto-parse si page de recherche
  if (window.location.href.includes('/sch/')) {
    console.log('OKAZ EBAY: Page de recherche détectée, auto-parse dans 3s...');

    setTimeout(async () => {
      try {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 400));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 800));

        const results = await parseResults();
        console.log('OKAZ EBAY AUTO:', results.length, 'résultats');

        if (results.length > 0) {
          chrome.runtime.sendMessage({
            type: 'EBAY_RESULTS',
            results,
            url: window.location.href
          });
        } else {
          console.log('OKAZ EBAY AUTO: 0 résultats, le SW retentera');
        }
      } catch (error) {
        console.error('OKAZ EBAY AUTO: Erreur', error);
      }
    }, 3000);
  }

})();

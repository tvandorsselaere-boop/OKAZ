// OKAZ Content Script - eBay.fr Parser v0.8.0
// Stratégies: s-card DOM → liens /itm/ → HTML regex → JSON embarqué

(function() {
  console.log('OKAZ: eBay parser v0.8.0 chargé');

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

  function extractPrice(text) {
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

  async function parseResults(maxResults = 10) {
    const results = [];
    const seenUrls = new Set();

    function addResult(title, price, url, image) {
      results.push({
        id: `ebay-${results.length}-${Date.now()}`,
        title: title.substring(0, 100), price, site: 'eBay', siteColor: '#E53238',
        image, url, location: '',
        handDelivery: false, hasShipping: true, hasWarranty: false,
        score: 70, redFlags: []
      });
    }

    // ===== STRATÉGIE 1 : s-card DOM (eBay 2025) =====
    const cards = document.querySelectorAll('.s-card');

    if (cards.length > 0) {
      for (const card of cards) {
        if (results.length >= maxResults) break;
        try {
          const link = card.querySelector('a.s-card__link, a[href*="/itm/"], a[href*="ebay"]');
          if (!link) continue;
          let url = link.href || '';
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);

          let title = '';
          const titleEl = card.querySelector('[class*="title"], [role="heading"], h3, .s-card__title');
          if (titleEl) title = titleEl.textContent?.trim() || '';
          if (!title) title = link.textContent?.trim() || '';
          if (!title) title = link.title || '';
          title = title.replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '').replace(/^Sponsorisé\s*/i, '').trim();
          if (!title || title.length < 5) continue;

          const price = extractPrice(card.textContent || '');
          if (price === 0) continue;

          let image = null;
          const imgEl = card.querySelector('img[src*="ebayimg"], img[src*="ebay"]');
          if (imgEl) {
            image = imgEl.src || imgEl.dataset?.src || null;
            if (image && (image.includes('placeholder') || image.includes('data:image'))) image = null;
          }

          if (!url.includes('ebay.fr') && url.includes('ebay.com')) url = url.replace('ebay.com', 'ebay.fr');
          try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}

          addResult(title, price, url, image);
        } catch (e) {}
      }
    }

    // ===== STRATÉGIE 2 : Liens /itm/ dans le DOM =====
    if (results.length === 0) {
      let links = document.querySelectorAll('a[href*="/itm/"]');
      if (links.length === 0) {
        const allLinks = document.querySelectorAll('a');
        const itmLinks = [];
        allLinks.forEach(a => {
          const href = a.href || a.getAttribute('href') || '';
          if (href.includes('/itm/')) itmLinks.push(a);
        });
        links = itmLinks;
      }

      for (const link of links) {
        if (results.length >= maxResults) break;
        try {
          let url = link.href || link.getAttribute('href') || '';
          if (!url.includes('/itm/')) continue;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);

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

          addResult(title, price, url, image);
        } catch (e) {}
      }
    }
    return results;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {

      (async () => {
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

    setTimeout(async () => {
      try {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 400));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 800));

        const results = await parseResults();

        if (results.length > 0) {
          chrome.runtime.sendMessage({
            type: 'EBAY_RESULTS',
            results,
            url: window.location.href
          });
        }
      } catch (error) {
        console.error('OKAZ EBAY AUTO: Erreur', error);
      }
    }, 3000);
  }

})();

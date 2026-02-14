// OKAZ Content Script - eBay.fr Parser v0.6.0
// Nouveau DOM eBay (2025) : plus de .s-item, utilise a[href*="/itm/"] + conteneur parent

(function() {
  console.log('OKAZ: eBay parser v0.6.0 chargé');
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

  // Attendre les liens /itm/ (= résultats chargés)
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (attempts <= 3) acceptConsent();

        const links = document.querySelectorAll('a[href*="/itm/"]');
        if (links.length > 0) {
          console.log(`OKAZ EBAY: ${links.length} liens /itm/ trouvés (tentative ${attempts})`);
          resolve(links);
          return;
        }

        if (attempts < 30) {
          setTimeout(check, 500);
        } else {
          console.log('OKAZ EBAY: Timeout, 0 liens /itm/');
          resolve([]);
        }
      };
      check();
    });
  }

  // Trouver le conteneur d'un lien /itm/ (remonter le DOM)
  function findItemContainer(link) {
    let el = link.parentElement;
    // Remonter max 6 niveaux pour trouver un conteneur avec prix
    for (let i = 0; i < 6; i++) {
      if (!el) break;
      const text = el.textContent || '';
      // Un bon conteneur a le prix EUR/€ et du texte substantiel
      if (text.match(/[\d,.]+\s*(?:EUR|€)/) && text.length > 50) {
        return el;
      }
      el = el.parentElement;
    }
    // Fallback: remonter 3 niveaux
    return link.parentElement?.parentElement?.parentElement || link.parentElement;
  }

  // Extraire le prix d'un texte
  function extractPrice(text) {
    // Prendre le PREMIER prix trouvé (prix principal, pas le "à X EUR" des enchères)
    // Supporte EUR et € (eBay peut utiliser l'un ou l'autre)
    const match = text.match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
    if (match) {
      const v = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
      if (v > 0 && v < 50000) return Math.round(v);
    }
    return 0;
  }

  // Parser les résultats
  async function parseResults(maxResults = 10) {
    const links = await waitForResults();
    const results = [];
    const seenUrls = new Set();

    for (const link of links) {
      if (results.length >= maxResults) break;

      try {
        let url = link.href || '';
        if (!url.includes('/itm/')) continue;
        // Nettoyer l'URL (enlever les query params)
        try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        // Titre : texte du lien ou attribut title
        let title = link.title || '';
        if (!title) {
          // Chercher un span/heading dans le lien
          const heading = link.querySelector('span[role="heading"], h3, span');
          title = heading?.textContent?.trim() || link.textContent?.trim() || '';
        }
        title = title
          .replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '')
          .replace(/^Sponsorisé\s*/i, '')
          .substring(0, 100);

        if (!title || title.length < 5) continue;

        // Trouver le conteneur parent pour prix et image
        const container = findItemContainer(link);

        // Prix
        const price = extractPrice(container?.textContent || '');

        // Image
        let image = null;
        const imgEl = container?.querySelector('img[src*="ebayimg"]') ||
                      container?.querySelector('img[src*="i.ebayimg"]') ||
                      container?.querySelector('img:not([src*="ebaystatic"])');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset?.src || null;
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank') || image.includes('ebaystatic.com/cr/v/c1'))) {
            image = null;
          }
        }

        // Filtrer les résultats sponsorisés/promos sans prix
        if (price === 0) continue;

        results.push({
          id: `ebay-${results.length}-${Date.now()}`,
          title,
          price, site: 'eBay', siteColor: '#E53238',
          image, url, location: '',
          handDelivery: false, hasShipping: true, hasWarranty: false,
          score: 70, redFlags: []
        });
      } catch (e) {
        console.error('OKAZ EBAY: Erreur parsing item', e);
      }
    }

    console.log(`OKAZ EBAY: ${results.length} résultats parsés sur ${seenUrls.size} URLs uniques`);
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
    console.log('OKAZ EBAY: Page de recherche détectée, auto-parse dans 4s...');

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
    }, 4000);
  }

})();

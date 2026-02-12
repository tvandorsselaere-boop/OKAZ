// OKAZ Content Script - eBay.fr Parser v0.5.2
// S'exécute automatiquement sur les pages de recherche eBay France

(function() {
  console.log('OKAZ: eBay parser v0.5.2 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Détecter si on est sur une page de consentement
  const isConsentPage = window.location.href.includes('consent') ||
    !!document.querySelector('#consent_prompt, .consent-page, #gdpr-banner');

  // Accepter le consentement GDPR si présent
  function acceptConsent() {
    const consentSelectors = [
      '#gdpr-banner-accept',
      'button#consent-page-btn-accept',
      '[data-testid="gdpr-banner-accept"]',
      'button.gdpr-banner__accept',
      '#consent_prompt_submit',
      'button[id*="accept"]',
      'button[data-testid*="accept"]',
      // Boutons génériques "Accepter"
      'button[name="accept"]',
      '#accept'
    ];
    for (const sel of consentSelectors) {
      const el = document.querySelector(sel);
      if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A')) {
        console.log('OKAZ EBAY: Consentement accepté via', sel);
        el.click();
        return true;
      }
    }
    // Fallback: chercher tout bouton contenant "accept" dans le texte
    const allButtons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('accepter') || text.includes('accept') || text.includes('agree') || text.includes('consent')) {
        console.log('OKAZ EBAY: Consentement accepté via bouton texte:', text.trim().substring(0, 30));
        btn.click();
        return true;
      }
    }
    return false;
  }

  // Essayer d'accepter le consentement
  acceptConsent();
  setTimeout(acceptConsent, 500);
  setTimeout(acceptConsent, 1500);
  setTimeout(acceptConsent, 3000);

  // Attendre que les résultats soient chargés
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20;

      const check = () => {
        attempts++;

        if (attempts <= 3) acceptConsent();

        const selectorsList = [
          'li.s-item',
          'div.s-item',
          '.srp-results .s-item',
          'ul.srp-results > li',
          'a[href*="/itm/"]'
        ];

        for (const selector of selectorsList) {
          const products = document.querySelectorAll(selector);
          const filtered = [...products].filter(el => {
            const text = el.textContent || '';
            return text.length > 20 &&
              !text.includes('Shop on eBay') &&
              !text.includes('VOUS AIMEREZ');
          });
          if (filtered.length > 0) {
            console.log(`OKAZ EBAY: ${filtered.length} produits via "${selector}"`);
            resolve({ products: filtered, selector });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          console.log('OKAZ EBAY: Timeout, 0 produits trouvés');
          // Debug info
          console.log('OKAZ EBAY DEBUG:', {
            url: location.href,
            title: document.title,
            bodyLen: document.body?.innerHTML?.length || 0,
            sItems: document.querySelectorAll('.s-item').length,
            itmLinks: document.querySelectorAll('a[href*="/itm/"]').length,
          });
          resolve({ products: [], selector: 'none' });
        }
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults(maxResults = 10) {
    const { products: productElements, selector } = await waitForResults();
    const results = [];
    const seenUrls = new Set();

    productElements.forEach((product, index) => {
      if (index >= maxResults) return;

      try {
        const link = product.tagName === 'A' ? product :
          (product.querySelector('a.s-item__link') || product.querySelector('a[href*="/itm/"]'));
        let url = link?.href || '';

        if (url) {
          try { const u = new URL(url); url = `${u.origin}${u.pathname}`; } catch {}
        }

        if (!url || !url.includes('/itm/') || seenUrls.has(url)) return;
        seenUrls.add(url);

        let title = '';
        const titleEl = product.querySelector('.s-item__title span[role="heading"]') ||
                        product.querySelector('.s-item__title span:not(.LIGHT_HIGHLIGHT)') ||
                        product.querySelector('.s-item__title') ||
                        product.querySelector('h3');
        if (titleEl?.textContent?.trim()) {
          title = titleEl.textContent.trim()
            .replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '')
            .replace(/^Sponsorisé\s*/i, '');
        }
        if (!title && link) title = link.title || link.textContent?.trim()?.substring(0, 80) || '';

        let price = 0;
        const priceEl = product.querySelector('.s-item__price');
        const priceText = priceEl?.textContent?.trim() || '';
        const priceMatch = priceText.match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
        if (priceMatch) {
          const v = parseFloat(priceMatch[1].replace(/\s/g, '').replace(',', '.'));
          if (v > 0 && v < 50000) price = Math.round(v);
        }
        if (price === 0) {
          const m2 = product.textContent.match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
          if (m2) {
            const v = parseFloat(m2[1].replace(/\s/g, '').replace(',', '.'));
            if (v > 0 && v < 50000) price = Math.round(v);
          }
        }

        let image = null;
        const imgEl = product.querySelector('.s-item__image-wrapper img') ||
                      product.querySelector('.s-item__image img') ||
                      product.querySelector('img[src*="ebayimg"]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset?.src;
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank') || image.includes('ebaystatic.com/cr/v/c1'))) {
            image = null;
          }
        }

        if (title && url) {
          results.push({
            id: `ebay-${index}-${Date.now()}`,
            title: title.substring(0, 80),
            price, site: 'eBay', siteColor: '#E53238',
            image, url, location: '',
            handDelivery: false, hasShipping: true, hasWarranty: false,
            score: 70, redFlags: []
          });
        }
      } catch (e) {
        console.error('OKAZ EBAY: Erreur parsing', index, e);
      }
    });

    console.log(`OKAZ EBAY: ${results.length} résultats parsés`);
    return results;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ EBAY: PARSE_PAGE reçue');
      const maxResults = request.maxResults || 10;

      (async () => {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults(maxResults);
        console.log('OKAZ EBAY: Réponse PARSE_PAGE:', results.length, 'résultats');
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
    console.log('OKAZ EBAY: Page de recherche détectée, auto-parse dans 2.5s...');

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
        chrome.runtime.sendMessage({
          type: 'EBAY_RESULTS',
          results,
          url: window.location.href
        });
      } catch (error) {
        console.error('OKAZ EBAY AUTO: Erreur', error);
        chrome.runtime.sendMessage({
          type: 'EBAY_RESULTS',
          results: [],
          url: window.location.href
        });
      }
    }, 2500);
  }

})();

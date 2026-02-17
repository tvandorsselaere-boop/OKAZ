// OKAZ Content Script - Amazon.fr Parser v0.5.0
// S'exécute automatiquement sur les pages de recherche Amazon.fr

(function() {
  console.log('OKAZ: Amazon parser v0.5.0 chargé');

  // Détection CAPTCHA Amazon
  function isCaptchaPage() {
    if (document.getElementById('captchacharacters')) return true;
    if (document.title.toLowerCase().includes('robot check')) return true;
    if (document.querySelector('form[action="/errors/validateCaptcha"]')) return true;
    return false;
  }

  // Attendre que les résultats soient chargés
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 25;

      const check = () => {
        attempts++;

        // Détection CAPTCHA
        if (isCaptchaPage()) {
          console.warn('OKAZ AMAZON: CAPTCHA détecté, abandon');
          resolve({ products: [], selector: 'captcha' });
          return;
        }

        // Sélecteurs Amazon search results
        const selectorsList = [
          '[data-component-type="s-search-result"]',
          'div.s-result-item[data-asin]',
          'div[data-asin][data-index]',
          'div.sg-col-inner .s-result-item',
          'a[href*="/dp/"]'
        ];

        for (const selector of selectorsList) {
          const products = document.querySelectorAll(selector);
          // Filtrer les éléments sans ASIN (pubs, conteneurs vides)
          const valid = [...products].filter(el => {
            const asin = el.getAttribute('data-asin');
            return asin && asin.length > 0;
          });
          if (valid.length > 0) {
            resolve({ products: valid, selector });
            return;
          }
        }

        // Fallback: liens /dp/ si aucun sélecteur structuré ne marche
        if (attempts >= maxAttempts) {
          const dpLinks = document.querySelectorAll('a[href*="/dp/"]');
          console.warn('OKAZ AMAZON: Timeout, fallback liens /dp/:', dpLinks.length);
          resolve({ products: dpLinks, selector: 'fallback-dp' });
          return;
        }

        setTimeout(check, 400);
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults(maxResults = 20) {
    const { products: productElements, selector } = await waitForResults();
    const results = [];
    const seenAsins = new Set();

    if (selector === 'captcha') {
      return [];
    }

    for (let index = 0; index < productElements.length; index++) {
      if (results.length >= maxResults) break;

      const product = productElements[index];

      try {
        // Filtrer les résultats sponsorisés
        if (product.querySelector('[data-component-type="sp-sponsored-result"]')) continue;
        const sponsoredText = product.querySelector('.puis-label-popover-default, .s-label-popover-default');
        if (sponsoredText && sponsoredText.textContent && sponsoredText.textContent.toLowerCase().includes('sponsorisé')) continue;
        // Autre indicateur de sponsoring
        if (product.querySelector('.a-row .a-color-secondary')?.textContent?.toLowerCase().includes('sponsorisé')) continue;

        // Extraire l'ASIN
        const asin = product.getAttribute('data-asin');
        if (!asin || asin.length === 0 || seenAsins.has(asin)) continue;
        seenAsins.add(asin);

        let title = '';
        let price = 0;
        let image = null;
        let url = '';

        // Extraire le titre
        const titleSelectors = [
          'h2 a span',
          'h2 span',
          '[data-cy="title-recipe"] a span',
          '.a-text-normal',
          'h2'
        ];

        for (const sel of titleSelectors) {
          const el = product.querySelector(sel);
          if (el?.textContent?.trim()) {
            title = el.textContent.trim();
            break;
          }
        }

        // Extraire l'URL
        const linkEl = product.querySelector('h2 a') || product.querySelector('a.a-link-normal[href*="/dp/"]');
        if (linkEl) {
          url = linkEl.href;
          if (url && !url.startsWith('http')) {
            url = 'https://www.amazon.fr' + url;
          }
          // Nettoyer l'URL (retirer les params de tracking Amazon internes)
          try {
            const urlObj = new URL(url);
            // Garder uniquement le path /dp/ASIN
            url = `https://www.amazon.fr/dp/${asin}`;
          } catch (e) {
            // Garder l'URL telle quelle
          }
        } else {
          url = `https://www.amazon.fr/dp/${asin}`;
        }

        // Extraire le prix
        // Amazon utilise .a-price .a-offscreen pour le prix principal
        const priceSelectors = [
          '.a-price:not(.a-text-price) .a-offscreen',
          '.a-price .a-offscreen',
          '[data-cy="price-recipe"] .a-offscreen',
          '.a-color-price',
          '.a-price-whole'
        ];

        for (const sel of priceSelectors) {
          const el = product.querySelector(sel);
          if (el?.textContent) {
            const priceText = el.textContent.trim();
            // Pattern Amazon: "149,99 €" ou "1 079,00 €" ou "149,99€"
            const pricePattern = priceText.match(/([\d\s]+(?:[.,]\d{2})?)\s*€/);
            if (pricePattern) {
              const cleanPrice = pricePattern[1].replace(/\s/g, '').replace(',', '.');
              const extracted = parseFloat(cleanPrice);
              if (extracted > 0 && extracted < 50000) {
                price = Math.round(extracted);
                break;
              }
            }
            // Fallback: juste des chiffres (prix whole + fraction)
            if (sel === '.a-price-whole') {
              const whole = parseInt(el.textContent.replace(/\s/g, ''));
              const fractionEl = product.querySelector('.a-price-fraction');
              const fraction = fractionEl ? parseInt(fractionEl.textContent) / 100 : 0;
              if (whole > 0 && whole < 50000) {
                price = Math.round(whole + fraction);
                break;
              }
            }
          }
        }

        // Extraire l'image
        const imgEl = product.querySelector('img.s-image') || product.querySelector('img[data-image-latency="s-product-image"]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src;
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank'))) {
            image = null;
          }
        }

        // Détecter la condition (neuf vs reconditionné)
        const titleLower = (title || '').toLowerCase();
        const isReconditioned = /reconditionn[eé]|renewed|occasion|refurbished/i.test(title || '');

        if (title && url && price > 0) {
          results.push({
            id: `amz-${asin}-${Date.now()}`,
            title: title.substring(0, 100),
            price: price,
            site: 'Amazon',
            siteColor: '#DAA520',
            image: image,
            url: url,
            location: '',
            handDelivery: false,
            hasShipping: true,
            score: 70, // Score neutre — Gemini recalculera
            redFlags: [],
            asin: asin,
            condition: isReconditioned ? 'reconditioned' : 'new'
          });
        }
      } catch (e) {
        console.error('OKAZ AMAZON: Erreur parsing produit', index, e);
      }
    }

    console.log(`OKAZ AMAZON: ${results.length} résultats parsés avec succès`);
    return results;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      (async () => {
        // Scroll pour déclencher lazy loading
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults(request.maxResults || 20);
        sendResponse({ success: true, results: results });
      })().catch(error => {
        console.error('OKAZ AMAZON: Erreur', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de recherche
  if (window.location.href.includes('/s?') || window.location.href.includes('/s/')) {
    setTimeout(async () => {

      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));

      const results = await parseResults();
      chrome.runtime.sendMessage({
        type: 'AMAZON_RESULTS',
        results: results,
        url: window.location.href
      });
    }, 1500);
  }

})();

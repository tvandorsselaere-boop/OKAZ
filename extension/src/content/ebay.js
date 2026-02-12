// OKAZ Content Script - eBay.fr Parser v0.5.0
// S'exécute automatiquement sur les pages de recherche eBay France

(function() {
  console.log('OKAZ: eBay parser v0.5.0 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Attendre que les résultats soient chargés
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 25;

      const check = () => {
        attempts++;

        if (attempts % 5 === 1) {
          console.log(`OKAZ EBAY: Tentative ${attempts}/${maxAttempts}`);
        }

        // Sélecteurs eBay.fr
        const selectorsList = [
          'div.s-item',
          'li.s-item',
          '[data-testid="srp-river-results"] .s-item',
          '.srp-results .s-item'
        ];

        for (const selector of selectorsList) {
          const products = document.querySelectorAll(selector);
          // eBay inclut souvent un premier élément "vide" (s-item__pl-on-bottom)
          const filtered = [...products].filter(el => {
            const title = el.querySelector('.s-item__title');
            return title && title.textContent && !title.textContent.includes('Shop on eBay') && !title.textContent.includes('Résultats');
          });
          if (filtered.length > 0) {
            console.log(`OKAZ EBAY: ${filtered.length} produits avec "${selector}"`);
            resolve({ products: filtered, selector });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 400);
        } else {
          console.log('OKAZ EBAY: Timeout après', maxAttempts, 'tentatives');
          resolve({ products: [], selector: 'none' });
        }
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults(maxResults = 10) {
    console.log('OKAZ EBAY: Début parsing...');

    const { products: productElements, selector } = await waitForResults();
    const results = [];
    const seenUrls = new Set();

    console.log(`OKAZ EBAY: Parsing de ${productElements.length} éléments (${selector})`);

    productElements.forEach((product, index) => {
      if (index >= maxResults) return;

      try {
        let title = '';
        let price = 0;
        let image = null;
        let url = '';

        // Extraire l'URL
        const link = product.querySelector('a.s-item__link') || product.querySelector('a[href*="/itm/"]');
        url = link?.href || '';

        // Nettoyer l'URL eBay (retirer les tracking params)
        if (url) {
          try {
            const urlObj = new URL(url);
            // Garder seulement le path /itm/...
            url = `${urlObj.origin}${urlObj.pathname}`;
          } catch (e) { /* garder l'URL telle quelle */ }
        }

        // Éviter les doublons
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);

        // Extraire le titre
        const titleEl = product.querySelector('.s-item__title span[role="heading"]') ||
                        product.querySelector('.s-item__title span') ||
                        product.querySelector('.s-item__title');
        if (titleEl?.textContent?.trim()) {
          title = titleEl.textContent.trim();
          // Retirer "Neuf" / "D'occasion" prefix parfois présent
          title = title.replace(/^(Neuf|D'occasion)\s*[–-]\s*/i, '');
        }

        // Extraire le prix - eBay.fr affiche "119,07 EUR" ou "25,00 €"
        const priceEl = product.querySelector('.s-item__price');
        if (priceEl?.textContent) {
          const priceText = priceEl.textContent.trim();
          // Gérer les fourchettes de prix "De 10,00 EUR à 20,00 EUR" → prendre le premier
          // Pattern: "119,07 EUR" ou "25,00 €" ou "1 079,00 EUR"
          const pricePattern = priceText.match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
          if (pricePattern) {
            const cleanPrice = pricePattern[1].replace(/\s/g, '').replace(',', '.');
            const extracted = parseFloat(cleanPrice);
            if (extracted > 0 && extracted < 50000) {
              price = Math.round(extracted);
            }
          }
        }

        // Extraire l'image
        const imgEl = product.querySelector('.s-item__image-wrapper img') ||
                      product.querySelector('.s-item__image img');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src;
          // Éviter les images placeholder
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank') || image.includes('ebaystatic.com/cr'))) {
            image = null;
          }
        }

        // eBay = livraison par défaut
        const handDelivery = false;
        const hasShipping = true;

        // Debug pour les premiers éléments
        if (index < 3) {
          console.log(`OKAZ EBAY DEBUG [${index}]: title="${title?.substring(0, 40)}", price=${price}`);
        }

        if (title && url) {
          results.push({
            id: `ebay-${index}-${Date.now()}`,
            title: title.substring(0, 80),
            price: price,
            site: 'eBay',
            siteColor: '#E53238',
            image: image,
            url: url,
            location: '',
            handDelivery: handDelivery,
            hasShipping: hasShipping,
            hasWarranty: false,
            score: calculateScore(title, price),
            redFlags: []
          });
        }
      } catch (e) {
        console.error('OKAZ EBAY: Erreur parsing produit', index, e);
      }
    });

    console.log(`OKAZ EBAY: ${results.length} résultats parsés avec succès`);
    return results;
  }

  // Score initial (sera remplacé par le dealScore Gemini côté site)
  function calculateScore(title, price) {
    let score = 70; // Score neutre — Gemini recalculera le vrai score
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ EBAY: Demande de parsing reçue');
      const maxResults = request.maxResults || 10;

      (async () => {
        // Scroll pour déclencher lazy loading
        console.log('OKAZ EBAY: Scroll pour lazy loading...');
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults(maxResults);
        console.log('OKAZ EBAY: Envoi de', results.length, 'résultats');
        sendResponse({ success: true, results: results });
      })().catch(error => {
        console.error('OKAZ EBAY: Erreur', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de recherche
  if (window.location.href.includes('/sch/')) {
    console.log('OKAZ EBAY: Page de recherche détectée');

    setTimeout(async () => {
      console.log('OKAZ EBAY: Scroll pour déclencher lazy loading...');

      // Scroll progressif
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));

      console.log('OKAZ EBAY: Parsing après scroll...');
      const results = await parseResults();

      console.log('OKAZ EBAY AUTO: Envoi de', results.length, 'résultats au SW');
      chrome.runtime.sendMessage({
        type: 'EBAY_RESULTS',
        results: results,
        url: window.location.href
      });
    }, 1500);
  }

})();

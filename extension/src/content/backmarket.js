// OKAZ Content Script - Back Market Parser v0.3.5
// S'exécute automatiquement sur les pages de recherche Back Market

(function() {
  console.log('OKAZ: Back Market parser v0.3.5 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Debug: afficher la structure de la page
  function debugDOM() {
    console.log('OKAZ DEBUG BACKMARKET: ========== Analyse du DOM ==========');
    console.log('OKAZ DEBUG: URL:', window.location.href);
    console.log('OKAZ DEBUG: Title:', document.title);

    // Chercher les éléments avec data-testid
    const testIdElements = document.querySelectorAll('[data-testid]');
    console.log('OKAZ DEBUG: Éléments data-testid:', testIdElements.length);
    if (testIdElements.length > 0) {
      const testIds = [...new Set([...testIdElements].map(el => el.getAttribute('data-testid')))];
      console.log('OKAZ DEBUG: data-testid uniques:', testIds.slice(0, 30));
    }

    // Chercher les liens vers des produits
    const productLinks = document.querySelectorAll('a[href*="/product/"], a[href*="/p/"]');
    console.log('OKAZ DEBUG: Liens produits trouvés:', productLinks.length);

    // Chercher les classes contenant "product" ou "card"
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(c => {
          if (c.toLowerCase().includes('product') || c.toLowerCase().includes('card') || c.toLowerCase().includes('listing')) {
            allClasses.add(c);
          }
        });
      }
    });
    if (allClasses.size > 0) {
      console.log('OKAZ DEBUG: Classes contenant product/card/listing:', [...allClasses].slice(0, 30));
    }

    console.log('OKAZ DEBUG BACKMARKET: =====================================');
  }

  // Attendre que la page soit complètement chargée
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 25;

      const check = () => {
        attempts++;

        // Debug toutes les 5 tentatives
        if (attempts % 5 === 1) {
          console.log(`OKAZ BACKMARKET: Tentative ${attempts}/${maxAttempts}`);
          debugDOM();
        }

        // Liste de sélecteurs Back Market à essayer
        const selectorsList = [
          // Sélecteurs Back Market 2025-2026
          '[data-testid="productCard"]',
          '[data-testid="product-card"]',
          '[data-qa="productCard"]',
          '[data-test="product-card"]',
          'div[class*="productCard"]',
          'div[class*="ProductCard"]',
          'article[class*="product"]',
          // Sélecteurs génériques
          '[class*="product-card"]',
          '[class*="listing-card"]',
          'a[href*="/p/"][class*="card"]',
          // Fallback par lien produit
          'a[href*="/p/"]'
        ];

        for (const selector of selectorsList) {
          const products = document.querySelectorAll(selector);
          if (products.length > 0) {
            console.log(`OKAZ BACKMARKET: ${products.length} produits avec "${selector}"`);
            resolve({ products, selector });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 400);
        } else {
          console.log('OKAZ BACKMARKET: Timeout après', maxAttempts, 'tentatives');
          debugDOM();
          // Dernier recours - liens vers produits
          const productLinks = document.querySelectorAll('a[href*="/p/"]');
          resolve({ products: productLinks, selector: 'fallback' });
        }
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults() {
    console.log('OKAZ BACKMARKET: Début parsing...');

    const { products: productElements, selector } = await waitForResults();
    const results = [];
    const seenUrls = new Set();

    console.log(`OKAZ BACKMARKET: Parsing de ${productElements.length} éléments (${selector})`);

    productElements.forEach((product, index) => {
      if (index >= 20) return; // Limiter à 20 résultats

      try {
        let title = '';
        let price = 0;
        let image = null;
        let url = '';

        // Extraire l'URL
        if (product.tagName === 'A') {
          url = product.href;
        } else {
          const link = product.querySelector('a[href*="/p/"]') || product.closest('a');
          url = link?.href || '';
        }

        // Normaliser l'URL Back Market
        if (url && !url.startsWith('http')) {
          url = 'https://www.backmarket.fr' + url;
        }

        // Éviter les doublons
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);

        // Extraire le titre
        const titleSelectors = [
          '[data-testid="product-title"]',
          '[data-qa="productTitle"]',
          'h2',
          'h3',
          '[class*="title"]',
          '[class*="Title"]',
          'span[class*="name"]',
          'p[class*="name"]'
        ];

        for (const sel of titleSelectors) {
          const el = product.querySelector(sel);
          if (el?.textContent?.trim()) {
            title = el.textContent.trim();
            break;
          }
        }

        // Fallback titre
        if (!title) {
          const link = product.querySelector('a') || product;
          if (link.title) {
            title = link.title;
          } else if (product.textContent) {
            const text = product.textContent.replace(/\s+/g, ' ').trim();
            // Éviter de prendre les prix comme titre
            const words = text.split(' ').filter(w => w.length > 2 && !/^\d+[,.]?\d*\s*€?$/.test(w));
            title = words.slice(0, 8).join(' ');
          }
        }

        // Extraire le prix - Back Market affiche souvent "à partir de XXX €"
        const priceSelectors = [
          '[data-testid="product-price"]',
          '[data-qa="productPrice"]',
          '[class*="price"]',
          '[class*="Price"]',
          'span[class*="amount"]'
        ];

        for (const sel of priceSelectors) {
          const el = product.querySelector(sel);
          if (el?.textContent) {
            const priceText = el.textContent.trim();
            // Pattern prix: "123,45 €" ou "à partir de 123 €" ou "123€"
            const pricePattern = priceText.match(/(\d+(?:[.,]\d{2})?)\s*€/);
            if (pricePattern) {
              const cleanPrice = pricePattern[1].replace(',', '.').replace(/\s/g, '');
              const extracted = parseFloat(cleanPrice);
              if (extracted > 0 && extracted < 10000) {
                price = Math.round(extracted);
                break;
              }
            }
          }
        }

        // Fallback prix
        if (price === 0) {
          const priceMatch = product.textContent.match(/(\d+(?:[.,]\d{2})?)\s*€/);
          if (priceMatch) {
            const cleanPrice = priceMatch[1].replace(',', '.').replace(/\s/g, '');
            const extracted = parseFloat(cleanPrice);
            if (extracted > 0 && extracted < 10000) {
              price = Math.round(extracted);
            }
          }
        }

        // Extraire l'image
        const imgEl = product.querySelector('img[src], img[data-src]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src;
          // Éviter les images placeholder
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank'))) {
            image = null;
          }
        }

        // Back Market = toujours livraison, jamais main propre, toujours garantie
        const handDelivery = false;
        const hasShipping = true;
        const hasWarranty = true; // Garantie Back Market incluse

        // Debug pour les premiers éléments
        if (index < 3) {
          console.log(`OKAZ BACKMARKET DEBUG [${index}]: title="${title?.substring(0, 30)}", price=${price}`);
        }

        if (title && url) {
          results.push({
            id: `bm-${index}-${Date.now()}`,
            title: title.substring(0, 80),
            price: price,
            site: 'Back Market',
            siteColor: '#4DB6AC', // Couleur Back Market vert/turquoise
            image: image,
            url: url,
            location: '', // Back Market = pas de localisation vendeur
            handDelivery: handDelivery,
            hasShipping: hasShipping,
            hasWarranty: hasWarranty,
            score: calculateScore(title, price),
            redFlags: [] // Back Market = reconditionné garanti, pas de red flags
          });
        }
      } catch (e) {
        console.error('OKAZ BACKMARKET: Erreur parsing produit', index, e);
      }
    });

    console.log(`OKAZ BACKMARKET: ${results.length} résultats parsés avec succès`);
    return results;
  }

  // Calculer un score de pertinence (Back Market = fiable, donc score élevé de base)
  function calculateScore(title, price) {
    let score = 85; // Score de base plus élevé car reconditionné garanti
    const titleLower = title.toLowerCase();

    // Bonus pour certains états
    if (titleLower.includes('excellent') || titleLower.includes('premium')) score += 5;
    if (titleLower.includes('comme neuf')) score += 4;
    if (titleLower.includes('très bon')) score += 3;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ BACKMARKET: Demande de parsing reçue');

      (async () => {
        // Scroll pour déclencher lazy loading
        console.log('OKAZ BACKMARKET: Scroll pour lazy loading...');
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults();
        console.log('OKAZ BACKMARKET: Envoi de', results.length, 'résultats');
        sendResponse({ success: true, results: results });
      })().catch(error => {
        console.error('OKAZ BACKMARKET: Erreur', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de recherche
  if (window.location.href.includes('/search') || window.location.href.includes('/l/')) {
    console.log('OKAZ BACKMARKET: Page de recherche détectée');

    setTimeout(async () => {
      console.log('OKAZ BACKMARKET: Scroll pour déclencher lazy loading...');

      // Scroll progressif
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));

      console.log('OKAZ BACKMARKET: Parsing après scroll...');
      const results = await parseResults();

      console.log('OKAZ BACKMARKET AUTO: Envoi de', results.length, 'résultats au SW');
      chrome.runtime.sendMessage({
        type: 'BACKMARKET_RESULTS',
        results: results,
        url: window.location.href
      });
    }, 1500);
  }

})();

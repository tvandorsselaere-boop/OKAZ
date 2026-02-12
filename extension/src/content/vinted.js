// OKAZ Content Script - Vinted Parser v0.5.0
// S'exécute automatiquement sur les pages de recherche Vinted

(function() {
  console.log('OKAZ: Vinted parser v0.5.0 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Debug: afficher la structure de la page
  function debugDOM() {
    console.log('OKAZ DEBUG VINTED: ========== Analyse du DOM ==========');
    console.log('OKAZ DEBUG: URL:', window.location.href);
    console.log('OKAZ DEBUG: Title:', document.title);

    // Chercher les éléments avec data-testid
    const testIdElements = document.querySelectorAll('[data-testid]');
    console.log('OKAZ DEBUG: Éléments data-testid:', testIdElements.length);
    if (testIdElements.length > 0) {
      const testIds = [...new Set([...testIdElements].map(el => el.getAttribute('data-testid')))];
      console.log('OKAZ DEBUG: data-testid uniques:', testIds.slice(0, 30));
    }

    // Chercher les liens vers des items
    const itemLinks = document.querySelectorAll('a[href*="/items/"]');
    console.log('OKAZ DEBUG: Liens /items/ trouvés:', itemLinks.length);

    // Chercher les classes contenant "item" ou "card"
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(c => {
          if (c.toLowerCase().includes('item') || c.toLowerCase().includes('card') || c.toLowerCase().includes('product')) {
            allClasses.add(c);
          }
        });
      }
    });
    if (allClasses.size > 0) {
      console.log('OKAZ DEBUG: Classes contenant item/card/product:', [...allClasses].slice(0, 30));
    }

    console.log('OKAZ DEBUG VINTED: =====================================');
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
          console.log(`OKAZ VINTED: Tentative ${attempts}/${maxAttempts}`);
          debugDOM();
        }

        // Liste de sélecteurs Vinted à essayer
        const selectorsList = [
          // Sélecteurs Vinted 2025-2026
          '[data-testid="item-box"]',
          '[data-testid="grid-item"]',
          '[data-testid="product-item"]',
          '[data-testid^="catalog-item"]',
          'div[class*="ItemBox"]',
          'div[class*="feed-grid__item"]',
          'div[class*="feed__item"]',
          // Sélecteurs génériques
          '.feed-grid__item',
          '.new-item-box',
          '.item-box',
          'article.item',
          // Fallback par lien
          'a[href*="/items/"]'
        ];

        for (const selector of selectorsList) {
          const items = document.querySelectorAll(selector);
          if (items.length > 0) {
            console.log(`OKAZ VINTED: ${items.length} articles avec "${selector}"`);
            resolve({ items, selector });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 400);
        } else {
          console.log('OKAZ VINTED: Timeout après', maxAttempts, 'tentatives');
          debugDOM();
          // Dernier recours - liens vers items
          const itemLinks = document.querySelectorAll('a[href*="/items/"]');
          resolve({ items: itemLinks, selector: 'fallback' });
        }
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults() {
    console.log('OKAZ VINTED: Début parsing...');

    const { items: itemElements, selector } = await waitForResults();
    const results = [];
    const seenUrls = new Set();

    console.log(`OKAZ VINTED: Parsing de ${itemElements.length} éléments (${selector})`);

    itemElements.forEach((item, index) => {
      if (index >= 20) return; // Limiter à 20 résultats

      try {
        let title = '';
        let price = 0;
        let image = null;
        let url = '';

        // Extraire l'URL
        if (item.tagName === 'A') {
          url = item.href;
        } else {
          const link = item.querySelector('a[href*="/items/"]') || item.closest('a');
          url = link?.href || '';
        }

        // Éviter les doublons
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);

        // Extraire le titre
        const titleSelectors = [
          '[data-testid="item-title"]',
          '[data-testid="description-title"]',
          'h2[class*="title"]',
          'h3[class*="title"]',
          '[class*="ItemBox__title"]',
          '[class*="item-title"]',
          'p[class*="title"]',
          '.item-title'
        ];

        for (const sel of titleSelectors) {
          const el = item.querySelector(sel);
          if (el?.textContent?.trim()) {
            title = el.textContent.trim();
            break;
          }
        }

        // Fallback titre: prendre le texte de l'élément
        if (!title) {
          // Chercher dans l'attribut title du lien
          const link = item.querySelector('a') || item;
          if (link.title) {
            title = link.title;
          } else if (item.textContent) {
            const text = item.textContent.replace(/\s+/g, ' ').trim();
            const words = text.split(' ').filter(w => w.length > 2 && !/^\d/.test(w));
            title = words.slice(0, 6).join(' ');
          }
        }

        // Extraire le prix
        const priceSelectors = [
          '[data-testid="item-price"]',
          '[data-testid="price-text"]',
          '[class*="ItemBox__price"]',
          '[class*="item-price"]',
          '.item-price',
          'span[class*="price"]',
          'p[class*="price"]'
        ];

        for (const sel of priceSelectors) {
          const el = item.querySelector(sel);
          if (el?.textContent) {
            const priceText = el.textContent.trim();
            // Pattern prix Vinted: "12,50 €" ou "1 250,00 €" (espace millier)
            const pricePattern = priceText.match(/([\d\s]+(?:[.,]\d{2})?)\s*€/);
            if (pricePattern) {
              const cleanPrice = pricePattern[1].replace(/\s/g, '').replace(',', '.');
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
          const priceMatch = item.textContent.match(/([\d\s]+(?:[.,]\d{2})?)\s*€/);
          if (priceMatch) {
            const cleanPrice = priceMatch[1].replace(/\s/g, '').replace(',', '.');
            const extracted = parseFloat(cleanPrice);
            if (extracted > 0 && extracted < 10000) {
              price = Math.round(extracted);
            }
          }
        }

        // Extraire l'image
        const imgEl = item.querySelector('img[src], img[data-src]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src;
          // Éviter les images placeholder
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank'))) {
            image = null;
          }
        }

        // Extraire la localisation du vendeur
        let location = '';
        const locationSelectors = [
          '[data-testid="item-location"]',
          '[data-testid="user-location"]',
          '[class*="location"]',
          '[class*="Location"]',
          'span[class*="city"]'
        ];
        for (const sel of locationSelectors) {
          const el = item.querySelector(sel);
          if (el?.textContent?.trim()) {
            location = el.textContent.trim();
            break;
          }
        }

        // Vinted = toujours livraison, jamais main propre
        const handDelivery = false;
        const hasShipping = true;

        // Debug pour les premiers éléments
        if (index < 3) {
          console.log(`OKAZ VINTED DEBUG [${index}]: title="${title?.substring(0, 30)}", price=${price}, location="${location}"`);
        }

        if (title && url) {
          results.push({
            id: `vinted-${index}-${Date.now()}`,
            title: title.substring(0, 80),
            price: price,
            site: 'Vinted',
            siteColor: '#09B1BA', // Couleur Vinted turquoise
            image: image,
            url: url,
            location: location,
            handDelivery: handDelivery,
            hasShipping: hasShipping,
            score: calculateScore(title, price),
            redFlags: detectRedFlags(title, price)
          });
        }
      } catch (e) {
        console.error('OKAZ VINTED: Erreur parsing article', index, e);
      }
    });

    console.log(`OKAZ VINTED: ${results.length} résultats parsés avec succès`);
    return results;
  }

  // Calculer un score de pertinence
  function calculateScore(title, price) {
    let score = 75;
    const titleLower = title.toLowerCase();

    const positiveKeywords = ['excellent', 'parfait', 'très bon', 'comme neuf', 'neuf', 'impeccable', 'jamais porté'];
    positiveKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) score += 4;
    });

    const suspiciousKeywords = ['urgent', 'vite', 'départ'];
    suspiciousKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) score -= 8;
    });

    // Prix trop bas pour certains produits tech
    if (titleLower.includes('iphone') && price > 0 && price < 100) score -= 30;
    if (titleLower.includes('airpods') && price > 0 && price < 30) score -= 25;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Détecter les red flags
  function detectRedFlags(title, price) {
    const flags = [];
    const titleLower = title.toLowerCase();

    if (titleLower.includes('iphone') && price > 0 && price < 100) flags.push('Prix très bas');
    if (titleLower.includes('airpods') && price > 0 && price < 30) flags.push('Prix suspect');
    if (titleLower.includes('urgent')) flags.push('Vente urgente');

    const uppercaseRatio = (title.match(/[A-Z]/g) || []).length / title.length;
    if (uppercaseRatio > 0.5 && title.length > 10) flags.push('Titre suspect');

    return flags;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ VINTED: Demande de parsing reçue');

      (async () => {
        // Scroll pour déclencher lazy loading
        console.log('OKAZ VINTED: Scroll pour lazy loading...');
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 400);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));

        const results = await parseResults();
        console.log('OKAZ VINTED: Envoi de', results.length, 'résultats');
        sendResponse({ success: true, results: results });
      })().catch(error => {
        console.error('OKAZ VINTED: Erreur', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de catalogue
  if (window.location.href.includes('/catalog') || window.location.href.includes('/vetements') || window.location.href.includes('/search')) {
    console.log('OKAZ VINTED: Page de recherche détectée');

    setTimeout(async () => {
      console.log('OKAZ VINTED: Scroll pour déclencher lazy loading...');

      // Scroll progressif
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 800));

      console.log('OKAZ VINTED: Parsing après scroll...');
      const results = await parseResults();

      console.log('OKAZ VINTED AUTO: Envoi de', results.length, 'résultats au SW');
      chrome.runtime.sendMessage({
        type: 'VINTED_RESULTS',
        results: results,
        url: window.location.href
      });
    }, 1500);
  }

})();

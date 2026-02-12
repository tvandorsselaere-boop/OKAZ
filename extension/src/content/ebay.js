// OKAZ Content Script - eBay.fr Parser v0.5.1
// S'exécute automatiquement sur les pages de recherche eBay France

(function() {
  console.log('OKAZ: eBay parser v0.5.1 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Accepter le consentement GDPR si présent (eBay affiche souvent un bandeau cookies)
  function acceptConsent() {
    const consentSelectors = [
      '#gdpr-banner-accept',
      'button#consent-page-btn-accept',
      '[data-testid="gdpr-banner-accept"]',
      'button.gdpr-banner__accept',
      '#consent_prompt_submit',
      'button[id*="accept"]',
      'button[data-testid*="accept"]',
      // eBay consent frame
      'iframe#gdpr-banner'
    ];
    for (const sel of consentSelectors) {
      const el = document.querySelector(sel);
      if (el && el.tagName === 'BUTTON') {
        console.log('OKAZ EBAY: Consentement GDPR accepté via', sel);
        el.click();
        return true;
      }
    }
    return false;
  }

  // Essayer d'accepter le consentement immédiatement et après un délai
  acceptConsent();
  setTimeout(acceptConsent, 1000);
  setTimeout(acceptConsent, 3000);

  // Debug DOM pour comprendre la structure de la page
  function debugDOM() {
    console.log('OKAZ EBAY DEBUG: ========== Analyse du DOM ==========');
    console.log('OKAZ EBAY DEBUG: URL:', window.location.href);
    console.log('OKAZ EBAY DEBUG: Title:', document.title);
    console.log('OKAZ EBAY DEBUG: Body length:', document.body?.innerHTML?.length || 0);

    // Chercher les éléments s-item
    const sItems = document.querySelectorAll('.s-item');
    console.log('OKAZ EBAY DEBUG: .s-item count:', sItems.length);

    // Chercher les éléments avec data-testid
    const srp = document.querySelector('[data-testid="srp-river-results"]');
    console.log('OKAZ EBAY DEBUG: srp-river-results:', !!srp);

    // Chercher les listes de résultats
    const lists = document.querySelectorAll('ul.srp-results, .srp-results');
    console.log('OKAZ EBAY DEBUG: srp-results lists:', lists.length);

    // Chercher les liens /itm/
    const itmLinks = document.querySelectorAll('a[href*="/itm/"]');
    console.log('OKAZ EBAY DEBUG: /itm/ links:', itmLinks.length);

    // Consent page?
    const consentPage = document.querySelector('#consent_prompt, #gdpr-banner, .consent-page');
    console.log('OKAZ EBAY DEBUG: Consent page:', !!consentPage);

    // CAPTCHA?
    const captcha = document.querySelector('#captcha, .captcha, [class*="captcha"]');
    console.log('OKAZ EBAY DEBUG: CAPTCHA:', !!captcha);

    console.log('OKAZ EBAY DEBUG: =====================================');
  }

  // Attendre que les résultats soient chargés
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // Plus de tentatives (eBay charge lentement)

      const check = () => {
        attempts++;

        if (attempts % 5 === 1) {
          console.log(`OKAZ EBAY: Tentative ${attempts}/${maxAttempts}`);
          if (attempts === 1) debugDOM();
        }

        // Re-tenter le consentement
        if (attempts <= 5) acceptConsent();

        // Sélecteurs eBay.fr — multiples stratégies
        const selectorsList = [
          'li.s-item',
          'div.s-item',
          '.srp-results .s-item',
          '[data-testid="srp-river-results"] .s-item',
          'ul.srp-results > li',
          // Fallback: liens vers des produits /itm/
          'a[href*="/itm/"]'
        ];

        for (const selector of selectorsList) {
          const products = document.querySelectorAll(selector);
          // eBay inclut souvent un premier élément "vide"
          const filtered = [...products].filter(el => {
            const text = el.textContent || '';
            // Exclure les éléments vides ou de navigation
            return text.length > 20 &&
              !text.includes('Shop on eBay') &&
              !text.includes('Résultats correspondants') &&
              !text.includes('VOUS AIMEREZ PEUT-ÊTRE AUSSI');
          });
          if (filtered.length > 0) {
            console.log(`OKAZ EBAY: ${filtered.length} produits avec "${selector}"`);
            resolve({ products: filtered, selector });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          console.log('OKAZ EBAY: Timeout après', maxAttempts, 'tentatives');
          debugDOM();
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
        const link = product.tagName === 'A' ? product :
          (product.querySelector('a.s-item__link') || product.querySelector('a[href*="/itm/"]'));
        url = link?.href || '';

        // Nettoyer l'URL eBay (retirer les tracking params)
        if (url) {
          try {
            const urlObj = new URL(url);
            // Garder seulement le path /itm/...
            url = `${urlObj.origin}${urlObj.pathname}`;
          } catch (e) { /* garder l'URL telle quelle */ }
        }

        // Éviter les doublons et les URLs invalides
        if (!url || !url.includes('/itm/') || seenUrls.has(url)) return;
        seenUrls.add(url);

        // Extraire le titre — plusieurs stratégies
        const titleEl = product.querySelector('.s-item__title span[role="heading"]') ||
                        product.querySelector('.s-item__title span:not(.LIGHT_HIGHLIGHT)') ||
                        product.querySelector('.s-item__title') ||
                        product.querySelector('h3');
        if (titleEl?.textContent?.trim()) {
          title = titleEl.textContent.trim();
          // Retirer "Neuf" / "D'occasion" prefix parfois présent
          title = title.replace(/^(Neuf|D'occasion|Nouveau)\s*[–-]\s*/i, '');
          // Retirer "Sponsorisé" prefix
          title = title.replace(/^Sponsorisé\s*/i, '');
        }

        // Fallback titre pour le cas 'a[href*="/itm/"]'
        if (!title && link) {
          title = link.title || link.textContent?.trim()?.substring(0, 80) || '';
        }

        // Extraire le prix - eBay.fr affiche "119,07 EUR" ou "25,00 €"
        const priceEl = product.querySelector('.s-item__price');
        if (priceEl?.textContent) {
          const priceText = priceEl.textContent.trim();
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

        // Fallback prix : chercher dans le texte de l'élément
        if (price === 0) {
          const priceMatch = product.textContent.match(/([\d\s]+(?:[.,]\d{2})?)\s*(?:EUR|€)/);
          if (priceMatch) {
            const cleanPrice = priceMatch[1].replace(/\s/g, '').replace(',', '.');
            const extracted = parseFloat(cleanPrice);
            if (extracted > 0 && extracted < 50000) {
              price = Math.round(extracted);
            }
          }
        }

        // Extraire l'image
        const imgEl = product.querySelector('.s-item__image-wrapper img') ||
                      product.querySelector('.s-item__image img') ||
                      product.querySelector('img[src*="ebayimg"]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src;
          // Éviter les images placeholder
          if (image && (image.includes('placeholder') || image.includes('data:image') || image.includes('blank') || image.includes('ebaystatic.com/cr/v/c1'))) {
            image = null;
          }
        }

        // eBay = livraison par défaut
        const handDelivery = false;
        const hasShipping = true;

        // Debug pour les premiers éléments
        if (index < 3) {
          console.log(`OKAZ EBAY DEBUG [${index}]: title="${title?.substring(0, 40)}", price=${price}, url=${url?.substring(0, 60)}`);
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
        console.error('OKAZ EBAY: Erreur PARSE_PAGE', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de recherche
  if (window.location.href.includes('/sch/')) {
    console.log('OKAZ EBAY: Page de recherche détectée');

    setTimeout(async () => {
      try {
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
      } catch (error) {
        console.error('OKAZ EBAY AUTO: Erreur', error);
        // Envoyer quand même un message vide pour débloquer le resolver
        chrome.runtime.sendMessage({
          type: 'EBAY_RESULTS',
          results: [],
          url: window.location.href
        });
      }
    }, 2000); // 2s au lieu de 1.5s (eBay est plus lent)
  }

})();

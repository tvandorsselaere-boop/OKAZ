// OKAZ Content Script - LeBonCoin Parser v0.5.0
// S'exécute automatiquement sur les pages de recherche LeBonCoin

(function() {
  console.log('OKAZ: LeBonCoin parser v0.5.0 chargé');
  console.log('OKAZ: URL =', window.location.href);

  // Debug: afficher la structure de la page
  function debugDOM() {
    console.log('OKAZ DEBUG: ========== Analyse du DOM ==========');
    console.log('OKAZ DEBUG: URL:', window.location.href);
    console.log('OKAZ DEBUG: Title:', document.title);

    // Chercher tous les liens vers des annonces
    const adLinks = document.querySelectorAll('a[href*="/ad/"]');
    console.log('OKAZ DEBUG: Liens /ad/ trouvés:', adLinks.length);
    if (adLinks.length > 0 && adLinks.length < 5) {
      adLinks.forEach((l, i) => console.log(`  [${i}] ${l.href}`));
    }

    // Chercher les éléments avec data-testid (nouveau format)
    const testIdElements = document.querySelectorAll('[data-testid]');
    console.log('OKAZ DEBUG: Éléments data-testid:', testIdElements.length);
    if (testIdElements.length > 0) {
      const testIds = [...new Set([...testIdElements].map(el => el.getAttribute('data-testid')))];
      console.log('OKAZ DEBUG: data-testid uniques:', testIds.slice(0, 30));
    }

    // Chercher les éléments avec data-qa-id
    const qaElements = document.querySelectorAll('[data-qa-id]');
    console.log('OKAZ DEBUG: Éléments data-qa-id:', qaElements.length);
    if (qaElements.length > 0) {
      const qaIds = [...new Set([...qaElements].map(el => el.getAttribute('data-qa-id')))];
      console.log('OKAZ DEBUG: data-qa-id uniques:', qaIds.slice(0, 20));
    }

    // Chercher les éléments avec data-test-id
    const testElements = document.querySelectorAll('[data-test-id]');
    console.log('OKAZ DEBUG: Éléments data-test-id:', testElements.length);

    // Chercher les articles
    const articles = document.querySelectorAll('article');
    console.log('OKAZ DEBUG: Articles:', articles.length);

    // Chercher les divs/li avec classe contenant "ad" ou "card"
    const adDivs = document.querySelectorAll('[class*="ad"], [class*="Ad"], [class*="card"], [class*="Card"], [class*="listing"], [class*="Listing"]');
    console.log('OKAZ DEBUG: Éléments ad/card/listing:', adDivs.length);

    // Afficher les classes uniques qui contiennent "ad" ou "card"
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(c => {
          if (c.toLowerCase().includes('ad') || c.toLowerCase().includes('card') || c.toLowerCase().includes('item')) {
            allClasses.add(c);
          }
        });
      }
    });
    if (allClasses.size > 0) {
      console.log('OKAZ DEBUG: Classes contenant ad/card/item:', [...allClasses].slice(0, 30));
    }

    console.log('OKAZ DEBUG: =====================================');
  }

  // Attendre que la page soit complètement chargée
  function waitForResults() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30;

      const check = () => {
        attempts++;

        // Debug toutes les 5 tentatives
        if (attempts % 5 === 1) {
          console.log(`OKAZ: Tentative ${attempts}/${maxAttempts}`);
          debugDOM();
        }

        // Liste de sélecteurs à essayer (mis à jour pour 2026)
        const selectorsList = [
          // Nouveaux sélecteurs LeBonCoin 2025-2026
          '[data-testid="adCard"]',
          '[data-testid="ad-card"]',
          '[data-test-id="adCard"]',
          '[data-test-id="ad-card"]',
          'div[class*="adCard"]',
          'div[class*="AdCard"]',
          'article[class*="adCard"]',
          // Anciens sélecteurs
          '[data-qa-id="aditem_container"]',
          '[data-test-id="ad"]',
          '[data-test-id="adcard"]',
          'article[data-qa-id]',
          'div[data-qa-id="aditem_container"]',
          'a[data-qa-id="aditem_container"]',
          'li[data-qa-id]',
          '[class*="styles_ad"]',
          // Sélecteurs génériques
          'article',
          'li[class*="ad"]',
          'li[class*="Ad"]'
        ];

        for (const selector of selectorsList) {
          const ads = document.querySelectorAll(selector);
          if (ads.length > 0) {
            console.log(`OKAZ: ${ads.length} annonces avec "${selector}"`);
            resolve({ ads, selector });
            return;
          }
        }

        // Fallback: liens vers annonces (plus permissif)
        const adLinks = document.querySelectorAll('a[href*="/ad/"], a[href*="/annonces/"]');
        if (adLinks.length > 3) {
          console.log(`OKAZ: Fallback - ${adLinks.length} liens vers annonces`);
          resolve({ ads: adLinks, selector: 'a[href*="/ad/"]' });
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          console.log('OKAZ: Timeout après', maxAttempts, 'tentatives');
          debugDOM();
          // Dernier recours - même si peu de liens
          resolve({ ads: adLinks, selector: 'fallback' });
        }
      };

      check();
    });
  }

  // Parser les résultats
  async function parseResults() {
    console.log('OKAZ: Début parsing...');

    const { ads: adElements, selector } = await waitForResults();
    const results = [];

    console.log(`OKAZ: Parsing de ${adElements.length} éléments (${selector})`);

    adElements.forEach((ad, index) => {
      if (index >= 20) return; // Limiter à 20 résultats

      try {
        let title = '';
        let price = 0;
        let image = null;
        let url = '';

        // Extraire l'URL en premier
        if (ad.tagName === 'A') {
          url = ad.href;
        } else {
          const link = ad.querySelector('a[href*="/ad/"]') || ad.closest('a');
          url = link?.href || '';
        }

        // Extraire le titre - essayer plusieurs méthodes
        const titleSelectors = [
          '[data-qa-id="aditem_title"]',
          'p[data-qa-id="aditem_title"]',
          '[data-test-id="ad-title"]',
          'h2',
          'h3',
          '[class*="Title"]',
          '[class*="title"]',
          'p[class*="text"]'
        ];

        for (const sel of titleSelectors) {
          const el = ad.querySelector(sel);
          if (el?.textContent?.trim()) {
            title = el.textContent.trim();
            break;
          }
        }

        // Si pas de titre, prendre le texte de l'élément
        if (!title && ad.textContent) {
          // Prendre les premiers mots significatifs
          const text = ad.textContent.replace(/\s+/g, ' ').trim();
          const words = text.split(' ').filter(w => w.length > 2);
          title = words.slice(0, 8).join(' ');
        }

        // Extraire le prix - ATTENTION aux faux positifs (chiffres dans le titre)
        const priceSelectors = [
          '[data-qa-id="aditem_price"]',
          'span[data-qa-id="aditem_price"]',
          '[data-test-id="ad-price"]',
          '[class*="Price"]:not([class*="title"])',
          '[class*="price"]:not([class*="title"])',
          'span[aria-label*="prix"]'
        ];

        for (const sel of priceSelectors) {
          const el = ad.querySelector(sel);
          if (el?.textContent) {
            const priceText = el.textContent.trim();
            // Chercher un pattern prix: nombre suivi de € ou EUR
            const pricePattern = priceText.match(/^(\d[\d\s.,]*)[\s]*(€|EUR)/i);
            if (pricePattern) {
              // Nettoyer: garder uniquement les chiffres
              const cleanPrice = pricePattern[1].replace(/[\s.,]/g, '');
              const extracted = parseInt(cleanPrice);
              if (extracted > 0 && extracted < 100000) { // Prix raisonnable
                price = extracted;
                break;
              }
            }
          }
        }

        // Fallback prix: stratégie par zones DOM (évite collision titre/prix)
        if (price === 0) {
          // 1. Chercher dans les éléments avec "price" ou "prix" dans la classe
          const priceZones = ad.querySelectorAll('[class*="rice" i], [class*="rix" i], [class*="amount" i], [class*="cost" i]');

          for (const zone of priceZones) {
            // Éviter les zones de titre
            if (zone.closest('[class*="title" i], [class*="titre" i]')) continue;

            const priceMatch = zone.textContent.match(/(\d[\d\s]*)\s*€/);
            if (priceMatch) {
              const cleanPrice = priceMatch[1].replace(/\s/g, '');
              const extracted = parseInt(cleanPrice);
              if (extracted > 0 && extracted < 100000) {
                price = extracted;
                break;
              }
            }
          }

          // 2. Si toujours pas de prix, chercher les éléments courts contenant uniquement un prix
          if (price === 0) {
            const allElements = ad.querySelectorAll('span, p, div');
            for (const el of allElements) {
              // Ignorer les éléments avec beaucoup de texte (probablement pas juste un prix)
              const text = el.textContent.trim();
              if (text.length > 20) continue;

              // Pattern strict: texte court qui ressemble à un prix
              const strictMatch = text.match(/^(\d[\d\s]*)\s*€$/);
              if (strictMatch) {
                const cleanPrice = strictMatch[1].replace(/\s/g, '');
                const extracted = parseInt(cleanPrice);
                if (extracted > 0 && extracted < 100000) {
                  price = extracted;
                  break;
                }
              }
            }
          }
        }

        // Extraire l'image
        const imgEl = ad.querySelector('img[src], img[data-src]');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('data-src');
          // Éviter les images placeholder
          if (image && (image.includes('placeholder') || image.includes('data:image'))) {
            image = null;
          }
        }

        // Extraire la localisation
        let location = '';
        const locationSelectors = [
          '[data-qa-id="aditem_location"]',
          '[data-test-id="ad-location"]',
          'p[class*="city"]',
          'span[class*="city"]',
          '[class*="Location"]',
          '[class*="location"]',
        ];
        for (const sel of locationSelectors) {
          const el = ad.querySelector(sel);
          if (el?.textContent?.trim()) {
            const locText = el.textContent.trim();
            // Vérifier que ce n'est pas le titre qui a été capturé
            // Une location LBC est courte (ville + dept) et ne contient pas de mots-clés produit
            if (locText.length < 50 && locText !== title && !locText.includes('€')) {
              location = locText;
              break;
            }
          }
        }
        // Fallback: chercher un pattern ville (XX) ou ville XXXXX dans le texte de l'annonce
        if (!location) {
          const adText = ad.textContent || '';
          // Pattern: "Ville (13)" ou "Aix-en-Provence (13)" — typique LBC
          const cityMatch = adText.match(/((?:[A-ZÀ-Ü][a-zà-ü]+[-'\s]?(?:de|du|des|en|la|le|les|sur|sous|lès|près|saint|sainte|lez|l'|d')?\s?)*[A-ZÀ-Ü][a-zà-ü]+)\s*\((\d{2,3})\)/);
          if (cityMatch && cityMatch[1].length < 40) {
            location = cityMatch[0];
          } else {
            // Pattern: "Aix-en-Provence 13100" (nom composé + code postal 5 chiffres)
            const postalMatch = adText.match(/((?:[A-ZÀ-Ü][a-zà-ü]+[-'\s]?(?:de|du|des|en|la|le|les|sur|sous|lès|près|saint|sainte|lez|l'|d')?\s?)*[A-ZÀ-Ü][a-zà-ü]+)\s+(\d{5})/);
            if (postalMatch && postalMatch[1].length < 40 && !postalMatch[1].match(/MacBook|iPhone|Samsung|Dell|HP|Asus|Lenovo|Apple|Go\b|Pro\b|Air\b|Max\b/i)) {
              location = postalMatch[1] + ' ' + postalMatch[2];
            }
          }
        }

        // Détecter livraison vs main propre
        // Sur LeBonCoin, le MODE PAR DÉFAUT est main propre
        // La livraison est une option qui doit être explicitement activée
        const deliveryText = ad.textContent.toLowerCase();

        // Détecter si livraison disponible (badge, icône, texte)
        const hasShipping = deliveryText.includes('livraison') ||
                           deliveryText.includes('envoi') ||
                           deliveryText.includes('mondial relay') ||
                           deliveryText.includes('colissimo') ||
                           deliveryText.includes('chronopost') ||
                           deliveryText.includes('relais colis') ||
                           ad.querySelector('[class*="shipping"]') !== null ||
                           ad.querySelector('[class*="delivery"]') !== null ||
                           ad.querySelector('[data-testid*="shipping"]') !== null ||
                           ad.querySelector('[data-testid*="delivery"]') !== null;

        // Main propre = par défaut sur LBC, SAUF si livraison uniquement mentionnée
        // Si location est présente et pas de mention "livraison uniquement", c'est main propre
        const handDelivery = location !== '' ||
                            deliveryText.includes('main propre') ||
                            deliveryText.includes('sur place') ||
                            deliveryText.includes('à retirer') ||
                            deliveryText.includes('à venir chercher') ||
                            !hasShipping; // Si pas de livraison détectée, c'est forcément main propre

        // Debug pour les premiers éléments
        if (index < 5) {
          console.log(`OKAZ DEBUG [${index}]: title="${title?.substring(0, 30)}", price=${price}, location="${location}", handDelivery=${handDelivery}`);
        }

        if (title && url) {
          results.push({
            id: `lbc-${index}-${Date.now()}`,
            title: title.substring(0, 80),
            price: price,
            site: 'LeBonCoin',
            siteColor: '#FF6E14',
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
        console.error('OKAZ: Erreur parsing annonce', index, e);
      }
    });

    console.log(`OKAZ: ${results.length} résultats parsés avec succès`);
    return results;
  }

  // Calculer un score de pertinence
  function calculateScore(title, price) {
    let score = 75;
    const titleLower = title.toLowerCase();

    const positiveKeywords = ['excellent', 'parfait', 'très bon', 'comme neuf', 'impeccable', 'garantie', 'facture'];
    positiveKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) score += 4;
    });

    const suspiciousKeywords = ['urgent', 'vite', 'départ', 'liquidation'];
    suspiciousKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) score -= 8;
    });

    if (titleLower.includes('iphone') && price < 150) score -= 30;
    if (titleLower.includes('macbook') && price < 300) score -= 30;
    if (titleLower.includes('ps5') && price < 200) score -= 25;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Détecter les red flags
  function detectRedFlags(title, price) {
    const flags = [];
    const titleLower = title.toLowerCase();

    if (titleLower.includes('iphone') && price > 0 && price < 200) flags.push('Prix très bas');
    if (titleLower.includes('macbook') && price > 0 && price < 400) flags.push('Prix suspect');
    if (titleLower.includes('ps5') && price > 0 && price < 250) flags.push('Prix anormalement bas');
    if (titleLower.includes('urgent')) flags.push('Vente urgente');
    if (titleLower.includes('neuf sous blister') && price > 0 && price < 500) flags.push('Neuf à prix cassé');

    const uppercaseRatio = (title.match(/[A-Z]/g) || []).length / title.length;
    if (uppercaseRatio > 0.5 && title.length > 10) flags.push('Titre suspect');

    return flags;
  }

  // Écouter les messages du service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PARSE_PAGE') {
      console.log('OKAZ: Demande de parsing reçue');

      // Scroll pour déclencher lazy loading avant parsing
      (async () => {
        console.log('OKAZ: Scroll pour lazy loading...');
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 500);
          await new Promise(r => setTimeout(r, 300));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));

        const results = await parseResults();
        console.log('OKAZ: Envoi de', results.length, 'résultats');
        sendResponse({ success: true, results: results });
      })().catch(error => {
        console.error('OKAZ: Erreur', error);
        sendResponse({ success: false, error: error.message });
      });

      return true;
    }
  });

  // Parser automatiquement si on est sur une page de recherche
  if (window.location.href.includes('/recherche')) {
    console.log('OKAZ: Page de recherche détectée');

    // Attendre le chargement initial
    setTimeout(async () => {
      console.log('OKAZ: Scroll pour déclencher lazy loading...');

      // Scroll progressif pour charger les annonces (lazy loading)
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 500));
      }

      // Remonter en haut
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1000));

      console.log('OKAZ: Parsing après scroll...');
      const results = await parseResults();

      console.log('OKAZ AUTO: Envoi de', results.length, 'résultats au SW');
      chrome.runtime.sendMessage({
        type: 'LEBONCOIN_RESULTS',
        results: results,
        url: window.location.href
      });
    }, 2000);
  }

})();

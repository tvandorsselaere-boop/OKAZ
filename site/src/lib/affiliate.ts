// OKAZ - Wrapping automatique des liens affiliés
// Transforme les URLs de résultats en liens affiliés pour les sites partenaires
// Le scoring n'est JAMAIS affecté - seul le lien change

/**
 * Wrap une URL de résultat en lien affilié si le site est partenaire.
 * Retourne l'URL originale si le site n'est pas affilié ou si les variables d'env manquent.
 */
export function wrapAffiliateLink(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Back Market → Awin
    if (hostname.includes('backmarket.')) {
      return wrapAwin(url, process.env.NEXT_PUBLIC_AWIN_MID_BACKMARKET);
    }

    // Rakuten → Awin
    if (hostname.includes('rakuten.')) {
      return wrapAwin(url, process.env.NEXT_PUBLIC_AWIN_MID_RAKUTEN);
    }

    // Fnac → Awin
    if (hostname.includes('fnac.')) {
      return wrapAwin(url, process.env.NEXT_PUBLIC_AWIN_MID_FNAC);
    }

    // Amazon → Tag direct
    if (hostname.includes('amazon.')) {
      return wrapAmazon(url);
    }

    // LeBonCoin, Vinted, etc. → Pas d'affiliation
    return url;
  } catch {
    // URL invalide → retourner telle quelle
    return url;
  }
}

/**
 * Wrap Awin : https://www.awin1.com/cread.php?awinmid={MID}&awinaffid={AFFID}&ued={URL_ENCODEE}
 */
function wrapAwin(url: string, merchantId: string | undefined): string {
  const affiliateId = process.env.NEXT_PUBLIC_AWIN_AFFID;

  // Si les variables manquent, retourner l'URL originale
  if (!affiliateId || !merchantId) {
    return url;
  }

  const encodedUrl = encodeURIComponent(url);
  return `https://www.awin1.com/cread.php?awinmid=${merchantId}&awinaffid=${affiliateId}&ued=${encodedUrl}`;
}

/**
 * Wrap Amazon : ajouter ?tag= (ou &tag= si déjà des params)
 */
function wrapAmazon(url: string): string {
  const tag = process.env.NEXT_PUBLIC_AMAZON_TAG;

  if (!tag) {
    return url;
  }

  try {
    const urlObj = new URL(url);

    // Remplacer le tag existant ou en ajouter un
    urlObj.searchParams.set('tag', tag);

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Génère un lien de recherche Amazon affilié pour le bandeau "Et en neuf ?"
 */
export function buildAmazonSearchLink(searchQuery: string): string {
  const tag = process.env.NEXT_PUBLIC_AMAZON_TAG;
  const encodedQuery = encodeURIComponent(searchQuery);

  const baseUrl = `https://www.amazon.fr/s?k=${encodedQuery}`;

  if (!tag) {
    return baseUrl;
  }

  return `${baseUrl}&tag=${tag}`;
}

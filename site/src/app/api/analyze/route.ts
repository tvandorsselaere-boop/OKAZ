// OKAZ API - Analyse des résultats via Gemini
// POST /api/analyze { results: [...], query: string, visualContext?: {...}, searchToken: string }
// Retourne: { analyzed: [...], topPick?: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { analyzeResultsWithGemini, RawResult, VisualContext, RealPriceStats, MatchCriteria } from '@/lib/gemini';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { verifyRequestAuth, verifySearchToken } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request.headers);
  const limit = checkRateLimit(`analyze:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans quelques secondes' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetIn / 1000)) } }
    );
  }

  try {
    const body = await request.json();

    // Vérifier l'authentification JWT
    const authResult = await verifyRequestAuth(request, body);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Vérifier le search token (émis par optimize)
    const { searchToken } = body;
    if (!searchToken || !verifySearchToken(searchToken, authResult.user.sub)) {
      return NextResponse.json(
        { error: 'Search token invalide ou expiré' },
        { status: 403 }
      );
    }

    const { results, query, visualContext, priceStats, matchCriteria } = body;

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Results manquants' },
        { status: 400 }
      );
    }

    console.log('[OKAZ API] Analyse de', results.length, 'résultats pour:', query);
    if (visualContext) {
      console.log('[OKAZ API] Contexte visuel:', visualContext);
    }

    // Convertir en format attendu
    const rawResults: RawResult[] = results.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      title: String(r.title || ''),
      price: Number(r.price) || 0,
      url: String(r.url || ''),
      image: r.image ? String(r.image) : null,
    }));

    // v0.5.0 - Passer le contexte visuel (couleur, taille...) pour ajuster le scoring
    const typedVisualContext: VisualContext | undefined = visualContext ? {
      color: visualContext.color,
      size: visualContext.size,
      condition: visualContext.condition,
      variant: visualContext.variant,
    } : undefined;

    // Typer priceStats si fourni
    const typedPriceStats: RealPriceStats | undefined = priceStats ? {
      median: Number(priceStats.median) || 0,
      min: Number(priceStats.min) || 0,
      max: Number(priceStats.max) || 0,
      count: Number(priceStats.count) || 0,
    } : undefined;

    // Typer matchCriteria si fourni
    const typedMatchCriteria: MatchCriteria | undefined = matchCriteria ? {
      mainProduct: String(matchCriteria.mainProduct || ''),
      requiredInTitle: Array.isArray(matchCriteria.requiredInTitle) ? matchCriteria.requiredInTitle.map(String) : [],
      boostIfPresent: Array.isArray(matchCriteria.boostIfPresent) ? matchCriteria.boostIfPresent.map(String) : [],
      excludeIfPresent: Array.isArray(matchCriteria.excludeIfPresent) ? matchCriteria.excludeIfPresent.map(String) : [],
    } : undefined;

    const { analyzed, topPick } = await analyzeResultsWithGemini(rawResults, query || '', typedVisualContext, typedPriceStats, typedMatchCriteria);

    console.log('[OKAZ API] Analyse terminée:', analyzed.length, 'résultats');
    if (topPick) {
      console.log('[OKAZ API] TopPick:', topPick.id, '-', topPick.headline);
    }

    return NextResponse.json({
      success: true,
      analyzed,
      topPick,
    });

  } catch (error) {
    console.error('[OKAZ API] Erreur analyse:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    );
  }
}

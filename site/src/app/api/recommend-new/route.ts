// OKAZ API - Recommandation produit neuf ("Et en neuf ?")
// POST /api/recommend-new { query: string, priceMin: number, priceMax: number, searchToken: string }
// Retourne: { success: boolean, recommendation?: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { recommendNewProduct } from '@/lib/gemini';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { verifyRequestAuth, verifySearchToken } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  const ip = getClientIP(request.headers);
  const limit = checkRateLimit(`recommend:${ip}`, 10, 60_000);
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

    const { query, priceMin, priceMax, topResults } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query manquante' },
        { status: 400 }
      );
    }

    console.log('[OKAZ Recommend]', query, `${priceMin}-${priceMax}€`);

    const recommendation = await recommendNewProduct(
      query,
      Number(priceMin) || 0,
      Number(priceMax) || 0,
      topResults
    );

    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    console.error('[OKAZ API] Erreur recommandation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la recommandation' },
      { status: 500 }
    );
  }
}

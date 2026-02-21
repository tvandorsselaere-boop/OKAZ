// OKAZ API - Optimisation des requêtes via Gemini
// POST /api/optimize { query: string, imageBase64?: string, referenceUrl?: string }
// Retourne: { criteria, briefing, optimizedUrl, searchToken }

import { NextRequest, NextResponse } from 'next/server';
import { optimizeQuery, buildLeBonCoinUrl } from '@/lib/gemini';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { verifyRequestAuth, consumeQuotaForRequest, generateSearchToken } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  // Rate-limit IP (defense in depth)
  const ip = getClientIP(request.headers);
  const limit = checkRateLimit(`optimize:${ip}`, 20, 60_000);
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

    // Consommer 1 recherche de quota
    const quotaResult = await consumeQuotaForRequest(authResult.user.sub, authResult.uuid);
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { error: 'Quota épuisé', quotaExhausted: true, remaining: 0 },
        { status: 429 }
      );
    }

    const { query, imageBase64, referenceUrl, clarifications, refinement } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query manquante' },
        { status: 400 }
      );
    }

    // v0.5.0 - Validation image (max 4MB en base64 ≈ 5.3MB string)
    if (imageBase64 && imageBase64.length > 6 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image trop grande (max 4MB)' },
        { status: 400 }
      );
    }

    console.log('[OKAZ Optimize]', query, imageBase64 ? '+image' : '', clarifications?.length ? `+${clarifications.length} clarif` : '', refinement ? '+refinement' : '');

    // Passer les options enrichies à Gemini
    const { criteria, briefing, visualContext, needsClarification, clarificationQuestion, clarificationOptions } = await optimizeQuery({
      query,
      imageBase64,
      referenceUrl,
      clarifications,
      refinement,
    });
    const optimizedUrl = buildLeBonCoinUrl(criteria);

    // Générer un search token pour analyze et recommend-new
    const searchToken = generateSearchToken(authResult.user.sub);

    return NextResponse.json({
      success: true,
      criteria,
      briefing,
      visualContext,
      optimizedUrl,
      searchToken,
      remaining: quotaResult.remaining,
      needsClarification: needsClarification || false,
      clarificationQuestion: clarificationQuestion || null,
      clarificationOptions: clarificationOptions || null,
    });

  } catch (error) {
    console.error('[OKAZ API] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'optimisation' },
      { status: 500 }
    );
  }
}

// OKAZ API - Optimisation des requêtes via Gemini
// POST /api/optimize { query: string, imageBase64?: string, referenceUrl?: string }
// Retourne: { criteria, briefing, optimizedUrl }

import { NextRequest, NextResponse } from 'next/server';
import { optimizeQuery, buildLeBonCoinUrl } from '@/lib/gemini';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
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
    const { query, imageBase64, referenceUrl, clarifications } = body;

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

    console.log('[OKAZ API] Optimisation requête:', query);
    console.log('[OKAZ API] Image:', imageBase64 ? 'OUI' : 'NON');
    console.log('[OKAZ API] Reference URL:', referenceUrl || 'NON');
    console.log('[OKAZ API] Clarifications:', clarifications?.length || 0);

    // Passer les options enrichies à Gemini
    const { criteria, briefing, visualContext, needsClarification, clarificationQuestion, clarificationOptions } = await optimizeQuery({
      query,
      imageBase64,
      referenceUrl,
      clarifications,
    });
    const optimizedUrl = buildLeBonCoinUrl(criteria);

    console.log('[OKAZ API] Critères:', criteria);
    console.log('[OKAZ API] Briefing:', briefing);
    console.log('[OKAZ API] Contexte visuel:', visualContext);
    console.log('[OKAZ API] Clarification:', needsClarification, clarificationQuestion);
    console.log('[OKAZ API] URL optimisée:', optimizedUrl);

    return NextResponse.json({
      success: true,
      criteria,
      briefing,
      visualContext,
      optimizedUrl,
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

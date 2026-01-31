// OKAZ API - Optimisation des requêtes via Gemini
// POST /api/optimize { query: string }
// Retourne: { criteria, briefing, optimizedUrl }

import { NextRequest, NextResponse } from 'next/server';
import { optimizeQuery, buildLeBonCoinUrl } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query manquante' },
        { status: 400 }
      );
    }

    console.log('[OKAZ API] Optimisation requête:', query);

    const { criteria, briefing } = await optimizeQuery(query);
    const optimizedUrl = buildLeBonCoinUrl(criteria);

    console.log('[OKAZ API] Critères:', criteria);
    console.log('[OKAZ API] Briefing:', briefing);
    console.log('[OKAZ API] URL optimisée:', optimizedUrl);

    return NextResponse.json({
      success: true,
      criteria,
      briefing,
      optimizedUrl,
    });

  } catch (error) {
    console.error('[OKAZ API] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'optimisation' },
      { status: 500 }
    );
  }
}

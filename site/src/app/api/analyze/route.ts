// OKAZ API - Analyse des résultats via Gemini
// POST /api/analyze { results: [...], query: string }
// Retourne: { analyzed: [...], topPick?: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { analyzeResultsWithGemini, RawResult } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { results, query } = body;

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Results manquants' },
        { status: 400 }
      );
    }

    console.log('[OKAZ API] Analyse de', results.length, 'résultats pour:', query);

    // Convertir en format attendu
    const rawResults: RawResult[] = results.map((r: Record<string, unknown>) => ({
      id: String(r.id || ''),
      title: String(r.title || ''),
      price: Number(r.price) || 0,
      url: String(r.url || ''),
      image: r.image ? String(r.image) : null,
    }));

    const { analyzed, topPick } = await analyzeResultsWithGemini(rawResults, query || '');

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

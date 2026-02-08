// OKAZ API - Analyse des résultats via Gemini
// POST /api/analyze { results: [...], query: string, visualContext?: {...} }
// Retourne: { analyzed: [...], topPick?: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { analyzeResultsWithGemini, RawResult, VisualContext } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { results, query, visualContext } = body;

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

    const { analyzed, topPick } = await analyzeResultsWithGemini(rawResults, query || '', typedVisualContext);

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

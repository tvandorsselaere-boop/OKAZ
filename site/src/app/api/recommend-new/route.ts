// OKAZ API - Recommandation produit neuf ("Et en neuf ?")
// POST /api/recommend-new { query: string, priceMin: number, priceMax: number }
// Retourne: { success: boolean, recommendation?: {...} }

import { NextRequest, NextResponse } from 'next/server';
import { recommendNewProduct } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, priceMin, priceMax, topResults } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query manquante' },
        { status: 400 }
      );
    }

    console.log('[OKAZ API] Recommandation neuf pour:', query, '| Fourchette:', priceMin, '-', priceMax, '€');

    const recommendation = await recommendNewProduct(
      query,
      Number(priceMin) || 0,
      Number(priceMax) || 0,
      topResults
    );

    console.log('[OKAZ API] Recommandation:', recommendation.hasRecommendation ? recommendation.productName : 'Aucune');

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

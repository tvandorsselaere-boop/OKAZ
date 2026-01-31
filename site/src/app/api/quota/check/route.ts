// OKAZ API - Vérifier le quota disponible
// GET /api/quota/check?uuid=xxx
// Retourne: { status, dailyRemaining, boostCredits, isPremium }

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { QuotaStatus } from '@/lib/supabase/types';

const DAILY_LIMIT = 5; // 5 recherches gratuites par jour

export async function GET(request: NextRequest) {
  const uuid = request.nextUrl.searchParams.get('uuid');

  if (!uuid) {
    return NextResponse.json(
      { error: 'UUID requis' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();

    // Vérifier si premium via extension_uuid
    const { data: user } = await supabase
      .from('okaz_users')
      .select('premium_until')
      .eq('extension_uuid', uuid)
      .single();

    const isPremium = user?.premium_until && new Date(user.premium_until) > new Date();

    if (isPremium) {
      const status: QuotaStatus = {
        isPremium: true,
        premiumUntil: user.premium_until,
        dailyUsed: 0,
        dailyLimit: DAILY_LIMIT,
        dailyRemaining: DAILY_LIMIT,
        boostCredits: 0,
        totalRemaining: -1, // Illimité
      };

      return NextResponse.json(status);
    }

    // Récupérer le quota du jour
    const today = new Date().toISOString().split('T')[0];

    const { data: quota } = await supabase
      .from('okaz_quotas')
      .select('searches_used, boost_credits')
      .eq('extension_uuid', uuid)
      .eq('date', today)
      .single();

    const searchesUsed = quota?.searches_used || 0;
    const boostCredits = quota?.boost_credits || 0;
    const dailyRemaining = Math.max(0, DAILY_LIMIT - searchesUsed);

    const status: QuotaStatus = {
      isPremium: false,
      dailyUsed: searchesUsed,
      dailyLimit: DAILY_LIMIT,
      dailyRemaining,
      boostCredits,
      totalRemaining: dailyRemaining + boostCredits,
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('[OKAZ Quota] Erreur check:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

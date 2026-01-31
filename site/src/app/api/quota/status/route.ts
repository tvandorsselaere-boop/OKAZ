// OKAZ API - État complet du quota
// GET /api/quota/status?uuid=xxx
// Retourne: QuotaStatus complet

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { QuotaStatus } from '@/lib/supabase/types';

const DAILY_LIMIT = 5;

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

    // Vérifier si premium
    const { data: user } = await supabase
      .from('okaz_users')
      .select('premium_until')
      .eq('extension_uuid', uuid)
      .single();

    const isPremium = user?.premium_until && new Date(user.premium_until) > new Date();

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
      isPremium: !!isPremium,
      premiumUntil: user?.premium_until || undefined,
      dailyUsed: searchesUsed,
      dailyLimit: DAILY_LIMIT,
      dailyRemaining,
      boostCredits,
      totalRemaining: isPremium ? -1 : dailyRemaining + boostCredits,
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('[OKAZ Quota] Erreur status:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

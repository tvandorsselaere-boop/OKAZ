// OKAZ API - État complet du quota
// GET /api/quota/status?uuid=xxx
// Retourne: QuotaStatus complet (free daily, ou monthly pour plans)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { QuotaStatus } from '@/lib/supabase/types';
import type { PlanType } from '@/lib/stripe';

const DAILY_LIMIT = 5;

function getCurrentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

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

    // Récupérer le user avec plan info
    const { data: user } = await supabase
      .from('okaz_users')
      .select('plan_type, plan_until, premium_until, monthly_searches_limit, monthly_searches_used, monthly_reset_date')
      .eq('extension_uuid', uuid)
      .single();

    const planType: PlanType = (user?.plan_type as PlanType) || 'free';
    const planUntil = user?.plan_until || user?.premium_until;
    const isPlanActive = planUntil && new Date(planUntil) > new Date();
    const hasActivePlan = isPlanActive && planType !== 'free';

    // Reset mensuel lazy: si le mois a changé, reset le compteur
    let monthlyUsed = user?.monthly_searches_used || 0;
    const monthlyLimit = user?.monthly_searches_limit || 0;
    const currentMonthStart = getCurrentMonthStart();

    if (hasActivePlan && user?.monthly_reset_date && user.monthly_reset_date < currentMonthStart) {
      // Nouveau mois → reset
      monthlyUsed = 0;
      await supabase
        .from('okaz_users')
        .update({
          monthly_searches_used: 0,
          monthly_reset_date: currentMonthStart,
        })
        .eq('extension_uuid', uuid);
    }

    // Récupérer le quota journalier (pour free + boost)
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
    const monthlyRemaining = hasActivePlan ? Math.max(0, monthlyLimit - monthlyUsed) : 0;

    const status: QuotaStatus = {
      isPremium: !!hasActivePlan,
      planType: hasActivePlan ? planType : 'free',
      planUntil: planUntil || undefined,
      dailyUsed: searchesUsed,
      dailyLimit: DAILY_LIMIT,
      dailyRemaining,
      boostCredits,
      monthlyUsed: hasActivePlan ? monthlyUsed : 0,
      monthlyLimit: hasActivePlan ? monthlyLimit : 0,
      monthlyRemaining,
      totalRemaining: hasActivePlan
        ? monthlyRemaining + boostCredits
        : dailyRemaining + boostCredits,
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

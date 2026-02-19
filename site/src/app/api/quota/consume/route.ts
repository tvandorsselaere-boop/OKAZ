// OKAZ API - Consommer une recherche
// POST /api/quota/consume { uuid }
// Plans: free = daily quota, plus/pro = monthly quota, boost = one-time credits

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyRequestAuth } from '@/lib/auth/verify-request';

const DAILY_LIMIT = 5;

function getCurrentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uuid } = body;

    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID requis' },
        { status: 400 }
      );
    }

    // Vérifier le JWT (optionnel — fallback UUID si JWT absent/invalide)
    // Sécurité acceptable : UUID est un v4 random, non devinable
    const auth = await verifyRequestAuth(request, body);
    if ('error' in auth) {
      console.log('[OKAZ Quota] Consume sans JWT valide, fallback UUID:', uuid.substring(0, 8) + '...');
    }

    const supabase = createServiceClient();

    // Vérifier le plan utilisateur
    const { data: user } = await supabase
      .from('okaz_users')
      .select('id, plan_type, plan_until, premium_until, monthly_searches_limit, monthly_searches_used, monthly_reset_date')
      .eq('extension_uuid', uuid)
      .single();

    const planUntil = user?.plan_until || user?.premium_until;
    const planType = user?.plan_type || 'free';
    const isPlanActive = planUntil && new Date(planUntil) > new Date();
    const hasActivePlan = isPlanActive && planType !== 'free';

    if (hasActivePlan && user) {
      // Plan Plus ou Pro : quota mensuel
      let monthlyUsed = user.monthly_searches_used || 0;
      const monthlyLimit = user.monthly_searches_limit || 0;
      const currentMonthStart = getCurrentMonthStart();

      // Reset lazy si nouveau mois
      if (user.monthly_reset_date && user.monthly_reset_date < currentMonthStart) {
        monthlyUsed = 0;
        await supabase
          .from('okaz_users')
          .update({
            monthly_searches_used: 0,
            monthly_reset_date: currentMonthStart,
          })
          .eq('id', user.id);
      }

      if (monthlyUsed < monthlyLimit) {
        await supabase
          .from('okaz_users')
          .update({ monthly_searches_used: monthlyUsed + 1 })
          .eq('id', user.id);

        return NextResponse.json({
          allowed: true,
          source: 'plan',
          remaining: monthlyLimit - monthlyUsed - 1,
          boostRemaining: -1,
        });
      }

      // Quota mensuel épuisé, vérifier boost
      const today = new Date().toISOString().split('T')[0];
      const { data: quota } = await supabase
        .from('okaz_quotas')
        .select('id, boost_credits')
        .eq('extension_uuid', uuid)
        .eq('date', today)
        .single();

      if (quota && quota.boost_credits > 0) {
        await supabase
          .from('okaz_quotas')
          .update({ boost_credits: quota.boost_credits - 1 })
          .eq('id', quota.id)
          .eq('boost_credits', quota.boost_credits);

        return NextResponse.json({
          allowed: true,
          source: 'boost',
          remaining: 0,
          boostRemaining: quota.boost_credits - 1,
        });
      }

      return NextResponse.json({
        allowed: false,
        source: 'exhausted',
        remaining: 0,
        boostRemaining: 0,
      });
    }

    // Free: quota journalier
    const today = new Date().toISOString().split('T')[0];

    let { data: quota } = await supabase
      .from('okaz_quotas')
      .select('id, searches_used, boost_credits')
      .eq('extension_uuid', uuid)
      .eq('date', today)
      .single();

    if (!quota) {
      const { data: newQuota, error: insertError } = await supabase
        .from('okaz_quotas')
        .insert({
          extension_uuid: uuid,
          date: today,
          searches_used: 0,
          boost_credits: 0,
        })
        .select()
        .single();

      if (insertError) {
        const { data: existingQuota } = await supabase
          .from('okaz_quotas')
          .select('id, searches_used, boost_credits')
          .eq('extension_uuid', uuid)
          .eq('date', today)
          .single();

        quota = existingQuota;
      } else {
        quota = newQuota;
      }
    }

    if (!quota) {
      return NextResponse.json(
        { error: 'Erreur création quota' },
        { status: 500 }
      );
    }

    // Quota journalier
    if (quota.searches_used < DAILY_LIMIT) {
      const { error: updateError } = await supabase
        .from('okaz_quotas')
        .update({ searches_used: quota.searches_used + 1 })
        .eq('id', quota.id)
        .eq('searches_used', quota.searches_used);

      if (updateError) {
        return NextResponse.json(
          { error: 'Réessayez', retry: true },
          { status: 409 }
        );
      }

      return NextResponse.json({
        allowed: true,
        source: 'daily',
        remaining: DAILY_LIMIT - quota.searches_used - 1,
        boostRemaining: quota.boost_credits,
      });
    }

    // Boost
    if (quota.boost_credits > 0) {
      const { error: updateError } = await supabase
        .from('okaz_quotas')
        .update({ boost_credits: quota.boost_credits - 1 })
        .eq('id', quota.id)
        .eq('boost_credits', quota.boost_credits);

      if (updateError) {
        return NextResponse.json(
          { error: 'Réessayez', retry: true },
          { status: 409 }
        );
      }

      return NextResponse.json({
        allowed: true,
        source: 'boost',
        remaining: 0,
        boostRemaining: quota.boost_credits - 1,
      });
    }

    return NextResponse.json({
      allowed: false,
      source: 'exhausted',
      remaining: 0,
      boostRemaining: 0,
    });

  } catch (error) {
    console.error('[OKAZ Quota] Erreur consume:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

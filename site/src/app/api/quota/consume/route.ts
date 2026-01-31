// OKAZ API - Consommer une recherche
// POST /api/quota/consume { uuid }
// Retourne: { allowed, source, remaining, boostRemaining }

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const DAILY_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    const { uuid } = await request.json();

    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID requis' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Vérifier si premium
    const { data: user } = await supabase
      .from('okaz_users')
      .select('premium_until')
      .eq('extension_uuid', uuid)
      .single();

    if (user?.premium_until && new Date(user.premium_until) > new Date()) {
      return NextResponse.json({
        allowed: true,
        source: 'premium',
        remaining: -1,
        boostRemaining: -1,
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Récupérer ou créer le quota du jour
    let { data: quota } = await supabase
      .from('okaz_quotas')
      .select('id, searches_used, boost_credits')
      .eq('extension_uuid', uuid)
      .eq('date', today)
      .single();

    if (!quota) {
      // Créer le quota du jour
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
        // Race condition: quelqu'un d'autre a créé le quota
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

    // Vérifier quota journalier
    if (quota.searches_used < DAILY_LIMIT) {
      // Incrémenter atomiquement
      const { error: updateError } = await supabase
        .from('okaz_quotas')
        .update({ searches_used: quota.searches_used + 1 })
        .eq('id', quota.id)
        .eq('searches_used', quota.searches_used); // Optimistic locking

      if (updateError) {
        // Race condition, réessayer
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

    // Quota journalier épuisé, vérifier boost
    if (quota.boost_credits > 0) {
      const { error: updateError } = await supabase
        .from('okaz_quotas')
        .update({ boost_credits: quota.boost_credits - 1 })
        .eq('id', quota.id)
        .eq('boost_credits', quota.boost_credits); // Optimistic locking

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

    // Aucun quota disponible
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

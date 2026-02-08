// OKAZ API - Reset quota (DEV ONLY)
// POST /api/quota/reset { uuid }
// Remet searches_used à 0 et ajoute 20 boost_credits

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Seulement en dev
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { uuid } = await request.json();

    if (!uuid) {
      return NextResponse.json({ error: 'UUID requis' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Vérifier si un quota existe pour aujourd'hui
    const { data: existing } = await supabase
      .from('okaz_quotas')
      .select('id')
      .eq('extension_uuid', uuid)
      .eq('date', today)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('okaz_quotas')
        .update({ searches_used: 0, boost_credits: 20 })
        .eq('id', existing.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from('okaz_quotas')
        .insert({
          extension_uuid: uuid,
          date: today,
          searches_used: 0,
          boost_credits: 20,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    console.log('[OKAZ Quota] Reset OK pour UUID:', uuid.substring(0, 8) + '...');
    return NextResponse.json({
      success: true,
      message: 'Quota reset: 5 daily + 20 boost credits',
    });

  } catch (error) {
    console.error('[OKAZ Quota] Erreur reset:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

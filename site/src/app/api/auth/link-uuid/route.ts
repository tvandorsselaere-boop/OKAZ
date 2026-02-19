// OKAZ API - Lier l'UUID extension au compte utilisateur
// POST /api/auth/link-uuid { email, uuid }
// Requiert JWT — l'email du JWT doit matcher l'email de la requête

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyRequestAuth } from '@/lib/auth/verify-request';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uuid } = body;

    if (!email || !uuid) {
      return NextResponse.json({ error: 'Email et UUID requis' }, { status: 400 });
    }

    // Vérifier le JWT
    const auth = await verifyRequestAuth(request, body);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // L'email du JWT doit correspondre à l'email de la requête
    if (auth.user.email !== email) {
      return NextResponse.json({ error: 'Email non autorisé' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('okaz_users')
      .update({ extension_uuid: uuid, updated_at: new Date().toISOString() })
      .eq('email', email);

    if (error) {
      console.error('[OKAZ Auth] Erreur link-uuid:', error);
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 });
    }

    console.log('[OKAZ Auth] UUID lié pour:', email, '→', uuid.substring(0, 8) + '...');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[OKAZ Auth] Erreur link-uuid:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// OKAZ API - Vérifier un Magic Link
// GET /api/auth/verify?token=xxx
// Redirige vers l'app avec le JWT

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateToken } from '@/lib/auth/jwt';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${APP_URL}?auth=error&reason=missing_token`);
  }

  try {
    const supabase = createServiceClient();

    // Récupérer le magic token
    const { data: magicToken } = await supabase
      .from('okaz_magic_tokens')
      .select('id, email, expires_at, used_at')
      .eq('token', token)
      .single();

    if (!magicToken) {
      console.log('[OKAZ Auth] Token invalide:', token.substring(0, 8) + '...');
      return NextResponse.redirect(`${APP_URL}?auth=error&reason=invalid_token`);
    }

    // Vérifier expiration
    if (new Date(magicToken.expires_at) < new Date()) {
      console.log('[OKAZ Auth] Token expiré:', token.substring(0, 8) + '...');
      return NextResponse.redirect(`${APP_URL}?auth=error&reason=expired`);
    }

    // Vérifier si déjà utilisé
    if (magicToken.used_at) {
      console.log('[OKAZ Auth] Token déjà utilisé:', token.substring(0, 8) + '...');
      return NextResponse.redirect(`${APP_URL}?auth=error&reason=already_used`);
    }

    // Marquer comme utilisé
    await supabase
      .from('okaz_magic_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', magicToken.id);

    // Récupérer l'utilisateur
    const { data: user } = await supabase
      .from('okaz_users')
      .select('id, email, premium_until')
      .eq('email', magicToken.email)
      .single();

    if (!user) {
      return NextResponse.redirect(`${APP_URL}?auth=error&reason=user_not_found`);
    }

    // Générer un nouveau JWT (révoque automatiquement l'ancien)
    const premiumUntil = user.premium_until ? new Date(user.premium_until) : undefined;
    const jwt = await generateToken(user.id, user.email, premiumUntil);

    console.log('[OKAZ Auth] Connexion réussie pour:', user.email);

    // Rediriger avec le token
    // L'extension interceptera ce paramètre
    return NextResponse.redirect(`${APP_URL}?auth=success&token=${jwt}&email=${encodeURIComponent(user.email)}`);

  } catch (error) {
    console.error('[OKAZ Auth] Erreur verify:', error);
    return NextResponse.redirect(`${APP_URL}?auth=error&reason=server_error`);
  }
}

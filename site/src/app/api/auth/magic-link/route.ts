// OKAZ API - Envoyer un Magic Link
// POST /api/auth/magic-link { email }
// Retourne: { sent: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendMagicLink } from '@/lib/email';
import { randomBytes } from 'crypto';

const TOKEN_EXPIRY_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email invalide' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Vérifier que l'utilisateur existe et est premium
    const { data: user } = await supabase
      .from('okaz_users')
      .select('id, premium_until')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      // Utilisateur non trouvé - ne pas révéler cette info
      // On fait semblant d'envoyer l'email
      console.log('[OKAZ Auth] Magic Link demandé pour email inconnu:', email);
      return NextResponse.json({ sent: true });
    }

    // Vérifier si premium actif
    if (!user.premium_until || new Date(user.premium_until) <= new Date()) {
      console.log('[OKAZ Auth] Magic Link demandé pour non-premium:', email);
      return NextResponse.json(
        { error: 'Compte non premium' },
        { status: 403 }
      );
    }

    // Générer un token unique
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Stocker le token
    await supabase.from('okaz_magic_tokens').insert({
      email: email.toLowerCase(),
      token,
      expires_at: expiresAt.toISOString(),
    });

    // Envoyer l'email
    const sent = await sendMagicLink(email, token);

    if (!sent) {
      return NextResponse.json(
        { error: 'Erreur envoi email' },
        { status: 500 }
      );
    }

    console.log('[OKAZ Auth] Magic Link envoyé à:', email);

    return NextResponse.json({ sent: true });

  } catch (error) {
    console.error('[OKAZ Auth] Erreur magic-link:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

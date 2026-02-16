// OKAZ API - Envoyer un Magic Link (ouvert à tous les utilisateurs)
// POST /api/auth/magic-link { email }
// Retourne: { sent: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendMagicLink } from '@/lib/email';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { maskEmail } from '@/lib/auth/verify-request';
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

    const normalizedEmail = email.toLowerCase().trim();

    // Rate-limit par IP (10/heure)
    const ip = getClientIP(request.headers);
    const ipLimit = checkRateLimit(`magic-link-ip:${ip}`, 10, 3600_000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Trop de demandes, réessayez plus tard' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.resetIn / 1000)) } }
      );
    }

    // Rate-limit par email (3/heure)
    const emailLimit = checkRateLimit(`magic-link-email:${normalizedEmail}`, 3, 3600_000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Trop de demandes pour cet email, réessayez plus tard' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(emailLimit.resetIn / 1000)) } }
      );
    }

    const supabase = createServiceClient();

    // Vérifier si l'utilisateur existe
    let { data: user } = await supabase
      .from('okaz_users')
      .select('id, premium_until')
      .eq('email', normalizedEmail)
      .single();

    // Si l'utilisateur n'existe pas, le créer (plan free)
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('okaz_users')
        .insert({
          email: normalizedEmail,
          plan_type: 'free',
        })
        .select('id, premium_until')
        .single();

      if (createError) {
        console.error('[OKAZ Auth] Erreur création user:', createError.message);
        // Race condition : l'user a peut-être été créé entre-temps
        const { data: existingUser } = await supabase
          .from('okaz_users')
          .select('id, premium_until')
          .eq('email', normalizedEmail)
          .single();
        user = existingUser;
      } else {
        user = newUser;
      }

      console.log('[OKAZ Auth] Nouvel utilisateur créé:', maskEmail(normalizedEmail));
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Erreur serveur' },
        { status: 500 }
      );
    }

    // Générer un token unique
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Stocker le token
    await supabase.from('okaz_magic_tokens').insert({
      email: normalizedEmail,
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

    console.log('[OKAZ Auth] Magic Link envoyé à:', maskEmail(normalizedEmail));

    return NextResponse.json({ sent: true });

  } catch (error) {
    console.error('[OKAZ Auth] Erreur magic-link:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

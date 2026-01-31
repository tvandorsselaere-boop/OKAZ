// OKAZ - Gestion JWT (génération, vérification, révocation)
import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { createServiceClient } from '@/lib/supabase/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-min-32-characters-long');
const ISSUER = 'okaz.facile-ia.com';
const TOKEN_EXPIRY = '365d'; // 1 an

export interface TokenPayload {
  sub: string;      // user id
  email: string;
  jti: string;      // JWT ID unique
  premium: boolean;
  premiumUntil?: string;
  [key: string]: unknown; // Index signature for JWTPayload compatibility
}

/**
 * Génère un nouveau JWT pour un utilisateur
 * Révoque automatiquement l'ancien token
 */
export async function generateToken(userId: string, email: string, premiumUntil?: Date): Promise<string> {
  const supabase = createServiceClient();
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an

  // Récupérer l'ancien JTI pour le révoquer
  const { data: user } = await supabase
    .from('okaz_users')
    .select('current_token_jti')
    .eq('id', userId)
    .single();

  // Révoquer l'ancien token si existant
  if (user?.current_token_jti) {
    await revokeToken(user.current_token_jti, expiresAt);
  }

  // Mettre à jour le JTI actif en DB
  await supabase
    .from('okaz_users')
    .update({ current_token_jti: jti })
    .eq('id', userId);

  // Générer le nouveau token
  const isPremium = premiumUntil ? new Date(premiumUntil) > new Date() : false;

  const token = await new SignJWT({
    sub: userId,
    email,
    jti,
    premium: isPremium,
    premiumUntil: premiumUntil?.toISOString(),
  } as TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  console.log('[JWT] Token généré pour', email, 'JTI:', jti.substring(0, 8) + '...');

  return token;
}

/**
 * Vérifie un token JWT
 * Retourne null si invalide ou révoqué
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: ISSUER,
    });

    const jti = payload.jti as string;

    // Vérifier si révoqué
    const isRevoked = await isTokenRevoked(jti);
    if (isRevoked) {
      console.log('[JWT] Token révoqué:', jti.substring(0, 8) + '...');
      return null;
    }

    // Vérifier que c'est bien le token actif en DB
    const supabase = createServiceClient();
    const { data: user } = await supabase
      .from('okaz_users')
      .select('current_token_jti, premium_until')
      .eq('id', payload.sub)
      .single();

    if (!user || user.current_token_jti !== jti) {
      console.log('[JWT] Token non actif pour user:', payload.sub);
      // Ajouter à la blacklist pour éviter de refaire la vérif DB
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await revokeToken(jti, expiresAt);
      return null;
    }

    // Mettre à jour le statut premium si nécessaire
    const isPremium = user.premium_until ? new Date(user.premium_until) > new Date() : false;

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      jti,
      premium: isPremium,
      premiumUntil: user.premium_until || undefined,
    };
  } catch (error) {
    console.error('[JWT] Erreur vérification:', error);
    return null;
  }
}

/**
 * Révoque un token (ajoute à la blacklist)
 */
export async function revokeToken(jti: string, expiresAt?: Date): Promise<void> {
  const supabase = createServiceClient();

  const expiry = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await supabase
    .from('okaz_revoked_tokens')
    .upsert({
      jti,
      expires_at: expiry.toISOString(),
    });

  console.log('[JWT] Token révoqué:', jti.substring(0, 8) + '...');
}

/**
 * Vérifie si un token est révoqué
 */
async function isTokenRevoked(jti: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('okaz_revoked_tokens')
    .select('jti')
    .eq('jti', jti)
    .single();

  return !!data;
}

/**
 * Révoque tous les tokens d'un utilisateur (changement email, etc.)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Récupérer le token actuel
  const { data: user } = await supabase
    .from('okaz_users')
    .select('current_token_jti')
    .eq('id', userId)
    .single();

  if (user?.current_token_jti) {
    await revokeToken(user.current_token_jti);
  }

  // Effacer le token actif
  await supabase
    .from('okaz_users')
    .update({ current_token_jti: null })
    .eq('id', userId);

  console.log('[JWT] Tous les tokens révoqués pour user:', userId);
}

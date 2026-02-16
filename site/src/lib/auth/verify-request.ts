// OKAZ - Middleware d'authentification pour API routes
// Vérifie JWT + gère quota côté serveur + search tokens

import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from './jwt';
import { createServiceClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Search tokens : validité 5 minutes, stockés en mémoire
// optimize émet un token, analyze/recommend-new le vérifient
const searchTokens = new Map<string, { userId: string; expiresAt: number }>();

// Nettoyage périodique des tokens expirés
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of searchTokens) {
    if (data.expiresAt < now) searchTokens.delete(token);
  }
}, 60_000);

export interface AuthResult {
  user: TokenPayload;
  uuid: string;
}

export interface AuthError {
  error: string;
  status: number;
}

/**
 * Vérifie l'authentification d'une requête API.
 * Extrait le JWT du header Authorization ou du body.
 */
export async function verifyRequestAuth(
  request: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthResult | AuthError> {
  // Extraire le JWT du header Authorization
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { error: 'Authentification requise', status: 401 };
  }

  // Vérifier le JWT
  const user = await verifyToken(token);
  if (!user) {
    return { error: 'Session expirée ou invalide', status: 401 };
  }

  // Extraire l'UUID du body (fallback pour identifier l'extension)
  const uuid = (body?.uuid as string) || '';

  return { user, uuid };
}

/**
 * Génère un search token temporaire (5 min) après consommation du quota.
 * Ce token est vérifié par analyze et recommend-new.
 */
export function generateSearchToken(userId: string): string {
  const token = uuidv4();
  searchTokens.set(token, {
    userId,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return token;
}

/**
 * Vérifie un search token (émis par optimize).
 */
export function verifySearchToken(token: string, userId: string): boolean {
  const data = searchTokens.get(token);
  if (!data) return false;
  if (data.expiresAt < Date.now()) {
    searchTokens.delete(token);
    return false;
  }
  if (data.userId !== userId) return false;
  return true;
}

const DAILY_LIMIT = 5;

/**
 * Consomme 1 recherche de quota côté serveur.
 * Premium = toujours autorisé.
 * Free = 5/jour.
 */
export async function consumeQuotaForRequest(
  userId: string,
  uuid: string
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createServiceClient();

  // Vérifier le plan utilisateur
  const { data: user } = await supabase
    .from('okaz_users')
    .select('id, plan_type, plan_until, premium_until, monthly_searches_limit, monthly_searches_used, monthly_reset_date')
    .eq('id', userId)
    .single();

  if (!user) {
    return { allowed: false, remaining: 0 };
  }

  const planUntil = user.plan_until || user.premium_until;
  const planType = user.plan_type || 'free';
  const isPlanActive = planUntil && new Date(planUntil) > new Date();
  const hasActivePlan = isPlanActive && planType !== 'free';

  // Plan payant : quota mensuel
  if (hasActivePlan) {
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
      return { allowed: true, remaining: monthlyLimit - monthlyUsed - 1 };
    }

    // Plan épuisé, vérifier boost
    return await tryBoostCredits(supabase, uuid);
  }

  // Free : quota journalier
  const today = new Date().toISOString().split('T')[0];
  const extUuid = uuid || user.id; // fallback sur user id

  let { data: quota } = await supabase
    .from('okaz_quotas')
    .select('id, searches_used, boost_credits')
    .eq('extension_uuid', extUuid)
    .eq('date', today)
    .single();

  if (!quota) {
    const { data: newQuota, error: insertError } = await supabase
      .from('okaz_quotas')
      .insert({
        extension_uuid: extUuid,
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
        .eq('extension_uuid', extUuid)
        .eq('date', today)
        .single();
      quota = existingQuota;
    } else {
      quota = newQuota;
    }
  }

  if (!quota) {
    return { allowed: false, remaining: 0 };
  }

  if (quota.searches_used < DAILY_LIMIT) {
    const { error: updateError } = await supabase
      .from('okaz_quotas')
      .update({ searches_used: quota.searches_used + 1 })
      .eq('id', quota.id)
      .eq('searches_used', quota.searches_used); // optimistic locking

    if (updateError) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: DAILY_LIMIT - quota.searches_used - 1 };
  }

  // Quota journalier épuisé, essayer boost
  if (quota.boost_credits > 0) {
    await supabase
      .from('okaz_quotas')
      .update({ boost_credits: quota.boost_credits - 1 })
      .eq('id', quota.id)
      .eq('boost_credits', quota.boost_credits);
    return { allowed: true, remaining: 0 };
  }

  return { allowed: false, remaining: 0 };
}

async function tryBoostCredits(
  supabase: ReturnType<typeof createServiceClient>,
  uuid: string
): Promise<{ allowed: boolean; remaining: number }> {
  if (!uuid) return { allowed: false, remaining: 0 };

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
    return { allowed: true, remaining: 0 };
  }

  return { allowed: false, remaining: 0 };
}

function getCurrentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

/**
 * Masque un email pour les logs : "van***@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.substring(0, 3);
  return `${visible}***@${domain}`;
}

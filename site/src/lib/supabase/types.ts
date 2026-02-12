// OKAZ - Types Supabase

import type { PlanType } from '@/lib/stripe';

export interface OkazUser {
  id: string;
  email: string;
  extension_uuid: string | null;
  premium_until: string | null;  // legacy, kept for backward compat
  plan_type: PlanType;
  plan_until: string | null;
  monthly_searches_limit: number;
  monthly_searches_used: number;
  monthly_reset_date: string | null;
  current_token_jti: string | null;
  created_at: string;
  updated_at: string;
}

export interface OkazPurchase {
  id: string;
  user_id: string | null;
  extension_uuid: string | null;
  stripe_payment_id: string;
  stripe_customer_id: string | null;
  type: 'boost' | 'pro' | 'premium';
  amount_cents: number;
  credits_added: number | null;
  created_at: string;
}

export interface OkazQuota {
  id: string;
  extension_uuid: string;
  date: string;
  searches_used: number;
  boost_credits: number;
  created_at: string;
  updated_at: string;
}

export interface OkazMagicToken {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface OkazRevokedToken {
  jti: string;
  revoked_at: string;
  expires_at: string;
}

// Résultat de la fonction consume_search
export interface ConsumeSearchResult {
  allowed: boolean;
  source: 'plan' | 'daily' | 'boost' | 'exhausted';
  remaining: number;
  boost_remaining: number;
}

// État du quota pour l'extension
export interface QuotaStatus {
  isPremium: boolean;  // true si plus ou pro actif
  planType: PlanType;
  planUntil?: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  boostCredits: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  totalRemaining: number;  // daily + boost, ou monthly remaining pour plans
}

// OKAZ - Configuration Stripe
import Stripe from 'stripe';

// Lazy initialization pour éviter erreur au build
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Alias pour compatibilité (deprecated, utiliser getStripe())
export const stripe = {
  get checkout() { return getStripe().checkout; },
  get webhooks() { return getStripe().webhooks; },
  get customers() { return getStripe().customers; },
  get subscriptions() { return getStripe().subscriptions; },
};

// Price IDs (configurés dans Stripe Dashboard + env vars Vercel)
export const STRIPE_PRICES = {
  BOOST: process.env.STRIPE_PRICE_BOOST || '',
  PRO: process.env.STRIPE_PRICE_PRO || '',
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM || '',
};

// Montants en centimes
export const AMOUNTS = {
  BOOST: 99,        // 0.99€
  PRO: 1999,        // 19.99€/an
  PREMIUM: 4999,    // 49.99€/an
};

// Crédits par achat
export const CREDITS = {
  BOOST: 10,        // +10 recherches (one-time)
};

// Plans avec quotas mensuels
export type PlanType = 'free' | 'pro' | 'premium';

export const PLANS: Record<Exclude<PlanType, 'free'>, {
  name: string;
  amount: number;
  monthlySearches: number;
}> = {
  pro: {
    name: 'OKAZ Pro',
    amount: AMOUNTS.PRO,
    monthlySearches: 100,
  },
  premium: {
    name: 'OKAZ Premium',
    amount: AMOUNTS.PREMIUM,
    monthlySearches: 500,
  },
};

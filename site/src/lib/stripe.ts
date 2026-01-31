// OKAZ - Configuration Stripe
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Price IDs (à configurer dans Stripe Dashboard)
export const STRIPE_PRICES = {
  BOOST: process.env.STRIPE_PRICE_BOOST || 'price_boost_placeholder',
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_placeholder',
};

// Montants en centimes
export const AMOUNTS = {
  BOOST: 99,      // 0.99€
  PREMIUM: 999,   // 9.99€
};

// Crédits par achat
export const CREDITS = {
  BOOST: 10,      // +10 recherches
};

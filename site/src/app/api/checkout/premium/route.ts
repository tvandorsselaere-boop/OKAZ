// OKAZ API - Créer session Stripe pour un abonnement (Pro ou Premium)
// POST /api/checkout/premium { email, uuid, planType: 'pro' | 'premium' }
// Retourne: { checkoutUrl }

import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS, STRIPE_PRICES } from '@/lib/stripe';
import type { PlanType } from '@/lib/stripe';
import { maskEmail } from '@/lib/auth/verify-request';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { email, uuid, planType } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    // Valider le type de plan
    const validPlans: PlanType[] = ['pro', 'premium'];
    const plan = validPlans.includes(planType) ? planType as Exclude<PlanType, 'free'> : 'pro';
    const planConfig = PLANS[plan];

    console.log('[OKAZ Checkout]', planConfig.name, 'pour:', maskEmail(email));

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: plan === 'premium' ? STRIPE_PRICES.PREMIUM : STRIPE_PRICES.PRO,
          quantity: 1,
        },
      ],
      metadata: {
        uuid: uuid || '',
        type: plan,
        email,
      },
      success_url: `${APP_URL}?premium=success&email=${encodeURIComponent(email)}`,
      cancel_url: `${APP_URL}?premium=cancel`,
    });

    console.log('[OKAZ Checkout] Session', planConfig.name, 'créée:', session.id);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('[OKAZ Checkout] Erreur premium:', error);
    return NextResponse.json(
      { error: 'Erreur création session' },
      { status: 500 }
    );
  }
}

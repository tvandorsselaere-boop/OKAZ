// OKAZ API - Créer session Stripe pour Premium
// POST /api/checkout/premium { email, uuid }
// Retourne: { checkoutUrl }

import { NextRequest, NextResponse } from 'next/server';
import { stripe, AMOUNTS } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { email, uuid } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    console.log('[OKAZ Checkout] Premium pour:', email);

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'OKAZ Premium',
              description: 'Recherches illimitées + Alertes + Historique prix + Nego-Coach',
            },
            unit_amount: AMOUNTS.PREMIUM,
            recurring: {
              interval: 'year',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        uuid: uuid || '',
        type: 'premium',
        email,
      },
      success_url: `${APP_URL}?premium=success&email=${encodeURIComponent(email)}`,
      cancel_url: `${APP_URL}?premium=cancel`,
    });

    console.log('[OKAZ Checkout] Session Premium créée:', session.id);

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

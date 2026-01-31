// OKAZ API - Créer session Stripe pour Pack Boost
// POST /api/checkout/boost { uuid }
// Retourne: { checkoutUrl }

import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICES, AMOUNTS } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { uuid } = await request.json();

    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID requis' },
        { status: 400 }
      );
    }

    console.log('[OKAZ Checkout] Boost pour UUID:', uuid.substring(0, 8) + '...');

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'OKAZ Pack Boost',
              description: '+10 recherches supplémentaires',
            },
            unit_amount: AMOUNTS.BOOST,
          },
          quantity: 1,
        },
      ],
      metadata: {
        uuid,
        type: 'boost',
      },
      success_url: `${APP_URL}?boost=success`,
      cancel_url: `${APP_URL}?boost=cancel`,
    });

    console.log('[OKAZ Checkout] Session créée:', session.id);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('[OKAZ Checkout] Erreur boost:', error);
    return NextResponse.json(
      { error: 'Erreur création session' },
      { status: 500 }
    );
  }
}

// OKAZ API - Stripe Customer Portal
// POST /api/checkout/portal { uuid }
// Retourne: { portalUrl }

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { uuid } = await request.json();

    if (!uuid) {
      return NextResponse.json({ error: 'UUID requis' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const stripe = getStripe();

    // Trouver le Stripe customer ID via les achats
    const { data: purchase } = await supabase
      .from('okaz_purchases')
      .select('stripe_customer_id')
      .eq('extension_uuid', uuid)
      .eq('type', 'premium')
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!purchase?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Aucun abonnement trouvé' },
        { status: 404 }
      );
    }

    // Créer une session du portail client Stripe
    const session = await stripe.billingPortal.sessions.create({
      customer: purchase.stripe_customer_id,
      return_url: APP_URL,
    });

    return NextResponse.json({ portalUrl: session.url });

  } catch (error) {
    console.error('[OKAZ Portal] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur création session portail' },
      { status: 500 }
    );
  }
}

// OKAZ API - Webhook Stripe
// POST /api/webhooks/stripe
// Gérer les événements: checkout.session.completed, customer.subscription.deleted

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, CREDITS } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('[OKAZ Webhook] Signature manquante');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[OKAZ Webhook] Signature invalide:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[OKAZ Webhook] Événement reçu:', event.type, event.id);

  // Idempotence: vérifier si déjà traité
  const supabase = createServiceClient();
  const eventKey = `webhook_${event.id}`;

  // Utiliser les purchases pour tracker les événements traités
  const { data: existing } = await supabase
    .from('okaz_purchases')
    .select('id')
    .eq('stripe_payment_id', event.id)
    .single();

  if (existing) {
    console.log('[OKAZ Webhook] Événement déjà traité:', event.id);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log('[OKAZ Webhook] Événement ignoré:', event.type);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[OKAZ Webhook] Erreur traitement:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { uuid, type, email } = session.metadata || {};
  const supabase = createServiceClient();

  console.log('[OKAZ Webhook] Checkout completed:', type, 'UUID:', uuid?.substring(0, 8), 'Email:', email);

  if (type === 'boost' && uuid) {
    // Pack Boost: ajouter des crédits
    const today = new Date().toISOString().split('T')[0];

    // Récupérer ou créer le quota
    let { data: quota } = await supabase
      .from('okaz_quotas')
      .select('id, boost_credits')
      .eq('extension_uuid', uuid)
      .eq('date', today)
      .single();

    if (!quota) {
      const { data: newQuota } = await supabase
        .from('okaz_quotas')
        .insert({
          extension_uuid: uuid,
          date: today,
          searches_used: 0,
          boost_credits: 0,
        })
        .select()
        .single();
      quota = newQuota;
    }

    if (quota) {
      // Ajouter les crédits
      await supabase
        .from('okaz_quotas')
        .update({ boost_credits: quota.boost_credits + CREDITS.BOOST })
        .eq('id', quota.id);

      console.log('[OKAZ Webhook] +', CREDITS.BOOST, 'crédits pour UUID:', uuid.substring(0, 8));
    }

    // Enregistrer l'achat
    await supabase.from('okaz_purchases').insert({
      extension_uuid: uuid,
      stripe_payment_id: session.payment_intent as string || session.id,
      stripe_customer_id: session.customer as string,
      type: 'boost',
      amount_cents: 99,
      credits_added: CREDITS.BOOST,
    });

  } else if (type === 'premium' && email) {
    // Premium: créer ou mettre à jour l'utilisateur
    const premiumUntil = new Date();
    premiumUntil.setFullYear(premiumUntil.getFullYear() + 1); // +1 an

    // Upsert user
    const { data: existingUser } = await supabase
      .from('okaz_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      await supabase
        .from('okaz_users')
        .update({
          premium_until: premiumUntil.toISOString(),
          extension_uuid: uuid || null,
        })
        .eq('id', existingUser.id);
    } else {
      await supabase.from('okaz_users').insert({
        email,
        extension_uuid: uuid || null,
        premium_until: premiumUntil.toISOString(),
      });
    }

    console.log('[OKAZ Webhook] Premium activé pour:', email, 'jusqu\'au:', premiumUntil.toISOString());

    // Enregistrer l'achat
    const { data: user } = await supabase
      .from('okaz_users')
      .select('id')
      .eq('email', email)
      .single();

    await supabase.from('okaz_purchases').insert({
      user_id: user?.id,
      extension_uuid: uuid,
      stripe_payment_id: session.subscription as string || session.id,
      stripe_customer_id: session.customer as string,
      type: 'premium',
      amount_cents: 999,
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = subscription.customer as string;

  console.log('[OKAZ Webhook] Subscription deleted, customer:', customerId);

  // Trouver l'utilisateur par Stripe customer ID
  const { data: purchase } = await supabase
    .from('okaz_purchases')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .eq('type', 'premium')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (purchase?.user_id) {
    // Révoquer le premium
    await supabase
      .from('okaz_users')
      .update({ premium_until: new Date().toISOString() })
      .eq('id', purchase.user_id);

    console.log('[OKAZ Webhook] Premium révoqué pour user:', purchase.user_id);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[OKAZ Webhook] Payment failed, customer:', invoice.customer);
  // TODO: Envoyer email de notification
}

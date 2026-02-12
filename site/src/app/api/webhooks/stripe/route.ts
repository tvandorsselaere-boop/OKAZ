// OKAZ API - Webhook Stripe
// POST /api/webhooks/stripe
// Gérer les événements: checkout.session.completed, customer.subscription.updated/deleted

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, CREDITS, PLANS } from '@/lib/stripe';
import type { PlanType } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWelcomePremium } from '@/lib/email';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

function getMonthlyResetDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

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

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
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
      await supabase
        .from('okaz_quotas')
        .update({ boost_credits: quota.boost_credits + CREDITS.BOOST })
        .eq('id', quota.id);

      console.log('[OKAZ Webhook] +', CREDITS.BOOST, 'crédits pour UUID:', uuid.substring(0, 8));
    }

    await supabase.from('okaz_purchases').insert({
      extension_uuid: uuid,
      stripe_payment_id: session.payment_intent as string || session.id,
      stripe_customer_id: session.customer as string,
      type: 'boost',
      amount_cents: 99,
      credits_added: CREDITS.BOOST,
    });

  } else if ((type === 'pro' || type === 'premium') && email) {
    // Abonnement Pro ou Premium
    const planType = type as Exclude<PlanType, 'free'>;
    const planConfig = PLANS[planType];
    const planUntil = new Date();
    planUntil.setFullYear(planUntil.getFullYear() + 1);

    const userData = {
      plan_type: planType,
      plan_until: planUntil.toISOString(),
      premium_until: planUntil.toISOString(), // backward compat
      monthly_searches_limit: planConfig.monthlySearches,
      monthly_searches_used: 0,
      monthly_reset_date: getMonthlyResetDate(),
      extension_uuid: uuid || null,
    };

    const { data: existingUser } = await supabase
      .from('okaz_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      await supabase
        .from('okaz_users')
        .update(userData)
        .eq('id', existingUser.id);
    } else {
      await supabase.from('okaz_users').insert({
        email,
        ...userData,
      });
    }

    console.log('[OKAZ Webhook]', planConfig.name, 'activé pour:', email, 'jusqu\'au:', planUntil.toISOString());

    sendWelcomePremium(email).then(sent => {
      console.log('[OKAZ Webhook] Email bienvenue:', sent ? 'envoyé' : 'échec');
    });

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
      type: planType,
      amount_cents: planConfig.amount,
    });

  } else if (type === 'plus' && email) {
    // Legacy: ancien format "plus" → traiter comme "pro"
    const planUntil = new Date();
    planUntil.setFullYear(planUntil.getFullYear() + 1);

    const { data: existingUser } = await supabase
      .from('okaz_users')
      .select('id')
      .eq('email', email)
      .single();

    const userData = {
      plan_type: 'pro' as const,
      plan_until: planUntil.toISOString(),
      premium_until: planUntil.toISOString(),
      monthly_searches_limit: PLANS.pro.monthlySearches,
      monthly_searches_used: 0,
      monthly_reset_date: getMonthlyResetDate(),
      extension_uuid: uuid || null,
    };

    if (existingUser) {
      await supabase.from('okaz_users').update(userData).eq('id', existingUser.id);
    } else {
      await supabase.from('okaz_users').insert({ email, ...userData });
    }

    console.log('[OKAZ Webhook] Legacy plus → Pro pour:', email);

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
      type: 'pro',
      amount_cents: PLANS.pro.amount,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = subscription.customer as string;

  console.log('[OKAZ Webhook] Subscription updated, customer:', customerId, 'cancel_at_period_end:', subscription.cancel_at_period_end);

  const cancelAtEnd = subscription.cancel_at_period_end;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEndTs = (subscription as any).current_period_end;
  if (cancelAtEnd && periodEndTs) {
    const periodEnd = new Date(periodEndTs * 1000);

    const { data: purchase } = await supabase
      .from('okaz_purchases')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .in('type', ['plus', 'pro', 'premium'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (purchase?.user_id) {
      await supabase
        .from('okaz_users')
        .update({
          plan_until: periodEnd.toISOString(),
          premium_until: periodEnd.toISOString(),
        })
        .eq('id', purchase.user_id);

      console.log('[OKAZ Webhook] Plan annulé, actif jusqu\'au:', periodEnd.toISOString());
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const customerId = subscription.customer as string;

  console.log('[OKAZ Webhook] Subscription deleted, customer:', customerId);

  const { data: purchase } = await supabase
    .from('okaz_purchases')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .in('type', ['plus', 'pro', 'premium'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (purchase?.user_id) {
    await supabase
      .from('okaz_users')
      .update({
        plan_type: 'free',
        plan_until: new Date().toISOString(),
        premium_until: new Date().toISOString(),
        monthly_searches_limit: 0,
        monthly_searches_used: 0,
      })
      .eq('id', purchase.user_id);

    console.log('[OKAZ Webhook] Plan révoqué pour user:', purchase.user_id);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[OKAZ Webhook] Payment failed, customer:', invoice.customer);
}

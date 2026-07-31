import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { accountService } from '../account/account.service';
import { getStripe } from './stripe';
import * as log from '../../utils/logger';

export class SubscriptionService {
  /** Current subscription + plan + salon limit for the owner's account. */
  async getForUser(userId: string) {
    const ctx = await accountService.getContextForUser(userId);
    return {
      account: ctx.account,
      subscription: ctx.subscription,
      salonLimit: ctx.salonLimit,
      salonCount: ctx.salons.length,
    };
  }

  /**
   * Create a Stripe Checkout session (test mode) for the base plan.
   * Uses the plan's stripePriceId when set, otherwise inline price_data
   * (no Stripe dashboard setup needed in dev).
   */
  async createCheckout(userId: string, planId?: string) {
    const stripe = getStripe();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) {
      throw { status: 401, error: 'User not found', message: 'User no longer exists' };
    }

    const account = await accountService.ensureAccountForOwner(userId);

    const plan = planId
      ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
      : await prisma.subscriptionPlan.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
    if (!plan || !plan.isActive) {
      throw { status: 404, error: 'Plan not found', message: 'Aucun plan disponible' };
    }

    // Reuse the Stripe customer if the account already has one
    const existingSub = await prisma.subscription.findUnique({
      where: { accountId: account.id },
    });

    let customerId = existingSub?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        metadata: { accountId: account.id },
      });
      customerId = customer.id;
    }

    const frontendUrl = (process.env.PRO_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = plan.stripePriceId
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: plan.currency.toLowerCase(),
            unit_amount: plan.priceCents,
            recurring: { interval: plan.interval === 'month' ? 'month' : 'year' },
            product_data: {
              name: `Reza Pro — ${plan.name}`,
              description: `Jusqu'à ${plan.maxSalons} salon(s)`,
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [lineItem],
      success_url: `${frontendUrl}/dashboard/rendez-vous?checkout=success`,
      cancel_url: `${frontendUrl}/dashboard/rendez-vous?checkout=cancel`,
      metadata: { accountId: account.id, planId: plan.id },
      subscription_data: {
        metadata: { accountId: account.id, planId: plan.id },
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  /** Map a Stripe subscription status to our enum. */
  private mapStatus(stripeStatus: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'NONE' {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
      case 'unpaid':
      case 'incomplete_expired':
        return 'CANCELED';
      default:
        return 'NONE';
    }
  }

  /** checkout.session.completed → activate the account subscription. */
  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const accountId = session.metadata?.accountId;
    const planId = session.metadata?.planId;
    if (!accountId || !planId) {
      log.warn('[Stripe] checkout.session.completed without account/plan metadata');
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    let currentPeriodEnd: Date | null = null;
    if (stripeSubscriptionId) {
      try {
        const stripeSub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
        const endUnix = stripeSub.items.data[0]?.current_period_end;
        if (endUnix) currentPeriodEnd = new Date(endUnix * 1000);
      } catch (e) {
        log.warn('[Stripe] Could not retrieve subscription for period end:', e);
      }
    }

    await prisma.subscription.upsert({
      where: { accountId },
      create: {
        accountId,
        planId,
        status: 'ACTIVE',
        stripeCustomerId: stripeCustomerId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        currentPeriodEnd,
      },
      update: {
        planId,
        status: 'ACTIVE',
        stripeCustomerId: stripeCustomerId ?? null,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
        currentPeriodEnd,
      },
    });

    await accountService.syncTenantsVisibility(accountId, true);
    log.log(`[Stripe] Subscription activated for account ${accountId}`);
  }

  /** customer.subscription.updated / .deleted → sync status + visibility. */
  async handleSubscriptionEvent(stripeSub: Stripe.Subscription) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSub.id },
    });
    if (!sub) {
      log.warn(`[Stripe] Unknown subscription ${stripeSub.id} — ignored`);
      return;
    }

    const status = this.mapStatus(stripeSub.status);
    const endUnix = stripeSub.items.data[0]?.current_period_end;

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status,
        currentPeriodEnd: endUnix ? new Date(endUnix * 1000) : sub.currentPeriodEnd,
      },
    });

    await accountService.syncTenantsVisibility(sub.accountId, status === 'ACTIVE');
    log.log(`[Stripe] Subscription ${stripeSub.id} -> ${status} (account ${sub.accountId})`);
  }
}

export const subscriptionService = new SubscriptionService();

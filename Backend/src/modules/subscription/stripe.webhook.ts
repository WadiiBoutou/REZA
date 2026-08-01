import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { getStripe } from './stripe';
import { subscriptionService } from './subscription.service';
import * as log from '../../utils/logger';

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Stripe webhook (test mode). Mounted with express.raw BEFORE the JSON body
 * parser so signature verification works. Local dev:
 *   stripe listen --forward-to localhost:5000/api/webhooks/stripe
 */
router.post('/', async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error('[Stripe] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    log.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await subscriptionService.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await subscriptionService.handleSubscriptionEvent(
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        // Unhandled event types are acknowledged silently
        break;
    }
    res.json({ received: true });
  } catch (error) {
    log.error(`[Stripe] Error handling ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;

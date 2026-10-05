// Stripe webhook for the client portal's yearly care plan. Keeps each client's plan status in sync.
//
// Environment variables:
//   PORTAL_STRIPE_SECRET_KEY      your business's Stripe secret key
//   PORTAL_STRIPE_WEBHOOK_SECRET  signing secret of this endpoint (Stripe > Developers > Webhooks), with events:
//                                 checkout.session.completed, customer.subscription.created,
//                                 customer.subscription.updated, customer.subscription.deleted
import { createPortalWebhookHandler } from "../lib/portal-api.js";
import { blobStore } from "../lib/portal-store.js";
import { sendSms, smsConfigured } from "../lib/sms.js";
import { stripe } from "../lib/stripe.js";

export default createPortalWebhookHandler({
  store: blobStore(),
  stripe: () => stripe("PORTAL_STRIPE_SECRET_KEY"),
  secret: () => process.env.PORTAL_STRIPE_WEBHOOK_SECRET,
  notify: async (message) => {
    if (process.env.PORTAL_ALERT_PHONE && smsConfigured()) await sendSms(process.env.PORTAL_ALERT_PHONE, message);
  },
});

export const config = { path: "/api/portal-stripe-webhook" };

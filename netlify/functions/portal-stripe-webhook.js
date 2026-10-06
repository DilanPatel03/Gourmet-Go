// Stripe webhook for the client portal's yearly care plan. Keeps each client's plan status in sync.
//
// Environment variables:
//   PORTAL_STRIPE_SECRET_KEY      your business's Stripe secret key
//   PORTAL_STRIPE_WEBHOOK_SECRET  signing secret of this endpoint (Stripe > Developers > Webhooks), with events:
//                                 checkout.session.completed, customer.subscription.created,
//                                 customer.subscription.updated, customer.subscription.deleted
import { createPortalWebhookHandler } from "../lib/portal-api.js";
import { blobStore } from "../lib/portal-store.js";
import { createNotifier } from "../lib/portal-notify.js";
import { createPush } from "../lib/push.js";
import { stripe } from "../lib/stripe.js";

const store = blobStore();
const push = createPush({ store });
const notify = createNotifier({ store, push });

export default createPortalWebhookHandler({
  store,
  stripe: () => stripe("PORTAL_STRIPE_SECRET_KEY"),
  secret: () => process.env.PORTAL_STRIPE_WEBHOOK_SECRET,
  notify,
});

export const config = { path: "/api/portal-stripe-webhook" };

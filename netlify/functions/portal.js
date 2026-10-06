// Client portal API at /api/portal/*. See netlify/lib/portal-api.js.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   PORTAL_ADMIN_KEY          required, a long secret (16+ characters) you type to open portal/admin.html
//   PORTAL_STRIPE_SECRET_KEY  optional, your business's Stripe secret key, for the yearly plan payments
//   PORTAL_ALERT_PHONE        optional, texts you about new requests and messages (uses the TWILIO_* variables)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT  optional, push notifications to the admin app
import { createPortalHandler } from "../lib/portal-api.js";
import { blobStore } from "../lib/portal-store.js";
import { createNotifier } from "../lib/portal-notify.js";
import { createPush } from "../lib/push.js";
import { stripe } from "../lib/stripe.js";

const store = blobStore();
const push = createPush({ store });
const notify = createNotifier({ store, push });

export default createPortalHandler({
  store,
  stripe: () => stripe("PORTAL_STRIPE_SECRET_KEY"),
  notify,
  push,
});

export const config = { path: "/api/portal/*" };

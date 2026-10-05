// Client portal API at /api/portal/*. See netlify/lib/portal-api.js.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   PORTAL_ADMIN_KEY          required, a long secret (16+ characters) you type to open portal/admin.html
//   PORTAL_STRIPE_SECRET_KEY  optional, your business's Stripe secret key, for the yearly plan payments
//   PORTAL_ALERT_PHONE        optional, texts you about new requests and messages (uses the TWILIO_* variables)
import { createPortalHandler } from "../lib/portal-api.js";
import { blobStore } from "../lib/portal-store.js";
import { sendSms, smsConfigured } from "../lib/sms.js";
import { stripe } from "../lib/stripe.js";

export default createPortalHandler({
  store: blobStore(),
  stripe: () => stripe("PORTAL_STRIPE_SECRET_KEY"),
  notify: async (message) => {
    if (process.env.PORTAL_ALERT_PHONE && smsConfigured()) await sendSms(process.env.PORTAL_ALERT_PHONE, message);
  },
});

export const config = { path: "/api/portal/*" };

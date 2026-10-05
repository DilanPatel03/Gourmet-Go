// Shared Stripe clients. Uses fetch so it runs on any Node 18+ runtime.
// Online ordering uses STRIPE_SECRET_KEY (the restaurant's account); the client portal uses
// PORTAL_STRIPE_SECRET_KEY (your business's account), so the money lands in the right place.
import Stripe from "stripe";

const clients = new Map();
export function stripe(keyEnv = "STRIPE_SECRET_KEY") {
  const key = process.env[keyEnv];
  if (!key) return null;
  if (!clients.has(key)) clients.set(key, new Stripe(key, { httpClient: Stripe.createFetchHttpClient() }));
  return clients.get(key);
}

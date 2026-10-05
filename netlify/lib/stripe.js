// Shared Stripe client for the ordering functions. Uses fetch so it runs on any Node 18+ runtime.
import Stripe from "stripe";

let client;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
  return client;
}

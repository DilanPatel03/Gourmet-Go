// Creates a Stripe Checkout page for a website order (pickup or delivery).
// Prices come from data/menu.js on the server; the browser only sends item ids and quantities.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   STRIPE_SECRET_KEY    required, from the Stripe dashboard (Developers > API keys)
//   STRIPE_TAX_RATE_ID   optional, a tax rate created in Stripe (Product catalog > Tax rates), applied to food
//   ORDERS_PAUSED        optional, set to "true" to stop taking online orders (redeploy to apply)
import { randomInt } from "node:crypto";
import { ORDERING, priceOrder } from "../../data/ordering.js";
import { stripe } from "../lib/stripe.js";

const reply = (status, payload) => Response.json(payload, { status });
const clean = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

function orderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[randomInt(chars.length)];
  return `GG-${code}`;
}

export default async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  if (process.env.ORDERS_PAUSED === "true") {
    return reply(503, { error: "Online ordering is paused right now. Please order on DoorDash or visit the drive-thru." });
  }
  const client = stripe();
  if (!client) {
    console.error("STRIPE_SECRET_KEY is not set");
    return reply(503, { error: "Online ordering isn't set up yet. Please order on DoorDash." });
  }

  let body;
  try {
    const text = await req.text();
    if (text.length > 20000) return reply(413, { error: "Order is too large." });
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "Something went wrong. Please refresh and try again." });
  }

  const type = body?.type;
  const name = clean(body?.customer?.name, 60);
  const phone = clean(body?.customer?.phone, 20);
  const street = clean(body?.address?.street, 120);
  const unit = clean(body?.address?.unit, 30);
  const zip = clean(body?.address?.zip, 10);
  const notes = clean(body?.notes, 200);

  if (!name) return reply(400, { error: "Please enter your name." });
  if (phone.replace(/\D/g, "").length < 10) return reply(400, { error: "Please enter a phone number we can reach you at." });
  if (type === "delivery" && street.length < 3) return reply(400, { error: "Please enter your delivery address." });

  const order = priceOrder(body?.cart, type, zip);
  if (order.error) return reply(400, { error: order.error });

  const taxRates = process.env.STRIPE_TAX_RATE_ID ? [process.env.STRIPE_TAX_RATE_ID] : undefined;
  const lineItems = order.lines.map((l) => ({
    price_data: { currency: "usd", unit_amount: l.unit, product_data: { name: l.name } },
    quantity: l.qty,
    ...(taxRates && { tax_rates: taxRates }),
  }));
  if (order.deliveryFee) {
    lineItems.push({
      price_data: { currency: "usd", unit_amount: order.deliveryFee, product_data: { name: "Delivery fee" } },
      quantity: 1,
    });
  }

  const code = orderCode();
  const origin = new URL(req.url).origin;
  const eta = type === "delivery" ? ORDERING.delivery.etaMinutes : ORDERING.pickup.readyMinutes;

  try {
    const session = await client.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      client_reference_id: code,
      metadata: { order_code: code, type, name, phone, street, unit, zip: zip.slice(0, 5), notes },
      success_url: `${origin}/order-success.html?order=${code}&type=${type}&eta=${eta}`,
      cancel_url: `${origin}/#menu`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // abandoned checkouts expire after ~30 minutes
    });
    return reply(200, { url: session.url, code });
  } catch (error) {
    console.error("Stripe checkout error:", error?.message ?? error);
    return reply(502, { error: "We couldn't start checkout. Please try again, or order on DoorDash." });
  }
};

export const config = { path: "/api/checkout" };

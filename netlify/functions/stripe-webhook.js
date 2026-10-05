// Receives Stripe's "payment succeeded" events and texts each new order to the restaurant via Twilio.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   STRIPE_SECRET_KEY      required
//   STRIPE_WEBHOOK_SECRET  required, the signing secret of this endpoint in Stripe (Developers > Webhooks)
//   TWILIO_ACCOUNT_SID     required, from the Twilio console
//   TWILIO_AUTH_TOKEN      required
//   TWILIO_FROM_NUMBER     required, your Twilio phone number, e.g. +15551234567
//   ORDER_ALERT_PHONE      required, who gets the texts, e.g. +15557654321 (comma-separate several numbers)
import { formatMoney } from "../../data/ordering.js";
import { stripe } from "../lib/stripe.js";

const text = (status, body) => new Response(body, { status });

async function orderMessage(client, session) {
  const m = session.metadata ?? {};
  const items = await client.checkout.sessions.listLineItems(session.id, { limit: 100 });
  const lines = items.data
    .filter((li) => li.description !== "Delivery fee")
    .map((li) => `${li.quantity}x ${li.description}`);
  return [
    `NEW ${m.type === "delivery" ? "DELIVERY" : "PICKUP"} ORDER ${m.order_code ?? ""}`.trim(),
    `Paid ${formatMoney(session.amount_total ?? 0)}`,
    "",
    ...lines,
    "",
    `Name: ${m.name ?? ""}`,
    `Phone: ${m.phone ?? ""}`,
    ...(m.type === "delivery" ? [`Deliver to: ${[m.street, m.unit, m.zip].filter(Boolean).join(", ")}`] : []),
    ...(m.notes ? [`Notes: ${m.notes}`] : []),
  ].join("\n");
}

async function sendText(body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, ORDER_ALERT_PHONE: to } = process.env;
  if (!sid || !token || !from || !to) throw new Error("Twilio environment variables are not set");
  for (const number of to.split(",").map((n) => n.trim()).filter(Boolean)) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: number, From: from, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}: ${await res.text()}`);
  }
}

export default async (req) => {
  if (req.method !== "POST") return text(405, "Use POST.");
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) {
    console.error("STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set");
    return text(500, "Not configured");
  }

  let event;
  try {
    event = client.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch (error) {
    console.error("Webhook signature check failed:", error.message);
    return text(400, "Bad signature");
  }

  const paid =
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paid) return text(200, "Ignored");

  try {
    await sendText(await orderMessage(client, event.data.object));
    return text(200, "Sent");
  } catch (error) {
    // A non-2xx response makes Stripe retry the event later, so the text isn't lost.
    console.error("Order notification failed:", error.message);
    return text(500, "Notification failed");
  }
};

export const config = { path: "/api/stripe-webhook" };

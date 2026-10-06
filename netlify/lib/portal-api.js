// Client portal API: clients manage Google Ads requests, the yearly care plan, support requests and
// messages; the admin (you) manages clients and answers them. Mounted at /api/portal/* by
// netlify/functions/portal.js. Dependencies are passed in so the logic can be tested without Netlify.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PORTAL } from "../../portal/config.js";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const newId = () => `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const json = (status, payload) => Response.json(payload, { status });
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const line = (v, max) => text(v, max).replace(/\s+/g, " ");
const ACTIVE = ["active", "trialing", "past_due"];
const STATUSES = ["open", "in_progress", "done"];

export function createPortalHandler({ store, stripe, notify, push = null, now = () => new Date().toISOString() }) {
  const bearer = (req) => {
    const h = req.headers.get("authorization") ?? "";
    return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  };
  const isAdmin = (req) => {
    const key = process.env.PORTAL_ADMIN_KEY ?? "";
    const given = bearer(req);
    if (key.length < 16 || !given) return false;
    return timingSafeEqual(Buffer.from(sha256(key)), Buffer.from(sha256(given)));
  };
  async function clientFor(req) {
    const token = bearer(req);
    if (!token) return null;
    const ref = await store.getJSON(`tokens/${sha256(token)}`);
    const client = ref && (await store.getJSON(`clients/${ref.clientId}`));
    return client && !client.archived ? client : null;
  }
  async function list(prefix) {
    const keys = await store.keys(prefix);
    return (await Promise.all(keys.map((k) => store.getJSON(k)))).filter(Boolean);
  }
  const saveClient = (c) => store.setJSON(`clients/${c.id}`, c);
  const view = ({ tokenHash, ...client }) => client;
  async function safeNotify(message, clientId) {
    try {
      await notify(message, { clientId });
    } catch (error) {
      console.error("Portal notification failed:", error.message);
    }
  }
  async function issueLink(client, origin) {
    if (client.tokenHash) await store.delete(`tokens/${client.tokenHash}`);
    const token = randomBytes(24).toString("base64url");
    client.tokenHash = sha256(token);
    await store.setJSON(`tokens/${client.tokenHash}`, { clientId: client.id });
    await saveClient(client);
    return `${origin}/portal/?k=${token}`;
  }
  async function readBody(req) {
    const raw = await req.text();
    if (raw.length > 20000) throw new Error("Too large");
    return raw ? JSON.parse(raw) : {};
  }
  const bump = (client, field) => {
    client.unread = { tickets: 0, messages: 0, ...client.unread };
    client.unread[field] += 1;
  };

  // ---- Client routes ----
  async function clientRoute(req, client, parts, origin) {
    const route = `${req.method} ${parts.join("/")}`;

    if (route === "GET me") {
      return json(200, {
        client: view(client),
        tickets: (await list(`tickets/${client.id}/`)).reverse(),
        messages: await list(`messages/${client.id}/`),
        billingEnabled: Boolean(stripe()),
      });
    }

    if (route === "POST tickets") {
      const body = await readBody(req);
      const kind = body.kind;
      const ticket = {
        id: newId(), clientId: client.id, kind, status: "open", priority: body.priority === "urgent" ? "urgent" : "normal",
        subject: "", details: text(body.details, 4000), ads: null, updates: [], createdAt: now(), updatedAt: now(),
      };
      if (kind === "ads") {
        const action = body.ads?.action;
        if (!PORTAL.ads.actions[action]) return json(400, { error: "Choose what you'd like to do with your ads." });
        const budget = body.ads?.budget === "" || body.ads?.budget == null ? null : Number(body.ads.budget);
        if (budget !== null && !(Number.isFinite(budget) && budget >= 1 && budget <= 100000)) {
          return json(400, { error: "Enter a monthly budget between $1 and $100,000." });
        }
        const goal = body.ads?.goal;
        if (action === "start" && !PORTAL.ads.goals[goal]) return json(400, { error: "Choose a goal for the campaign." });
        if (action === "start" && budget === null) return json(400, { error: "Enter a monthly budget for the campaign." });
        ticket.ads = { action, goal: PORTAL.ads.goals[goal] ? goal : null, budget, area: line(body.ads?.area, 120) };
        ticket.subject = `Google Ads: ${PORTAL.ads.actions[action]}`;
      } else if (PORTAL.requestKinds[kind]) {
        ticket.subject = line(body.subject, 120);
        if (!ticket.subject) return json(400, { error: "Add a short subject." });
        if (!ticket.details) return json(400, { error: "Describe what you need." });
      } else {
        return json(400, { error: "Choose a request type." });
      }
      await store.setJSON(`tickets/${client.id}/${ticket.id}`, ticket);
      bump(client, "tickets");
      await saveClient(client);
      await safeNotify(`${ticket.priority === "urgent" ? "URGENT " : ""}New request from ${client.name}: ${ticket.subject}`, client.id);
      return json(201, { ticket });
    }

    if (req.method === "POST" && parts[0] === "tickets" && parts[2] === "reply" && parts.length === 3) {
      const key = `tickets/${client.id}/${parts[1]}`;
      const ticket = await store.getJSON(key);
      if (!ticket) return json(404, { error: "Request not found." });
      const reply = text((await readBody(req)).text, 4000);
      if (!reply) return json(400, { error: "Write a reply first." });
      ticket.updates.push({ by: "client", text: reply, at: now() });
      if (ticket.status === "done") ticket.status = "open";
      ticket.updatedAt = now();
      await store.setJSON(key, ticket);
      bump(client, "tickets");
      await saveClient(client);
      await safeNotify(`${client.name} replied on "${ticket.subject}"`, client.id);
      return json(200, { ticket });
    }

    if (route === "POST messages") {
      const body = text((await readBody(req)).text, 2000);
      if (!body) return json(400, { error: "Write a message first." });
      const message = { id: newId(), from: "client", text: body, at: now() };
      await store.setJSON(`messages/${client.id}/${message.id}`, message);
      bump(client, "messages");
      await saveClient(client);
      await safeNotify(`New message from ${client.name}: ${body.slice(0, 140)}`, client.id);
      return json(201, { message });
    }

    if (route === "POST billing/checkout") {
      const s = stripe();
      if (!s) return json(503, { error: "Online payment isn't set up yet. We'll send you an invoice instead." });
      if (ACTIVE.includes(client.subscription?.status)) {
        return json(409, { error: "Your plan is already active. Use Manage billing to update your card." });
      }
      const session = await s.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(PORTAL.plan.price * 100),
            recurring: { interval: "year" },
            product_data: { name: `${PORTAL.plan.name}${client.domain ? ` (${client.domain})` : ""}` },
          },
        }],
        ...(client.subscription?.customerId
          ? { customer: client.subscription.customerId }
          : client.email ? { customer_email: client.email } : {}),
        client_reference_id: client.id,
        metadata: { clientId: client.id },
        subscription_data: { metadata: { clientId: client.id } },
        success_url: `${origin}/portal/?billing=success#billing`,
        cancel_url: `${origin}/portal/#billing`,
      });
      return json(200, { url: session.url });
    }

    if (route === "POST billing/manage") {
      const s = stripe();
      if (!s || !client.subscription?.customerId) return json(400, { error: "There's no billing account yet. Pay the plan first." });
      const session = await s.billingPortal.sessions.create({ customer: client.subscription.customerId, return_url: `${origin}/portal/#billing` });
      return json(200, { url: session.url });
    }

    return json(404, { error: "Not found." });
  }

  // ---- Admin routes ----
  async function adminRoute(req, parts, origin) {
    const [, section, id, sub] = parts; // parts[0] === "admin"

    if (section === "push") {
      if (!push) return json(501, { error: "Notifications aren't available." });
      if (req.method === "GET" && id === "key") return json(200, { enabled: push.enabled(), publicKey: push.publicKey() });
      if (req.method === "POST" && id === "subscribe") {
        if (!push.enabled()) return json(503, { error: "Notifications aren't set up yet. Add the VAPID keys on Netlify." });
        if (!(await push.subscribe((await readBody(req)).subscription))) return json(400, { error: "This device couldn't be registered." });
        return json(200, { ok: true });
      }
      if (req.method === "POST" && id === "unsubscribe") {
        await push.unsubscribe((await readBody(req)).endpoint);
        return json(200, { ok: true });
      }
      if (req.method === "POST" && id === "test") {
        const sent = await push.send({ title: PORTAL.brand, body: "Notifications are working.", url: "/portal/admin.html" });
        return json(200, { sent });
      }
    }

    if (req.method === "GET" && section === "clients" && !id) {
      const clients = (await list("clients/")).filter((c) => !c.archived);
      const rows = await Promise.all(
        clients.map(async (c) => {
          const tickets = await list(`tickets/${c.id}/`);
          return { ...view(c), openRequests: tickets.filter((t) => t.status !== "done").length };
        }),
      );
      return json(200, { clients: rows });
    }

    if (req.method === "POST" && section === "clients" && !id) {
      const body = await readBody(req);
      const name = line(body.name, 80);
      if (!name) return json(400, { error: "Enter the client's business name." });
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "client";
      const client = {
        id: `${slug}-${randomBytes(2).toString("hex")}`, name,
        domain: line(body.domain, 120), email: line(body.email, 120), phone: line(body.phone, 30),
        createdAt: now(), subscription: null, unread: { tickets: 0, messages: 0 },
      };
      const link = await issueLink(client, origin);
      return json(201, { client: view(client), link });
    }

    if (section === "clients" && id) {
      const client = await store.getJSON(`clients/${id}`);
      if (!client) return json(404, { error: "Client not found." });
      if (req.method === "GET" && !sub) {
        client.unread = { tickets: 0, messages: 0 };
        await saveClient(client);
        return json(200, {
          client: view(client),
          tickets: (await list(`tickets/${id}/`)).reverse(),
          messages: await list(`messages/${id}/`),
        });
      }
      if (req.method === "POST" && sub === "link") return json(200, { link: await issueLink(client, origin) });
      if (req.method === "POST" && !sub) {
        const body = await readBody(req);
        for (const [field, max] of [["name", 80], ["domain", 120], ["email", 120], ["phone", 30]]) {
          if (typeof body[field] === "string") client[field] = line(body[field], max);
        }
        if (typeof body.archived === "boolean") client.archived = body.archived;
        if (!client.name) return json(400, { error: "Name can't be empty." });
        await saveClient(client);
        return json(200, { client: view(client) });
      }
    }

    if (req.method === "POST" && section === "tickets" && id && sub) {
      const key = `tickets/${id}/${sub}`;
      const ticket = await store.getJSON(key);
      if (!ticket) return json(404, { error: "Request not found." });
      const body = await readBody(req);
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return json(400, { error: "Unknown status." });
        ticket.status = body.status;
      }
      const reply = text(body.reply, 4000);
      if (reply) ticket.updates.push({ by: "admin", text: reply, at: now() });
      ticket.updatedAt = now();
      await store.setJSON(key, ticket);
      return json(200, { ticket });
    }

    if (req.method === "POST" && section === "messages" && id) {
      if (!(await store.getJSON(`clients/${id}`))) return json(404, { error: "Client not found." });
      const body = text((await readBody(req)).text, 2000);
      if (!body) return json(400, { error: "Write a message first." });
      const message = { id: newId(), from: "admin", text: body, at: now() };
      await store.setJSON(`messages/${id}/${message.id}`, message);
      return json(201, { message });
    }

    return json(404, { error: "Not found." });
  }

  return async (req) => {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\/portal\/?/, "").split("/").filter(Boolean);
    try {
      if (parts[0] === "admin") {
        if (!isAdmin(req)) return json(401, { error: "Wrong admin key." });
        return await adminRoute(req, parts, url.origin);
      }
      const client = await clientFor(req);
      if (!client) return json(401, { error: "This portal link isn't valid anymore. Ask us for a new one." });
      return await clientRoute(req, client, parts, url.origin);
    } catch (error) {
      if (error instanceof SyntaxError || error.message === "Too large") return json(400, { error: "Something went wrong. Please refresh and try again." });
      console.error("Portal error:", error);
      return json(500, { error: "Something went wrong on our side. Please try again." });
    }
  };
}

// ---- Stripe webhook for the yearly plan ----
function applySubscription(client, sub) {
  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  client.subscription = {
    ...client.subscription,
    status: sub.status,
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
}

export function createPortalWebhookHandler({ store, stripe, notify, secret }) {
  return async (req) => {
    if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
    const s = stripe();
    if (!s || !secret()) return new Response("Not configured", { status: 500 });
    let event;
    try {
      event = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret());
    } catch (error) {
      console.error("Portal webhook signature check failed:", error.message);
      return new Response("Bad signature", { status: 400 });
    }

    const obj = event.data.object;
    let clientId, sub;
    if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
      clientId = obj.client_reference_id || obj.metadata?.clientId;
      sub = await s.subscriptions.retrieve(typeof obj.subscription === "string" ? obj.subscription : obj.subscription.id);
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      clientId = obj.metadata?.clientId;
      sub = obj;
    } else {
      return new Response("Ignored", { status: 200 });
    }

    const client = clientId && (await store.getJSON(`clients/${clientId}`));
    if (!client) {
      console.error(`Portal webhook: no client for ${event.type} (${clientId})`);
      return new Response("Unknown client", { status: 200 });
    }
    const before = client.subscription ?? {};
    applySubscription(client, sub);
    await store.setJSON(`clients/${client.id}`, client);

    const after = client.subscription;
    let message = null;
    if (event.type === "checkout.session.completed") message = `${client.name} paid the yearly care plan.`;
    else if (after.status === "canceled" && before.status !== "canceled") message = `${client.name}'s care plan was canceled.`;
    else if (after.status === "past_due" && before.status !== "past_due") message = `${client.name}'s care plan payment failed.`;
    else if (after.cancelAtPeriodEnd && !before.cancelAtPeriodEnd) message = `${client.name} turned off auto-renew for the care plan.`;
    if (message) {
      try {
        await notify(message, { clientId: client.id });
      } catch (error) {
        console.error("Portal notification failed:", error.message);
      }
    }
    return new Response("OK", { status: 200 });
  };
}

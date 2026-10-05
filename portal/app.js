// Client side of the portal: Google Ads requests, yearly care plan, support requests and messages.
import { PORTAL } from "./config.js";
import { api, fmtDate, h, messageThread, money, planPill, planState, submitting, ticketCard, toast } from "./ui.js";

const KEY_STORE = "portal-key";
const app = document.getElementById("app");
const tabs = document.querySelector(".tabs");
document.querySelectorAll(".js-brand").forEach((el) => (el.textContent = PORTAL.brand));
document.title = `${PORTAL.brand} · Client Portal`;

// The private link looks like /portal/?k=TOKEN. Keep the token on this device and remove it from the address bar.
const params = new URLSearchParams(location.search);
let key = params.get("k");
try {
  if (key) localStorage.setItem(KEY_STORE, key);
  else key = localStorage.getItem(KEY_STORE);
} catch {}
const billingResult = params.get("billing");
if (params.has("k") || params.has("billing")) history.replaceState(null, "", location.pathname + location.hash);

let data = null;
const tab = () => (location.hash.slice(1) || "overview");

function signedOut(text) {
  tabs.hidden = true;
  app.replaceChildren(
    h("section", { class: "card narrow" },
      h("h1", {}, "Welcome to your client portal"),
      h("p", { class: "muted" }, text)));
}

async function load() {
  if (!key) return signedOut(`Open this page with the private link ${PORTAL.brand} sent you.`);
  try {
    data = await api("me", { key });
  } catch (e) {
    if (e.status === 401) {
      try { localStorage.removeItem(KEY_STORE); } catch {}
      return signedOut(e.message);
    }
    if (!data) return signedOut("We couldn't load your portal. Check your connection and refresh the page.");
    return;
  }
  render();
}

function render() {
  tabs.hidden = false;
  document.querySelector(".js-who").textContent = data.client.name;
  tabs.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab() ? "page" : "false"));
  const views = { overview, ads, billing, requests, messages };
  // Keep anything the client is typing if a background refresh re-renders the page.
  const drafts = [...app.querySelectorAll("input, textarea, select")].map((el) => [el.id, el.type === "checkbox" || el.type === "radio" ? el.checked : el.value]);
  const focused = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  app.replaceChildren((views[tab()] ?? overview)());
  for (const [id, v] of drafts) {
    const el = id && document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox" || el.type === "radio") el.checked = v;
    else el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const refocus = focused && document.getElementById(focused);
  if (refocus && app.contains(refocus)) {
    refocus.focus({ preventScroll: true });
    if (typeof caret === "number" && "setSelectionRange" in refocus && refocus.type !== "number") refocus.setSelectionRange(caret, caret);
  }
  if (tab() === "messages") app.querySelector(".thread")?.lastElementChild?.scrollIntoView({ block: "nearest" });
}

const pageHead = (title, intro) => h("header", { class: "page-head" }, h("h1", {}, title), intro ? h("p", { class: "muted" }, intro) : null);

function overview() {
  const c = data.client;
  const open = data.tickets.filter((t) => t.status !== "done");
  const last = data.messages.at(-1);
  const plan = planState(c.subscription);
  return h("div", {},
    pageHead(`Hi, ${c.name}`, "Everything about your website in one place."),
    h("div", { class: "grid" },
      h("section", { class: "card" },
        h("p", { class: "label" }, "Website"),
        c.domain ? h("p", { class: "big" }, h("a", { href: `https://${c.domain.replace(/^https?:\/\//, "")}`, target: "_blank", rel: "noopener" }, c.domain)) : h("p", { class: "big muted" }, "Not set"),
        h("p", { class: "muted" }, "Hosted and maintained by ", PORTAL.brand, ".")),
      h("section", { class: "card" },
        h("p", { class: "label" }, "Care plan"),
        h("p", { class: "big" }, planPill(c.subscription)),
        h("p", { class: "muted" }, plan.active && c.subscription?.renewsAt
          ? `${c.subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${fmtDate(c.subscription.renewsAt)}`
          : `${money(PORTAL.plan.price)} per year`),
        h("a", { class: "link", href: "#billing" }, plan.active ? "View billing" : "Pay now")),
      h("section", { class: "card" },
        h("p", { class: "label" }, "Open requests"),
        h("p", { class: "big num" }, open.length),
        h("a", { class: "link", href: "#requests" }, "New request")),
      h("section", { class: "card" },
        h("p", { class: "label" }, "Messages"),
        last ? h("p", { class: "snippet" }, last.text) : h("p", { class: "muted" }, "Send us a message any time."),
        h("a", { class: "link", href: "#messages" }, "Open messages"))));
}

function ads() {
  const actions = Object.entries(PORTAL.ads.actions);
  const form = h("form", { class: "card form", novalidate: true },
    h("fieldset", {},
      h("legend", {}, "What would you like to do?"),
      h("div", { class: "choices" }, actions.map(([value, label], i) =>
        h("label", { class: "choice" },
          h("input", { type: "radio", name: "action", id: `ads-action-${value}`, value, checked: i === 0 }),
          h("span", {}, label))))),
    h("div", { class: "fields js-goal" },
      h("label", { for: "ads-goal" }, "Goal"),
      h("select", { id: "ads-goal", name: "goal" },
        h("option", { value: "" }, "Choose a goal"),
        Object.entries(PORTAL.ads.goals).map(([v, l]) => h("option", { value: v }, l)))),
    h("div", { class: "row js-budget" },
      h("div", { class: "fields" },
        h("label", { for: "ads-budget" }, "Monthly budget (USD)"),
        h("input", { id: "ads-budget", name: "budget", type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "300" })),
      h("div", { class: "fields" },
        h("label", { for: "ads-area" }, "Area to show ads in"),
        h("input", { id: "ads-area", name: "area", maxlength: "120", placeholder: "e.g. 10 miles around our store" }))),
    h("div", { class: "fields" },
      h("label", { for: "ads-details" }, "Anything else we should know?"),
      h("textarea", { id: "ads-details", name: "details", rows: "3", maxlength: "4000", placeholder: "Promotions to feature, dates, keywords…" })),
    h("p", { class: "form-error", role: "alert" }),
    h("button", { class: "btn", type: "submit" }, "Send to our team"),
    h("p", { class: "hint" }, "We make the change in Google Ads, usually within one business day, and update the request here. Ad spend is billed by Google to your ads account."));

  const sync = () => {
    const action = form.action.value;
    form.querySelector(".js-goal").hidden = action !== "start";
    form.querySelector(".js-budget").hidden = !["start", "change"].includes(action);
  };
  form.addEventListener("change", sync);
  sync();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const f = Object.fromEntries(new FormData(form));
      const { ticket } = await api("tickets", { key, method: "POST", body: { kind: "ads", details: f.details, ads: { action: f.action, goal: f.goal, budget: f.budget, area: f.area } } });
      data.tickets.unshift(ticket);
      form.reset();
      toast("Sent. We'll take it from here.");
      render();
    });
  });

  const list = data.tickets.filter((t) => t.kind === "ads");
  return h("div", {},
    pageHead("Google Ads", "Start, change, pause or stop your ads. Our team handles the setup in Google Ads for you."),
    form,
    h("h2", { class: "section-title" }, "Your ads requests"),
    list.length ? h("div", { class: "stack" }, list.map((t) => ticketCard(t, { footer: replyForm(t) }))) : h("p", { class: "empty" }, "No ads requests yet."));
}

function billing() {
  const c = data.client;
  const plan = planState(c.subscription);
  const banner =
    billingResult === "success"
      ? h("p", { class: "notice ok" }, "Thank you! Your payment went through. It can take a minute for your plan to show as active.")
      : null;
  const pay = h("button", { class: "btn", type: "button" }, `Pay ${money(PORTAL.plan.price)} / year`);
  const manage = h("button", { class: "btn btn-quiet", type: "button" }, "Manage billing");
  const go = (path, btn) => async () => {
    btn.disabled = true;
    try {
      location.href = (await api(path, { key, method: "POST" })).url;
    } catch (e) {
      toast(e.message, "bad");
      btn.disabled = false;
    }
  };
  pay.addEventListener("click", go("billing/checkout", pay));
  manage.addEventListener("click", go("billing/manage", manage));

  return h("div", {},
    pageHead("Billing", "Your yearly website and domain care plan."),
    banner,
    h("section", { class: "card plan" },
      h("div", { class: "plan-head" },
        h("div", {},
          h("p", { class: "label" }, PORTAL.plan.name),
          h("p", { class: "price" }, money(PORTAL.plan.price), h("span", {}, " / year"))),
        planPill(c.subscription)),
      h("ul", { class: "checks" }, PORTAL.plan.includes.map((i) => h("li", {}, i))),
      plan.active && c.subscription?.renewsAt
        ? h("p", { class: "muted" }, `${c.subscription.cancelAtPeriodEnd ? "Your plan ends on" : "Renews automatically on"} ${fmtDate(c.subscription.renewsAt)}.`)
        : null,
      c.subscription?.status === "past_due" ? h("p", { class: "notice bad" }, "Your last payment didn't go through. Use Manage billing to update your card.") : null,
      h("div", { class: "actions" },
        !data.billingEnabled
          ? h("p", { class: "muted" }, "Online payment isn't set up yet. We'll send you an invoice instead.")
          : [plan.active ? null : pay, c.subscription?.customerId ? manage : null]),
      h("p", { class: "hint" }, "Payments are processed securely by Stripe. Manage billing lets you update your card, download receipts or turn off auto-renew.")));
}

function replyForm(t) {
  const id = `reply-${t.id}`;
  const form = h("form", { class: "reply" },
    h("label", { class: "sr-only", for: id }, "Reply"),
    h("textarea", { id, name: "text", rows: "2", maxlength: "4000", placeholder: "Add a reply…" }),
    h("p", { class: "form-error", role: "alert" }),
    h("button", { class: "btn btn-quiet btn-small", type: "submit" }, "Reply"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const { ticket } = await api(`tickets/${t.id}/reply`, { key, method: "POST", body: { text: form.text.value } });
      data.tickets = data.tickets.map((x) => (x.id === ticket.id ? ticket : x));
      form.text.value = "";
      render();
    });
  });
  return form;
}

function requests() {
  const form = h("form", { class: "card form", novalidate: true },
    h("div", { class: "fields" },
      h("label", { for: "req-kind" }, "Type of request"),
      h("select", { id: "req-kind", name: "kind" }, Object.entries(PORTAL.requestKinds).map(([v, l]) => h("option", { value: v }, l)))),
    h("div", { class: "fields" },
      h("label", { for: "req-subject" }, "Subject"),
      h("input", { id: "req-subject", name: "subject", maxlength: "120", required: true, placeholder: "e.g. Update our holiday hours" })),
    h("div", { class: "fields" },
      h("label", { for: "req-details" }, "Details"),
      h("textarea", { id: "req-details", name: "details", rows: "5", maxlength: "4000", required: true, placeholder: "What should change, where on the site, and any text or photos we need" })),
    h("label", { class: "check" },
      h("input", { type: "checkbox", id: "req-urgent", name: "urgent" }),
      h("span", {}, "This is urgent (the site is down or customers can't order)")),
    h("p", { class: "form-error", role: "alert" }),
    h("button", { class: "btn", type: "submit" }, "Submit request"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const f = Object.fromEntries(new FormData(form));
      const { ticket } = await api("tickets", { key, method: "POST", body: { kind: f.kind, subject: f.subject, details: f.details, priority: f.urgent ? "urgent" : "normal" } });
      data.tickets.unshift(ticket);
      form.reset();
      toast("Request received. We'll update it here.");
      render();
    });
  });
  const list = data.tickets.filter((t) => t.kind !== "ads");
  return h("div", {},
    pageHead("Support & maintenance", "Report a problem or ask for a change to your website."),
    form,
    h("h2", { class: "section-title" }, "Your requests"),
    list.length ? h("div", { class: "stack" }, list.map((t) => ticketCard(t, { footer: replyForm(t) }))) : h("p", { class: "empty" }, "No requests yet."));
}

function messages() {
  const form = h("form", { class: "composer" },
    h("label", { class: "sr-only", for: "msg-text" }, "Message"),
    h("textarea", { id: "msg-text", name: "text", rows: "2", maxlength: "2000", placeholder: `Message ${PORTAL.brand}…` }),
    h("button", { class: "btn", type: "submit" }, "Send"),
    h("p", { class: "form-error", role: "alert" }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const { message } = await api("messages", { key, method: "POST", body: { text: form.text.value } });
      data.messages.push(message);
      form.text.value = "";
      render();
    });
  });
  return h("div", {},
    pageHead("Messages", `Write to the ${PORTAL.brand} team directly. We usually reply within one business day.`),
    h("section", { class: "card chat" }, messageThread(data.messages, "client"), form));
}

addEventListener("hashchange", () => data && render());
setInterval(() => document.visibilityState === "visible" && data && load(), 30000);
load();

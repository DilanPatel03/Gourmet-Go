// Shared helpers for the client portal and admin pages.
import { PORTAL } from "./config.js";

// h("p", { class: "x", onclick }, "text", child) builds DOM safely (strings become text, never HTML).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export async function api(path, { key, method = "GET", body } = {}) {
  const res = await fetch(`/api/portal/${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: res.status });
  return data;
}

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
export const money = (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const STATUS = { open: ["Open", "info"], in_progress: ["In progress", "warn"], done: ["Done", "ok"] };
export const statusPill = (s) => h("span", { class: `pill pill-${STATUS[s]?.[1] ?? "muted"}` }, STATUS[s]?.[0] ?? s);

export function planState(sub) {
  const s = sub?.status;
  if (s === "active" || s === "trialing") {
    return sub.cancelAtPeriodEnd
      ? { label: "Ends " + fmtDate(sub.renewsAt), tone: "warn", active: true }
      : { label: "Active", tone: "ok", active: true };
  }
  if (s === "past_due" || s === "unpaid") return { label: "Payment failed", tone: "bad", active: true };
  if (s === "canceled") return { label: "Canceled", tone: "muted", active: false };
  if (s === "incomplete") return { label: "Payment pending", tone: "warn", active: false };
  return { label: "Not paid", tone: "muted", active: false };
}
export const planPill = (sub) => {
  const p = planState(sub);
  return h("span", { class: `pill pill-${p.tone}` }, p.label);
};

export const kindLabel = (t) =>
  t.kind === "ads" ? "Google Ads" : t.kind === "maintenance" ? "Maintenance" : "Support";

// One request card with its history and an optional footer (reply form / admin controls).
export function ticketCard(t, { footer, viewer = "client" } = {}) {
  const facts = [];
  if (t.ads) {
    if (t.ads.goal) facts.push(["Goal", PORTAL.ads.goals[t.ads.goal]]);
    if (t.ads.budget != null) facts.push(["Monthly budget", money(t.ads.budget)]);
    if (t.ads.area) facts.push(["Area", t.ads.area]);
  }
  const who = (by) => (by === viewer ? "You" : by === "admin" ? PORTAL.brand : "Client");
  return h("article", { class: "ticket" },
    h("header", { class: "ticket-head" },
      h("div", {},
        h("p", { class: "ticket-meta" }, kindLabel(t), " · ", fmtDate(t.createdAt), t.priority === "urgent" ? h("span", { class: "pill pill-bad" }, "Urgent") : null),
        h("h3", { class: "ticket-title" }, t.subject)),
      statusPill(t.status)),
    facts.length ? h("dl", { class: "facts" }, facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))) : null,
    t.details ? h("p", { class: "ticket-body" }, t.details) : null,
    t.updates?.length
      ? h("ol", { class: "updates" }, t.updates.map((u) =>
          h("li", { class: `update update-${u.by}` },
            h("p", { class: "update-meta" }, who(u.by), " · ", fmtDateTime(u.at)),
            h("p", {}, u.text))))
      : null,
    footer ?? null);
}

export function messageThread(messages, viewer) {
  if (!messages.length) return h("p", { class: "empty" }, "No messages yet.");
  return h("ol", { class: "thread" }, messages.map((m) =>
    h("li", { class: `bubble ${m.from === viewer ? "mine" : "theirs"}` },
      h("p", {}, m.text),
      h("p", { class: "bubble-meta" }, m.from === viewer ? "You" : m.from === "admin" ? PORTAL.brand : "Client", " · ", fmtDateTime(m.at)))));
}

export function toast(text, tone = "ok") {
  const t = h("div", { class: `toast toast-${tone}`, role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 4000);
}

// Disable a form's submit button while `work` runs and show any error inside the form.
export async function submitting(form, work) {
  const btn = form.querySelector("[type=submit]");
  const err = form.querySelector(".form-error");
  if (err) err.textContent = "";
  btn && (btn.disabled = true);
  try {
    await work();
  } catch (e) {
    if (err) err.textContent = e.message;
    else toast(e.message, "bad");
  } finally {
    btn && (btn.disabled = false);
  }
}

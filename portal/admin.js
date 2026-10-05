// Admin side of the portal: add clients, share their private links, answer requests and messages.
import { PORTAL } from "./config.js";
import { api, fmtDate, h, messageThread, planPill, submitting, ticketCard, toast } from "./ui.js";

const KEY_STORE = "portal-admin-key";
const root = document.getElementById("admin");
const actions = document.querySelector(".topbar-actions");
document.querySelectorAll(".js-brand").forEach((el) => (el.textContent = PORTAL.brand));
document.title = `${PORTAL.brand} · Portal Admin`;

let key = "";
try { key = sessionStorage.getItem(KEY_STORE) || ""; } catch {}
let clients = [];
let selected = null; // { client, tickets, messages }
let freshLink = null; // { clientId, link } shown once after creating a client or resetting a link
let adding = false;

const call = (path, opts = {}) => api(`admin/${path}`, { key, ...opts });

function signIn(message = "") {
  actions.hidden = true;
  const form = h("form", { class: "card narrow form" },
    h("h1", {}, "Portal admin"),
    h("p", { class: "muted" }, "Enter the admin key you set as PORTAL_ADMIN_KEY on Netlify."),
    h("div", { class: "fields" },
      h("label", { for: "admin-key" }, "Admin key"),
      h("input", { id: "admin-key", type: "password", autocomplete: "current-password", required: true })),
    h("p", { class: "form-error", role: "alert" }, message),
    h("button", { class: "btn", type: "submit" }, "Sign in"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      key = form.querySelector("#admin-key").value.trim();
      await loadClients();
      try { sessionStorage.setItem(KEY_STORE, key); } catch {}
      render();
    });
  });
  root.replaceChildren(form);
}

async function loadClients() {
  clients = (await call("clients")).clients;
}
async function openClient(id) {
  selected = await call(`clients/${id}`);
  const row = clients.find((c) => c.id === id);
  if (row) row.unread = { tickets: 0, messages: 0 };
  render();
  if (matchMedia("(max-width: 860px)").matches) root.querySelector(".detail")?.scrollIntoView({ behavior: "smooth" });
}

function copyBox(link) {
  const input = h("input", { class: "copy-input", value: link, readonly: true, "aria-label": "Portal link" });
  const btn = h("button", { class: "btn btn-small", type: "button" }, "Copy");
  btn.addEventListener("click", () => {
    navigator.clipboard?.writeText(link).then(
      () => toast("Link copied."),
      () => { input.select(); toast("Press Ctrl+C / ⌘C to copy.", "warn"); });
  });
  return h("div", { class: "copy" }, input, btn);
}

function clientList() {
  const add = h("form", { class: "card form add-client", hidden: !adding },
    h("h2", { class: "card-title" }, "Add a client"),
    ...[["name", "Business name", "text", true], ["domain", "Website domain", "text"], ["email", "Billing email", "email"], ["phone", "Phone", "tel"]].map(([n, l, t, req]) =>
      h("div", { class: "fields" }, h("label", { for: `new-${n}` }, l), h("input", { id: `new-${n}`, name: n, type: t, required: req, maxlength: "120" }))),
    h("p", { class: "form-error", role: "alert" }),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Create client"),
      h("button", { class: "btn btn-quiet", type: "button", onclick: () => { adding = false; render(); } }, "Cancel")));
  add.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(add, async () => {
      const body = Object.fromEntries(new FormData(add));
      const { client, link } = await call("clients", { method: "POST", body });
      adding = false;
      freshLink = { clientId: client.id, link };
      await loadClients();
      await openClient(client.id);
    });
  });

  return h("aside", { class: "client-list" },
    h("div", { class: "list-head" },
      h("h1", {}, "Clients"),
      h("button", { class: "btn btn-small", type: "button", hidden: adding, onclick: () => { adding = true; render(); root.querySelector("#new-name")?.focus(); } }, "Add client")),
    add,
    clients.length
      ? h("ul", { class: "clients" }, clients.map((c) => {
          const unread = (c.unread?.tickets ?? 0) + (c.unread?.messages ?? 0);
          return h("li", {},
            h("button", { type: "button", class: `client-row${selected?.client.id === c.id ? " is-active" : ""}`, onclick: () => openClient(c.id).catch((e) => toast(e.message, "bad")) },
              h("span", { class: "client-name" }, c.name, unread ? h("span", { class: "dot", "aria-label": `${unread} new` }) : null),
              h("span", { class: "client-sub" }, c.domain || "No domain"),
              h("span", { class: "client-badges" }, planPill(c.subscription), c.openRequests ? h("span", { class: "pill pill-info" }, `${c.openRequests} open`) : null)));
        }))
      : h("p", { class: "empty" }, "No clients yet. Add your first one."));
}

function adminControls(t, clientId) {
  const sid = `status-${t.id}`, rid = `reply-${t.id}`;
  const form = h("form", { class: "reply admin-reply" },
    h("div", { class: "row" },
      h("div", { class: "fields" },
        h("label", { for: sid }, "Status"),
        h("select", { id: sid, name: "status" }, [["open", "Open"], ["in_progress", "In progress"], ["done", "Done"]].map(([v, l]) => h("option", { value: v, selected: t.status === v }, l))))),
    h("div", { class: "fields" },
      h("label", { for: rid }, "Reply to client (optional)"),
      h("textarea", { id: rid, name: "reply", rows: "2", maxlength: "4000" })),
    h("p", { class: "form-error", role: "alert" }),
    h("button", { class: "btn btn-small", type: "submit" }, "Save"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const { ticket } = await call(`tickets/${clientId}/${t.id}`, { method: "POST", body: { status: form.status.value, reply: form.reply.value } });
      selected.tickets = selected.tickets.map((x) => (x.id === ticket.id ? ticket : x));
      const row = clients.find((c) => c.id === clientId);
      if (row) row.openRequests = selected.tickets.filter((x) => x.status !== "done").length;
      toast("Saved.");
      render();
    });
  });
  return form;
}

function detail() {
  if (!selected) return h("section", { class: "detail card empty-detail" }, h("p", { class: "muted" }, "Choose a client to see their requests, messages and billing."));
  const { client: c, tickets, messages } = selected;

  let confirmReset = false;
  const resetBtn = h("button", { class: "btn btn-quiet btn-small", type: "button" }, "New portal link");
  resetBtn.addEventListener("click", async () => {
    if (!confirmReset) {
      confirmReset = true;
      resetBtn.textContent = "Confirm: old link stops working";
      return;
    }
    resetBtn.disabled = true;
    try {
      freshLink = { clientId: c.id, link: (await call(`clients/${c.id}/link`, { method: "POST" })).link };
      render();
    } catch (e) {
      toast(e.message, "bad");
      resetBtn.disabled = false;
    }
  });

  const msgForm = h("form", { class: "composer" },
    h("label", { class: "sr-only", for: "admin-msg" }, "Message"),
    h("textarea", { id: "admin-msg", name: "text", rows: "2", maxlength: "2000", placeholder: `Message ${c.name}…` }),
    h("button", { class: "btn", type: "submit" }, "Send"),
    h("p", { class: "form-error", role: "alert" }));
  msgForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(msgForm, async () => {
      const { message } = await call(`messages/${c.id}`, { method: "POST", body: { text: msgForm.text.value } });
      selected.messages.push(message);
      msgForm.text.value = "";
      render();
    });
  });

  const sub = c.subscription;
  return h("section", { class: "detail" },
    h("header", { class: "card detail-head" },
      h("div", {},
        h("h2", { class: "detail-title" }, c.name),
        h("p", { class: "muted" }, [c.domain, c.email, c.phone].filter(Boolean).join(" · ") || "No contact details")),
      h("div", { class: "detail-plan" },
        planPill(sub),
        sub?.renewsAt ? h("span", { class: "muted small" }, `${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} ${fmtDate(sub.renewsAt)}`) : null),
      freshLink?.clientId === c.id
        ? h("div", { class: "fresh-link" },
            h("p", {}, h("strong", {}, "Portal link for ", c.name), ". Send it to the client privately; anyone with it can open their portal."),
            copyBox(freshLink.link))
        : h("div", { class: "actions" }, resetBtn)),
    h("h3", { class: "section-title" }, "Requests"),
    tickets.length
      ? h("div", { class: "stack" }, tickets.map((t) => ticketCard(t, { viewer: "admin", footer: adminControls(t, c.id) })))
      : h("p", { class: "empty" }, "No requests yet."),
    h("h3", { class: "section-title" }, "Messages"),
    h("section", { class: "card chat" }, messageThread(messages, "admin"), msgForm));
}

function render() {
  actions.hidden = false;
  root.replaceChildren(h("div", { class: "admin-grid" }, clientList(), detail()));
}

document.querySelector(".js-signout").addEventListener("click", () => {
  try { sessionStorage.removeItem(KEY_STORE); } catch {}
  key = "";
  selected = null;
  signIn();
});
document.querySelector(".js-refresh").addEventListener("click", async () => {
  try {
    await loadClients();
    if (selected) selected = await call(`clients/${selected.client.id}`);
    freshLink = null;
    render();
    toast("Up to date.");
  } catch (e) {
    toast(e.message, "bad");
  }
});

if (!key) signIn();
else loadClients().then(render, (e) => signIn(e.status === 401 ? "That admin key didn't work." : e.message));

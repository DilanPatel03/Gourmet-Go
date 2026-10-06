// Admin side of the portal: add clients, share their private links, answer requests and messages.
import { PORTAL } from "./config.js";
import { api, fmtDate, h, messageThread, planPill, submitting, ticketCard, toast } from "./ui.js";

const KEY_STORE = "portal-admin-key";
const root = document.getElementById("admin");
const actions = document.querySelector(".topbar-actions");
document.querySelectorAll(".js-brand").forEach((el) => (el.textContent = PORTAL.brand));
document.title = `${PORTAL.brand} · Portal Admin`;

let key = "";
try { key = localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || ""; } catch {}
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
    h("label", { class: "check" },
      h("input", { type: "checkbox", id: "admin-remember", checked: true }),
      h("span", {}, "Keep me signed in on this device")),
    h("p", { class: "form-error", role: "alert" }, message),
    h("button", { class: "btn", type: "submit" }, "Sign in"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      key = form.querySelector("#admin-key").value.trim();
      await loadClients();
      try {
        (form.querySelector("#admin-remember").checked ? localStorage : sessionStorage).setItem(KEY_STORE, key);
      } catch {}
      render();
      refreshPushState();
    });
  });
  root.replaceChildren(form);
}

async function loadClients() {
  clients = (await call("clients")).clients;
  const unread = clients.reduce((n, c) => n + (c.unread?.tickets ?? 0) + (c.unread?.messages ?? 0), 0);
  try {
    if (unread > 0) navigator.setAppBadge?.(unread);
    else navigator.clearAppBadge?.();
  } catch {}
}

// ---- Installable app and push notifications ----
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
let installPrompt = null;
let pushState = "checking"; // checking | on | off | blocked | not-configured | needs-install | unsupported
let pushBusy = false;

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  refreshList();
});

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function refreshPushState() {
  if (!pushSupported) pushState = isIOS && !standalone() ? "needs-install" : "unsupported";
  else if (Notification.permission === "denied") pushState = "blocked";
  else {
    try {
      const { enabled } = await call("push/key");
      if (!enabled) pushState = "not-configured";
      else {
        const reg = await navigator.serviceWorker.ready;
        pushState = (await reg.pushManager.getSubscription()) ? "on" : "off";
      }
    } catch {
      pushState = "not-configured";
    }
  }
  refreshList();
}

async function setPush(on) {
  pushBusy = true;
  refreshList();
  try {
    const reg = await navigator.serviceWorker.ready;
    if (on) {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications weren't allowed. You can allow them in your phone's settings.");
      const { publicKey } = await call("push/key");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await call("push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
      toast("Notifications are on for this device.");
    } else {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await call("push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      toast("Notifications are off for this device.");
    }
  } catch (e) {
    toast(e.message, "bad");
  }
  pushBusy = false;
  await refreshPushState();
}

function appPanel() {
  const rows = [];
  if (!standalone()) {
    rows.push(h("div", { class: "app-row" },
      h("div", {},
        h("p", { class: "app-title" }, "Install the admin app"),
        h("p", { class: "hint" }, installPrompt
          ? "Adds it to your home screen with its own icon."
          : isIOS ? "In Safari, tap Share, then Add to Home Screen." : "Use your browser menu: Install app or Add to Home Screen.")),
      installPrompt
        ? h("button", { class: "btn btn-small", type: "button", onclick: async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; refreshList(); } }, "Install")
        : null));
  }
  const pushText = {
    checking: "Checking…",
    on: "On for this device. You'll be alerted about new requests, messages and payments.",
    off: "Get an alert when a client sends a request, a message or pays.",
    blocked: "Blocked. Allow notifications for this app in your phone's settings.",
    "not-configured": "Not set up yet: add the VAPID keys on Netlify.",
    "needs-install": "On iPhone, install the app first (see above), then open it from your home screen.",
    unsupported: "This browser doesn't support notifications.",
  }[pushState];
  rows.push(h("div", { class: "app-row" },
    h("div", {}, h("p", { class: "app-title" }, "Notifications"), h("p", { class: "hint" }, pushText)),
    pushState === "off" ? h("button", { class: "btn btn-small", type: "button", disabled: pushBusy, onclick: () => setPush(true) }, "Turn on") : null,
    pushState === "on"
      ? h("div", { class: "actions" },
          h("button", { class: "btn btn-quiet btn-small", type: "button", onclick: () => call("push/test", { method: "POST" }).then((r) => toast(r.sent ? "Test sent." : "No devices registered."), (e) => toast(e.message, "bad")) }, "Test"),
          h("button", { class: "btn btn-quiet btn-small", type: "button", disabled: pushBusy, onclick: () => setPush(false) }, "Turn off"))
      : null));
  return h("section", { class: "card app-panel" }, rows);
}

// Re-draw only the client list (keeps anything you're typing in the detail pane).
function refreshList() {
  const old = root.querySelector(".client-list");
  if (old) old.replaceWith(clientList());
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
    appPanel(),
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
  try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch {}
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

// Notifications link to admin.html#client=ID; open that client.
function openFromHash() {
  const m = location.hash.match(/client=([^&]+)/);
  if (m && key) openClient(decodeURIComponent(m[1])).catch(() => {});
}
addEventListener("hashchange", openFromHash);

// Keep the list (and an idle open conversation) up to date while the app is open.
setInterval(async () => {
  if (!key || document.visibilityState !== "visible" || !root.querySelector(".admin-grid")) return;
  try {
    await loadClients();
    const detail = root.querySelector(".detail");
    const busy = detail && ([...detail.querySelectorAll("textarea, input")].some((el) => el.value.trim()) || detail.contains(document.activeElement));
    if (selected && !busy) {
      selected = await call(`clients/${selected.client.id}`);
      render();
    } else refreshList();
  } catch {}
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && key && root.querySelector(".admin-grid")) loadClients().then(refreshList, () => {});
});

if (!key) signIn();
else
  loadClients().then(
    () => {
      render();
      refreshPushState();
      openFromHash();
    },
    (e) => signIn(e.status === 401 ? "That admin key didn't work." : e.message),
  );

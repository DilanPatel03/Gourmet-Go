// "Ask Gourmet Go" chat widget. Sends the conversation to the AI assistant
// (netlify/functions/chat.js, served at /api/chat) and shows its replies.
import { DOORDASH_URL } from "./data/menu.js";

const ENDPOINT = "/api/chat";
const STORAGE_KEY = "gg-chat";
const SUGGESTIONS = ["What do you recommend?", "Anything spicy?", "How do I order?"];
const GREETING = "Hi! I'm the Gourmet Go assistant. Ask me anything about the menu or how to order.";
const OFFLINE = `The assistant isn't available right now. You can browse the menu on this page or order on DoorDash: ${DOORDASH_URL}`;

let history = []; // { role: "user" | "assistant", content: string }
try {
  history = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
} catch {}
const save = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20)));
  } catch {}
};

const root = document.createElement("div");
root.className = "chat";
root.innerHTML = `
  <button class="chat-launcher" type="button" aria-label="Ask Gourmet Go" aria-expanded="false" aria-controls="chat-panel">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>
    <span>Ask Gourmet Go</span>
  </button>
  <section id="chat-panel" class="chat-panel" role="dialog" aria-label="Gourmet Go assistant" hidden>
    <header class="chat-head">
      <img src="images/logo.svg" alt="" width="28" height="28">
      <div>
        <p class="chat-title">Gourmet Go Assistant</p>
        <p class="chat-sub">Menu questions and ordering help</p>
      </div>
      <button class="chat-close" type="button" aria-label="Close chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </header>
    <div class="chat-log" aria-live="polite"></div>
    <div class="chat-suggest"></div>
    <form class="chat-form">
      <label for="chat-input" class="sr-only">Your question</label>
      <input id="chat-input" name="q" type="text" maxlength="1000" autocomplete="off" placeholder="Ask about the menu…">
      <button type="submit" aria-label="Send">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>
      </button>
    </form>
    <p class="chat-note">AI assistant. Answers can be wrong, so check prices on DoorDash.</p>
  </section>`;
document.body.append(root);

const launcher = root.querySelector(".chat-launcher");
const panel = root.querySelector(".chat-panel");
const log = root.querySelector(".chat-log");
const suggest = root.querySelector(".chat-suggest");
const form = root.querySelector(".chat-form");
const input = root.querySelector("#chat-input");
let busy = false;

// Render text with any http(s) links made clickable, without using innerHTML.
function addText(el, text) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[.,!?)]+$/, "");
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = url.replace(/^https?:\/\/(www\.)?/, "");
      el.append(a, part.slice(url.length));
    } else if (part) {
      el.append(part);
    }
  }
}

function bubble(role, text) {
  const el = document.createElement("p");
  el.className = `chat-msg chat-${role}`;
  addText(el, text);
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function renderSuggestions() {
  suggest.replaceChildren();
  if (history.length) return;
  for (const q of SUGGESTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q;
    b.addEventListener("click", () => send(q));
    suggest.append(b);
  }
}

function renderAll() {
  log.replaceChildren();
  bubble("assistant", GREETING);
  for (const m of history) bubble(m.role, m.content);
  renderSuggestions();
}

async function send(text) {
  const q = text.trim();
  if (!q || busy) return;
  busy = true;
  history.push({ role: "user", content: q });
  save();
  bubble("user", q);
  renderSuggestions();
  input.value = "";
  const typing = bubble("assistant", "");
  typing.classList.add("chat-typing");
  typing.setAttribute("aria-label", "Assistant is typing");

  let answer;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json().catch(() => ({}));
    answer = typeof data.reply === "string" && data.reply ? data.reply : OFFLINE;
    if (res.ok) {
      history.push({ role: "assistant", content: answer });
    } else {
      history.pop(); // drop the unanswered question so the conversation stays valid
    }
  } catch {
    answer = OFFLINE;
    history.pop();
  }
  save();
  typing.remove();
  bubble("assistant", answer);
  busy = false;
  input.focus();
}

function setOpen(open) {
  panel.hidden = !open;
  launcher.setAttribute("aria-expanded", open);
  root.classList.toggle("is-open", open);
  if (open) {
    log.scrollTop = log.scrollHeight;
    input.focus();
  }
}

launcher.addEventListener("click", () => setOpen(panel.hidden));
root.querySelector(".chat-close").addEventListener("click", () => {
  setOpen(false);
  launcher.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) {
    setOpen(false);
    launcher.focus();
  }
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value);
});

renderAll();

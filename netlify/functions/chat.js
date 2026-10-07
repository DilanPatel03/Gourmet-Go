// Gourmet Go AI assistant: a Netlify Function that answers customer questions with Claude.
// The browser sends the chat history here; the Anthropic API key stays on the server
// (set ANTHROPIC_API_KEY in Netlify > Site configuration > Environment variables).
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, DOORDASH_URL, MENU } from "../../data/menu.js";

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 12; // only the most recent turns are sent to Claude
const MAX_CHARS = 1000; // per message
const RATE_LIMIT = { requests: 20, windowMs: 10 * 60 * 1000 }; // per visitor IP, per warm instance

const UNAVAILABLE =
  `Sorry, I can't answer right now. You can see the full menu on this page or order on DoorDash: ${DOORDASH_URL}`;

function menuText() {
  return CATEGORIES.map((cat) => {
    const items = MENU.filter((d) => d.category === cat.id)
      .map((d) => {
        const price = `${d.from ? "from " : ""}$${d.price.toFixed(2)}`;
        const tags = d.tags.length ? ` [${d.tags.join(", ")}]` : "";
        return `- ${d.name} (${price})${tags}: ${d.desc}`;
      })
      .join("\n");
    return `${cat.title}:\n${items}`;
  }).join("\n\n");
}

const SYSTEM_PROMPT = `You are the Gourmet Go assistant, the chat helper on the Gourmet Go restaurant website. Gourmet Go is a gourmet fast food restaurant ("the future of fast food") serving smash burgers, crispy chicken and loaded fries, with drive-thru, dine-in, and delivery through DoorDash.

Your job is to help website visitors with questions about the menu, recommendations, and how to order. Keep replies short and friendly: usually one to three sentences, like a helpful person at the counter. Write plain text with no markdown, headings, or bullet symbols, because the chat window shows text exactly as written.

The menu and prices (from the Gourmet Go DoorDash store):

${menuText()}

How to answer:
- Only state facts that appear above. Prices are the DoorDash prices; in-store prices may differ.
- To order, people can order online right on this website: tap "Order online" to open the order page, add items, then tap "View order" to choose pickup or delivery and pay securely. Delivery from the website is only offered in some areas; the order panel shows whether it's available. They can also order on DoorDash: ${DOORDASH_URL} . Drive-thru and dine-in are available at the restaurant. You can't take orders or payments in this chat.
- You don't have the street address, opening hours, or phone number. Say so, and point people to the DoorDash page, which shows the location and current hours.
- You don't have allergen, ingredient-sourcing, nutrition, or calorie information beyond the descriptions above. Say so, and suggest asking the restaurant directly before ordering if it matters for their health.
- Don't invent deals, discounts, combos, sizes, customizations, catering options, or menu items that aren't listed. If asked, say you don't have that information.
- For job applications, catering, complaints, or anything you can't help with, suggest the contact form at the bottom of this website.
- If someone asks about things unrelated to Gourmet Go, politely steer back to the food.
- Reply in the same language the visitor writes in.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const hits = new Map(); // ip -> recent request timestamps

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.requests;
}

// Accept only plain-text turns that alternate user/assistant and end with the visitor.
function cleanMessages(body) {
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-MAX_MESSAGES) : null;
  if (!raw || raw.length === 0) return null;
  while (raw.length && raw[0]?.role !== "user") raw.shift();
  const messages = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (!content) return null;
    const expected = messages.length % 2 === 0 ? "user" : "assistant";
    if (m.role !== expected) return null;
    messages.push({ role: m.role, content });
  }
  if (messages.length === 0 || messages.at(-1).role !== "user") return null;
  return messages;
}

const reply = (status, payload) => Response.json(payload, { status });

export default async (req, context) => {
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return reply(503, { reply: UNAVAILABLE });
  }
  if (rateLimited(context?.ip ?? "unknown")) {
    return reply(429, { reply: "You're sending messages quickly. Please wait a few minutes and try again." });
  }

  let body;
  try {
    const text = await req.text();
    if (text.length > 20000) return reply(413, { error: "Message too long." });
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: "Invalid JSON." });
  }
  const messages = cleanMessages(body);
  if (!messages) return reply(400, { error: "Invalid conversation." });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return reply(200, { reply: "Sorry, I can't help with that. I'm happy to answer questions about the Gourmet Go menu or how to order." });
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return reply(200, { reply: text || UNAVAILABLE });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return reply(429, { reply: "I'm getting a lot of questions right now. Please try again in a minute." });
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key was rejected:", error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error("Chat function error:", error);
    }
    return reply(502, { reply: UNAVAILABLE });
  }
};

export const config = { path: "/api/chat" };

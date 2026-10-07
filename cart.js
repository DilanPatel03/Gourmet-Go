// Online ordering (order.html): cart, order details and hand-off to Stripe Checkout (netlify/functions/checkout.js).
import { MENU } from "./data/menu.js";
import { ORDERING, deliveryAvailable, formatMoney, priceOrder } from "./data/ordering.js";

const ENDPOINT = "/api/checkout";
const STORAGE_KEY = "gg-cart";
const $ = (sel, el = document) => el.querySelector(sel);

let cart = []; // [{ id, qty }]
try {
  cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").filter((l) => MENU.some((m) => m.id === l.id));
} catch {}
let type = "pickup";
let busy = false;
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {}
};

const drawer = document.createElement("div");
drawer.className = "cart-root";
drawer.innerHTML = `
  <div class="cart-overlay" hidden></div>
  <aside id="cart-panel" class="cart-panel" role="dialog" aria-modal="true" aria-label="Your order" hidden>
    <header class="cart-head">
      <p class="cart-title">Your order</p>
      <button class="cart-close" type="button" aria-label="Close order">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </header>
    <div class="cart-body">
      <ul class="cart-lines"></ul>
      <form class="cart-form" novalidate>
        <fieldset class="cart-type">
          <legend>How do you want it?</legend>
          <div class="cart-toggle">
            <button type="button" data-type="pickup" aria-pressed="true">Pickup</button>
            <button type="button" data-type="delivery" aria-pressed="false">Delivery</button>
          </div>
          <p class="cart-hint"></p>
        </fieldset>
        <label for="co-name">Name</label>
        <input id="co-name" name="name" autocomplete="name" maxlength="60" required>
        <label for="co-phone">Phone</label>
        <input id="co-phone" name="phone" type="tel" autocomplete="tel" maxlength="20" required>
        <div class="cart-address" hidden>
          <label for="co-street">Street address</label>
          <input id="co-street" name="street" autocomplete="address-line1" maxlength="120">
          <div class="cart-row">
            <div><label for="co-unit">Apt / unit</label><input id="co-unit" name="unit" autocomplete="address-line2" maxlength="30"></div>
            <div><label for="co-zip">ZIP code</label><input id="co-zip" name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10"></div>
          </div>
        </div>
        <label for="co-notes">Notes <span>(optional)</span></label>
        <input id="co-notes" name="notes" maxlength="200" placeholder="Wing sauce choice, special requests…">
      </form>
    </div>
    <footer class="cart-foot">
      <dl class="cart-sum"></dl>
      <p class="cart-error" role="alert"></p>
      <button class="btn cart-pay" type="button">Continue to payment</button>
      <p class="cart-secure">Secure payment by Stripe. Card, Apple Pay and Google Pay.</p>
    </footer>
  </aside>`;
document.body.append(drawer);

const panel = $(".cart-panel", drawer);
const overlay = $(".cart-overlay", drawer);
const form = $(".cart-form", drawer);
const errorEl = $(".cart-error", drawer);
const payBtn = $(".cart-pay", drawer);
const countEls = document.querySelectorAll(".js-cart-count");

function render() {
  const count = cart.reduce((n, l) => n + l.qty, 0);
  countEls.forEach((el) => {
    el.textContent = count;
    el.hidden = count === 0;
  });
  document.querySelectorAll(".js-cart-open").forEach((b) => b.setAttribute("aria-label", `Your order, ${count} item${count === 1 ? "" : "s"}`));

  const lines = $(".cart-lines", drawer);
  lines.replaceChildren();
  if (!cart.length) {
    const li = document.createElement("li");
    li.className = "cart-empty";
    li.textContent = "Your order is empty. Add something from the menu.";
    lines.append(li);
  }
  for (const l of cart) {
    const item = MENU.find((m) => m.id === l.id);
    const li = document.createElement("li");
    li.className = "cart-line";
    li.innerHTML = `
      <div class="cl-info"><p class="cl-name"></p><p class="cl-price"></p></div>
      <div class="cl-qty">
        <button type="button" data-dec="${item.id}" aria-label="Remove one ${item.name}">−</button>
        <span>${l.qty}</span>
        <button type="button" data-inc="${item.id}" aria-label="Add one ${item.name}">+</button>
      </div>`;
    $(".cl-name", li).textContent = item.name;
    $(".cl-price", li).textContent = formatMoney(Math.round(item.price * 100) * l.qty);
    lines.append(li);
  }

  const canDeliver = deliveryAvailable();
  const deliveryBtn = $('[data-type="delivery"]', drawer);
  deliveryBtn.disabled = !canDeliver;
  if (!canDeliver && type === "delivery") type = "pickup";
  drawer.querySelectorAll("[data-type]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.type === type));
  $(".cart-address", drawer).hidden = type !== "delivery";
  $(".cart-hint", drawer).textContent =
    type === "pickup"
      ? `Ready in about ${ORDERING.pickup.readyMinutes} minutes.`
      : canDeliver
        ? `About ${ORDERING.delivery.etaMinutes} minutes. ${formatMoney(Math.round(ORDERING.delivery.fee * 100))} delivery fee, ${formatMoney(Math.round(ORDERING.delivery.minimum * 100))} minimum.`
        : "";
  if (!canDeliver) $(".cart-hint", drawer).textContent += " Delivery coming soon, or order delivery on DoorDash.";

  const sum = $(".cart-sum", drawer);
  const subtotal = cart.reduce((s, l) => s + Math.round(MENU.find((m) => m.id === l.id).price * 100) * l.qty, 0);
  const fee = type === "delivery" ? Math.round(ORDERING.delivery.fee * 100) : 0;
  sum.innerHTML = `
    <div><dt>Subtotal</dt><dd>${formatMoney(subtotal)}</dd></div>
    ${fee ? `<div><dt>Delivery fee</dt><dd>${formatMoney(fee)}</dd></div>` : ""}
    <div class="cart-total"><dt>Total <span>before tax</span></dt><dd>${formatMoney(subtotal + fee)}</dd></div>`;
  payBtn.disabled = busy || !cart.length;
  // Let the order page keep its +/- buttons and order bar in sync.
  document.dispatchEvent(new CustomEvent("cart:change", { detail: { cart: cart.map((l) => ({ ...l })), count, subtotal } }));
}

function add(id) {
  const line = cart.find((l) => l.id === id);
  if (line) line.qty = Math.min(line.qty + 1, ORDERING.maxQuantityPerItem);
  else cart.push({ id, qty: 1 });
  save();
  render();
}
function remove(id) {
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  line.qty -= 1;
  if (line.qty <= 0) cart = cart.filter((l) => l !== line);
  save();
  render();
}

let lastFocus = null;
function setOpen(open) {
  panel.hidden = overlay.hidden = !open;
  document.documentElement.classList.toggle("cart-locked", open);
  if (open) {
    lastFocus = document.activeElement;
    errorEl.textContent = "";
    render();
    $(".cart-close", drawer).focus();
  } else {
    lastFocus?.focus?.();
  }
}

async function checkout() {
  errorEl.textContent = "";
  const data = Object.fromEntries(new FormData(form));
  const order = priceOrder(cart, type, data.zip);
  const problem =
    order.error ||
    (!data.name.trim() && "Please enter your name.") ||
    (data.phone.replace(/\D/g, "").length < 10 && "Please enter a phone number we can reach you at.") ||
    (type === "delivery" && data.street.trim().length < 3 && "Please enter your delivery address.");
  if (problem) {
    errorEl.textContent = problem;
    return;
  }
  busy = true;
  payBtn.textContent = "Starting secure checkout…";
  render();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        cart,
        customer: { name: data.name, phone: data.phone },
        address: type === "delivery" ? { street: data.street, unit: data.unit, zip: data.zip } : undefined,
        notes: data.notes,
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    errorEl.textContent = result.error || "We couldn't start checkout. Please try again, or order on DoorDash.";
  } catch {
    errorEl.textContent = "Online checkout isn't available right now. Please order on DoorDash.";
  }
  busy = false;
  payBtn.textContent = "Continue to payment";
  render();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.dataset.add) {
    add(t.dataset.add);
    t.classList.remove("added");
    void t.offsetWidth;
    t.classList.add("added");
  } else if (t.dataset.inc) add(t.dataset.inc);
  else if (t.dataset.dec) remove(t.dataset.dec);
  else if (t.dataset.type && !t.disabled) {
    type = t.dataset.type;
    errorEl.textContent = "";
    render();
  } else if (t.classList.contains("js-cart-open")) {
    e.preventDefault();
    setOpen(true);
  }
});
$(".cart-close", drawer).addEventListener("click", () => setOpen(false));
overlay.addEventListener("click", () => setOpen(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) setOpen(false);
});
payBtn.addEventListener("click", checkout);
form.addEventListener("input", () => (errorEl.textContent = ""));
form.addEventListener("submit", (e) => {
  e.preventDefault();
  checkout();
});

render();

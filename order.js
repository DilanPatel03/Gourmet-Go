// Order page: menu with Add / +- buttons and a bottom bar that opens checkout. The cart itself
// (storage, checkout panel, payment) lives in cart.js, which announces every change with "cart:change".
import { CATEGORIES, DOORDASH_URL, MENU } from "./data/menu.js";
import { ORDERING, formatMoney } from "./data/ordering.js";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

document.querySelectorAll(".js-doordash").forEach((a) => (a.href = DOORDASH_URL));
document.querySelectorAll(".js-ready").forEach((el) => (el.textContent = ORDERING.pickup.readyMinutes));
$("#year").textContent = new Date().getFullYear();

const cats = CATEGORIES.filter((c) => MENU.some((m) => m.category === c.id));
$("#order-cats").innerHTML = cats.map((c) => `<a href="#cat-${c.id}">${esc(c.title)}</a>`).join("");
$("#order-menu").innerHTML = cats
  .map((cat) => `
    <section class="oc" id="cat-${cat.id}">
      <h2 class="oc-title">${esc(cat.title)}</h2>
      <ul class="oc-list">
        ${MENU.filter((d) => d.category === cat.id)
          .map((d) => `
          <li class="oi">
            <div class="oi-text">
              <div class="oi-head">
                <h3 class="oi-name">${esc(d.name)}</h3>
                ${d.tags.map((t) => `<span class="mi-tag">${esc(t)}</span>`).join("")}
              </div>
              <p class="oi-desc">${esc(d.desc)}</p>
              <p class="oi-price">${d.from ? "<small>from</small> " : ""}${formatMoney(Math.round(d.price * 100))}</p>
            </div>
            <div class="oi-ctl" data-ctl="${d.id}"></div>
          </li>`)
          .join("")}
      </ul>
    </section>`)
  .join("");

function control(id, qty) {
  const name = esc(MENU.find((m) => m.id === id).name);
  if (!qty) return `<button type="button" class="mi-add" data-add="${id}" aria-label="Add ${name} to your order">Add</button>`;
  return `<div class="stepper" role="group" aria-label="${name} quantity">
      <button type="button" data-dec="${id}" aria-label="Remove one ${name}">−</button>
      <span aria-live="polite">${qty}</span>
      <button type="button" data-inc="${id}" aria-label="Add one ${name}" ${qty >= ORDERING.maxQuantityPerItem ? "disabled" : ""}>+</button>
    </div>`;
}

function sync({ cart, count, subtotal }) {
  const qty = new Map(cart.map((l) => [l.id, l.qty]));
  // Keep keyboard focus on the same item when its button turns into a stepper (or back).
  const active = document.activeElement?.closest?.("[data-ctl]")?.dataset.ctl;
  document.querySelectorAll("[data-ctl]").forEach((el) => {
    const q = qty.get(el.dataset.ctl) ?? 0;
    if (el.dataset.q !== String(q)) {
      el.dataset.q = q;
      el.innerHTML = control(el.dataset.ctl, q);
    }
  });
  if (active) document.querySelector(`[data-ctl="${active}"] [data-inc], [data-ctl="${active}"] [data-add]`)?.focus();

  const bar = $(".order-bar");
  bar.hidden = count === 0;
  document.body.classList.toggle("has-order-bar", count > 0);
  $(".js-bar-count").textContent = `${count} item${count === 1 ? "" : "s"}`;
  $(".js-bar-total").textContent = formatMoney(subtotal);
}

document.querySelectorAll("[data-ctl]").forEach((el) => (el.innerHTML = control(el.dataset.ctl, 0)));
document.addEventListener("cart:change", (e) => sync(e.detail));

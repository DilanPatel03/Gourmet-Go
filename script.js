import { DOORDASH_URL, CATEGORIES, MENU } from "./data/menu.js";

const $ = (sel) => document.querySelector(sel);

document.querySelectorAll(".js-doordash").forEach((a) => (a.href = DOORDASH_URL));

// ---- Menu board ----
function renderMenu() {
  $("#menu-board").innerHTML = CATEGORIES.map((cat) => {
    const items = MENU.filter((d) => d.category === cat.id);
    if (!items.length) return "";
    return `
      <section class="menu-cat">
        <h3 class="menu-cat-title">${cat.title}<span class="menu-cat-count">${String(items.length).padStart(2, "0")}</span></h3>
        <ul class="menu-list">
          ${items
            .map(
              (d) => `
            <li class="menu-item">
              <div class="mi-row">
                <span class="mi-name">${d.name}</span>
                ${d.tags.map((t) => `<span class="mi-tag">${t}</span>`).join("")}
                <span class="mi-dots" aria-hidden="true"></span>
                <span class="mi-price">${d.from ? "<small>from</small>" : ""}$${d.price.toFixed(2)}</span>
              </div>
              <p class="mi-desc">${d.desc}</p>
            </li>`
            )
            .join("")}
        </ul>
      </section>`;
  }).join("");
}

// ---- Order count on the bag icon (the order itself lives on order.html) ----
try {
  const count = JSON.parse(localStorage.getItem("gg-cart") || "[]").reduce((n, l) => n + (l.qty || 0), 0);
  document.querySelectorAll(".js-cart-count").forEach((el) => {
    el.textContent = count;
    el.hidden = count === 0;
  });
} catch {}

// ---- Mobile nav ----
const navToggle = $(".nav-toggle");
const navLinks = $("#nav-links");
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", false);
  }
});

// ---- Contact form (front-end validation only) ----
$("#contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const status = form.querySelector(".form-status");
  let ok = true;
  form.querySelectorAll("input, textarea").forEach((el) => {
    const valid = el.checkValidity() && el.value.trim() !== "";
    el.classList.toggle("invalid", !valid);
    if (!valid) ok = false;
  });
  if (!ok) {
    status.textContent = "Please fill in all fields with a valid email.";
    return;
  }
  // TODO: send to a form service or backend.
  status.textContent = "Thanks! We'll be in touch soon.";
  form.reset();
});

$("#year").textContent = new Date().getFullYear();
renderMenu();

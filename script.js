// Your DoorDash store link. Every "Order" button on the site uses this.
const DOORDASH_URL = "https://www.doordash.com/store/44671789";

// Menu data. Edit this list to change what appears on the site.
const MENU = [
  { name: "The Gourmet Burger", desc: "Double smash patty, aged cheddar, caramelized onions and house Go sauce on a brioche bun.", price: 9.99, category: "burgers", tags: ["Signature"], emoji: "🍔" },
  { name: "Truffle Mushroom Burger", desc: "Seared patty, Swiss, roasted mushrooms and truffle aioli.", price: 10.99, category: "burgers", tags: [], emoji: "🍔" },
  { name: "Smokehouse Bacon Burger", desc: "Thick-cut bacon, smoked gouda, crispy onions and bourbon BBQ.", price: 11.49, category: "burgers", tags: ["Fan favorite"], emoji: "🥓" },
  { name: "Hot Honey Chicken Sandwich", desc: "Buttermilk fried chicken, hot honey glaze, pickles and slaw.", price: 9.49, category: "chicken", tags: ["Spicy"], emoji: "🌶️" },
  { name: "Crispy Tenders (4 pc)", desc: "Hand-breaded tenders with your choice of two house sauces.", price: 8.49, category: "chicken", tags: [], emoji: "🍗" },
  { name: "Gold Fries", desc: "Hand-cut fries with garlic parmesan seasoning.", price: 3.99, category: "sides", tags: [], emoji: "🍟" },
  { name: "Loaded Truffle Fries", desc: "Truffle oil, parmesan, herbs and a side of aioli.", price: 5.99, category: "sides", tags: ["Signature"], emoji: "🍟" },
  { name: "Onion Rings", desc: "Beer-battered sweet onion rings with smoky dipping sauce.", price: 4.49, category: "sides", tags: [], emoji: "🧅" },
  { name: "Salted Caramel Shake", desc: "Hand-spun vanilla custard with salted caramel swirl.", price: 5.99, category: "shakes", tags: [], emoji: "🥤" },
  { name: "Cookies & Cream Shake", desc: "Hand-spun with real cookie pieces and whipped cream.", price: 5.99, category: "shakes", tags: [], emoji: "🍪" },
  { name: "Fresh Lemonade", desc: "Squeezed daily. Classic or strawberry.", price: 2.99, category: "shakes", tags: [], emoji: "🍋" },
  { name: "The Go Combo", desc: "Gourmet Burger, Gold Fries and a drink.", price: 14.49, category: "burgers", tags: ["Best value"], emoji: "🍱" },
];

const $ = (sel) => document.querySelector(sel);

document.querySelectorAll(".js-doordash").forEach((a) => (a.href = DOORDASH_URL));

// ---- Menu rendering & filtering ----
const grid = $("#menu-grid");

function renderMenu(filter = "all") {
  grid.innerHTML = MENU.filter((d) => filter === "all" || d.category === filter)
    .map(
      (d) => `
      <article class="dish">
        <div class="dish-img" aria-hidden="true">${d.emoji}</div>
        <div class="dish-body">
          <div class="dish-tags">${d.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <h3>${d.name}</h3>
          <p>${d.desc}</p>
          <span class="price">$${d.price.toFixed(2)}</span>
        </div>
      </article>`
    )
    .join("");
}

document.querySelectorAll(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn);
    });
    renderMenu(btn.dataset.filter);
  });
});

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

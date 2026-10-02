// Your DoorDash store link. Every "Order" button on the site uses this.
const DOORDASH_URL = "https://www.doordash.com/store/44671789";

// Menu data, from the Gourmet Go DoorDash store. Edit this list to change what appears on the site.
// `from: true` shows "From $X" for items whose price depends on options.
const MENU = [
  { name: "GoBurger", desc: "Single 80/20 smash patty, American cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 8.99, from: true, category: "burgers", tags: [], emoji: "🍔" },
  { name: "Double GoBurger", desc: "Double smash patties, double cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.89, category: "burgers", tags: [], emoji: "🍔" },
  { name: "TripleThreat GoBurger", desc: "Triple smash patties, cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 16.59, category: "burgers", tags: [], emoji: "🍔" },
  { name: "Crispy Chicken Sandwich", desc: "Crispy chicken, lettuce, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.49, category: "chicken", tags: [], emoji: "🐔" },
  { name: "Go Nuggets", desc: "Crispy, golden chicken nuggets.", price: 5.99, category: "chicken", tags: [], emoji: "🍗" },
  { name: "Go Wings", desc: "5 crispy golden wings, breaded and tossed in your choice of signature Gourmet Go sauce.", price: 7.99, category: "chicken", tags: [], emoji: "🍗" },
  { name: "Voodoo Fries", desc: "Crispy golden fries loaded with spicy Cajun seasoning, creamy ranch drizzle, signature voodoo sauce, and finished with Gourmet Go seasoning.", price: 7.59, category: "loaded", tags: ["Spicy"], emoji: "🌶️" },
  { name: "Garlic Noir Fries", desc: "Golden crispy fries layered with creamy garlic parmesan sauce and cracked black pepper.", price: 7.59, category: "loaded", tags: [], emoji: "🧄" },
  { name: "Buffalo Ranch Fries", desc: "Golden crispy fries topped with buffalo ranch drizzle and creamy cheese sauce.", price: 7.59, category: "loaded", tags: [], emoji: "🔥" },
  { name: "Golden Fries", desc: "Golden crispy fries layered with warm cheese sauce and Gourmet Go signature seasoning.", price: 7.59, category: "loaded", tags: [], emoji: "🧀" },
  { name: "French Fries", desc: "Crispy seasoned fries.", price: 5.99, category: "sides", tags: [], emoji: "🍟" },
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
          <span class="price">${d.from ? "From " : ""}$${d.price.toFixed(2)}</span>
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

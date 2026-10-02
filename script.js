// Your DoorDash store link. Every "Order" button on the site uses this.
const DOORDASH_URL = "https://www.doordash.com/store/44671789";

// Menu data, from the Gourmet Go DoorDash store. Edit this list to change what appears on the site.
// `from: true` shows "From $X" for items whose price depends on options.
const MENU = [
  { name: "GoBurger", desc: "Single 80/20 smash patty, American cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 8.99, from: true, category: "burgers", tags: [] },
  { name: "Double GoBurger", desc: "Double smash patties, double cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.89, category: "burgers", tags: [] },
  { name: "TripleThreat GoBurger", desc: "Triple smash patties, cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 16.59, category: "burgers", tags: [] },
  { name: "Crispy Chicken Sandwich", desc: "Crispy chicken, lettuce, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.49, category: "chicken", tags: [] },
  { name: "Go Nuggets", desc: "Crispy, golden chicken nuggets.", price: 5.99, category: "chicken", tags: [] },
  { name: "Go Wings", desc: "5 crispy golden wings, breaded and tossed in your choice of signature Gourmet Go sauce.", price: 7.99, category: "chicken", tags: [] },
  { name: "Voodoo Fries", desc: "Crispy golden fries loaded with spicy Cajun seasoning, creamy ranch drizzle, signature voodoo sauce, and finished with Gourmet Go seasoning.", price: 7.59, category: "loaded", tags: ["Spicy"] },
  { name: "Garlic Noir Fries", desc: "Golden crispy fries layered with creamy garlic parmesan sauce and cracked black pepper.", price: 7.59, category: "loaded", tags: [] },
  { name: "Buffalo Ranch Fries", desc: "Golden crispy fries topped with buffalo ranch drizzle and creamy cheese sauce.", price: 7.59, category: "loaded", tags: [] },
  { name: "Golden Fries", desc: "Golden crispy fries layered with warm cheese sauce and Gourmet Go signature seasoning.", price: 7.59, category: "loaded", tags: [] },
  { name: "French Fries", desc: "Crispy seasoned fries.", price: 5.99, category: "sides", tags: [] },
];

const $ = (sel) => document.querySelector(sel);

document.querySelectorAll(".js-doordash").forEach((a) => (a.href = DOORDASH_URL));

// ---- Menu board ----
const CATEGORIES = [
  { id: "burgers", title: "Burgers" },
  { id: "chicken", title: "Chicken" },
  { id: "loaded", title: "Loaded Fries" },
  { id: "sides", title: "Sides" },
];

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

// Menu data — edit this list to change what appears on the site.
const MENU = [
  { id: 1, name: "Herb-Roasted Chicken", desc: "Free-range chicken, garlic mash, charred green beans and thyme jus.", price: 16.5, category: "mains", tags: ["Gluten-free"], emoji: "🍗", color: "#f6dcc4" },
  { id: 2, name: "Braised Short Rib", desc: "Slow-braised beef, creamy polenta and red wine glaze.", price: 19.0, category: "mains", tags: ["Chef's pick"], emoji: "🥩", color: "#efd0c2" },
  { id: 3, name: "Miso Glazed Salmon", desc: "Wild salmon, sesame greens and jasmine rice.", price: 18.0, category: "mains", tags: ["High protein"], emoji: "🐟", color: "#f9d9cf" },
  { id: 4, name: "Harvest Grain Bowl", desc: "Farro, roasted squash, kale, pomegranate and tahini dressing.", price: 13.5, category: "bowls vegetarian", tags: ["Vegan"], emoji: "🥗", color: "#dfe9d3" },
  { id: 5, name: "Spicy Poke Bowl", desc: "Ahi tuna, avocado, edamame, pickled ginger and sriracha mayo.", price: 15.0, category: "bowls", tags: ["Spicy"], emoji: "🍣", color: "#f7d6d6" },
  { id: 6, name: "Wild Mushroom Risotto", desc: "Arborio rice, porcini, parmesan and truffle oil.", price: 15.5, category: "mains vegetarian", tags: ["Vegetarian"], emoji: "🍄", color: "#ece2d2" },
  { id: 7, name: "Thai Peanut Noodle Bowl", desc: "Rice noodles, crunchy veggies, tofu and peanut-lime sauce.", price: 13.0, category: "bowls vegetarian", tags: ["Vegan"], emoji: "🍜", color: "#f8e6c4" },
  { id: 8, name: "Dark Chocolate Pot de Crème", desc: "Silky chocolate custard with sea salt and whipped cream.", price: 7.0, category: "desserts vegetarian", tags: ["Sweet"], emoji: "🍫", color: "#e6d3c7" },
  { id: 9, name: "Seasonal Fruit Tart", desc: "Buttery crust, vanilla custard and fresh market fruit.", price: 7.5, category: "desserts vegetarian", tags: ["Sweet"], emoji: "🥧", color: "#f7e1cf" },
];

const fmt = (n) => `$${n.toFixed(2)}`;
const $ = (sel) => document.querySelector(sel);

// ---- Menu rendering & filtering ----
const grid = $("#menu-grid");

function renderMenu(filter = "all") {
  const items = MENU.filter((d) => filter === "all" || d.category.split(" ").includes(filter));
  grid.innerHTML = items
    .map(
      (d) => `
      <article class="dish">
        <div class="dish-img" style="background:${d.color}" aria-hidden="true">${d.emoji}</div>
        <div class="dish-body">
          <div class="dish-tags">${d.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <h3>${d.name}</h3>
          <p>${d.desc}</p>
          <div class="dish-foot">
            <span class="price">${fmt(d.price)}</span>
            <button class="btn btn-small" data-add="${d.id}">Add</button>
          </div>
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

// ---- Cart ----
const cart = new Map(); // id -> qty
try {
  const saved = JSON.parse(localStorage.getItem("gg-cart") || "[]");
  saved.forEach(([id, qty]) => MENU.some((d) => d.id === id) && cart.set(id, qty));
} catch {}

function saveCart() {
  try { localStorage.setItem("gg-cart", JSON.stringify([...cart])); } catch {}
}

function renderCart() {
  const list = $("#cart-items");
  let total = 0, count = 0;
  if (cart.size === 0) {
    list.innerHTML = `<li class="empty">Your cart is empty. Add something delicious!</li>`;
  } else {
    list.innerHTML = [...cart]
      .map(([id, qty]) => {
        const d = MENU.find((m) => m.id === id);
        total += d.price * qty;
        count += qty;
        return `
        <li class="cart-item">
          <span class="ci-emoji">${d.emoji}</span>
          <div class="ci-info">
            <div class="ci-name">${d.name}</div>
            <div class="ci-price">${fmt(d.price * qty)}</div>
          </div>
          <div class="qty">
            <button data-dec="${id}" aria-label="Remove one">−</button>
            <span>${qty}</span>
            <button data-inc="${id}" aria-label="Add one">+</button>
          </div>
        </li>`;
      })
      .join("");
  }
  $("#cart-total").textContent = fmt(total);
  $("#cart-count").textContent = count;
  saveCart();
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  const b = $("#cart-button");
  b.classList.remove("bump");
  void b.offsetWidth;
  b.classList.add("bump");
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.add) addToCart(+t.dataset.add);
  if (t.dataset.inc) addToCart(+t.dataset.inc);
  if (t.dataset.dec) {
    const id = +t.dataset.dec;
    const q = (cart.get(id) || 0) - 1;
    q > 0 ? cart.set(id, q) : cart.delete(id);
    renderCart();
  }
});

function toggleCart(open) {
  $("#cart").classList.toggle("open", open);
  $("#cart").setAttribute("aria-hidden", !open);
  $("#overlay").classList.toggle("show", open);
}
$("#cart-button").addEventListener("click", () => toggleCart(true));
$("#cart-close").addEventListener("click", () => toggleCart(false));
$("#overlay").addEventListener("click", () => toggleCart(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && toggleCart(false));

$("#checkout").addEventListener("click", () => {
  if (cart.size === 0) return;
  // TODO: connect to a real checkout / ordering backend.
  alert("Thanks! Online checkout is coming soon.");
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
renderCart();

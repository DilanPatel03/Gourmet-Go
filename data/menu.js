// Gourmet Go menu and store links. Both the website and the AI assistant read this file,
// so edit here and they stay in sync. Items and prices come from the Gourmet Go DoorDash store.

// Your DoorDash store link. Every "Order" button on the site uses this.
export const DOORDASH_URL = "https://www.doordash.com/store/44671789";

export const CATEGORIES = [
  { id: "burgers", title: "Burgers" },
  { id: "chicken", title: "Chicken" },
  { id: "loaded", title: "Loaded Fries" },
  { id: "sides", title: "Sides" },
];

// `id` identifies the item in orders; keep it the same if you rename an item.
// `from: true` shows "From $X" for items whose price depends on options.
export const MENU = [
  { id: "goburger", name: "GoBurger", desc: "Single 80/20 smash patty, American cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 8.99, from: true, category: "burgers", tags: [] },
  { id: "double-goburger", name: "Double GoBurger", desc: "Double smash patties, double cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.89, category: "burgers", tags: [] },
  { id: "triplethreat-goburger", name: "TripleThreat GoBurger", desc: "Triple smash patties, cheese, lettuce, tomato, pickles and Gourmet Go sauce on a toasted potato roll.", price: 16.59, category: "burgers", tags: [] },
  { id: "crispy-chicken-sandwich", name: "Crispy Chicken Sandwich", desc: "Crispy chicken, lettuce, pickles and Gourmet Go sauce on a toasted potato roll.", price: 12.49, category: "chicken", tags: [] },
  { id: "go-nuggets", name: "Go Nuggets", desc: "Crispy, golden chicken nuggets.", price: 5.99, category: "chicken", tags: [] },
  { id: "go-wings", name: "Go Wings", desc: "5 crispy golden wings, breaded and tossed in your choice of signature Gourmet Go sauce.", price: 7.99, category: "chicken", tags: [] },
  { id: "voodoo-fries", name: "Voodoo Fries", desc: "Crispy golden fries loaded with spicy Cajun seasoning, creamy ranch drizzle, signature voodoo sauce, and finished with Gourmet Go seasoning.", price: 7.59, category: "loaded", tags: ["Spicy"] },
  { id: "garlic-noir-fries", name: "Garlic Noir Fries", desc: "Golden crispy fries layered with creamy garlic parmesan sauce and cracked black pepper.", price: 7.59, category: "loaded", tags: [] },
  { id: "buffalo-ranch-fries", name: "Buffalo Ranch Fries", desc: "Golden crispy fries topped with buffalo ranch drizzle and creamy cheese sauce.", price: 7.59, category: "loaded", tags: [] },
  { id: "golden-fries", name: "Golden Fries", desc: "Golden crispy fries layered with warm cheese sauce and Gourmet Go signature seasoning.", price: 7.59, category: "loaded", tags: [] },
  { id: "french-fries", name: "French Fries", desc: "Crispy seasoned fries.", price: 5.99, category: "sides", tags: [] },
];

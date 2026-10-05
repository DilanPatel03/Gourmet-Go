// Online ordering settings and order math. The website uses this to show totals and the
// checkout server function uses it to charge them, so the two always agree.
import { MENU } from "./menu.js";

export const ORDERING = {
  pickup: {
    enabled: true,
    readyMinutes: 20, // shown to customers as the estimated pickup time
  },
  delivery: {
    // TODO: set your real delivery fee, minimum and the ZIP codes your drivers cover.
    // Delivery stays hidden on the website until at least one ZIP code is listed here.
    fee: 4.99,
    minimum: 15.0, // minimum food subtotal for delivery
    zips: [],
    etaMinutes: 45,
  },
  maxQuantityPerItem: 20,
  maxItemsPerOrder: 40,
};

export const deliveryAvailable = () => ORDERING.delivery.zips.length > 0;

const cents = (dollars) => Math.round(dollars * 100);
export const formatMoney = (c) => `$${(c / 100).toFixed(2)}`;

// cart: [{ id, qty }]. Returns the priced order (amounts in cents) or { error }.
// Tax is added by Stripe at checkout, so it is not included here.
export function priceOrder(cart, type, zip = "") {
  if (!Array.isArray(cart) || cart.length === 0) return { error: "Your cart is empty." };
  if (type === "pickup" && !ORDERING.pickup.enabled) return { error: "Pickup isn't available right now." };
  if (type === "delivery" && !deliveryAvailable()) return { error: "Delivery isn't available yet." };
  if (type !== "pickup" && type !== "delivery") return { error: "Choose pickup or delivery." };

  const lines = [];
  let count = 0;
  for (const entry of cart) {
    const item = MENU.find((m) => m.id === entry?.id);
    const qty = entry?.qty;
    if (!item) return { error: "An item in your cart is no longer on the menu. Please remove it." };
    if (!Number.isInteger(qty) || qty < 1 || qty > ORDERING.maxQuantityPerItem) return { error: `Please choose a quantity between 1 and ${ORDERING.maxQuantityPerItem}.` };
    if (lines.some((l) => l.id === item.id)) return { error: "Duplicate item in cart." };
    count += qty;
    lines.push({ id: item.id, name: item.name, qty, unit: cents(item.price), total: cents(item.price) * qty });
  }
  if (count > ORDERING.maxItemsPerOrder) return { error: `Online orders are limited to ${ORDERING.maxItemsPerOrder} items. Call the restaurant for larger orders.` };

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  let deliveryFee = 0;
  if (type === "delivery") {
    if (!ORDERING.delivery.zips.includes(String(zip).trim().slice(0, 5))) return { error: "Sorry, we don't deliver to that ZIP code yet. Pickup is available." };
    if (subtotal < cents(ORDERING.delivery.minimum)) return { error: `Delivery orders need at least ${formatMoney(cents(ORDERING.delivery.minimum))} of food.` };
    deliveryFee = cents(ORDERING.delivery.fee);
  }
  return { type, lines, count, subtotal, deliveryFee, total: subtotal + deliveryFee };
}

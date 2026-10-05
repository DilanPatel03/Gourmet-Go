// Client portal settings, shared by the portal pages and the portal server functions.
// TODO: replace the placeholder brand with your business name.
export const PORTAL = {
  brand: "Your Studio",
  plan: {
    name: "Website & Domain Care",
    price: 100, // US dollars per year
    // TODO: list exactly what the yearly fee covers.
    includes: ["Domain renewal", "Hosting and security updates", "Small text and photo updates"],
  },
  // Request types clients can choose on the Support tab.
  requestKinds: {
    support: "Support (something isn't working)",
    maintenance: "Maintenance (update or change something)",
  },
  ads: {
    actions: {
      start: "Start a new campaign",
      change: "Change budget or targeting",
      pause: "Pause ads",
      resume: "Resume ads",
      stop: "Stop ads for good",
    },
    goals: {
      calls: "More phone calls",
      visits: "More website visits",
      orders: "More online orders",
      store: "More people in the store",
    },
  },
};

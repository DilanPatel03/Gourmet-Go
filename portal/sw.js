// Service worker for the installable admin app: keeps the app shell available offline and
// shows push notifications about client activity. Never caches /api responses.
const CACHE = "portal-admin-v1";
const SHELL = ["admin.html", "admin.js", "ui.js", "config.js", "portal.css", "admin.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, so you always get the latest version; the cache is only a fallback when offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const jobs = [
    self.registration.showNotification(data.title || "Client portal", {
      body: data.body || "New client activity",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { url: data.url || "admin.html" },
    }),
  ];
  if (typeof data.badge === "number" && self.navigator.setAppBadge) {
    jobs.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(jobs).catch(() => {}));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "admin.html", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.includes("/portal/admin.html"));
      if (open) return open.navigate(target).then((w) => (w ?? open).focus());
      return self.clients.openWindow(target);
    }),
  );
});

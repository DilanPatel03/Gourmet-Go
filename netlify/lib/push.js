// Push notifications for the admin app (Web Push). Each phone or computer where you tap
// "Turn on notifications" is saved as a subscription; new client activity is pushed to all of them.
//
// Environment variables:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  a key pair (generate with: npx web-push generate-vapid-keys)
//   VAPID_SUBJECT                        mailto: address push services can contact, e.g. mailto:you@yourstudio.com
import { createHash } from "node:crypto";
import webpush from "web-push";

const keyFor = (endpoint) => `push/${createHash("sha256").update(endpoint).digest("hex")}`;

export function createPush({ store, sender = webpush }) {
  const enabled = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  return {
    enabled,
    publicKey: () => (enabled() ? process.env.VAPID_PUBLIC_KEY : null),

    async subscribe(sub) {
      const endpoint = sub?.endpoint;
      if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return false;
      if (typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") return false;
      await store.setJSON(keyFor(endpoint), { endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, createdAt: new Date().toISOString() });
      return true;
    },

    unsubscribe: (endpoint) => (typeof endpoint === "string" ? store.delete(keyFor(endpoint)) : undefined),

    // payload: { title, body, url, badge }. Subscriptions the push service reports as gone are removed.
    async send(payload) {
      if (!enabled()) return 0;
      const vapidDetails = {
        subject: process.env.VAPID_SUBJECT || "mailto:notifications@example.com",
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      };
      const keys = await store.keys("push/");
      let sent = 0;
      await Promise.all(keys.map(async (key) => {
        const sub = await store.getJSON(key);
        if (!sub) return;
        try {
          await sender.sendNotification(sub, JSON.stringify(payload), { vapidDetails, TTL: 86400, urgency: "high" });
          sent += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) await store.delete(key);
          else console.error("Push failed:", error.statusCode ?? "", error.message);
        }
      }));
      return sent;
    },
  };
}

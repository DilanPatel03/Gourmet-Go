// Tells you about client activity: a text (if PORTAL_ALERT_PHONE and Twilio are set) and a push
// notification to every device where the admin app has notifications turned on.
import { PORTAL } from "../../portal/config.js";
import { sendSms, smsConfigured } from "./sms.js";

export function createNotifier({ store, push }) {
  return async (message, { clientId } = {}) => {
    const jobs = [];
    if (process.env.PORTAL_ALERT_PHONE && smsConfigured()) jobs.push(sendSms(process.env.PORTAL_ALERT_PHONE, message));
    if (push.enabled()) {
      jobs.push((async () => {
        const clients = await Promise.all((await store.keys("clients/")).map((k) => store.getJSON(k)));
        const badge = clients.reduce((n, c) => n + (c?.unread?.tickets ?? 0) + (c?.unread?.messages ?? 0), 0);
        await push.send({
          title: `${PORTAL.brand} Admin`,
          body: message,
          url: `/portal/admin.html${clientId ? `#client=${encodeURIComponent(clientId)}` : ""}`,
          badge,
        });
      })());
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  };
}

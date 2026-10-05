# Gourmet Go

Website for Gourmet Go, *the future of fast food*. Drive-thru, dine-in and delivery on DoorDash.

Plain HTML/CSS/JS with no build step, plus small Netlify server functions for the AI assistant and online ordering.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

The chat assistant needs its server function. To run it locally too, use the Netlify CLI:

```sh
npm install
ANTHROPIC_API_KEY=sk-ant-... npx netlify dev
```

## Editing

- **Menu, prices and DoorDash link:** `data/menu.js`. The website, online ordering and the AI assistant all read this file.
- **Pickup time, delivery fee, minimum and delivery ZIP codes:** `data/ordering.js`.
- **What the assistant knows and how it answers:** the `SYSTEM_PROMPT` in `netlify/functions/chat.js`.
- **Address and hours:** the "Visit us" section in `index.html`.
- **Brand colors:** the CSS variables in `:root` in `styles.css` (`--gold`, `--bg`, …).
- **Logo:** `images/logo.svg`.

## AI assistant

The "Ask Gourmet Go" chat answers questions about the menu and ordering using Claude
(`claude-opus-5-5`, low effort, with automatic fallback to another Claude model if a request is declined).

- `chat.js` is the chat window in the browser. It sends the conversation to `/api/chat`.
- `netlify/functions/chat.js` runs on Netlify, adds the menu and rules, and calls the Claude API.
  The API key stays on the server and never reaches the browser.
- Basic protections: messages are capped at 1,000 characters, only the last 12 turns are sent,
  and each visitor IP is limited to 20 messages per 10 minutes.

### Going live on Netlify

1. Get an API key at <https://console.anthropic.com> and add billing.
   **Set a monthly spend limit** there so a busy day can't surprise you.
2. On netlify.com, import this GitHub repo (no build command needed; `netlify.toml` has the settings).
3. In Netlify, go to **Site configuration → Environment variables**, add `ANTHROPIC_API_KEY`, and redeploy.

On GitHub Pages (no server) the chat window still appears but tells visitors the assistant
is unavailable and points them to DoorDash.

## Online ordering (pickup and delivery)

Customers tap **Add** on menu items, open their order (bag icon in the header), choose pickup or
delivery, and pay on Stripe's secure checkout page (cards, Apple Pay, Google Pay). Each paid order is
texted to the restaurant through Twilio.

- `cart.js` is the cart and order panel in the browser.
- `netlify/functions/checkout.js` prices the order from `data/menu.js` on the server (the browser
  can't change prices) and creates the Stripe Checkout page.
- `netlify/functions/stripe-webhook.js` receives Stripe's "payment succeeded" event and sends the text.
- `order-success.html` is the thank-you page customers land on after paying.
- **Delivery stays hidden until you list ZIP codes** in `data/ordering.js` (and set your real fee and minimum).

### Setting it up

1. **Stripe** (stripe.com): create an account and finish business verification so payouts reach your bank.
   - *Developers → API keys:* copy the **secret key** into Netlify as `STRIPE_SECRET_KEY`.
   - *Developers → Webhooks → Add endpoint:* URL `https://YOUR-SITE/api/stripe-webhook`, events
     `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its
     **signing secret** into Netlify as `STRIPE_WEBHOOK_SECRET`.
   - *Sales tax:* create a tax rate (Product catalog → Tax rates) with your local rate and put its id
     (`txr_...`) in Netlify as `STRIPE_TAX_RATE_ID`. Without it, no tax is charged. It's applied to food,
     not the delivery fee; check your local rules.
   - *Settings → Emails:* turn on receipts for successful payments.
   - Test first with the **test-mode** key and card `4242 4242 4242 4242`, then switch to the live key.
2. **Twilio** (twilio.com): buy a phone number, then add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER` (e.g. `+15551234567`) and `ORDER_ALERT_PHONE` (the restaurant phone; separate
   several with commas) in Netlify. US numbers must be registered for texting (A2P 10DLC, or toll-free
   verification) before messages are delivered, which can take a few days.
3. Redeploy on Netlify after adding environment variables.

To pause online orders (for example when closed or slammed), set `ORDERS_PAUSED` to `true` in Netlify
and redeploy. If a text fails to send, Stripe retries the webhook automatically, so the order isn't lost;
every order is also listed in the Stripe dashboard under Payments.

## Client portal (`/portal/`)

A portal for the businesses you build websites for. Each client opens it with a private link and can:

- **Google Ads:** ask to start a campaign (goal, monthly budget, area), change it, pause, resume or stop.
  You make the change in Google Ads and update the request.
- **Billing:** pay the $100/year website & domain care plan (a Stripe subscription that renews
  automatically), and update their card, download receipts or cancel through Stripe's billing page.
- **Requests:** submit support or maintenance requests (with an "urgent" flag) and follow replies.
- **Messages:** message you directly.

You manage everything at **`/portal/admin.html`**: add clients (each gets a private link to send them),
see unread requests and messages, change request status, reply, and see who has paid.

- Brand name, plan price and what the plan includes: `portal/config.js` (currently the placeholder "Your Studio").
- Server logic: `netlify/lib/portal-api.js`, served by `netlify/functions/portal.js` and
  `netlify/functions/portal-stripe-webhook.js`. Data is stored in Netlify Blobs (built into Netlify).

### Setting it up on Netlify

1. `PORTAL_ADMIN_KEY`: a long random secret (16+ characters). You type it to sign in to the admin page.
2. Payments, using **your business's** Stripe account (not the restaurant's):
   - `PORTAL_STRIPE_SECRET_KEY`: your Stripe secret key.
   - Webhook endpoint `https://YOUR-SITE/api/portal-stripe-webhook` with events `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`;
     put its signing secret in `PORTAL_STRIPE_WEBHOOK_SECRET`.
   - In Stripe, turn on the **customer portal** (Settings → Billing → Customer portal) so "Manage billing" works.
3. Optional: `PORTAL_ALERT_PHONE` to get a text for new requests, messages and plan payments
   (uses the same `TWILIO_*` settings as order texts).

Portal links work like passwords: anyone with a client's link can open that client's portal. If a link
leaks, open the client in the admin page and choose **New portal link**; the old one stops working.

## Still placeholder

- Street address and hours (the Visit section links to DoorDash for now)
- The contact form validates input but doesn't send anywhere yet

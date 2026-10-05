# Gourmet Go

Website for Gourmet Go, *the future of fast food*. Drive-thru, dine-in and delivery on DoorDash.

Plain HTML/CSS/JS with no build step, plus one small server function for the AI assistant.

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

- **Menu, prices and DoorDash link:** `data/menu.js`. The website and the AI assistant both read this file.
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

## Still placeholder

- Street address and hours (the Visit section links to DoorDash for now)
- The contact form validates input but doesn't send anywhere yet

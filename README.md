# Gourmet Go

Marketing and ordering site for Gourmet Go: chef-crafted meals, delivered.

Plain HTML/CSS/JS. There's no build step.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Editing

- **Menu items:** edit the `MENU` array at the top of `script.js`.
- **Colors and fonts:** edit the CSS variables in `:root` in `styles.css`.
- **Copy:** edit `index.html`.

## Not yet connected

- Checkout (cart works and is saved in the browser, but checkout only shows a message)
- Contact form (validates input but doesn't send anywhere yet)

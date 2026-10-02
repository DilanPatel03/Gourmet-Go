# Gourmet Go

Website for Gourmet Go, *the future of fast food*. Drive-thru, dine-in and delivery on DoorDash.

Plain HTML/CSS/JS. There's no build step.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Editing

- **DoorDash link:** set `DOORDASH_URL` at the top of `script.js`. Every "Order" button uses it.
- **Menu items:** edit the `MENU` array in `script.js`.
- **Address and hours:** the "Visit us" section in `index.html`.
- **Brand colors:** the CSS variables in `:root` in `styles.css` (`--gold`, `--bg`, …).
- **Logo:** `images/logo.svg`.

## Still placeholder

- DoorDash store URL, address, hours and map link
- Menu items and prices
- The contact form validates input but doesn't send anywhere yet

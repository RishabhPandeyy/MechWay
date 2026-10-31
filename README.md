# MechWay Frontend

Frontend-only static website for the MechWay college project.

## Run Locally

```sh
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173`.

## Deploy

Use this repository root as the static site root. It contains:

- `index.html`
- `pages/`
- `assets/`
- `server/` static admin pages only, not a Node backend
- `_redirects`
- `.htaccess`
- `robots.txt`
- `sitemap.xml`

Backend files, database credentials, `.env` files, server code, tests and deployment notes are intentionally not included.

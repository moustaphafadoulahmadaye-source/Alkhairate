# EAEPCG — Établissement Alkhaïrat Énergie pour les Commerces Général

Full working web app: public website + customer accounts + orders + messages + admin dashboard.

## Structure

```
eaepcg-webapp/
├── frontend/         Static multi-page site (HTML/CSS/JS, no build step)
│   ├── index.html    Landing page — each feature is a button leading to its own page
│   ├── about.html
│   ├── services.html     pulled live from the API (5 real services)
│   ├── products.html     general trading / products
│   ├── contact.html      send a message — requires an account
│   ├── order.html        place an order — requires an account
│   ├── register.html
│   ├── login.html
│   ├── account.html      customer dashboard: my orders + my messages
│   ├── admin.html        admin dashboard: everyone who ordered/messaged/registered/signed in
│   └── assets/
├── backend/
│   ├── server.js         Express app (serves the API and the frontend)
│   ├── db.js              SQLite schema + seed of the 5 real services
│   ├── routes/            auth, services, orders, messages, admin
│   ├── middleware/auth.js JWT auth + admin guard
│   ├── seedAdmin.js       creates/promotes the first admin account
│   └── data/eaepcg.db     SQLite database file (created automatically)
```

## How browsing/permissions work

- **Anyone** can browse every page (Home, About, Services, Products, Contact info) without an account.
- **Placing an order** or **sending a message** requires being signed in — the page shows a "login required" prompt otherwise.
- **Admin dashboard** (`admin.html`) shows: all registered customers, all orders (with status you can change), all messages (with status you can change), and a log of recent logins (who is signed in / has signed in).

## Run it

```bash
cd backend
npm install
Copy-Item .env.example .env # PowerShell; edit the values below before starting
# Create a strong secret (PowerShell):
$secret = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
# Then set JWT_SECRET in .env to a unique random value of at least 32 characters.
npm run seed-admin          # creates the first admin account
npm start                   # starts on http://localhost:4000
```

Before starting the server, configure `backend/.env`:

```text
JWT_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
CORS_ORIGIN=http://localhost:4000
```

`JWT_SECRET` is required. The server refuses to start when it is missing or uses a
known placeholder/weak value. Never commit `.env`; it is ignored by Git. The
`.env.example` file contains placeholders only.

### Email notifications

Email notifications use SMTP and are optional for local development. Copy the SMTP
settings from `.env.example` into `backend/.env` and replace every placeholder:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=no-reply@example.com
```

When SMTP is not configured, registration, orders, and messages still succeed;
the server logs that the notification was skipped. Configure SMTP in production
to enable welcome, order, status, customer-message, and administrator emails.

Then open **http://localhost:4000** in a browser — it serves both the API (`/api/...`) and the frontend pages from the same server, so there's nothing else to configure. The frontend also uses `http://localhost:4000/api` automatically when an HTML file is opened directly from disk, but the backend must still be running.

The administrator login is configured by `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
`backend/.env`. Do not publish those values or commit the file. To change the
administrator credentials, edit `.env` and run `npm run seed-admin`.

## Deploying separately (frontend on a static host, backend elsewhere)

If you host `frontend/` and `backend/` on different domains, open `frontend/assets/js/api.js` and change:
```js
const API_BASE = '/api';
```
to your backend's full URL, e.g. `https://api.etsalkhairatenergie.com/api`.

Set `CORS_ORIGIN` to the exact comma-separated frontend origin(s) used in
deployment. Authentication and registration endpoints are rate-limited.
Set `TRUST_PROXY=true` only when the application is behind a trusted reverse
proxy that forwards the client IP.

## Notes

- Passwords are hashed with bcrypt; sessions use signed JWTs (7-day expiry) stored in the browser's localStorage.
- The database is SQLite (`backend/data/eaepcg.db`) — a single file, easy to back up or move.
- Every login is logged (`sessions_log` table) so the admin dashboard can show who has signed in.

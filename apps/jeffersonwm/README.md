# JeffersonWM

<div align="center">
  <img src="./git-banner.jpeg" alt="JeffersonWM Banner" width="800" />
</div>

JeffersonWM is the umbrella app space for William Jefferson's personal web tools. In the monorepo, this app represents the dedicated `jeffersonwm` site that sits alongside Perihelion, Bullion, and Lionship on the hosted domain.

## Local Development

From the monorepo root:

```powershell
npm run install:jeffersonwm
npm run build:jeffersonwm
```

For app development inside the app folder:

```powershell
cd apps/jeffersonwm
npm run dev
```

For the JeffersonWM-owned widget API:

```powershell
cd apps/jeffersonwm
npm run server
npm run typecheck:api
```

The widget API reads from `.env.development` or `.env.production`. Start from `.env.example` when the new MySQL database is created.
That template now includes the JeffersonWM widget database fields, the widget admin token, and the Vite switches used for local/prod widget control.

JeffersonWM backend ports:

- `8110` is the JeffersonWM API port. Point the public Cloudflare tunnel here.
- `npm run dev` on the laptop also proxies `/api/widget`, `/api/account`, and `/api/locations` to this same server.
- `3000` is only the code fallback if no port env var is set; do not use it for the normal JeffersonWM workflow.

Normal workflow:

```powershell
# Server computer
npm run server
```

```powershell
# Laptop
npm run dev
```

Local `.env.development` enables the widget and points Vite's `/api/widget`, `/api/account`, and `/api/locations` proxies to the JeffersonWM API on port `8110`. The widget now reads from JeffersonWM's own API and database rather than depending on Lionship.

Widget API aliases are available at:

- `GET /api/widget/state`
- `GET /api/widget/preferences`
- `PUT /api/widget/preferences`

Additional JeffersonWM API checks:

- `GET /health`
- `GET /api/widget/resolved`
- `GET /api/locations/search?q=San`

Local page URLs:

- `http://localhost:5173/`
- `http://localhost:5173/account/`

## Widget Migration

The homepage widget has moved into JeffersonWM. The public widget markup remains in `index.html`, and the live homepage now depends on JeffersonWM's widget API rather than Lionship widget endpoints.

Database setup files:

- `database/widget-schema.sql` creates the future JeffersonWM widget tables.
- `database/widget-migration-from-legacy.sql` documents how to copy old `jeffers4_dates` and `jeffers4_fonts` data into the new widget database.

Do not delete the legacy databases until the new JeffersonWM API is verified live and cPanel/env references have been checked.

## Deployment

Hosted path:

- `https://jeffersonwm.com/jeffersonwm/`

Build output:

- `apps/jeffersonwm/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/jeffersonwm/`

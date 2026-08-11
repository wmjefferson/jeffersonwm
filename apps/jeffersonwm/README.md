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

For the future JeffersonWM-owned widget API:

```powershell
cd apps/jeffersonwm
npm run dev:api
npm run typecheck:api
```

The widget API reads from `.env.development` or `.env.production`. Start from `.env.example` when the new MySQL database is created.

## Widget Migration

The homepage widget is moving out of Lionship and into JeffersonWM. During the migration, the public widget markup remains in `index.html`, but the widget is paused so the live homepage does not depend on Lionship widget endpoints.

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

# Aphelion

Aphelion is a grid image explorer with hover previews, search, custom images, and a lightweight server shell.
It now also includes an admin-facing card curation layer for turning Keep drawings into collectible card records.

## Run Locally

1. Install dependencies:
   `npm install`
2. Start the local dev server:
   `npm run dev`
3. Start the live server:
   `$env:NODE_ENV='production'; npm run server`
4. Start the dev tunnel:
   `npm run tunnel:dev`
5. Start the live tunnel:
   `npm run tunnel:live`

The app runs on `APHELION_PORT`, with `8125` reserved for dev and `8120` reserved for live.
Set `APHELION_IMAGE_DIRS` to a semicolon-separated list of image roots, with the fastest local server mirror first and the shared Keep folder second. Set `VITE_APHELION_API_BASE_URL` to the public API hostname when building the ASO-hosted frontend.
For card curation, set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `APHELION_MYSQL_DATABASE`. Aphelion will create its MySQL tables automatically once the connection works.
For dev, no override is needed because `server.ts` loads `.env.development` by default. For live server runs, set `NODE_ENV=production` or `$env:APHELION_ENV_FILE='.env.production'` before `npm run server`. The `NODE_ENV` setting should come from the launch command, not from the `.env.*` files, so Vite does not warn during frontend builds.

## Publish

From the monorepo root:

```powershell
npm run publish:aphelion
```

That command:

- uploads the built frontend to the ASO `/aphelion/` folder
- syncs the backend source/runtime files to `\\JEFFERSHIZZLE-D\Dotcoms E\aphelion`

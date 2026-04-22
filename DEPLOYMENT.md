# Deployment Workflow

This monorepo deploys to the `jeffersonwm.com` hosting space on ASO.

## Hosted Paths

Each app is built locally and its `dist` output is uploaded to the matching folder on the server:

- `apps/perihelion/dist` -> `/home2/jeffers4/jeffersonwm.com/perihelion/`
- `apps/bullion/dist` -> `/home2/jeffers4/jeffersonwm.com/bullion/`
- `apps/lionship/dist` -> `/home2/jeffers4/jeffersonwm.com/lionship/`
- `apps/jeffersonwm/dist` -> `/home2/jeffers4/jeffersonwm.com/jeffersonwm/`

## Build Commands

From the monorepo root:

```powershell
npm run build:perihelion
npm run build:bullion
npm run build:lionship
npm run build:jeffersonwm
```

To build everything:

```powershell
npm run build
```

To reinstall dependencies and verify all apps:

```powershell
npm run verify
```

## Upload Rule

Upload the **contents** of each app's `dist` folder into the matching ASO directory.

Example:

- upload `apps/bullion/dist/index.html` to `/home2/jeffers4/jeffersonwm.com/bullion/index.html`
- upload `apps/bullion/dist/assets/*` to `/home2/jeffers4/jeffersonwm.com/bullion/assets/*`

Do not upload the `dist` folder itself as a nested folder on the server.

## App Notes

### Perihelion

Perihelion's frontend is hosted on ASO, but its API/media backend lives on the home server through:

- `https://api.jeffersonwm.com`

Deploying Perihelion on ASO means uploading the built frontend only:

- `index.html`
- `assets/*`

The Python API and Cloudflare Tunnel are maintained separately on the home server.

### Bullion

Bullion is a frontend-only app. Deploy the built files from `apps/bullion/dist`.

### Lionship

Lionship is a frontend-only app. Deploy the built files from `apps/lionship/dist`.

### JeffersonWM

JeffersonWM is configured for the hosted path:

- `https://jeffersonwm.com/jeffersonwm/`

Deploy the built files from `apps/jeffersonwm/dist`.

## Recommended Deployment Checklist

- run the app build locally
- verify the generated `dist` looks current
- replace `index.html` on the host
- replace the `assets` folder contents on the host
- hard refresh the live site after upload
- test the app in production

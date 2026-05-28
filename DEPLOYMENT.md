# Deployment Workflow

This document reflects the current live split between ASO-hosted frontends, home-server backends, and the standalone auth service.

## JeffersonWM Monorepo Scope

This repo currently contains:

- `apps/feed`
- `apps/jeffersonwm`
- `apps/perihelion`
- `apps/lionship`
- `apps/bullion`
- `apps/vermilion`
- `apps/battalion`

Not every app in the repo is deployed the same way.

## Frontend Deploy Targets On ASO

These apps are built locally and uploaded to ASO as static frontend assets.

- `apps/feed/dist`
  - live frontend path:
    - `https://jeffersonwm.com/feed/`
- `apps/jeffersonwm/dist`
  - live homepage root:
    - `https://jeffersonwm.com`
- `apps/perihelion/dist`
  - live frontend path:
    - `https://jeffersonwm.com/perihelion/`
- `apps/lionship/dist`
  - live frontend path:
    - `https://jeffersonwm.com/lionship/`
- `apps/bullion/dist`
  - live frontend path:
    - `https://jeffersonwm.com/bullion/`

Upload the **contents** of each `dist` folder, not the `dist` folder itself.

## Local Build Commands

From the monorepo root:

```powershell
npm run build:feed
npm run build:perihelion
npm run build:bullion
npm run build:lionship
npm run build:jeffersonwm
```

To build the monorepo apps together:

```powershell
npm run build
```

To reinstall dependencies and verify the currently wired frontend apps:

```powershell
npm run verify
```

## Current Live Backend Split

### Perihelion

- frontend:
  - ASO
- backend:
  - home server
- live API:
  - `https://api.jeffersonwm.com`

Deploy pattern:

1. build frontend locally
2. upload `apps/perihelion/dist` to ASO
3. update the live Python backend script on the home server
4. restart the Perihelion backend process

### Lionship

- frontend:
  - ASO
- backend:
  - home server
- live API:
  - `https://api-lionship.jeffersonwm.com`

Deploy pattern:

1. build frontend locally
2. upload `apps/lionship/dist` to ASO
3. copy or pull backend source to:
   - `E:\lionship\backend`
4. restart the live Node process

### JeffersonWM Homepage

- frontend:
  - ASO root
- data dependencies:
  - Lionship widget endpoints
  - Auth JeffersonWM when account links are used later

Deploy pattern:

1. update `apps/jeffersonwm`
2. if needed, build locally
3. upload the resulting frontend files to the JeffersonWM root on ASO

### Feed

- frontend:
  - ASO
- backend:
  - intended to stay its own service entity
- suggested live API:
  - `https://api-feed.jeffersonwm.com`
- suggested home-server runtime:
  - `E:\feed\backend`
- suggested port:
  - `8050`

Deploy pattern:

1. build locally
2. upload `apps/feed/dist` to the live `/feed/` path
3. point the frontend at the live backend with:
   - `VITE_API_BASE_URL`
4. restart the feed backend if its API changed

Recommended data shape for cross-site updates:

- expose small changelog JSON feeds or endpoints per site
- or push release entries into the feed backend with:
  - `POST /api/feed/changelog`

### Bullion

Bullion is currently frontend-only in this repo.

Deploy pattern:

1. build locally
2. upload `apps/bullion/dist`

## Services Outside This Monorepo

### Auth JeffersonWM

Auth is no longer part of this monorepo.

- source repo:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\auth-jeffersonwm`
- live runtime:
  - `E:\auth-jeffersonwm\backend`
- live site:
  - `https://auth.jeffersonwm.com`

Deploy auth by updating the auth repo/runtime separately.

### Dooky Detective

Dooky is maintained from its own repo/runtime.

- local repo:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective`
- live backend:
  - `E:\dookydetective\backend`

### Jeffershizzle

Jeffershizzle is maintained separately.

- local repo:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffershizzle`
- live backend script:
  - `E:\scripts\jeffershizzle_images_api.py`

## Recommended Deploy Rules

### For ASO-hosted frontends

- build locally
- upload fresh frontend assets
- hard refresh the live site

### For home-server backends

- update the live backend source
- restart the matching process
- verify the API locally and publicly

### For Auth JeffersonWM

Because auth serves both frontend and backend from the home server, the cleanest pattern is:

1. update source locally
2. sync source to the live runtime
3. build there or copy the updated `dist`
4. restart auth

## Recommended Release Checklist

- confirm which repo owns the change
- build locally if frontend assets changed
- sync backend files if runtime code changed
- restart the affected service
- verify the public site
- verify the public API when relevant
- verify cross-app auth behavior if the change touches central auth

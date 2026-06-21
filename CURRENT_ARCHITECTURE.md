# Current Architecture Snapshot

This is the current working shape of the active sites, services, and supporting repos.

## Primary Local Source Repos

- JeffersonWM monorepo:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm`
- Auth JeffersonWM:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\auth-jeffersonwm`
- Dooky Detective:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective`
- Jeffershizzle:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffershizzle`
- Multimillion template:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\multimillion`

## JeffersonWM Monorepo Apps

- `apps/jeffersonwm`
  - live homepage and widget hub
- `apps/feed`
  - JeffersonWM feed page and release timeline
- `apps/stallioneer`
  - library inventory and barcode entry app
- `apps/perihelion`
  - live frontend client for the Perihelion archive
- `apps/lionship`
  - live frontend plus backend source for the links service
- `apps/bullion`
  - static app in the JeffersonWM family
- `apps/vermilion`
  - local Python project now tracked in the monorepo
- `apps/millionfold`
  - batch image trimmer, renamer, and processor
- `apps/battalion`
  - tracked source for the live Battalion app; current runtime still deploys from the home server copy

## Current Project Checkpoints

- Stallioneer
  - current release checkpoint:
    - `v0.1.3`
  - current editing direction:
    - add-book flow split more clearly into lookup, details, inventory, and actions
    - inventory editing now prefers copy-first editing instead of shared top-level defaults
    - speed mode and standard mode are both being tuned around real scanning and shelf entry work

## Home Server Runtime Layout

- Shared scripts workspace:
  - `E:\scripts`
- Perihelion:
  - backend script: `E:\scripts\perihelion_images_api.py`
  - images: `E:\perihelion\images`
  - shares: `E:\perihelion\shares`
  - port: `8010`
  - auth mode: central auth via `auth.jeffersonwm.com`
- Dooky Detective:
  - backend runtime: `E:\dookydetective\backend`
  - images: `E:\dookydetective\images`
  - port: `8020`
- Jeffershizzle:
  - backend script: `E:\scripts\jeffershizzle_images_api.py`
  - images: `E:\jeffershizzle\images`
  - port: `8030`
- Lionship:
  - backend runtime: `E:\lionship\backend`
  - data cache:
    - `E:\lionship\data`
  - port: `8040`
- Auth JeffersonWM:
  - backend runtime: `E:\auth-jeffersonwm\backend`
  - SQLite store:
    - `E:\auth-jeffersonwm\backend\data\auth-jeffersonwm.sqlite3`
  - port: `8060`
- Feed:
  - suggested backend runtime:
    - `E:\feed\backend`
  - suggested port:
    - `8050`
- Battalion:
  - backend runtime: `E:\battalion`
  - current production start command:
    - `npm run prod`
  - port: `8070`
- Millionfold:
  - backend script: `E:\millionfold\millionfold_api.py`
  - port: `8090`
  - auth mode: central auth via `auth.jeffersonwm.com`

## Public Frontends

- JeffersonWM homepage:
  - `https://jeffersonwm.com`
- Feed page:
  - `https://jeffersonwm.com/feed/`
- Perihelion frontend:
  - `https://jeffersonwm.com/perihelion/`
- Lionship frontend:
  - `https://jeffersonwm.com/lionship/`
- Auth JeffersonWM:
  - `https://auth.jeffersonwm.com`
- Dooky Detective:
  - `https://dookydetective.com`
- Jeffershizzle:
  - `https://jeffershizzle.com`
- Millionfold frontend:
  - `https://jeffersonwm.com/millionfold/`


## Public APIs

- Perihelion API:
  - `https://api.jeffersonwm.com`
- Lionship API:
  - `https://api-lionship.jeffersonwm.com`
- Auth JeffersonWM app + API root:
  - `https://auth.jeffersonwm.com`
- Feed API:
  - suggested:
    - `https://api-feed.jeffersonwm.com`
- Dooky Detective API:
  - `https://api.dookydetective.com`
- Jeffershizzle API:
  - `https://api.jeffershizzle.com`
- Millionfold API:
  - suggested:
    - `https://api-millionfold.jeffersonwm.com`


## Cloudflare Tunnels

- `api-perihelion`
  - hostname: `api.jeffersonwm.com`
  - service: `http://127.0.0.1:8010`
- `api-dookydetective`
  - hostname: `api.dookydetective.com`
  - service: `http://127.0.0.1:8020`
- `api-jeffershizzle`
  - hostname: `api.jeffershizzle.com`
  - service: `http://127.0.0.1:8030`
- `api-lionship`
  - hostname: `api-lionship.jeffersonwm.com`
  - service: `http://127.0.0.1:8040`
- `api-auth-jeffersonwm`
  - hostname: `auth.jeffersonwm.com`
  - service: `http://127.0.0.1:8060`
- `api-feed`
  - suggested hostname: `api-feed.jeffersonwm.com`
  - suggested service: `http://127.0.0.1:8050`
- `api-battalion`
  - tunnel token currently tracked operationally as:
    - `api-battalion.token`
  - live runtime service:
    - `http://127.0.0.1:8070`
- `api-millionfold`
  - suggested hostname: `api-millionfold.jeffersonwm.com`
  - service: `http://127.0.0.1:8090`


## Deployment Split

### Local development

Use the laptop repos as the source of truth for code.

- edit locally
- test locally when practical
- commit and push from the source repo

### Production frontend deploy

Use ASO for the static/public frontends that are not served directly from the home server.

- build locally
- upload the built frontend to ASO

This applies to:

- JeffersonWM homepage
- Feed page
- Perihelion frontend
- Lionship frontend
- Bullion

### Production backend deploy

Use the home server for live Node and Python runtimes.

- update the live runtime copy on the home server
- restart the matching process
- keep Cloudflare tunnels pointed at `127.0.0.1` services

### Central auth deployment

`auth-jeffersonwm` is now its own repo and service.

- source repo:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\auth-jeffersonwm`
- live runtime:
  - `E:\auth-jeffersonwm\backend`
- session cookie scope:
  - `.jeffersonwm.com`

## Central Auth Status

`auth.jeffersonwm.com` is now the first shared account system for the JeffersonWM network.

Current features:

- request / approval / block account flow
- admin dashboard
- per-app memberships
- account history
- shared session handling for JeffersonWM subdomains

Current active client:

- Perihelion
  - requires:
    - valid central auth session
    - `perihelion` app membership
- Millionfold
  - requires:
    - valid central auth session
    - `millionfold` app membership


## Source Of Truth Summary

- code source of truth:
  - local repos on the laptop
- live backend runtime:
  - home server
- live static frontend hosting:
  - ASO
- public routing and exposure:
  - Cloudflare DNS + Tunnel
- shared identity layer:
  - `auth.jeffersonwm.com`

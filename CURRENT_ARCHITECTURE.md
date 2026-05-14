# Current Architecture Snapshot

This is the current working shape of the active sites and services.

## Local Source Repos

- JeffersonWM: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm`
- Dooky Detective: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\dookydetective`
- JeffersonWM legacy: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm-legacy`
- WmJefferson: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\wmjefferson`
- Jeffershizzle: `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffershizzle`

## Home Server Layout

- Perihelion:
  - backend script: `E:\scripts\perihelion_images_api.py`
  - images: `E:\perihelion\images`
  - shares: `E:\perihelion\shares`
  - port: `8010`
- Dooky Detective:
  - backend repo/runtime: `E:\dookydetective\backend`
  - images: `E:\dookydetective\images`
  - port: `8020`
- Jeffershizzle:
  - frontend root on ASO: `public_html`
  - image API script: `jeffershizzle_images_api.py`
  - images: `E:\jeffershizzle\images`
  - port: `8030`
- Lionship:
  - backend: `E:\lionship\backend`
  - data/config/logs under `E:\lionship\...`
  - next clean port: `8040` (to avoid Jeffershizzle on `8030`)

## Public Frontends

- JeffersonWM homepage: `https://jeffersonwm.com`
- Perihelion frontend: `https://jeffersonwm.com/perihelion/`
- Dooky Detective frontend: `https://dookydetective.com`
- Jeffershizzle frontend: `https://jeffershizzle.com`

## Public APIs

- Perihelion API: `https://api.jeffersonwm.com`
- Dooky Detective API: `https://api.dookydetective.com`
- Jeffershizzle API: `https://api.jeffershizzle.com`
- Lionship API: `https://api-lionship.jeffersonwm.com`

## Cloudflare Tunnels

- `api-perihelion`
  - hostname: `api.jeffersonwm.com`
  - service: `http://localhost:8010`
- `api-dookydetective`
  - hostname: `api.dookydetective.com`
  - service: `http://localhost:8020`
- `api-jeffershizzle`
  - hostname: `api.jeffershizzle.com`
  - service: `http://localhost:8030`
- `api-lionship`
  - hostname: `api-lionship.jeffersonwm.com`
  - service: `http://localhost:8040`

## Deployment Split

### Local development

Use the local repos as the source of truth for code.

- edit locally
- test locally
- push to GitHub

### Production frontend deploy

- build locally
- upload build output to ASO for the public site

### Production backend deploy

- pull/update code on the home server only for the live runtime copy
- restart the live backend there

## Share Pages

### Perihelion

- shared galleries are served by the API
- the frontend now supports path-style share URLs:
  - `https://jeffersonwm.com/perihelion/abcd`
- legacy query-style URLs can still be read:
  - `https://jeffersonwm.com/perihelion/?share=abcd`

## Source Of Truth Summary

- code source of truth: local repos on the laptop
- live backend runtime: home server
- live static frontend hosting: ASO
- public routing and exposure: Cloudflare DNS + Tunnel

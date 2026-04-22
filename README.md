# JeffersonWmDotcom Monorepo

This repository contains the Jefferson Wm web apps:

- `apps/perihelion`
- `apps/bullion`
- `apps/lionship`
- `apps/jeffersonwm`

Legacy standalone repos are preserved separately and this monorepo is the new active workspace.

Each app keeps its own dependencies and build configuration. The root `package.json`
provides convenience scripts for installing and building the apps without forcing
them into a shared npm workspace.

## Useful Commands

- `npm run install:all`
- `npm run build`
- `npm run verify`

## Deployment

Deployment notes for the ASO hosting layout live in [DEPLOYMENT.md](./DEPLOYMENT.md).

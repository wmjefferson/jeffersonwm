# JeffersonWmDotcom Monorepo

This repository contains the Jefferson Wm web apps:

- `apps/feed`
- `apps/perihelion`
- `apps/bullion`
- `apps/battalion`
- `apps/lionship`
- `apps/jeffersonwm`
- `apps/vermilion`

Legacy standalone repos are preserved separately and this monorepo is the new active workspace.

Each app keeps its own dependencies and build configuration. The root `package.json`
provides convenience scripts for installing and building the apps without forcing
them into a shared npm workspace.

## Useful Commands

- `npm run install:feed`
- `npm run install:battalion`
- `npm run install:all`
- `npm run build:battalion`
- `npm run build:feed`
- `npm run build`
- `npm run verify`

## Deployment

Deployment notes for the ASO hosting layout live in [DEPLOYMENT.md](./DEPLOYMENT.md).
Current live stack notes live in [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md).
Operational startup and service notes live in [STACK_RUNBOOK.md](./STACK_RUNBOOK.md).

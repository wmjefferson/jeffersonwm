![JeffersonWM git banner](./docs/images/jeffwm-git.jpeg)

# JeffersonWmDotcom Monorepo

JeffersonWM is the active monorepo for the JeffersonWM sites, utilities, and support apps. It consolidates the current public-facing projects, internal tooling, and release infrastructure into one working tree so builds, feed updates, and homepage/version coordination can move together.

## App folders

Active app directories in [`apps/`](./apps):

- `apps/battalion`
- `apps/bullion`
- `apps/feed`
- `apps/jeffersonwm`
- `apps/lionship`
- `apps/millionfold`
- `apps/perihelion`
- `apps/stallioneer`
- `apps/tourbillion`
- `apps/vermilion`

Legacy standalone repos may still exist for history, but this repository is the main workspace.

## Root scripts

The root [`package.json`](./package.json) provides convenience scripts for the npm-managed apps that are currently wired into the shared build flow:

- `npm run install:all`
- `npm run build`
- `npm run verify`
- `npm run deploy:prepare`

Per-app scripts available from the root today:

- `npm run install:battalion`
- `npm run install:perihelion`
- `npm run install:bullion`
- `npm run install:feed`
- `npm run install:lionship`
- `npm run install:jeffersonwm`
- `npm run install:vermilion`
- `npm run build:battalion`
- `npm run build:perihelion`
- `npm run build:bullion`
- `npm run build:feed`
- `npm run build:lionship`
- `npm run build:jeffersonwm`
- `npm run build:vermilion`

Some app folders use their own local runtimes or workflows and are not yet part of the root npm script chain.

## Ops docs

- Deployment notes: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Current live stack: [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md)
- Startup and service notes: [STACK_RUNBOOK.md](./STACK_RUNBOOK.md)

## Working style

- Keep app-specific dependencies and build config inside each app.
- Use the feed and JeffersonWM homepage together when publishing version updates.
- Treat this repo as the source of truth for cross-app coordination, release notes, and shared documentation.

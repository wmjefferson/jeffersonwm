# Perihelion

![Perihelion - Image Browser](https://jeffersonwm.com/pic/gitprofperihelion.jpg)

Perihelion is a limited-by-design image browser for navigating picture collections, staged selections, exports, and shareable pages. It is built for personal art-study and reference workflows, but the structure is flexible enough to grow into a broader image utility.

## Local Development

From the monorepo root:

```powershell
npm run install:perihelion
npm run build:perihelion
```

For local frontend + backend development inside the app folder:

```powershell
cd apps/perihelion
npm run dev
```

## Deployment

Frontend path:

- `https://jeffersonwm.com/perihelion/`

Build output:

- `apps/perihelion/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/perihelion/`

Perihelion's API and media backend are served separately from the home server through:

- `https://api.jeffersonwm.com`

That means ASO deployment covers the frontend build only.

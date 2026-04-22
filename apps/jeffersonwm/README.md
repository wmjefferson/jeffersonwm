# JeffersonWM

![William Jefferson](https://jeffersonwm.com/pic/gitprofjeffersonwm.jpg)

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

## Deployment

Hosted path:

- `https://jeffersonwm.com/jeffersonwm/`

Build output:

- `apps/jeffersonwm/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/jeffersonwm/`

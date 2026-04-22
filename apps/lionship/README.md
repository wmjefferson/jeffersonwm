# Lionship

Lionship is a high-density link dashboard for organizing personal web destinations into a fast, visually minimal hub. It began as an AI Studio app and now lives inside the JeffersonWmDotcom monorepo as a standalone React/TypeScript site.

## Local Development

From the monorepo root:

```powershell
npm run install:lionship
npm run build:lionship
```

For app development inside the app folder:

```powershell
cd apps/lionship
npm run dev
```

If the app uses Gemini features, copy `.env.example` to `.env.local` and set:

```text
GEMINI_API_KEY=your_key_here
```

## Deployment

Hosted path:

- `https://jeffersonwm.com/lionship/`

Build output:

- `apps/lionship/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/lionship/`

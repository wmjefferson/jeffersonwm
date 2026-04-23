# Lionship

Lionship is a high-density link dashboard for organizing personal web destinations into a fast, visually minimal hub. It began as an AI Studio app and now lives inside the JeffersonWmDotcom monorepo as a React/TypeScript app with an optional Express/MySQL backend.

## Architecture

Lionship can run in two modes:

- frontend-only mode
- backend-backed mode

### Frontend-only mode

The app works as a static site and falls back to browser local storage for saved links. This is the simplest deployment path and fits standard ASO static hosting.

### Backend-backed mode

The app can also run with:

- `server.ts`
- Express API routes at `/api/links`
- optional MySQL persistence

In this mode, link edits can be stored centrally instead of only in the browser.

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

If the app uses Gemini features or the optional database backend, copy `.env.example` to `.env.local` and set the values you need:

```text
GEMINI_API_KEY=your_key_here
MYSQL_HOST=your_host
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
```

## Deployment

Hosted path:

- `https://jeffersonwm.com/lionship/`

Build output:

- `apps/lionship/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/lionship/`

## Deployment Options

### Option 1: frontend-only on ASO

Upload the built `dist` contents to the hosted `lionship` folder. In this setup:

- the app is static
- local storage remains the fallback storage
- no server process or database is required

### Option 2: backend-backed deployment

Run `server.ts` in an environment that supports:

- Node.js
- Express
- environment variables
- optional MySQL access

In this setup:

- the frontend can still be built with Vite
- the backend serves `/api/links`
- edits can persist in MySQL

This is better if you want Lionship to store edits centrally across devices.

# Lionship Workflow

This app now follows the same split as the other sites:

- local source = where code changes happen
- static frontend = what gets uploaded for the live site
- optional backend = what handles shared persistence

## Source Of Truth

Local app folder:

- `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\lionship`

## Local Development

Run the integrated app server:

```powershell
cd C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\lionship
npm install
npm run dev
```

Local integrated URL:

- `http://localhost:8040`

Optional standalone Vite client:

```powershell
npm run dev:client
```

Standalone Vite URL:

- `http://localhost:8041`

## Local Behavior

- if the API and database are available, edits go through `/api/links`
- if the database is not configured, the app falls back to local storage

## Frontend Build

Build command:

```powershell
npm run build
```

Build output:

- `dist`

## Production Model

Recommended live setup:

- frontend hosted statically
- backend/API served separately
- backend port: `8040`
- MySQL stores shared link data

## Current Recommended Production Shape

- frontend: `https://jeffersonwm.com/lionship/`
- API: `https://api-lionship.jeffersonwm.com`
- backend port: `8040`

## Safe Update Flow

1. Edit code locally.
2. Test with `npm run dev`.
3. Build with `npm run build`.
4. Commit and push from the repo.
5. Deploy the frontend build.
6. If backend code changed, update the live backend copy and restart it.

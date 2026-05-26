# Stack Runbook

This is the practical operations guide for the current JeffersonWM network.

## Current Live Services

### Central auth

- site:
  - `https://auth.jeffersonwm.com`
- home-server runtime:
  - `E:\auth-jeffersonwm\backend`
- port:
  - `8060`

### Perihelion

- frontend:
  - `https://jeffersonwm.com/perihelion/`
- API:
  - `https://api.jeffersonwm.com`
- backend script:
  - `E:\scripts\perihelion_images_api.py`
- port:
  - `8010`
- auth mode:
  - central auth
- required app membership:
  - `perihelion`

### Feed

- frontend:
  - `https://jeffersonwm.com/feed/`
- local app source:
  - `apps/feed`
- intended backend shape:
  - separate feed service entity
- suggested live API:
  - `https://api-feed.jeffersonwm.com`
- suggested home-server runtime:
  - `E:\feed\backend`
- suggested port:
  - `8050`
- semantic release notes:
  - use the `Release` source type in the composer

### Lionship

- frontend:
  - `https://jeffersonwm.com/lionship/`
- API:
  - `https://api-lionship.jeffersonwm.com`
- backend:
  - `E:\lionship\backend`
- port:
  - `8040`

### Dooky Detective

- frontend:
  - `https://dookydetective.com`
- API:
  - `https://api.dookydetective.com`
- backend:
  - `E:\dookydetective\backend`
- port:
  - `8020`

### Jeffershizzle

- frontend:
  - `https://jeffershizzle.com`
- API:
  - `https://api.jeffershizzle.com`
- backend script:
  - `E:\scripts\jeffershizzle_images_api.py`
- port:
  - `8030`

### Battalion

- backend:
  - `E:\battalion`
- production command:
  - `npm run prod`
- port:
  - `8070`

## VS Code Service Control

Open the shared scripts workspace:

- `\\JEFFERSHIZZLE-D\Dotcoms\scripts\dotcoms-code-workspace.code-workspace`

Then use:

```text
Ctrl+Shift+P
Tasks: Run Task
```

Main task names:

- `VSCode: start all services`
- `VSCode: restart all services`
- `VSCode: stop all services`
- `restart tunnels`
- `restart servers`

If the task list does not appear correctly:

```text
Developer: Reload Window
```

## Direct Server Scripts

From `E:\scripts`:

```powershell
.\start-all-services.ps1
.\stop-all-services.ps1
.\restart-all-services.ps1
.\start-servers.ps1
.\start-tunnels.ps1
.\restart-servers.ps1
.\restart-tunnels.ps1
```

Supporting files:

- `E:\scripts\service-launcher.ps1`
- `E:\scripts\.vscode\tasks.json`

## Start Command Reference

### Perihelion backend

Runs with central-auth environment setup before:

```powershell
python E:\scripts\perihelion_images_api.py
```

### Peri tunnel

```powershell
cloudflared tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-perihelion.token
```

### Dooky backend

```powershell
Set-Location E:\dookydetective\backend
npm run server
```

### Dooky tunnel

```powershell
cloudflared tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-dookydetective.token
```

### Jeffershizzle backend

```powershell
Set-Location E:\scripts
py jeffershizzle_images_api.py
```

### Jeffershizzle tunnel

```powershell
cloudflared.exe tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-jeffershizzle.token
```

### Lionship backend

```powershell
Set-Location E:\lionship\backend
npm run server
```

### Lionship tunnel

```powershell
cloudflared tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-lionship.token
```

### Auth backend

```powershell
Set-Location E:\auth-jeffersonwm\backend
$env:NODE_ENV='production'
npm run server
```

### Auth tunnel

```powershell
cloudflared.exe tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-auth-jeffersonwm.token
```

### Battalion backend

```powershell
Set-Location E:\battalion
npm run prod
```

### Battalion tunnel

```powershell
cloudflared.exe tunnel run --token-file C:\Users\Bill\.cloudflared\tokens\api-battalion.token
```

## Auth Notes

### Central auth host

- auth site:
  - `https://auth.jeffersonwm.com`
- session cookie domain:
  - `.jeffersonwm.com`

### Peri session verification

In a browser where you are signed into auth, this should show a real user object:

- `https://api.jeffersonwm.com/api/auth/status`

If `user` is `null` there, Peri is not seeing the shared session yet.

### Peri access requirement

Approved account alone is not enough.

Peri currently requires:

- approved account
- `perihelion` app membership

## Troubleshooting Notes

### Peri API root vs health

Peri currently uses:

- root API page:
  - `https://api.jeffersonwm.com/`
- auth status:
  - `https://api.jeffersonwm.com/api/auth/status`

There is not a dedicated `/health` endpoint on the Peri API right now.

### Feed changelog ingestion

Better than iframe embeds:

- publish changelog JSON from each site
- or push release entries directly to the feed backend

Useful feed endpoints:

- `GET /api/changelog/schema`
- `POST /api/feed/changelog`
- `POST /api/feed/import-changelogs`

### Battalion command mismatch

Battalion does **not** use:

```powershell
npm run server
```

Use:

```powershell
npm run prod
```

### Port in use

If you see `EADDRINUSE`, the backend is usually already running on that port.

### VS Code task visibility

If the task list appears empty, make sure you are opening the shared scripts workspace or folder and reload the window once.

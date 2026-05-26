# Feed Changelog Workflow

This document is the reusable handoff for creating and publishing changelog entries into the JeffersonWM feed.

Use it when working from another chat, another computer, or another app so the same setup and format are preserved.

---

## What This System Does

The feed has two views:

- `Full Feed`
  - mixed chronological stream of GitHub activity, manual entries, and release notes
- `Changelog`
  - release-note-only view, using the same release entries filtered out of the main timeline

Release entries are not a separate database or service. They are standard feed entries with:

- `source: "release"`
- a semantic version title
- 3 short “What’s New” bullets

Those release entries appear:

- in the main feed chronologically
- in the changelog-only view automatically

---

## Live Setup

### Frontend

- public page:
  - `https://jeffersonwm.com/feed/`
- source:
  - `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\feed`
- upload destination:
  - ASO `feed` subfolder for JeffersonWM

### Backend

- public API:
  - `https://api-feed.jeffersonwm.com`
- runtime folder:
  - `E:\feed\backend`
- local origin:
  - `http://127.0.0.1:8050`

### Cloudflare Tunnel

For `api-feed.jeffersonwm.com`, the route should be:

- hostname:
  - `api-feed.jeffersonwm.com`
- path:
  - leave empty
- type:
  - `HTTP`
- URL:
  - `127.0.0.1:8050`

Important:

- do **not** use `HTTPS` for the local origin
- do **not** use a custom path like `^/blog`

---

## Server `.env`

Example live `E:\feed\backend\.env` shape:

```env
PORT=8050
HOST=0.0.0.0
PUBLIC_BASE_URL=https://api-feed.jeffersonwm.com
ALLOWED_ORIGINS=https://jeffersonwm.com,https://www.jeffersonwm.com,https://api-feed.jeffersonwm.com
VITE_API_BASE_URL=https://api-feed.jeffersonwm.com

CHANGELOG_SOURCE_URLS=
CHANGELOG_POLL_MINUTES=15

FEED_SECRET=your-private-feed-secret
GITHUB_FEED_URL=https://github.com/wmjefferson.atom

MYSQL_HOST=143.95.39.115
MYSQL_USER=jeffers4_admin
MYSQL_PASSWORD=your-real-password
MYSQL_DATABASE=jeffers4_feeds
```

### What `FEED_SECRET` Is

You choose this yourself.

It is **not**:

- a GitHub token
- a MySQL password
- a Cloudflare token
- an auth.jeffersonwm.com password

It is only the feed app’s private editor/admin secret.

It is used for:

- feed editor login
- manual posting
- release-note posting
- changelog imports

The same value is:

- stored in `E:\feed\backend\.env`
- entered into the feed page’s editor login

---

## Start The Feed Server

On the server:

```powershell
Set-Location E:\feed\backend
npm install
npm run build
$env:NODE_ENV='production'
npm run server
```

### Local health check

```powershell
try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8050/health").Content } catch { $_ | Out-String }
```

### Public health check

```powershell
try { (Invoke-WebRequest -UseBasicParsing "https://api-feed.jeffersonwm.com/health").Content } catch { $_ | Out-String }
```

Expected:

- local `/health` proves the app is up
- public `/health` proves tunnel + Cloudflare routing are correct

---

## Frontend Deploy

Build locally from:

- `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\feed`

```powershell
Set-Location "C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\feed"
npm run build
```

Upload the contents of:

- `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\feed\dist`

to:

- the `feed` subfolder on JeffersonWM hosting at ASO

That powers:

- `https://jeffersonwm.com/feed/`

---

## Human Request Template

Use this when asking another chat or another assistant to prepare a changelog update:

```text
Create a changelog update for Feed.

App: Battalion
Version: 1.0.1
Date: 2026-05-26
URL: https://github.com/wmjefferson/jeffersonwm/issues/33

Highlights:
- Added CRUD flow for actions and emotions
- Improved emotion and body sensation structure
- Continued polish on mechanics and progression

Context:
- Include anything important since the last release
- Keep it to 3 bullets
- Phrase it like a “What’s New” panel
```

### Multi-app version

```text
Create a changelog batch for Feed.

App: JeffersonWM
Version: 1.0.1
URL: https://jeffersonwm.com
Highlights:
- ...
- ...
- ...

App: Perihelion
Version: 1.0.1
URL: https://jeffersonwm.com/perihelion/
Highlights:
- ...
- ...
- ...

App: Battalion
Version: 1.0.1
URL: https://github.com/wmjefferson/jeffersonwm/issues/33
Highlights:
- ...
- ...
- ...
```

---

## JSON Format For Direct Publishing

The feed backend already accepts this shape directly:

```json
{
  "source": "release",
  "entries": [
    {
      "id": "battalion-v1.0.1",
      "appName": "Battalion",
      "version": "1.0.1",
      "url": "https://github.com/wmjefferson/jeffersonwm/issues/33",
      "createdAt": "2026-05-26T18:00:00-07:00",
      "highlights": [
        "Added CRUD flow for actions and emotions.",
        "Improved the emotion and body sensation structure.",
        "Continued polish on mechanics and progression."
      ]
    }
  ]
}
```

### Notes

- `source` should usually be `"release"`
- `id` should be stable and unique
- `appName` is the public app/site name
- `version` becomes part of the title
- each `highlights` line becomes a bullet in “What’s New”

---

## Feed API Endpoints

### Read

- `GET /health`
- `GET /api/feed`
- `GET /api/changelog/schema`

### Write / admin

- `POST /api/auth/verify`
- `POST /api/feed`
- `POST /api/feed/refresh`
- `POST /api/feed/import-changelogs`
- `POST /api/feed/changelog`

Base URL:

- `https://api-feed.jeffersonwm.com`

Example full release endpoint:

- `https://api-feed.jeffersonwm.com/api/feed/changelog`

---

## How To Publish A Release Manually

There are two easy ways.

### Option 1: Through the feed UI

1. Open:
   - `https://jeffersonwm.com/feed/`
2. Log in with the feed secret
3. Choose `Release`
4. Enter:
   - app/site
   - version
   - URL
   - three highlight lines
5. Post it

### Option 2: Through the API

POST to:

- `https://api-feed.jeffersonwm.com/api/feed/changelog`

with a body like:

```json
{
  "secret": "your-private-feed-secret",
  "source": "release",
  "entries": [
    {
      "id": "perihelion-v1.0.1",
      "appName": "Perihelion",
      "version": "1.0.1",
      "url": "https://jeffersonwm.com/perihelion/",
      "createdAt": "2026-05-26T19:00:00-07:00",
      "highlights": [
        "Added one thing.",
        "Improved another thing.",
        "Cleaned up one more thing."
      ]
    }
  ]
}
```

---

## How To Work With Other Chats

If another chat is helping with an app and you want a clean release note later, ask them for:

1. app name
2. version number
3. public URL
4. three “What’s New” bullets
5. optional timestamp/date

Best instruction to give them:

```text
Please summarize this work as a feed-ready changelog entry.
Keep it to:
- App name
- Version
- URL
- 3 short “What’s New” bullets
Write it in a way that can be turned into the JeffersonWM feed release JSON format.
```

Then bring that result back here and it can be published into the feed.

---

## Baseline History File

The first published baseline batch lives here:

- `C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\feed\release-seeds\2026-05-25-baseline.json`

That file is the starting template for future bulk changelog batches.

You can keep adding more seed or release files in the same folder over time.

---

## Best Ongoing Workflow

1. Build features normally in the app repos
2. From time to time, ask for a manual changelog update
3. Summarize each app in 3 bullets
4. Publish those release entries into the feed
5. Upload the refreshed frontend `dist` if the feed UI changed

This keeps:

- day-to-day GitHub activity in the full timeline
- polished semantic-version updates in the changelog lane

without needing a whole separate changelog system.

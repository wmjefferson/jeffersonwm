# Feed

`apps/feed` is the JeffersonWM activity stream page.

It is designed to stay its own app-page entity while still living inside the JeffersonWM monorepo.

## Purpose

The feed combines:

- GitHub activity
- manual public log entries
- release notes
- milestone/status posts

Release notes are intended to sit inline with the GitHub feed chronologically, so version changes show up in the same timeline as repository activity.

## Local Development

From this folder:

```powershell
npm install
npm run dev
```

Default local URL:

- `http://localhost:8050`

## Production Shape

Suggested frontend path:

- `https://jeffersonwm.com/feed/`

Suggested backend API hostname:

- `https://api-feed.jeffersonwm.com`

Suggested home-server runtime:

- `E:\feed\backend`

Suggested backend shape:

- keep the feed service as its own backend entity
- point the frontend at it with:
  - `VITE_API_BASE_URL`

## Environment

Main variables:

- `PORT`
- `HOST`
- `PUBLIC_BASE_URL`
- `ALLOWED_ORIGINS`
- `VITE_API_BASE_URL`
- `CHANGELOG_SOURCE_URLS`
- `CHANGELOG_POLL_MINUTES`
- `FEED_SECRET`
- `GITHUB_FEED_URL`
- `MYSQL_HOST`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

## Notes

- semantic version updates should be posted with the `Release` source type
- each line in the release highlights box becomes a bullet in the rendered feed
- the app now builds for `/feed/`

## Better Than Iframes

Yes. Structured JSON or an authenticated webhook is much better than an iframe for changelog ingestion.

This service now supports:

- `POST /api/feed/changelog`
  - push one or more release entries directly
- `POST /api/feed/import-changelogs`
  - manually trigger imports from configured changelog source URLs
- `GET /api/changelog/schema`
  - return the expected JSON shape

### Recommended pattern

For Battalion and the other sites:

1. each site exposes a tiny changelog JSON file or endpoint
2. feed service polls those URLs with `CHANGELOG_SOURCE_URLS`
3. release entries get woven into the same chronology as GitHub events

That gives you clean structured data, better styling control, and easier long-term maintenance than mining iframe content.

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

## Folder Previews And Mixed Files

The frontend now supports two optional browse-time expansions:

- `Include Other Files` to show non-image files alongside images
- `Show Folder Thumbnails` to preview each folder by its first visible file

For richer API responses, the frontend can consume folder objects shaped like:

```json
{
  "name": "folder-name",
  "path": "folder-name",
  "thumbnailPath": "folder-name/example.jpg",
  "thumbnailKind": "image",
  "thumbnailExt": ".jpg",
  "itemCount": 12
}
```

Older APIs that only return `directories` still work; they just fall back to plain folder cards.

## Home-Server Python API Dependency

The live Perihelion API is still the Python script on the home server:

- `E:\scripts\perihelion_images_api.py`

If you want folder preview selection and metadata handling to match the repo features, install Pillow on that server-side Python runtime:

```powershell
pip install -r apps/perihelion/backend/requirements.txt
```

or directly:

```powershell
pip install Pillow
```

Pillow is intended here for metadata access and first-file folder preview discovery even if you are not exposing all of that data yet.

## Auth And History Foundation

Perihelion now has a backend foundation for:

- local user accounts
- admin approval of new accounts
- cookie-based sessions
- download history logging
- richer Pillow-backed image metadata

The current implementation is designed so the live service can stay private by default, while still letting you deliberately open it up when needed.

### Default behavior

- browsing requires sign-in by default
- download history is logged whether or not the request is authenticated
- the first registered user becomes the initial approved admin

### Environment knobs for the live Python API

```text
PERIHELION_DATA_DIR=E:\perihelion\data
PERIHELION_REQUIRE_AUTH=true
PERIHELION_SESSION_DAYS=30
PERIHELION_BOOTSTRAP_ADMIN_USERNAME=
PERIHELION_BOOTSTRAP_ADMIN_PASSWORD=
```

If you ever want to temporarily reopen browsing for testing, set:

```text
PERIHELION_REQUIRE_AUTH=false
```

### New backend endpoints

- `GET /api/auth/status`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/history/downloads`
- `GET /api/admin/users`
- `POST /api/admin/users/:id/approve`
- `POST /api/admin/users/:id/block`

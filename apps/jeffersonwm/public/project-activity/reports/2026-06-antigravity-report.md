# Platform Development Report — June 2026

This report provides a comprehensive summary of all feature development, system architecture migrations, UI improvements, and release logs completed across the platform during the month of June 2026.

---

## 🛠 Major Architectural Migrations

### 1. Vermilion (v1.0.0 to v1.3.0)
* **Desktop-to-Web Rebuild:** Migrated the legacy Tkinter Python desktop application into a modern web monorepo featuring a **React 19 + TypeScript** frontend and a multithreaded **Python HTTP API backend** running on port `8100`.
* **Pure Grouping Modes:** Implemented pure Date (Day, Month, Year) and Name Prefix (first 1, 2, or 3 characters) distribution strategies. This allows organizing files directly into folders without forcing arbitrary count-based splits.
* **Interactive dry-run Planner:** Added a dry-run directory planner, custom renaming rule presets, active filters, and SSE progress tracking with comprehensive undo/rollback support.
* **Legacy Relocation:** Relocated all old Tkinter panel files (`panels/`) and main execution scripts (`app.py`, `main.py`) to `vermilion-legacy/` for clean repository management.

### 2. Millionfold (v0.1.0 to v0.1.5)
* **New Image Processing Utility:** Created a canvas-based batch image processor React utility and a Python backend server on port `8060` (equalizing Google Keep Notes images, resizing, hex-padding, and auto-sorting by YYYY MM).
* **Job Cancellation & Controls:** Integrated an on-demand "Cancel Job" button that terminates background processing threads, and exposed the server's Process ID (PID) in the header for easier system administration.
* **Memory & Performance Polish:** Introduced a customizable feed history limit, including a **"Latest Only"** mode to discard previous images immediately on new updates. This resolved browser layout memory crashes on large folders.
* **Corrupt File Safety:** Implemented null-safety checks in the LiveFeed path parser to prevent unhandled TypeErrors from crashing the React tree on corrupted files.
* **Post-Run Summary Modal:** Added a brutalist-themed `JobCompleteModal` showing total processed files, successes, failures, and generated output ZIP archive paths.

---

## 🎨 Application & UI Enhancements

### 3. Perihelion (v1.4.0 to v1.4.3)
* **Manual Folder Covers:** Created a `folder_covers` SQLite schema and GET/POST API endpoints allowing admins to assign any image as a manual folder cover.
* **Scaling & Fit Polish:** Modified folder thumbnails to use `object-contain` with neutral letterbox fills rather than stretching/cropping images to fill.
* **Gallery URL State & Working Set:** Added stateful URL navigation to preserve search and folder locations, and implemented session-backed selection drafts to carry working-set images across page changes.
* **Cache & Previews:** Added cached 1024px previews for huge images with visible fallback/retry handling, and restored the `Lrg` badge rules for files exceeding 4096px.

### 4. Lionship (v1.1.0)
* **Tags & Categories Support:** Added a SQLite database migration for tags, category selection dropdowns, and tag-editing interfaces.
* **Dynamic Masonry Layout:** Built a fluid horizontal-first Masonry card layout for tags and categories with full-width container scaling and expanded card widths (`330px`).
* **Branded Interface:** Added a custom About page with outbound links and a re-branded responsive header.

### 5. Stallioneer (v0.1.4)
* **Personal vs. Admin Controls:** Segmented personal account preferences from administrative settings panels.
* **Layout Refinements:** Redesigned the book entry pages into a left/right working split, refined inventory lookup states, and corrected styling alignment issues in the admin header.

### 6. Clionidae (v0.1.5)
* **Design Workspace Division:** Separated design assets, grids, forms, and interface playground modules onto a dedicated `/design` route.
* **Pragmatic Root Structure:** Kept the `/home` SPA route focused purely on documentation and template infrastructure examples.
* **UI Polish:** Lightened the banner frame and tested editorial typography setups to make the template cleaner for bootstrap re-use.

---

## 🛡 Authentication & Integration

### 7. Auth & Multimillion (v0.1.0)
* **Routing Splits:** Configured Auth as a split-routed application with a landing page at `/` and the SPA dashboard at `/home`.
* **Redirections:** Built query-parameter client bypass overrides to pass logged-in users directly to their destination apps.
* **Watcher Fixes:** Resolved HMR WebSocket port conflicts and folder watch crashes over SMB network file shares.
* **Marker Alignments:** Aligned application check triggers by placing durable `dummymillionfold` and `dummyauth` files in public build locations.

### 8. Battalion (v1.2.35)
* **Routing Splits:** Separated the crimson-themed landing page (`/`) from the tracker SPA (`/home`).
* **Clean Introspective Quotes:** Removed passively optimistic endings from all 100 quotes, returning them to their purely introspective self-deprecating forms.
* **Quote Refresh:** Connected quote refresh states to update on-click alongside backend network reloads.

---

## 🌐 Platform Homepage & Release Feed

### 9. JeffersonWM Home & Feed (v0.2.2)
* **Time Greeting Widget:** Built a local time greeting widget (`Good Morning` / `Good Afternoon` / `Good Evening`) running client-side.
* **Visual Theme:** Applied the new 5% opacity "Lion" background illustration pattern across JeffersonWM Home, Feed, and Battalion.
* **Feed Resets:** Configured a title-click header action to reset active search filters and page positions instantly.
* **Release Logs:** Synchronized and pushed June release entries to the feed API.

---

## 📈 Current Version Registry

| Application | Active Version | Primary June Changes |
| :--- | :--- | :--- |
| **Perihelion** | `v1.4.3` | Manual Covers, scaling fixes, stateful URL history, staging persistence |
| **Vermilion** | `v1.3.0` | React/Python monorepo rewrite, pure date & name prefix grouping |
| **Millionfold** | `v0.1.5` | Keep Notes equalization, job cancellation, PID tracking, memory polish |
| **Battalion** | `v1.2.35` | Minimal landing page split, introspective quotes pool, quotes refresh |
| **Auth** | `v0.1.0` | Central login landing page split, query-param bypass redirects |
| **Lionship** | `v1.1.0` | Categories/tags DB support, horizontal Masonry layouts, About page |
| **Stallioneer** | `v0.1.4` | Admin banner settings, lookup layouts, edit-page split view |
| **Clionidae** | `v0.1.5` | `/design` visual library separation, typography cleanups |
| **Tourbillion** | `v0.1.1` | STARFIELD, MATRIX, PIPES screensaver modules separation |
| **Feed** | `v0.2.2` | Lion background pattern, title-click resets, release seeds push |

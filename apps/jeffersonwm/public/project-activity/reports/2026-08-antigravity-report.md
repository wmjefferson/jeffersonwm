# Platform Development Report — August 2026

This report provides a comprehensive summary of all feature development, system improvements, UI refinements, and operational work completed across the platform during the month of August 2026.

---

## 🖼 Aphelion — Keep Drawing Gallery & Curation System

### 1. Aphelion (v0.1.0 to v0.3.0)
* **App Launch & Runtime Integration:** Aphelion entered the platform as a live split-deployment image wall, gained a publish helper, server/tunnel entries, health endpoints, and shared-image-library support. The frontend deploys to ASO and the backend runs on the server share.
* **Keep Image Root Correction:** The live image path initially failed because the configured Keep root was being normalized into an invalid local path. Aphelion was updated to try multiple image roots in order — preferring the local server path then the UNC share — bringing the live site onto the real shared image catalog.
* **MySQL Curation Layer:** Shifted from a SQLite sketch to a MySQL-backed curation schema (`curationDb.ts`, `curationTypes.ts`) for card identity, rarity, series, attributes, and review state. Admin save/load/library routes were added to `server.ts`.
* **Admin Curation Page:** Built `AdminPage.tsx` with a card queue, image preview, editable identity fields, folder-tree filtering, field-level autosave, multi-select popup filters for rarity/series/attributes, and multi-series assignment. Folders are derived directly from each card's `folderPath` so the queue respects the existing thousand-image batch structure.
* **Path & SQL Debugging:** Resolved stacked 500 errors caused by UNC path over-escaping, machine-specific log folder assumptions, and a MySQL aggregation syntax incompatibility. Each issue was fixed independently to unblock the admin API.
* **Selected-Image Downloads:** The selected page now supports checkbox review with `Select all`, `Deselect all`, and `Download (n)` footer actions. Zip downloads write a detailed JSONL manifest into Aphelion's local `data/downloads` folder, while Auth receives only a lightweight `aphelion.selected_zip_downloaded` notification event — keeping the central timeline readable without duplicating per-item records.
* **Role Access Clarification:** Auth admins can now complete the popup sign-in and reach signed-in public tools. Owner-only admin/options pages remain protected. The public-only routing posture (home + highlights only, all other routes redirect) remains in place until the admin surface is ready for broader access.
* **Auth Notification Bridge:** New notification-worthy Aphelion actions were registered: `aphelion.export_all_images`, `aphelion.export_highlighted_images`, `aphelion.highlight_reset`, and `aphelion.selected_zip_downloaded`.

---

## 🔐 Auth — Central Account & Notification Service

### 2. Auth JeffersonWM (v0.1.0)
* **Popup Auth Mode:** Auth now supports a compact `popup=1` mode — a simplified card with login/register inputs that posts a success message back to the opener and closes. JeffersonWM, Perihelion, and other sites launch this popup instead of full-page redirects.
* **Account Manager Modal:** Account creation and editing were moved into a single modal editor on the Accounts page. The owner can manage usernames, display names, passwords, app memberships, account type, state, and notes without leaving the list view.
* **Activity Page Overhaul:** Rebuilt around live username search (activates after three characters), explicit column headings, and checkbox-driven filters for site and action. Site filter options were remapped to the registered app name list so the filter reads as `Auth`, `Perihelion`, or `Jeffershizzle` instead of raw history-value strings.
* **Notifications Page:** Brought into the same collapsible-filter rhythm as Activity so both log pages read as siblings. Added `Search By Username`, per-trigger `On | Off` email controls, and a stable scrollbar gutter. The direct `#notifications` route now initializes correctly on first load.
* **Naming Normalization:** Cross-app notification labels were standardized — `Peri` became `Perihelion`, Lionship actions now carry `Lionship` prefixes — so the cross-site dashboard is easier to scan.
* **Email Notification Wiring:** Registration email notifications now work through the live ASO SMTP host on port 465. Admins receive email on new requests; requesters receive email when approved or denied.
* **Widget Privacy Integration:** JeffersonWM widget API now calls Auth's status endpoint directly to resolve the current user, replacing the earlier cookie-name shortcut that could not distinguish account state.
* **Shell Background:** A shared JeffersonWM paisley/computer pattern was applied at 7% opacity to the Auth shell layer, with banners left slightly translucent so the pattern stays quiet behind the dashboard.
* **Safe Env Handling:** Clarified that `.env.development`, `.env.production`, and `.env.example` are tracked Git reference files only. Short guidance comments were added at the top of each, and the August 30 safe-save commit (`de0c390`) deliberately excluded local secret-bearing env edits.

---

## 🌐 JeffersonWM Home & Widget

### 3. JeffersonWM Home (v0.0.4 to v0.2.1)
* **Popup Auth Flow:** Login and Register links were removed from the home footer. The Account link now opens a compact popup auth card. The Account page shows a single Login/Register control that flips to Sign Out when a session is active.
* **Auth-Resolved Widget Privacy:** The widget API now queries Auth's status endpoint to determine the active user: guests receive San Francisco defaults only; approved users receive their own preference/date rows; admin retains access to the legacy global date table.
* **Account Page:** A dedicated account page at `/account/` supports city search, saved city/coordinate preferences, inferred weather-unit defaults, and a direct Celsius/Fahrenheit override. City selection is the save action — no separate button required.
* **Widget Temperature Unit:** The homepage weather display now reads `resolved.weatherUnit` and renders `°C` or `°F` correctly based on the saved preference.
* **Widget Ownership Migration:** Widget data ownership was moved from Lionship to JeffersonWM. Lionship's temporary `/api/widget/*` bridge routes were removed. The old standalone `jeffers4_dates` / `jeffers4_fonts` databases can now be retired. A new JeffersonWM API scaffold, widget DB schema, and legacy migration SQL files were added.
* **Word-of-the-Day Refinements:** Dictionary.com and Oxford were removed as active widget sources. The active editorial set settled on Merriam-Webster, Wiktionary, Dictionary.com, and Vocabulary.com. Fallback links were corrected to point at each dictionary's homepage or WOTD page instead of stale term-specific URLs.
* **Discovery Strip Experiment (Paused):** A broader daily-discovery source architecture was built and then intentionally paused after the denser source list felt too busy for the homepage. The extended sources were commented out rather than deleted so the work can be resumed later.
* **Project Activity Page:** A new public page reads the JeffersonWM GitHub project via GraphQL, filters out private and archived repositories, and renders a timeline with issue open/close durations colored by GitHub project status categories (`Backlog`, `Ready`, `In Progress`, `Blocked`, `Done`). Row-hover highlighting makes dense lines easier to follow. Filter and lower-issues panels were simplified out after the first pass.
* **Logout Cleanup:** Account logout now immediately clears the visible granted-app membership list rather than leaving stale access cues until the next page refresh.

---

## 📸 Perihelion — Archive & Gallery Intelligence

### 4. Perihelion (v1.4.5 to v1.7.0)
* **Publishing Workflow:** A dedicated publish helper (`scripts/publish-perihelion.mjs`) was added to the JeffersonWM monorepo. `npm run publish:perihelion` uploads the ASO frontend and syncs Python backend files to the server share. `--skip-build` is available for already-built deploys.
* **Shell & Typography Pass:** The browsing workspace was restyled to match the lighter Auth/Clionidae shell direction. Banners shifted to a quieter framed treatment, the full interface standardized on `Inter Tight`, and folder/image cards, popovers, and toolbar rows were softened to match.
* **Control Refinements:** Max Mode was repositioned after items-per-page options, `100` was added to the default page-size list, selected options are highlighted blue and bold, and `Include Others` was converted to an underlined toggle.
* **Folder Access Control System (v1.7.0):** Per-folder visibility moved from design discussion into implementation. The folder edit popup now has access controls for `User`, `Reg Admin`, and always-on `Pref Admin`. Each approved account supports explicit `inherit`, `allow`, and `deny` modes. Parent folders gate child folders — a deny cascades to children and cannot be reopened below. Backend enforcement was added across folder listings, file listings, search, tag stats, media routes, downloads, and share views. Database support was added through `folder_details` visibility columns and a new `folder_account_access` table.
* **Local Folder Mode:** A browser-side local-folder picker was added using the File System Access API with a file input fallback. Regular users can browse their own local image folder through the Perihelion interface without touching the server archive. Local mode supports browsing, paging, search, folder navigation, lightbox, selection, and staging — with server-only actions hidden.
* **Separate Server-Library Auth Flag:** `PERIHELION_SERVER_LIBRARY_REQUIRE_AUTH` was added so local-folder experiments do not weaken the hosted archive's access requirements. The flag covers all archive-backed API routes and is surfaced through `/api/auth/status`.
* **Popup Auth & Logout Gate:** Central-auth sign-in now opens the popup window, listens for the `auth:success` postMessage, and closes back into the archive. Logout immediately clears entries, folders, selection state, and the current user before the auth status fetch completes. Signed-out visitors stay in a minimal shell with only the top-right auth action visible.
* **Staging Defaults & Summary:** `Resize Dimensions` and `Compress File Size` now open by default on the staging page. A new `Staging Summary` card reports source mode, selected item count, available/missing counts, image/video/other totals, and total file size.

---

## 🐾 Dooky Detective — Dog Gallery

### 5. Dooky Detective (v0.0.6 to v0.0.8)
* **Video Integration:** Video support was added as a first-class tile type in the mosaic layout. The Express backend auto-discovers FFmpeg/FFprobe binaries from WinGet packages, extracts video dimensions and duration via `ffprobe`, and generates JPEG poster stills via `ffmpeg` into a `posters/` cache folder.
* **Unified Media API:** `/api/media` now returns a unified JSON stream of `{ id, type, src, poster, title, width, height, duration }` records for both photos and videos, maintaining backward compatibility with `/api/images`, `/api/photos`, and `/api/videos`.
* **VideoCard Component:** `App.tsx` was rebuilt with a `MediaCard` delegating between `PhotoCard` and `VideoCard`. `VideoCard` renders the cached poster immediately, then transitions into `autoPlay muted loop playsInline` video playback.
* **Storage Consolidation:** Media root consolidated under `E:\images\dookydetective\` with `photos\`, `videos\`, and `posters\` as siblings.
* **Streaming Stall Root Cause:** Camera-recorded MP4s place the `moov` atom at the file end, requiring full download before streaming can begin. A batch FFmpeg re-encode using `-movflags +faststart` was prepared to move the atom to the front for instant streaming.

---

## 💅 Jeffershizzle — Photo Archive Modernization

### 6. Jeffershizzle (current build)
* **Vite Migration:** Converted from legacy static serving to a Vite-based dev server with ES module `js/config.js` and `js/app.js`.
* **API Connection:** Image requests now point directly at `https://api.jeffershizzle.com/images` for both local dev and production.
* **Original Aesthetic Restoration:** Typography restored to Source Serif 4 (500 weight) with tight negative tracking and 20px header/banner styling. Images and landing backgrounds sit flush against the 44px fixed header and footer banners. Two-pixel grid gaps maintained across all layout modes.
* **Browse View:** Font size increased to 25px, an intro line added, category clicks route into a dedicated view with a bottom "back." link. Landing background `#78` was archived; the active manifest covers 91 backgrounds.

---

## 🗂 Copy — Shared Content Repository

### 7. Copy (new)
* **Central Content Store:** A new `Copy` app was created at `E:\copy`, wired with its own Express API and Cloudflare tunnel (`api-copy.jeffersonwm.com`). It holds all site writeups, notes, landings, and abouts in a tree of Markdown files organized by site.
* **Weekly Summary System:** Six weekly-summary styles were established and stored in `copy/text/feed/weekly-summaries/styles.json`. Feed can load them directly, render all six at once in edit mode, and let the user choose the strongest option before publishing.
* **VS Code Task Integration:** Copy server and tunnel were added to VS Code tasks and the shared server launcher.

---

## 📋 Clionidae — Template & Standards Reference

### 8. Clionidae (v0.1.5 to v0.3.0 → archived)
* **Platform Standards Refresh:** All in-app documentation was updated to reflect the current state of central Auth, Feed, build/version/publish scripts, route guards, shared image/data roots, and backend sync patterns.
* **Visual Guidance Loosened:** Clionidae now exports structural patterns — cards, status regions, forms, tables, routes, data states — while each site keeps its own visual personality.
* **Shell Simplification:** Main brand links home, Design header reads `Clionidae Visual + Design Library`, footer names link outward, and the About page/link were removed.
* **Archived:** Clionidae was ultimately decommissioned and renamed `clionidae-legacy` with the archive made private. The app remains live online under the same paths, but the repo is no longer under active development.

---

## 🌐 Platform Homepage & Release Feed

### 9. Feed (v0.2.3 to v0.2.4+)
* **Weekly TL;DR Chooser:** The editor now renders all six weekly-summary styles at once — `Compact: Plain Bullets`, `Compact: Built/Fixed/Decided`, `Compact: Outcome First`, `Expanded: Focus/Work/Result`, `Expanded: Editorial Recap`, and `Expanded: Technical + Why It Matters` — each with its label, purpose, rendered preview, and a one-click `Use This Style` action.
* **Entry Tint — Full Stack:** Tint selection moved from a draft-only browser style into a persisted MySQL `tint_color` column that survives create, edit, and reload. The picker compacted into a small popup beside the date field; 16 color labels available as hover tooltips.
* **Manual Entry Layout Compacted:** Title and Publish Date now share one row, freeing vertical space in the composer.
* **Jeffershizzle Browse Fix:** Clicking an enlarged image from the browse page now returns to `#/browse` instead of following the spiderweb forward-link.
* **Release Seeds Published:** Checkpoint entries published for Aphelion launch, JeffersonWM publishing workflow, widget greeting, Perihelion staging/video, and Dooky Detective video support.

---

## ⚙️ Build System & Platform Infrastructure

### 10. Publishing & Versioning
* **Publish Helpers Expanded:** `scripts/publish-perihelion.mjs` and `scripts/publish-auth.mjs` were added to the JeffersonWM monorepo. Perihelion's helper syncs the ASO frontend and the Python backend. Auth's helper builds the standalone repo and syncs source plus fresh `dist` while preserving `.env`, `data`, and `node_modules`.
* **Millionfold & Vermilion Added:** `scripts/publish-aso.mjs` was extended to support Millionfold and Vermilion directly, with matching root aliases added.
* **Local Publish Shortcuts:** Plain `npm run publish` commands were added inside JeffersonWM app folders, `auth-jeffersonwm`, and `clionidae` so deploys can be triggered from the active workspace.
* **Logged-Build Fix:** `scripts/logged-build.mjs` now correctly reads `.vscode/sftp.json` before uploading `versions.json`, resolving the "no deploy config" warning.
* **Safe All-Repo Save (Aug 30):** Active repos saved repo-by-repo: Auth JeffersonWM (`de0c390`), Dooky Detective (`6dcb083`), Jeffershizzle (`6fd2236`), JeffersonWM (`152e2fd`). Archive repos (`clionidae-legacy`, `jeffersonwm-legacy`) were intentionally excluded. Auth env file edits were held back to keep SMTP/token values out of Git history.

### 11. Tourbillion — Screensaver
* **Fullscreen Button:** A fullscreen toggle was added during an August pass, confirmed working on first try.
* **Mode Cleanup:** Trains, Wings, and Pipes modes were removed from the active interface.

---

## 📈 August Version Registry

| Application | Active August Version | Primary August Changes |
| :--- | :--- | :--- |
| **Aphelion** | `v0.3.0` | Launch, MySQL curation layer, admin catalog/editor, selected-image downloads, Auth notification bridge |
| **Auth** | `v0.1.0` | Popup auth mode, Activity/Notifications overhaul, email notifications, Auth-resolved widget privacy, shell background |
| **JeffersonWM Home** | `v0.2.1` | Popup auth, widget ownership migration, project activity page, account page, word-of-the-day refinements |
| **Perihelion** | `v1.7.0` | Folder access controls, local folder mode, server-library auth flag, popup auth/logout gate, staging defaults |
| **Dooky Detective** | `v0.0.8` | Video tile support, FFmpeg/FFprobe auto-discovery, poster generation, unified `/api/media` |
| **Jeffershizzle** | current build | Vite migration, ES module conversion, aesthetic restoration, browse-view improvements |
| **Copy** | new | Central content store, weekly summary styles, API and tunnel |
| **Clionidae** | `v0.3.0` → archived | Platform standards refresh, then archived as legacy |
| **Feed** | `v0.2.4+` | Weekly TL;DR chooser, full-stack entry tint, compact manual entry layout, release seeds |
| **Tourbillion** | `v0.1.1` | Fullscreen button added, lesser-polished modes removed |
| **Battalion** | `v1.2.35` | Stable — no new changes this month |
| **Stallioneer** | `v0.1.4` | Stable — no new changes this month |
| **Millionfold** | `v0.1.5` | Stable — added to publish tooling |
| **Vermilion** | `v1.3.0` | Stable — added to publish tooling |

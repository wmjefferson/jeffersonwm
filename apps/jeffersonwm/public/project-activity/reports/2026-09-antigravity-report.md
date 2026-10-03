# Platform Development Report — September 2026

This report provides a comprehensive summary of all feature development, system improvements, UI refinements, and operational work completed across the platform during the month of September 2026. School was in session for the full month, making the pace more deliberate — but September still produced two new apps (Billionaire reaching its first major milestone, Lionfish being introduced from the ground up), the first native Android companion app for Battalion, and the beginning of a potential commerce surface inside Aphelion.

---

## ☎️ Billionaire — Vanity Number & Fax Club App

### 1. Billionaire (v0.2.0 to v0.3.0)
* **Dynamic Typography Randomization:** Billionaire now connects to MySQL `widget_fonts` and queries the 41 approved Round 1–2 fonts. All fonts are batch preloaded at app mount to eliminate typing latency and font flicker. The typeface switches randomly on every digit entered, deleted, or cleared.
* **Hybrid Vanity Word Search Engine:** Built a high-performance Trie prefix graph search (`src/lib/vanityMatcher.ts`) bundled with 83,500+ English words. At every digit index, the search simultaneously branches through 1-digit DTMF (`2`=ABC…`9`=WXYZ), 1-digit A1Z26, and 2-digit A1Z26 letter mappings. Verified matches of three or more letters are surfaced — e.g. `3-1-20` → `CAT`, `3569377` → `FLOWERS`.
* **Owner Review UI Integration:** A dedicated **Words** section was added to each submission card in Owner Review (`#admin`). Color-coded `DTMF`, `A1Z26`, and `HYBRID` method badges appear with full-match highlights and hover tooltips detailing the digit range and character breakdown. An expandable `+X more / Less` toggle handles cards with many matches.
* **Windows 11 Fax Architecture Research:** Explored the full roadmap for a Windows 11 desktop fax suite integrating with the HP Color LaserJet Pro MFP M283cdw (33.6 kbps onboard analog modem). Designed a dual-engine pipeline: HP Digital Fax (inbound, Fax-to-Network-Folder → `FileSystemWatcher` + Toast notifications) and HP PC Fax print spooler (outbound). The proposed desktop architecture reuses Billionaire's telephony surface, vanity word analysis, and SQLite local history, built in React + Tauri or Electron.
* **Build & Publish:** Built and published to ASO at v0.3.0. Feed release note and copy files updated. Feed advanced to v0.2.9.

---

## ⚔️ Battalion — RPG Habit & Task Tracker

### 2. Battalion (v1.2.35 to v1.3.0)
* **Native Android Companion App (v1.0.0):** A Kotlin/Jetpack Compose companion app was built and shipped for Android 8.0+. The app connects directly to `api-battalion.jeffersonwm.com` and provides real-time HP/XP/Gold progress bars, a level and title display, and a real-time mood indicator.
* **Emotion Logging:** Emotion selection was refactored into expanding top-level categories with single-tap logging and in-app HUD confirmation banners — replacing system alert dialogs.
* **Masonry Actions & Favorites:** Horizontal category tabs, two-column vertical masonry action cards, long-press favorite toggling (blue/green transitions with immediate "Favorites" tab placement), and HUD banners for action confirmation.
* **Home Screen Widgets:** Two interactive Android home screen widgets were built: a **Status Widget** (3×1, expandable to 5×2) that cycles between HP/XP/Health individually at one row and shows all three simultaneously when expanded; and a **Quick-Action Shortcut Widget** (1×1, resizable) with configurable shortcut assignment, favorites filtering, six customizable button accent colors, and dynamic font/emoji sizing.
* **Visual Branding:** `battvert03.jpg` with dark gradient scrim applied to the companion app and login screens; `batthorz01.jpg` applied to widget backdrops. Launcher icon replaced with the Battalion SVG sword emblem.
* **Session Management:** In-app Account dialog with live username display, one-tap session refresh, backstack-clearing logout with prefilled username retention, and transparent HTTP 401 retry recovery in `ApiClient`.
* **Multi-User Architecture (v1.3.0):** Introduced a strict 4-tier account hierarchy (Owner → Admin → Authenticated Users → Public/Guests). Owner Account ID 1 retains all personal history (Level 9, 444 completed tasks, 36,795 gold) untouched.
* **Master Startup Template:** A dedicated Master Template account (ID 2, slug `template`) holds baseline starter quests (18) and habits (8). A new `accountProvisioner.js` automatically clones the starter kit for new Central Auth users on first Battalion sign-in.
* **Master Template Manager:** An owner-exclusive Settings panel edits starting stats and starter quests/habits, enforces required Change Summaries, and writes structured JSON diffs to a persistent `template_changelog` table with Central Auth audit stream notification.
* **Central Auth SSO Integration:** Battalion now authenticates with `auth.jeffersonwm.com` via shared parent-domain cookies. A 🔑 **Sign In with Central Auth SSO** button was added to the login page. Live top-bar badges show 🟢 Central Auth or 🔐 Local status. Owner ownership and role permissions sync dynamically from Central Auth.
* **Public Share Links:** Settings now includes a Public Share Link card with one-click URL copying (`https://jeffersonwm.com/battalion/?user=slug`) and custom slug editing.
* **Deployment:** Android debug APK built via Gradle and verified live on a Samsung Galaxy device. Web app built/published via `publish-aso.mjs`; backend synced to the server share.

---

## 🦁 Lionfish — USB Keypad Interceptor (NEW)

### 3. Lionfish (new app)
* **Purpose:** A native Windows desktop utility (`apps/lionfish`) built in .NET 10 / WPF with the CommunityToolkit.Mvvm pattern. Lionfish isolates secondary USB keypads (a 34-key mechanical numeric keypad and an 8-button macro pad with rotary knob) from the primary laptop keyboard, capturing their inputs to execute custom keystrokes, text injection, media controls, and macros without leaking raw typing to foreground windows.
* **Hardware Interception:** Integrated with the Interception kernel driver (`InputInterceptorNS` 2.2.1) for true driver-level hardware key blocking. Automated driver state checks on startup, UAC elevation support, and clean uninstallation from Settings.
* **Safety Guard:** `SafetyGuard` with an Emergency Kill Switch (Left Ctrl + Right Ctrl), mandatory Master Keyboard protection for the internal laptop keyboard, and a watchdog heartbeat with 3-second startup delay.
* **Interactive Device Detection:** A Windows Raw Input sink (`WM_INPUT`) powers a **🎯 Identify Device** mode that flashes the correct device card orange and displays the exact key name when any physical key is pressed — allowing precise device identification before assigning roles.
* **Hardware Classification:** Device names aligned to verified physical hardware: `VID_258E&PID_000F` → 34-Key Numeric Keypad; `VID_30FA&PID_1340` → 8-Button Macro Pad (with Rotary Knob); `ACPI\HPQ8001` → Internal Laptop Keyboard (protected); `VID_045E&PID_07B2` → Microsoft Wireless Keyboard. Virtual software devices (UVHID) were filtered out.
* **Composite USB Endpoint Merging:** USB devices with multiple HID endpoints (`MI_00` + `MI_01`) are now merged into a single logical device card, eliminating duplicate ghost cards.
* **Custom Device Title Editing:** Inline ✏️ edit buttons on each device card allow custom friendly names (e.g. "Work Numpad"), persisted to `%APPDATA%\Lionfish\config.json` and reflected across all tabs.
* **Key Map Device Dropdown:** Wired to live device detection events, auto-selects the active macro pad, and generates starter key mappings tailored to the chosen device.
* **Windows 11 Smart App Control Fix:** Solved the `0x800711C7` policy block by consolidating all Core engine types directly into `Lionfish.App` — eliminating secondary DLL file loads and compiling everything into a single `Lionfish.exe`.
* **Perihelion-Style Navigation Tabs:** Restyled tabs as pill buttons (`#FF6B35` Lionfish orange active state) inside a rounded dark container (`#252538`), with distinctive icons for Devices, Key Map, Macros, and Settings.
* **Instance Management:** `run.ps1` launcher script detects active background processes, shows PID, and offers an interactive restart prompt. App minimizes cleanly to the system tray on close.
* **Status:** Compiling with 0 errors and 0 warnings. Device enumeration, live key identification, title renaming, and Key Map synchronization verified. Chrome/Edge browser extension (Phase 4) and macro playback remain as next steps.

---

## 🖼 Aphelion — Gallery, Curation, & Shop Lab

### 4. Aphelion (v0.3.0, ongoing)
* **Admin UX Polish:** Admin now lands on a quiet empty panel by default. Curation was moved to its own top-banner `Curation` link at `#curation`. The Admin `Public` link was changed to red for clearer separation from the admin context.
* **Public Highlight Selection Cap:** Signed-out public highlight selection is now capped to the last 5 clicked blocks, while the broader signed-in behavior remains intact.
* **Selected-Image Border Toggle:** Replaced checkbox overlays on the selected page with click-to-toggle image selection using a 2px blue border — cleaner and more visual.
* **Background & Frame Treatment:** A new Gemini-generated background image was added as a low-opacity root background following the Perihelion-style page pattern. Side gutters and large-image/center-frame borders were restored after the transparent pass made the frame too subtle.
* **Admin Highlights Download Stats:** The Admin Highlights page now reads Aphelion's selected-download JSONL logs and merges download counts into the highlight summary. Three sort modes were added: by Highlights, Downloads, and Recent Activity.
* **Curation Folder Path Fix:** The curation catalog now uses real relative image directory paths for `folderPath` instead of display-style labels with spaced slashes, fixing nested folder browsing for groups like `00 - Aphelion` and `00 - AI`.
* **Keyboard Block Navigation:** Arrow keys now move the active block around the public grid layout; Enter selects or clears through the same handler as a mouse click.
* **Heatmap Deferred:** A lightweight isometric heatmap prototype (x/y = grid position, z = highlight count) was built and then intentionally removed from the live UI. The decision is to wait until more highlight/download data exists before committing to a visualization.
* **Shop Lab Prototype (new):** Added an owner-only `Shop Lab` route in Aphelion for planning potential merchandise. Product candidate groups are loaded from `00 - Aphelion` folders. Each group card shows the first 10 images with title-click panels for full review. Editing includes group title, description, product type, status, fulfillment/category, production notes, pricing notes, and sample notes.
* **Shop Lab Detail:** Added image lightbox viewing with identity details, edit shortcuts that jump directly into Curation, signed serving of folder images not yet in the catalog, JSON and CSV export for planning/production sheets, drag-and-drop image ordering with automatic save, and Options-page management for dropdown values.
* **Aphelion's build warning** was resolved by moving the background image into Vite-managed `src/assets` so it bundles as a hashed asset.

---

## 📚 Stallioneer — Book Inventory & Cataloging

### 5. Stallioneer (v0.1.4, multiple passes)
* **Visual Pass:** Background updated to a new camera-pattern image as transparent black line art at 8% opacity, matching the Perihelion-style page pattern treatment. Inventory filter controls were reorganized into a five-column row (title/sort, tags, collections, spacing, entries per page).
* **Inventory Filter Overhaul:** The old filter presentation was replaced with a compact `Filter` popup grouping Sort, Collections, and Tags. Collection and tag filters are dynamic toggle chips with live counts from the database. The runtime inventory error caused by EF projections was fixed by moving filter-count dictionary lookups into in-memory mapping.
* **Edit Book Consolidation:** Multiple physical copy edit blocks were consolidated into one active copy editor selected by an `Editing copy` dropdown. Save / Clear / Delete actions were moved beside Back in the Edit Book page header.
* **Perihelion-Style Controls:** Edit Book and Add From Code form controls were restyled toward the Perihelion aesthetic: compact square buttons, square inputs/selects/textareas, flatter panels, squared copy controls, repeated cards, lookup candidates, and tag helper controls.
* **Central Auth Integration:** Account-level inventory ownership was introduced. User inventories stay private; Admins have app-level management; Owner/owner retains full visibility. An account-scoped inventory visibility bug caused by the central Auth ID differing from the local `wm` bootstrap owner was fixed by mapping Owner access back to the existing inventory.
* **Auth Notifications:** Stallioneer export activity now flows into Auth as consolidated notification events (one event per export, not one per book).
* **Options Page Consolidation:** Import/export work was moved from Bulk into Options. Tags, Collections, and Locations management was moved into compact dropdown panels in Options. Account-permissions section was removed because account control has shifted to central Auth. PDF field checkboxes were converted into blue active toggle pills. Options export was reshaped into a 50/50 layout (PDF on left, CSV/full on right).
* **Bulk Simplification:** Removed the extra Manage Tags/Collections link. Replaced separate collection/status/location buttons with three stacked dropdowns and one combined `Apply` action. Added immediate tag-badge toggle flow: selected books populate tag badges, and clicking a badge adds/removes the tag without a separate confirmation button.
* **Build & Deploy:** Multiple build/publish/live-copy/hash-check cycles across the month. Runtime, CSS, JS, and publish metadata all verified on the server share each time.

---

## 📸 Perihelion — Archive & Gallery Intelligence

### 6. Perihelion (v1.8.4 to v1.9.1)
* **Video Support & Gallery Previews:** Video formats (`.mp4`, `.webm`, `.mov`, `.m4v`, `.ogv`, `.ogg`) are now auto-detected across the archive. Gallery cards show a distinct yellow `VID` badge alongside the existing `LRG` indicator. Muted hover-to-play video previews play on mouse enter and reset on mouse leave.
* **Lightbox Video Player:** The lightbox now renders an interactive `<video>` player with native playback controls when viewing a video item. The video lightbox backdrop is ~25% darker with smooth 200ms enter/exit transitions.
* **Toolbar Reorganization:** An `INCLUDE VIDEO` filter toggle was added to Line 1 next to `INCLUDE OTHER FILES`. The `Share Code` input was moved to Line 3 beside tags and lists. Blue bold active states now work correctly on `MAX MODE`, `INCLUDE OTHER FILES`, and `INCLUDE VIDEO` in both light and dark mode.
* **Share Page Creation Unblocked:** The `Create` button in staging was no longer disabled — the Note Title field is now optional, with automatic fallback generation from note content or timestamp.
* **Account-Scoped Tags & Lists:** Perihelion tags and saved lists are now strictly partitioned per account for users and admins. Owner retains aggregate visibility across all accounts.
* **Sorting:** Image sorting was added to the gallery (`v1.9.1`).
* **Bundle:** Production bundle building cleanly at ~341 kB minified JS / ~94 kB gzip.

---

## 🦁 Lionship — Link Stream

### 7. Lionship (current build)
* **CORS Auth Fix:** The live site was showing offline mode even though `api-lionship.jeffersonwm.com/api/links` returned data. The root cause was credentialed CORS — the API response lacked `Access-Control-Allow-Credentials: true`. The Express CORS config was updated, and a new `scripts/publish-lionship.mjs` was added to the monorepo so future publishes sync the backend as well as the frontend.
* **Layout Polish:** Footer typography matched to the Billionaire/Auth family, bottom-left status text cleared, list controls aligned left, list rows given a subtle five-row alternating band treatment, and tighter card spacing applied.
* **Multiple Search:** Lionship search was updated to support multiple comma-separated search terms.

---

## 🌐 JeffersonWM Home — Widget & Infrastructure

### 8. JeffersonWM Home (v0.2.2 to v0.3.1)
* **Reports Page:** A new internal reports page was added to JeffersonWM Home (`v0.2.2`).
* **Widget Typography Dashboard:** The `/account/widget` page received a full round-filtering and live-preview stabilization pass. All 213 curated Google Fonts are now categorized across Rounds R1–R8 with interactive filter pills and round badge tags. Font card titles link directly to official Google Fonts specimen pages. Clicking the 1–5 weight scale immediately updates the sample text CSS `font-weight` in-place without card re-rendering. Defaults set at Weight: 3 / Probability: 3, with a `↺ Reset All (3/3)` toolbar action backed by `POST /api/widget/fonts/reset-all` and Auth history logging.
* **4-Second Reload Jump Fixed:** The background session heartbeat was repeatedly calling `checkAuth()` and rebuilding the entire DOM grid. An `isDataLoaded` flag was added so font/event catalogs load once on initial entry and stay stable during background polling.
* **Widget Fonts/Dates Separated:** Font management and special-dates management were moved into their own dedicated `/account/widget` page with Auth activity logging for access.
* **Word-of-the-Day Widget:** Oxford and Dictionary.com were removed as active widget sources; the final active set is Merriam-Webster and Wiktionary. Widget fallback link behavior was corrected so fallback site names link to the dictionary homepage, not a stale term-specific URL.
* **Widget Special Dates Highlight:** Special dates in the widget now highlight in color when today matches the date.

---

## 🔐 Auth — Central Account Service

### 9. Auth (ongoing)
* **Notification Organization:** "Select All" / "Deselect All" filter links were moved directly under column headers. The redundant `ALL` display button was removed. The elements link was repositioned to the third metadata row.
* **Batch Notification Consolidation:** Multi-element batch operations (like Perihelion zip exports) now log as a single consolidated event rather than spamming individual notifications per file. Direct JSON export URLs open as formatted plain text in the browser.
* **Account Options:** Dedicated `Export Activity` and `Export Notifications` buttons were added to the Options page.
* **Cross-Site Notification Wiring:** Spurious/legacy notification events from Tourbillion and Battalion were removed. Lionship link actions and Perihelion operations are now fully wired.
* **Portfolio Headings:** Precise 4-word functional headings were established across all 21 dotcom sites in the ecosystem.
* **User Access Simplification:** User-level access to Auth admin was removed entirely; admin was removed from widget management.

---

## ⚙️ Platform Infrastructure

### 10. Shared Under-Construction & 404 Pages
* **Under-Construction Page:** A single `/underconstruction.html` page now handles all paused or unfinished sites. A `?site=` query parameter lets one page show site-specific labels without separate folders. Currently routing: Bullion, Clionidae, Millionfold, and Vermilion.
* **Shared 404 Page:** A platform-wide `404.html` was added with the same simple banner/copyright shell (`404` top left, `Sign In` top right, copyright bottom right, blank main content over the shared background). Apache `ErrorDocument 404` and `Options -Indexes` were added to the JeffersonWM root `.htaccess`.
* **App-Level Route Guards:** Aphelion, Battalion, Billionaire, Lionship, and Stallioneer all received first-pass unknown-route handling pointing toward the shared 404 baseline.

### 11. DNS Standardization
* DNS records for `jeffersonwm.com`, `wmjefferson.com`, `jeffershizzle.com`, and related hostnames were reviewed and standardized: web routes stay proxied through Cloudflare, mail/control-panel records remain DNS-only. An unused `localhost` DNS record was removed after confirming no active dependency.

### 12. System-Wide Save (Sep 21)
* Active repos saved repo-by-repo: JeffersonWM `58ee1f9`, Battalion `58ee1f9`, Perihelion `58ee1f9`, Feed `58ee1f9`. Archive repos intentionally excluded.

---

## 📈 September Version Registry

| Application | Active September Version | Primary September Changes |
| :--- | :--- | :--- |
| **Billionaire** | `v0.3.0` | Typeface randomization per keystroke, hybrid vanity word search engine, Owner Review badges |
| **Battalion** | `v1.3.0` / Android `v1.0.0` | Native Android companion app, home screen widgets, multi-user architecture, Central Auth SSO |
| **Lionfish** | new | New Windows desktop USB keypad interceptor (.NET 10/WPF), driver-level interception, device detection, macro framework |
| **Aphelion** | `v0.3.0+` | Admin UX polish, keyboard navigation, curation folder fix, Shop Lab prototype with planning/export |
| **Stallioneer** | `v0.1.4+` | Inventory filter overhaul, central Auth integration, edit book consolidation, Bulk simplification, Options consolidation |
| **Perihelion** | `v1.9.1` | Video support (gallery previews + lightbox player), account-scoped tags/lists, gallery sorting |
| **Lionship** | current build | CORS auth fix, backend publish helper, multiple search, layout polish |
| **JeffersonWM Home** | `v0.3.1` | Reports page, widget typography dashboard (R1–R8), special-dates highlight, WOTD widget cleanup |
| **Auth** | ongoing | Notification organization, batch consolidation, export buttons, cross-site wiring, portfolio headings |
| **Feed** | `v0.2.10` | Weekly summaries completed for all weeks back to Week 17, legend commented out |
| **Dooky Detective** | `v0.0.8` | Stable — no new changes this month |
| **Jeffershizzle** | current build | Stable — no new changes this month |
| **Tourbillion** | `v0.1.1` | Stable — no new changes this month |

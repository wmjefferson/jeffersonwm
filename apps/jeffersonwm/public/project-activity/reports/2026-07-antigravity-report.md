# Platform Development Report — July 2026

This report provides a comprehensive summary of all feature development, system improvements, UI refinements, and operational work completed across the platform during the month of July 2026.

---

## 🛠 Perihelion — Archive & Gallery Intelligence

### 1. Perihelion (v1.4.4 to v1.4.5)
* **Global Tag Search:** Added cross-archive tag lookup so a tag can surface images from any folder rather than only the one currently open.
* **Folder Count Display:** Updated folder thumbnail cards to show separate subfolder and file counts, making each card more informative at a glance.
* **Inline Tag Rename:** Replaced prompt-based tag renaming with inline editing behavior for a smoother management experience.
* **Folder Covers Preserved:** Manual folder cover state continued to be treated as a separate concern from folder metadata, making the archive easier to reason about.
* **AI Image Tagging Research:** Investigated using a vision AI pipeline (Gemini Flash) to automatically generate tags for approximately 12,000 line drawings. Reviewed sample images from `E:\images\Keep 06202026 Verm\`, identified consistent art style properties (monochrome/single-color, gestural line drawings, abstract-to-figurative), and proposed a tag taxonomy covering subject matter, color, style, and mood. Recommended Gemini 2.0 Flash as the lowest-cost and most practical API option for bulk tagging.

---

## 🌐 JeffersonWM Home & Platform Coordination

### 2. JeffersonWM Home (v0.0.4)
* **Manifest-Based Version Display:** Version labels shifted toward reading from version files on load rather than being hardcoded in page text, preventing stale version display.
* **Status, Development & About Pages:** These pages became more explicit public surfaces, giving the homepage a clearer structure for communicating what exists and what is actively changing.
* **Map Asset Update:** The map asset was refreshed so the homepage points at a cleaner, more direct visual reference.
* **Widget & Spacing Tuning:** Continued tuning top spacing and widget proportions so the homepage presents as one coherent frame rather than disconnected panels.
* **City Line & Refresh Control:** "San Francisco, California" was added above the time display in the widget, styled consistently with the date line. This label also became a subtle click-to-refresh control for the widget (words, weather, next event, random font) — no full page reload required.

### 3. Widget — Word of the Day Refinement
* **Dictionary.com Selector Update:** Switched to the current `a.wotd-entry-headword` selector for reliable daily word scraping.
* **Fallback Behavior Standardized:** When a source fails, the widget now displays the source website name with a link to its homepage or WOTD page, rather than a stale placeholder word.
* **Oxford & Dictionary.com Removed:** Ultimately simplified the widget to Merriam-Webster and Wiktionary as the two active daily word sources, deferring the others.
* **Fallback Link Logic:** Frontend link logic was corrected so fallback labels route to source pages rather than term-specific URLs.
* **Pacific-Midnight Freeze Confirmed:** The WOTD cache is keyed to `America/Los_Angeles` and refreshes on the first request after Pacific midnight — behavior was documented and verified.

---

## 💼 WM Jefferson Professional Site

### 4. WM Jefferson (current build)
* **Mobile Layout Overhaul:** Redesigned responsive behavior so the outer border frame scales down on smaller screens, and the BACK/logo footer no longer forces logos into a cramped horizontal row on mobile. Logos now drop below BACK on vertical layouts.
* **Footer Positioning:** Raised the BACK/logo banner so it no longer sits flush against the page border on scrolling pages, both on wide and narrow layouts. Mobile bottom spacing was tuned independently to match the feel of the wider layout.
* **Logo Flush Alignment:** Fixed left-edge alignment so the logo row shares the same left margin as the BACK label on vertical layouts.
* **Reach Out Page:** Handshake and LinkedIn logos were moved from the footer to two left-aligned lines directly under the "Feel free" sentence on the Reach Out page. Logo inset padding was removed.
* **Page-Specific Logo Visibility:** Logo links were removed from the footer on the Here, There, and This pages; kept on Home, Index/Learn, and About.
* **Copy Corrections:** Changed "Git." label to "GitHub." Paragraph order on the "Where I Am" page was swapped.
* **Lion Image:** A square lion image was moved from the project root into its proper `public/` folder and wired into the About page.
* **Cross-Link:** Added a clearer cross-link from WM Jefferson back to JeffersonWM for consistent public identity.
* **Build Marker:** Added `dummywmjefferson` to the build output for reliable identification in FTP/WinSCP workflows.
* **GitHub Link Corrected:** Fixed the Reach Out page GitHub link to point at the intended repository.
* **Footer Text Simplified:** Home/footer text was changed from interactive-feeling copy to stable, descriptive text.

---

## 🐾 Dooky Detective

### 5. Dooky Detective
* **Banner Layout:** Moved the large title from a full-page display to a top banner mirroring the existing bottom banner, with matching styles. The title still links home and refreshes the board.
* **Photo Board Sizing:** Changed the photo board to fit approximately 90% of usable page space based on actual available width and height, improving behavior on both horizontal and vertical screen orientations.
* **Responsive Ratio Layouts:** Implemented different layout variants based on screen ratio, improving presentation across device types.

---

## 📡 Vermilion — Server Runtime Migration

### 6. Vermilion (v1.3.0)
* **Server-Runnable Runtime:** Clarified and restructured Vermilion as a server-runnable Python filesystem API, not a laptop-only script. The runtime copy was reduced to essential files.
* **Port Convention Settled:** Live API on port `8100`; no-auth development path on `8105`; `8110` reserved for future use.
* **VS Code Tasks Updated:** Added `verm server` and `verm tunnel` tasks; normalized Millionfold task names to `mill server` and `mill tunnel`.
* **Deployment Notes Relocated:** Notes that belonged with the runtime were moved out of the server folder to keep the runtime directory clean and obvious.
* **Multi-Computer Git Workflow:** Established and documented a single-branch, no-fork sync workflow for working across both computers on the same repo — always push before switching, always pull before starting.

---

## 🔧 Lionship — Tunnel & Widget Restoration

### 7. Lionship
* **Offline Mode Diagnosed:** Identified that Lionship's offline mode was caused by a missing `api-lionship.jeffersonwm.com` public hostname, not a database issue. Local backend at `http://127.0.0.1:8040` was confirmed healthy.
* **Tunnel Restored:** Walked through Cloudflare Zero Trust tunnel configuration to restore the public hostname route pointing at `http://127.0.0.1:8040`. Port was also confirmed as `8040` — a discrepancy with an older Cloudflare config that pointed to the wrong port.

---

## ⚙️ Build System & Operational Infrastructure

### 8. Build Logging & Version Workflow
* **Logged Build System:** Developed a `buildlog:appname` npm script pattern that automatically reads the current `package.json` version, appends a build entry to the shared versioning log, and records date, app, version, note, and git branch/commit. The log is only written on a passing build.
* **Millionfold & Tourbillion Added:** These two apps were added to the root `install:all`, `build`, `verify`, and `deploy:prepare` npm scripts, which had previously omitted them.
* **Consolidated App Inventory:** Documented the full list of apps, their purposes, port assignments, public routes, API tunnel domains, and direct npm dependencies.
* **Version Commands Documented:** Powershell snippets for reading all app versions at once from `package.json` files were recorded.

### 9. Backup & Robocopy
* **Laptop-to-Server Robocopy:** Set up Robocopy with a scheduled task to mirror the laptop's Dotcoms folder to the server. Configured preview (list-only) and live copy modes.
* **Full Dotcoms Mirror:** Expanded the backup from a single-site copy to a full Dotcoms tree mirror strategy.
* **Re-established after Partial Failure:** After an initial setup that only copied the JeffersonWM subfolder, reconfigured to mirror the entire folder tree correctly.

---

## 🌐 Platform Homepage & Release Feed

### 10. Feed (v0.2.3)
* **Release Seeds Published:** Checkpoint entries for July milestones were added for apps that changed materially.
* **Manual Entry & Rich Text Carried Forward:** The rich manual editor and post composition tools established in June continued to be the primary way to record and publish platform notes.

---

## 📈 July Version Registry

| Application | Active July Version | Primary July Changes |
| :--- | :--- | :--- |
| **Perihelion** | `v1.4.5` | Global tag search, folder counts, inline tag rename, folder cover preservation, AI tagging research |
| **JeffersonWM Home** | `v0.0.4` | Manifest-driven versions, widget city line + refresh control, status/about/map pages |
| **WM Jefferson** | current build | Full mobile overhaul, footer repositioning, logo alignment, Reach Out page, dummy marker |
| **Dooky Detective** | current build | Top banner layout, photo board sizing, ratio-responsive layouts |
| **Vermilion** | `v1.3.0` | Server runtime migration, port conventions, VS Code tasks, multi-computer git workflow |
| **Lionship** | — | Tunnel restored, offline mode root cause identified and resolved |
| **Feed** | `v0.2.3` | July release seeds, rich manual entry continued |
| **Millionfold** | `v0.1.5` | Added to root build/install scripts, auth-linked flow maintained |
| **Stallioneer** | `v0.1.4` | Scanner workflow and settings split continued (primarily Codex thread) |
| **Battalion** | `v1.2.35` | Stable — platform-aligned, no new changes this month |

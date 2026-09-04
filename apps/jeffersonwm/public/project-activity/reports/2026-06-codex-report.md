# June 2026 Codex Thread Report

Generated: 2026-06-30, late evening Pacific time

## Scope

This report summarizes June 2026 work visible from the local Codex records on this machine. It draws from:

- Codex thread metadata in `C:\Users\wmjef\.codex\state_5.sqlite`.
- Raw June-active JSONL session transcripts in `C:\Users\wmjef\.codex\sessions` and `C:\Users\wmjef\.codex\archived_sessions`.
- Local memory registry summaries in `C:\Users\wmjef\.codex\memories`.
- Shared JeffersonWM action logs in `\\JEFFERSHIZZLE-D\Dotcoms E\other\actions`.

Important limitation: this report can only include other AI conversations when their contents were pasted into Codex, saved into the actions folder, or otherwise present in local Codex/thread files. It does not directly inspect external chat services or conversations that were never brought onto this machine.

## Executive Summary

June was the month the JeffersonWM ecosystem became a real working network instead of a set of separate app experiments. The center of gravity moved from "make individual sites work" to "coordinate apps, auth, feeds, deployment, status, versioning, reusable templates, and repeatable workflows."

The largest active thread was the long-running JeffersonWM workspace thread, which carried most of the live app work: Feed, JeffersonWM Home, Clionidae, Perihelion, Battalion, Auth, Millionfold, Vermilion, Tourbillion, and cross-site deployment habits. A second major thread formed around the Library Scanner idea, which became Stallioneer. Separate June threads handled Windows 95 hardware/software setup, Win95 native app planning, and Codex startup troubleshooting.

By the end of the month:

- JeffersonWM Home had evolved into a compact public hub with app versions, background treatment, status/about/map pages, and coordinated links.
- Feed became the public development log, release lane, manual editor, weekly archive, pinned-note surface, and version record.
- Clionidae became the reusable design/template reference rather than just another app.
- Stallioneer moved from an idea to a working scanner-first book inventory app with settings, admin concepts, import/export, speed mode, copies, and bulk-action planning.
- Perihelion, Battalion, Millionfold, Vermilion, Auth, and Tourbillion all received meaningful platform integration or deployment work.
- The shared actions folder became the practical cross-thread memory layer.
- Versioning and deployment conventions became much more standardized.

## Thread Inventory

| Thread | Active in June | Status | Approx. role |
| --- | --- | --- | --- |
| Diagnose site issue / JeffersonWM workspace | Apr 4 - Jun 30 | active | Main JeffersonWM ecosystem implementation thread |
| Plan book scanner app | Jun 1 - Jun 11 | archived | Early architecture for ISBN scanning and inventory |
| The Library Scanner | Jun 11 - Jun 19 | active | Stallioneer implementation and release workflow |
| Assess Windows 95 install | May 29 - Jun 11 | active | Real hardware Windows 95 installation troubleshooting |
| Build Windows 95 app | Jun 13 | active | Native Win95 inventory app toolchain planning |
| Disable Codex startup on Windows | Jun 7 | archived | Initial startup-setting answer |
| Disable Codex at startup | Jun 19 - Jun 20 | active | Deeper targeted startup investigation |

## Main JeffersonWM Workspace Thread

The JeffersonWM thread dominated the month. It carried the transition from individual app tinkering into a coordinated platform with common infrastructure, version history, deployment conventions, and live public surfaces.

### JeffersonWM Home

JeffersonWM Home became the public coordination point for the ecosystem. Its role shifted from a simple link list to a living map of visible apps and versions.

Major outcomes:

- App version labels were repeatedly synchronized against Feed releases.
- Bullion and Clionidae were removed from the public home list when they were not ready to remain public.
- Millionfold and Vermilion were added or restored when they had enough public shape.
- A bottom link area was added for `Status`, `About`, and `William Jefferson`.
- The page title was changed to `Jefferson Williams Dotcom`.
- `William Jefferson` was linked to `wmjefferson.com`.
- A new About popup was created with a full app list and a map popup.
- A Status page was added under `/status/`.
- The homepage received the shared lion-pattern background at 5 percent opacity.
- The widget was adjusted repeatedly for top spacing, stacked city/time/weather/special-date lines, word-of-the-day layout, typeface display, and font probability popup behavior.

By month end, JeffersonWM Home was acting as the public index, identity marker, and version board for the network.

### Feed

Feed became the public development record and the most important shared coordination surface. It grew from a basic running log into a usable editorial and release tool.

Major outcomes:

- Feed was grouped by calendar week, with week numbers and previous/next week navigation.
- The style of the week navigator was simplified to feel functional and separate from feed entries.
- Manual editing and deletion were added for changelogs and manual entries.
- A dedicated `Manual` filter was added beside `Full Feed` and `Changelog`.
- Feed timestamps were aligned to US Pacific time.
- The top spacing and horizontal frame were aligned more closely with JeffersonWM Home.
- The Editor Login link was moved near the Sync GitHub button.
- Clicking the word `Feed` at the top now resets the page.
- Pin-to-top was added for feed entries.
- Pinned entries received a visually distinct card treatment.
- A separate computer-pattern overlay was added for pinned posts.
- Markdown-style manual entry preview was added, then later replaced by a richer manual editor.
- Rich manual entries now support inline formatting, headings, lists, blockquotes, links, image uploads, and general attachments.
- The Feed backend gained protected upload support under the feed secret.
- Feed advanced through at least v0.2.1, v0.2.2, and v0.2.3 during the month.

Feed's role expanded from "project log" to "release ledger, public journal, changelog editor, and cross-thread status memory."

### Clionidae

Clionidae became the template and design reference for future sites. The direction changed from one brand/style shared across all sites to a deliberately basic and adaptable skeleton.

Major outcomes:

- Components and sample content were activated so the template could be tested locally.
- Optional auth and data infrastructure were documented as "ready but off" patterns.
- The template was expanded with practical modules: content detail, settings, dashboard, forms, controls, and component samples.
- An `everything` page was added with detailed template instructions for future AI conversations.
- A `step-by-step` page was added to outline the process of building another site.
- Clionidae was split conceptually into a functional infrastructure side and a visual/design library side.
- Visual/template pages were simplified so elements could be copied or studied without too much imposed design.
- Experiments were made with pastel differentiation, debug borders, 1px structure, typography, margins, and banner styles.
- The public homepage link was eventually removed again so Clionidae can remain a local template reference until it is ready.

The key decision was that Clionidae should not be a finished branded app. It should be a reusable site skeleton and standards reference.

### Battalion

Battalion moved into live deployment and public polish. Much of the month involved getting local/server/API/tunnel behavior aligned and then improving public surfaces.

Major outcomes:

- Deployment focused on the API tunnel, Cloudflare routing, production/local behavior, and feed integration.
- The public dashboard was verified across local, private, server, and iPad contexts.
- Feed entries and version updates were added for Battalion milestones.
- Emotion/action UI layout was refined repeatedly, especially accordion headers, counts, search boxes, arrows, and widths.
- Category names for emotions were later added to the emotion list.
- Public visual polish added a subtle illustrated background pattern to dashboard/login/register/landing areas.
- Public dashboard alternating rows were softened into lighter gray treatment.
- Split routing was established so the landing page can live at root and the main app at `/home`.
- The app version reached v1.2.35 in the actions record.

Battalion became one of the first cases where local/server/live behavior, Feed releases, homepage versions, and tunnel routing all had to stay aligned.

### Perihelion

Perihelion work focused on image browsing, routing, auth integration, Trillions exploration, and later folder-cover/gallery improvements.

Major outcomes:

- Discussion clarified remote/local routing, auth redirects, and image-root decisions.
- The shared image library was moved toward `E:\images` as the long-term central image location.
- Trillions, a Google Keep/Firebase experiment, was imported and tested in mock/OAuth form.
- Firebase was configured but later commented/documented after the Keep API route became impractical for a regular Google account.
- The Trillions work was preserved as a future resource rather than continued.
- Perihelion gained first/previous/next/last pagination controls.
- Version/action/feed tracking was updated repeatedly.
- Later Perihelion reached v1.4.4, with manual folder cover selection and widescreen thumbnail aspect-ratio fixes.

The biggest June decision was not to force the Google Keep path after scope/API limits became clear. The useful pieces were kept for later.

### Millionfold

Millionfold entered the public app list and became part of the central auth/deployment pattern.

Major outcomes:

- Millionfold was prepared for publication and added to JeffersonWM Home.
- Auth status was checked through API behavior.
- Auth-required behavior was discussed and deferred/configured through backend flags.
- The logged-in Dashboard link was changed to go directly to Auth `/home`.
- `dummymillionfold` was added as a build marker.
- Millionfold reached v0.1.5 in the shared versioning trail.
- It gained runtime cancellation, server PID display, and configurable live feed history limits based on the actions record.

Millionfold became another proof point for the root landing plus `/home` workspace pattern.

### Auth / Multimillion

The auth system became more central in June, moving from a background service into a visible account/login surface shared by apps.

Major outcomes:

- The account page was simplified visually: top banner, bottom banner, 1px borders, centered login/register box, and left-justified account page once logged in.
- Redirect-back behavior after successful app login was added or clarified.
- The login success countdown was considered but fast redirect was accepted.
- Auth split routing was configured with a landing page at root and SPA at `/home`.
- `dummyauth` was added as a build marker.
- Auth was recorded as v0.1.0.

Auth's role is now central SSO and account/membership infrastructure, not just a login form.

### Vermilion

Vermilion received public presentation and versioning work.

Major outcomes:

- A public explainer page was created with screenshot/description/link context.
- The page notes that it was generated from prompts and will be updated as Vermilion changes.
- It was linked from JeffersonWM Home.
- Version labels were updated, eventually to v1.3.0.
- Later actions record describes pure grouping distribution options for date and name prefix.

Vermilion became visible as a utility/project page even without a direct download.

### Tourbillion

Tourbillion was imported, cleaned, and saved as a standalone browser screensaver app.

Major outcomes:

- It was integrated into the JeffersonWM app family.
- Files were split/refactored to reduce large monolithic app structure.
- Mode rendering was separated for easier performance and visual tuning.
- It was added to JeffersonWM Home with version tracking.
- The actions log kept it at v0.1.1 by month end.

Tourbillion's June work was mostly structural: clean import, modularization, and release tracking.

### VS Code Tasks, Tunnels, and Startup Commands

The workspace got more operationally repeatable.

Major outcomes:

- VS Code tasks were configured for Perihelion, Dooky, Shizzle, Lionship, Auth, Battalion, Feed, and later Millionfold tunnel/server commands.
- Task names were normalized to match the user's preferred list.
- The user wanted command-line windows available for restarting services instead of losing command access.
- Tunnel/server conventions were made more explicit through token-file commands and per-app ports.
- Cloudflare tunnel troubleshooting became a repeated part of deployment workflow.

This shifted operations from "remember commands" to "run named tasks."

### Dummy Files and Build Markers

Dummy marker files became a practical deployment aid.

Major outcomes:

- Dummy files were added to app public folders so they appear in built `dist` output.
- Existing ASO-side dummy files were mirrored locally where needed.
- Auth and Millionfold got specific markers: `dummyauth` and `dummymillionfold`.
- The root dummy files were considered less important where they were not uploaded by the normal workflow.

The purpose is visual confirmation in FTP/WinSCP and safer deployment comparison.

## Library Scanner / Stallioneer Threads

The book scanner idea started as a general architecture discussion and became Stallioneer, a self-hosted book inventory application.

### Early Book Scanner Planning

The first planning thread established the serious direction:

- Android barcode scanning plus Windows/web management was considered.
- The user preferred a future-proof, multi-account, home-server approach.
- Online ISBN lookup from Open Library and Google Books was discussed.
- The system was framed around books, copies, inventory, roles, and longer-term lending/sales workflows.
- A "serious" architecture was preferred over a toy scanner.

This thread set the durable design premise: distinguish titles/books from physical copies, preserve multi-account/admin potential, and build toward real inventory.

### Stallioneer Implementation

The later Library Scanner thread moved the project into the JeffersonWM repo as Stallioneer.

Major outcomes:

- Stallioneer was installed into the Dotcoms/JeffersonWM repo.
- Add-book flow became code-first: enter ISBN/UPC, press Enter, show selectable results, then populate details.
- The app was verified locally on `localhost:5107`.
- SQLite/search behavior and local rebuild issues were debugged.
- The running `LibraryScanner.Web.exe` process was identified as a possible build-lock source.
- Standard add mode was refined into lookup/details/actions/inventory sections.
- Speed Mode was added for rapid scan/select/save/next workflows.
- Manual entry was added for cases where no number is available.
- Camera scanning was explored, then the visible camera button was removed in favor of barcode scanner/keyboarding as the main workflow.
- Barcode gun behavior was clarified: it behaves like fast keyboard input ending in Enter.
- Settings and admin surfaces were split.
- Regular accounts were simplified while admin-only permissions stayed separate.
- Import/export was added, simplified, and planned around common-denominator CSV plus PDF export.
- Export log over a custom time range was added/planned.
- Bulk actions moved toward a separate page.
- Edit-book pages moved toward copy-first inventory, with multiple copies edited individually.
- Extended details and inventory layout were adjusted to avoid unwanted column stretching.
- Duplicate/copy-history/loan/sale/disposal/cover selection/additional-info concepts were planned for later.

By the end of June, Stallioneer had a strong working frame for real shelf work: scanner-first intake, speed mode, admin/settings groundwork, copy-level inventory, and import/export foundations.

## Windows 95 Threads

Two June threads focused on the older physical Windows 95 machine and future native software for it.

### Hardware and Install Troubleshooting

The existing Windows 95 install thread continued into June.

Major outcomes:

- Hard drive recognition improved: HDD was seen as Primary Master.
- CD-ROM detection was worked through with master/slave and primary/secondary channel placement.
- CMOS/default settings and boot order were discussed.
- A Windows 98 SE Startup Disk with CD-ROM support was recommended.
- USB keyboard behavior was diagnosed as BIOS-level support not necessarily carrying into DOS.
- PS/2 keyboard issues were noted.
- `OAKCDROM.SYS` and `MSCDEX.EXE` were identified as important generic CD-ROM driver pieces.

The practical result was a clearer path for booting DOS with CD-ROM support on real hardware, rather than treating it as an emulation or nostalgia exercise.

### Native Windows 95 App Planning

A separate thread asked what it would take to build a real Windows 95 application.

Major outcomes:

- The answer pivoted from broad "retro app" talk to real Win95 target constraints after the user clarified that the app must run on an actual Windows 95 machine.
- Recommended direction: C/C++ targeting Win32 API.
- First app shape: a small inventory utility.
- Minimal stack: Open Watcom C/C++ 1.9, Win32 API, resource compiler/editor included with the toolchain, and flat-file storage.
- Avoided modern runtimes such as .NET, Electron, Chromium, modern Python, and heavy frameworks.
- Suggested simple local storage formats: CSV, tab-delimited, or custom binary.

This established a conservative path for future Win95-native utilities.

## Codex Startup Troubleshooting

Two threads addressed Codex launching on Windows startup.

The first thread gave the normal Windows path: Settings > Apps > Startup or Task Manager startup apps.

The later deeper thread investigated why Codex was not visible there.

Major outcomes:

- Codex was found to be a packaged Windows app.
- The app manifest did not declare a normal Windows startup task.
- No clear Codex entry was found in common Startup folder, Run registry keys, or scheduled tasks.
- The likely explanation became Windows app/session restore behavior rather than a classic startup entry.
- The user specifically wanted a Codex-only solution that would not stop unrelated startup apps like Security Center, Realtek, or Unified Remote.

The durable recommendation is to avoid broad Windows startup disabling and continue using targeted investigation for Codex-specific launch behavior.

## Cross-Cutting Decisions

Several durable decisions emerged across threads:

- Use Feed as the public development ledger, not GitHub alone.
- Use the actions folder as the shared cross-thread handoff and memory surface.
- Keep homepage version labels synchronized with Feed releases.
- Prefer standard semver `X.Y.Z`, even if the user briefly considered wider version formats.
- Use root landing plus `/home` SPA routing for apps that need both public intro and authenticated/functional workspace.
- Use named VS Code tasks for tunnels and servers to reduce startup-command memory load.
- Keep optional features built in but toggled off where useful, especially auth and future data layers.
- Prefer local-first stability before live publishing.
- Do not over-standardize visual branding across apps; each app can have its own visual identity.
- Use Clionidae as the reusable skeleton and standards reference, not as the universal aesthetic.
- Preserve experiments, even cancelled ones, when they might be useful later.

## Open Threads and Deferred Work

Likely next or deferred items from June:

- Continue Feed visual refinements and test the rich manual editor live after the updated server route is deployed.
- Keep refining Clionidae as a reusable template and eventually revisit URL/history standards across all apps.
- Continue Stallioneer with bulk actions, duplicate detection, external lookup provider selection, cover selection, copy history, loan/sale/disposal tracking, and share URLs.
- Revisit Perihelion after ongoing side-chat/server changes settle.
- Decide when to require auth for Millionfold and other private apps.
- Continue status page API checks and possibly improve service health data.
- Return to Windows 95 once the boot/CD/keyboard path is stable enough to install and then build a first native utility.
- Save/commit repo-wide checkpoints after side-chat work is reconciled.

## June Narrative in One Paragraph

June was a consolidation month. The JeffersonWM ecosystem gained a public record, public map, status surface, version discipline, richer deployment habits, and a clearer division between apps, templates, utilities, auth, and infrastructure. Stallioneer emerged from the book-scanner planning thread as a serious scanner-first inventory app. Perihelion, Battalion, Millionfold, Vermilion, Auth, Tourbillion, Clionidae, Feed, and JeffersonWM Home all became more connected. Separate Windows 95 and Codex-startup threads stayed practical and hardware-specific. The month ended with the system feeling less like separate projects and more like a living workspace with memory, routing, versioning, deployment rhythm, and a growing internal standard.

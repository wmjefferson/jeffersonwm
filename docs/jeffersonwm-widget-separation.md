# JeffersonWM Widget Separation

## Decision

JeffersonWM should own the homepage widget, personalization, and account-aware defaults. Lionship should remain a focused linkstream app. This avoids a giant Lionship database becoming the hidden center of unrelated systems.

## Target Ownership

### JeffersonWM

JeffersonWM owns the homepage experience and any data needed to personalize that page.

Suggested widget data:

- `widget_defaults`: public fallback location, display choices, and default behavior.
- `widget_public_special_dates`: shared dates shown before login or to everyone.
- `widget_fonts`: typeface names, weights, probabilities, and display metadata.
- `user_widget_preferences`: per-user location, time display, weather display, and default font behavior.
- `user_widget_special_dates`: private per-user dates tied to central auth accounts.

### Lionship

Lionship owns links and link organization only.

Suggested Lionship data:

- `links`: link title, URL, description, status, and ordering.
- `categories`: link grouping if it remains part of the app.
- `tags`: reusable link labels if they remain part of the app.
- `link_tags`: many-to-many relationship between links and tags if needed.

## Database Direction

Do not consolidate this into one giant Lionship database. Use separate live/dev databases by system:

- Lionship live/dev databases for linkstream data.
- JeffersonWM widget live/dev databases for homepage widget and personalization data.

The original standalone dates and fonts databases were copied into the JeffersonWM widget database, verified, and then retired once the live code paths were removed.

The old `jeffers4_jefferson` database was verified as a legacy links-only database. Current link data lives in the dedicated links database, so `jeffers4_jefferson` can be exported for safety and removed from cPanel when convenient.

## Runtime Direction

The JeffersonWM homepage should eventually read widget data from a JeffersonWM-owned endpoint, such as:

- `/api/widget/state`
- `/api/widget/events`
- `/api/widget/fonts`
- `/api/widget/preferences`

Those routes can be served by a future JeffersonWM API/tunnel or by a fuller JeffersonWM app server. Lionship's former widget routes were only temporary migration scaffolding before JeffersonWM took ownership of the feature.

## Migration Phases

1. Freeze the public widget and remove Lionship from the JeffersonWM homepage while ownership is being moved.
2. Create the JeffersonWM widget database and matching dev database.
3. Copy the legacy special-dates records into JeffersonWM widget special dates.
4. Copy the legacy font records into JeffersonWM widget fonts.
5. Add JeffersonWM widget API routes and point the homepage widget at `/api/widget`.
6. Add central-auth-aware preferences for location, dates, and display options.
7. Remove widget routes from Lionship after JeffersonWM is verified live.
8. Archive or remove legacy databases only after confirming no code, cPanel config, tunnel, or backup process depends on them.

## Temporary State

The JeffersonWM homepage widget now reads from JeffersonWM's own API and database. The widget markup remains in `index.html`, but it should no longer depend on Lionship widget endpoints for normal page loading.

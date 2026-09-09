# UW–Madison Study Spots

An interactive map and directory of 46 hand-picked study spots across the UW–Madison campus and Madison, WI — libraries, coffee shops, student unions, outdoor spots, and hidden gems. Includes crowdsourced real-time busyness reporting, a feedback/corrections system, spot suggestions, and a password-gated admin dashboard.

Live data lives in Cloudflare KV; the site is a static frontend backed by Cloudflare Pages Functions.

## Tech stack

- **Frontend:** vanilla JS (ES modules), Leaflet.js for the map, no framework
- **Build tool:** Vite
- **Backend:** Cloudflare Pages Functions (the `functions/` directory)
- **Data store:** Cloudflare KV (one namespace, key-prefixed by data type)
- **Map tiles:** Esri World Light Gray Base/Reference (free, no API key)
- **Geocoding:** OpenStreetMap Nominatim (used once, offline, to produce the coordinates baked into `data.js`)

## Project structure

```
index.html, app.js, style.css, data.js   — the frontend (built by Vite)
functions/
  api/
    busyness.js       — GET/POST current busyness status per spot
    busyness-all.js   — GET busyness status for every spot at once (the "Least busy" sort)
    feedback.js       — POST a correction/issue report
    suggest-spot.js   — POST a new spot suggestion
    log.js            — GET public "Updates" log (owner responses)
    spots.js           — GET base spot data merged with any live edits
    transit-time.js    — POST an estimated travel time per spot from a given origin (the "Transit time" sort)
  dashboard.js         — GET/POST login + render the reports dashboard
  dashboard-action.js  — POST dismiss/respond actions on feedback/suggestions (admin only)
  dashboard-edit.js    — GET/POST spot editor: index + per-spot edit form (admin only)
  _shared/
    kv-helpers.js        — shared constants, KV read/prune helpers, busyness conflict resolution
    dashboard-auth.js    — password hashing/cookie session helpers, shared login handling
    dashboard-ui.js       — shared HTML shell/CSS/escaping for both dashboard pages
    spot-overrides.js     — KV override read/merge helpers used by spots.js and dashboard-edit.js
```

## Data model (Cloudflare KV)

One KV namespace (bound as `STUDY_SPOTS_KV`), everything else is key-prefix convention:

| Prefix | Shape | Notes |
|---|---|---|
| `busyness:<spotId>` | array of `{deviceId, level, ts}` | pruned to last 2h on every read/write |
| `feedback:<ts>-<rand>` | `{spotId, spotName, issueType, message, ts}` | one key per submission |
| `suggestion:<ts>-<rand>` | `{name, location, category, description, ts}` | one key per submission |
| `log:<ts>-<rand>` | `{type, summary, originalMessage, response, ts}` | created when the owner "Responds" in the dashboard |
| `feedback-throttle:<deviceId>`, `suggest-throttle:<deviceId>` | timestamp string | 30s TTL, guards accidental double-submits |
| `spot-override:<spotId>` | `{name, address, category, affiliation, tags, description}` | full replacement record, written by the `/dashboard-edit` spot editor |
| `transit-cache:<lat>,<lng>` | `{fetchedAt, routes}` | 60s-fresh cache of a Transit API `nearby_routes` lookup, keyed to ~11m precision; expires from KV after 120s |

Study spot data (name, address, coordinates, tags, description) is seeded from the static, hand-authored `STUDY_SPOTS` in `data.js` — but name/address/category/affiliation/tags/description can be overridden live via `/dashboard-edit` without a redeploy (see below). **Coordinates are never editable through the UI** — a spot's lat/lng always comes from `data.js`; if a location genuinely needs to move, that's a `data.js` + redeploy change.

### Busyness conflict resolution

When multiple people report different busyness levels for the same spot, the displayed status is a **recency-weighted average** of the ordinal levels (empty=0 … full=3), not "last write wins" or a simple majority vote — see `computeBusynessStatus()` in `functions/_shared/kv-helpers.js` for the exact algorithm and reasoning. A `mixed: true` flag is set when reports genuinely disagree (2+ levels apart), and the UI surfaces that honestly rather than hiding the disagreement.

## Local development

```bash
npm install
npm run dev        # Vite only — fast iteration on frontend/CSS, but /api/* and /dashboard 404
npm run dev:full    # full stack: builds, then runs Functions + a local simulated KV via wrangler
```

`npm run dev:full` requires **Node ≥22** (a `wrangler` requirement) — this repo's own frontend build only needs Node ≥20.19, so if you're on an older Node just for casual frontend work, `npm run dev` still works fine.

For `/dashboard` to work locally, copy `.dev.vars.example` to `.dev.vars` and set your own `DASHBOARD_PASSWORD` there (gitignored, never committed).

## Deployment (Cloudflare Pages)

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Framework preset:** Vite
- **Environment variable (Production):** `DASHBOARD_PASSWORD` — set as a **Secret**, not plaintext, under Settings → Environment variables. Without it, `/dashboard` shows a clear "not configured" message rather than failing silently.
- **Environment variable (Production, optional):** `TRANSIT_API_KEY` — a `transit_publicapi_*` key from https://transitapp.com/apis, set as a Secret. Powers live bus times for the "Transit time" sort; without it, that sort silently falls back to walking-distance estimates (see "Sorting and directions" below).
- **KV binding:** create a namespace under Workers & Pages → KV, then bind it to the Pages project (Settings → Functions → KV namespace bindings) with variable name `STUDY_SPOTS_KV`. No `wrangler.toml` is used — bindings are dashboard-only.
- Environment variable/secret changes apply to the **next** deployment, not retroactively — if you're adding one to an already-live project, trigger a redeploy (Deployments tab → latest → "Retry deployment").

## Admin dashboard (`/dashboard`)

Password-gated (see above). Server-rendered — unauthenticated visitors never receive report data, since the page checks auth before touching KV at all.

Shows three sections: suggested spots, active busyness reports (read-only), and feedback. Suggestions and feedback each get two actions:
- **Dismiss** — deletes the entry, no public trace.
- **Respond** — deletes the entry and writes a `log:` entry with your response text, which becomes publicly visible via the "Updates" button on the main site (`/api/log`).

## Spot editor (`/dashboard-edit`)

Same auth/session as `/dashboard` (logging into one logs into both — one cookie, and each page's login form redirects back to wherever you were headed rather than always landing on `/dashboard`). A searchable index of all spots links to a per-spot edit form (name, address, category, affiliation, tags, description). Saving writes a `spot-override:<id>` KV record; a **Reset to original** button (shown only when an override exists) deletes it. Edits take effect immediately — the main site fetches `/api/spots` once on load and merges any overrides into the bundled data before rendering, so there's no rebuild/redeploy step, and the site still works fine on the static data if that fetch ever fails.

## Sorting and directions

The sort control next to the results count offers four orders: Alphabetical (default), Distance, Least busy, and Transit time.

- **Distance** and **Transit time** need the visitor's location, requested via the browser's Geolocation API only when one of those is first selected (never on page load). A denial or failure falls back to alphabetical order with an inline note — it's never a dead end.
- **Least busy** fetches every spot's status in one call to `/api/busyness-all` and sorts empty → some seats → busy → full, with spots that have no recent reports sorted last.
- **Transit time** estimates each spot's travel time from the visitor via `/api/transit-time`, taking the faster of a straight-line walk or a live single-bus Transit trip (no transfers). Without a `TRANSIT_API_KEY` configured, every estimate is walking-distance only — the sort still works, just less precisely, and the UI says so.

**Get Directions** opens `transitapp.com`'s web trip planner (`/en/trip`) with the spot as the destination, requesting the visitor's location the same way as above for the origin. If location isn't available, the destination still opens and Transit's own page prompts for a location itself. (The `origin`/`destination`/`_search` query parameters aren't publicly documented by Transit — they were determined by inspecting the trip planner's own client code, so they could change in a future Transit release.)

## Overlay behavior

Only one overlay (the spot detail drawer, any modal, or the "new update" toast) is ever open at a time — every open function calls a shared `closeAllOverlays()` first (see `app.js`), so triggering a new one always cleanly replaces whatever was showing rather than stacking on top of it.

## Known limitations

- Pin coordinates are geocoded but building-level, not room-level.
- KV's read-modify-write isn't atomic — two near-simultaneous busyness votes for the same spot could theoretically race. Not worth a Durable Object at this traffic scale.
- `list()` calls (dashboard, `/api/log`) fetch the first page only (up to 1000 keys) — no pagination. Fine for a single-campus niche site; would need revisiting if this scaled up significantly.
- The device ID used for rate-limiting is a `localStorage` UUID — trivially reset by clearing site data. Acceptable tradeoff for a low-stakes community tool, not a security boundary.

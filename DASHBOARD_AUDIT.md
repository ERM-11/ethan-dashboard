# DASHBOARD_AUDIT.md

Generated 2026-07-11 by a full-codebase audit (post visual redesign `fe4899d`, post fix round `58f14fb` + `9352367`); **updated 2026-07-11 after the visual-overhaul round** (BriefingStrip, WeatherIcon, entrance animation, ambience, per-widget polish — see per-section notes); **updated again 2026-07-11 after the heatmap + backup round** (Study Activity widget, Edit-layout Export/Import — §2, §3, §4, §6 notes); **updated 2026-07-12 after the readiness + hygiene round** (Today's Focus widget + `src/lib/readiness.js`, Vitest/ESLint toolchain, React.lazy code-split of CIMA/German, German toggle hit-area fix, `tint` token — §1, §2, §3, §4, §5, §6, §8 notes). Section numbers are a contract — other prompts reference them by number.

Build verified 2026-07-12: `npm run build` exit code **0** with **no chunk-size warning** (main 291.44 kB / gzip 92.60, lazy `CimaWidget` chunk 154.96 kB, lazy `GermanWidget` chunk 80.90 kB, shared `flame` micro-chunk 0.37 kB; PWA precache 17 entries / 824.83 KiB). `npm run test` **96/96** across 7 files (mutation-checked — see §8); `npm run lint` exit **0** (7 structural react-refresh warnings). `vite preview` responds **200** on `/`.

## 1. Tech Stack

npm-installed (no CDN imports anywhere; fonts are the only external `<link>`):

| Package | Version (package.json) | Role |
|---|---|---|
| react / react-dom | ^18.3.1 | UI |
| lucide-react | ^1.24.0 | icon set |
| vite | ^5.4.11 (5.4.21 installed) | build/dev |
| @vitejs/plugin-react | ^4.3.4 | JSX/HMR |
| vite-plugin-pwa | ^0.21.1 (0.21.2 installed) | service worker + manifest (generateSW, autoUpdate) |
| tailwindcss | ^3.4.17 | styling |
| postcss / autoprefixer | ^8.4.49 / ^10.4.20 | CSS pipeline |
| pngjs | ^7.0.0 | dev-only, icon generation script |
| vitest / jsdom | ^3.2.4 / ^26.1.0 | dev-only — unit + component tests (`vitest.config.js`; node env default, jsdom per-file) |
| @testing-library/react (+ dom, jest-dom, user-event) | ^16.3.0 | dev-only — widget smoke tests |
| eslint (+ @eslint/js, globals, eslint-plugin-react-hooks ^5.2, eslint-plugin-react-refresh) | ^9.29.0 | dev-only — flat config, no style rules |

Fonts: DM Sans + Space Grotesk from Google Fonts (`index.html` `<link>`); **JetBrains Mono self-hosted** (three woff2 in `src/assets/fonts/`, `@font-face` in `src/index.css`) so its slashed-zero OpenType feature survives (Google's build strips GSUB). The woff2 files are in the service-worker precache (`globPatterns` includes `woff2`).

Vitest + Testing Library and ESLint 9 (flat config) since the 2026-07-12 hygiene round; still no TypeScript. Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `icons`.

## 2. File Structure

```
dashboard/                      ← git repo root (remote "github")
├── api/
│   └── proxy.js                Vercel serverless CORS proxy, host-allowlisted
├── public/icons/               icon-192 / icon-512 / icon-maskable-512 (PNG)
├── scripts/make-icons.mjs      generates the PNG icons (pngjs), npm run icons
├── index.html                  meta/PWA tags, Google Fonts link, pre-paint theme script
├── vite.config.js              react + VitePWA (manifest, workbox runtimeCaching rules)
├── vitest.config.js            test config — separate from vite.config.js so tests never boot the PWA plugin; node env default, component tests opt into jsdom per-file; TZ pinned to Pacific/Auckland so UTC calendar bugs fail loudly
├── eslint.config.js            ESLint 9 flat config: @eslint/js + react-hooks + react-refresh recommended, no style rules
├── tailwind.config.js          strict 5-size fontSize scale, CSS-var colour tokens (incl. tint), font stacks
├── postcss.config.js           tailwind + autoprefixer
└── src/
    ├── main.jsx                ReactDOM root, StrictMode
    ├── index.css               @font-face, theme CSS vars, .num/.press/.shimmer/.scroller, reduced-motion kill-switch, safe-area padding
    ├── config.js               LOCATION (Edinburgh), proxy chain + fetchViaProxy, date helpers (todayISO, parseISO, dayOfYear, mondayOf)
    ├── config.test.js          date-helper unit tests (local-vs-UTC, leap years, Mon-first weeks, DST boundaries)
    ├── test/setup.js           jest-dom matchers + jsdom localStorage shim (Node 25 ships a method-less built-in)
    ├── hooks/
    │   ├── useFetchData.js     shared fetch hook (interval refresh, transform, custom fetcher)
    │   └── useLocalStorage.js  JSON get/set with functional updates
    ├── lib/                    pure JSX-free modules (node-tested — *.test.js siblings)
    │   ├── backup.js           export/validate/apply for dashboard_ key backups (all-or-nothing) — backup.test.js + backup.localStorage.test.js
    │   ├── readiness.js        readiness scoring for Today's Focus (formula in its comment block) — readiness.test.js
    │   └── studyActivity.js    heatmap grid + intensity logic for StudyActivityWidget — studyActivity.test.js
    ├── data/
    │   ├── vocabulary.json         279 words
    │   ├── german-exercises.json   140 exercises
    │   ├── cima-questions.json     4×50 questions
    │   └── ey-milestones.json      22 milestones + startDate + weeklyHourTarget
    └── components/
        ├── ui.jsx              shared primitives: Card, Skeleton, ErrorState, Empty, Badge, Chip, Segmented, Accordion, ProgressBar, Primary/Secondary/GhostBtn, inputCls, focusRing, press, buzz, WeatherIcon + weatherLabel (WMO → lucide)
        ├── ErrorBoundary.jsx   per-widget class boundary with "Reload widget" reset
        ├── BriefingStrip.jsx   header chip strip (not a widget): EY countdown, streaks, best sunset, top mover — read-only, scrolls to cards
        ├── WeatherWidget.jsx   7-day forecast + expandable hourly scroller
        ├── PollenWidget.jsx    Overall rollup + 6 pollen types as two-column chips
        ├── SunsetWidget.jsx    sun arc + 5-day sunset-quality ring forecast
        ├── NewsWidget.jsx      BBC Business RSS with keyword filter chips
        ├── StockWidget.jsx     watchlist, sparklines, detail chart, validated add
        ├── WordWidget.jsx      word of the day, learn/quiz modes
        ├── GermanWidget.jsx    fill-the-blank dialogues, streak + week calendar
        ├── CimaWidget.jsx      4-module MCQ bank, spaced repetition, daily challenge
        ├── EyWidget.jsx        countdown, milestone checklist, weekly hours log
        ├── StudyActivityWidget.jsx  12-week contribution heatmap over stored study data
        ├── ReadinessWidget.jsx Today's Focus — top-2 study-readiness rows scored by src/lib/readiness.js
        └── StockWidget.test.jsx, CimaWidget.test.jsx  widget smoke tests (jsdom; proxy-chain fetch mock / spaced-repetition + daily determinism)
```

The prompt library (boot prompt, task prompts) lives one level **above** the repo root in `dashboard artifacts/` and is not committed here.

## 3. Widget Inventory

Order/config lives in `App.jsx` `WIDGETS` map; default order: readiness, weather, pollen, sunset, stocks, news, word, cima, german, ey, study (existing saved orders get `readiness` appended by the healing line — never reset). Only CIMA spans 2 columns (`sm:col-span-2 lg:col-span-2`). All widgets are self-contained (useState/useLocalStorage), wrapped in `ErrorBoundary`. **CIMA and German are `React.lazy`** (2026-07-12): their code + JSON banks load as separate precached chunks on mount, behind content-shaped Card+Skeleton Suspense fallbacks (`CimaFallback`/`GermanFallback` in App.jsx) inside their ErrorBoundaries.

Edit-layout mode (header "Edit layout") additionally shows an **Export data / Import data** bar: export downloads every `dashboard_` key as `dashboard-backup-YYYY-MM-DD.json` (raw string values); import validates the whole file (only `dashboard_` keys, parseable values), shows an inline confirm (key count + export date), applies all-or-nothing via `src/lib/backup.js` (snapshot rollback), then reloads the page. Pending import state clears when leaving edit mode.

App.jsx also renders (top to bottom): the header, a 1px gradient hairline, the **BriefingStrip** (`BriefingStrip.jsx`, own ErrorBoundary, *not* in `dashboard_widgetOrder`) — a `.scroller` row of ≥44px chips (EY days-to-start from `ey-milestones.json`, CIMA + German streaks from their localStorage keys, best sunset day via SunsetWidget's exported `SUNSET_URL`/`calcSunsetScore`/`findHourlyIndex`, top watchlist mover via StockWidget's exported `fetchQuote`/`STOCK_DEFAULTS`; reads only, one fetch per page load, chips skeleton then drop on error, tap scrolls to `widget-<id>` anchors) — then the grid. Grid wrappers carry `id="widget-<id>"`, `scroll-mt-4`, and the `.card-enter` entrance animation staggered by `--enter-i` (see §5).

### WeatherWidget (`src/components/WeatherWidget.jsx`)
- **Displays:** single 7-across horizontally scrollable day strip (`.scroller`, `-mx-4 px-4` bleed; each tile: weekday, shared `WeatherIcon`, high/low °, thin precip-probability bar shown at ≥10%); tap a day → horizontal hourly scroller (every 3rd hour: time, `WeatherIcon`, temp, precip micro-bar + %), "Last updated" line.
- **API:** Open-Meteo forecast, `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&hourly=temperature_2m,precipitation_probability,weather_code` — direct fetch (Open-Meteo has CORS), 15-min refresh.
- **localStorage:** none.
- **Interactions:** day tiles toggle the hourly panel (aria-expanded, full weekday + condition + temps in aria-label); retry button on error.
- **Notes:** no emoji — icons come from the shared `WeatherIcon` (ui.jsx, exact WMO code-range matching). Skeleton is a 7-tile scroller row.

### PollenWidget (`src/components/PollenWidget.jsx`)
- **Displays:** prominent full-width "Overall" panel (max level across types) leading, then a two-column chip grid of the 6 types (Grass, Birch, Alder, Olive, Ragweed, Mugwort — raw value + Low/Medium/High badge). Rows rounding to 0 collapse behind a "Show all (+N)" ghost toggle (session state; if *everything* is 0, all show and the toggle hides). Last-updated + "zero values out of season are normal" note.
- **API:** `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=…&longitude=…&current=grass_pollen,birch_pollen,alder_pollen,olive_pollen,ragweed_pollen,mugwort_pollen` — direct fetch, 15-min refresh.
- **localStorage:** none. **Interactions:** show-all toggle, retry.
- **Notes:** per-type thresholds `[low, high)` hard-coded in `TYPES`; levels always paired with the word (never colour-only). The former separate "Tree pollen" aggregate row was deliberately dropped in the 2026-07-11 overhaul (Birch/Alder/Olive chips + Overall cover it).

### SunsetWidget (`src/components/SunsetWidget.jsx`)
- **Displays:** (1) semicircle sun arc with live sun position (minute tick), sunrise/sunset times, daylight duration, ▲/▼ delta vs yesterday, golden-hour time, tomorrow's times; (2) 5-day sunset-quality forecast — SVG ring gauges scored 0–100 by `calcSunsetScore` (documented in the file: mid-cloud Gaussian peaked at 40% σ=20 (+35), high cloud linear (+20); low cloud (−20), humidity>70% (−10), precip>30% (−10 hard), visibility<10 km (−5); +45 shift, clamped), label bands Poor<25 / Fair / Decent / Good / Great / Spectacular≥85, sunset time per day, **gold `#f0b429` ring + "best" badge on the highest-scoring day (reserved, this widget only)**.
- **API:** one Open-Meteo forecast call: `daily=sunrise,sunset,daylight_duration&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,precipitation_probability,visibility&past_days=1&forecast_days=5` — 60-min refresh. Hourly sample matched to each day's sunset hour (`findHourlyIndex`), with neutral fallbacks when missing.
- **localStorage:** none. **Interactions:** none (rings display-only); retry on error.
- **Notes:** daily index 0 = yesterday (delta only); quality loop runs indices 1..end. Skeleton mirrors arc + stats + 5-ring row. **Exports `SUNSET_URL`, `calcSunsetScore`, `findHourlyIndex` for BriefingStrip — load-bearing, keep intact.**

### NewsWidget (`src/components/NewsWidget.jsx`)
- **Displays:** 5 headlines from BBC Business RSS filtered by chip (All, EY/Big Four, UK Banking, Fintech, Consulting — keyword lists in `FILTERS`), each expandable to description + "Read more" link; source + date line per item.
- **API:** `https://feeds.bbci.co.uk/news/business/rss.xml` via `fetchViaProxy` (proxy chain, §4), 30-min refresh, DOMParser transform (first 30 items).
- **localStorage:** none. **Interactions:** filter chips, expand/collapse per headline, external links, retry.
- **Notes:** per-item dates are relative — "today"/"yesterday" (plain text, compared via local `todayISO`) or a short date with digits in `.num`.

### StockWidget (`src/components/StockWidget.jsx`)
- **Displays:** fixed index header panel (`bg-card2`) with LSE/NYSE market-status dot + open/closed word and two display-only index rows — FTSE 100 (`^FTSE`) and S&P 500 (`^GSPC`), name + last + day % only; then watchlist rows — ticker, 5-day sparkline (gradient fill, dashed prev-close line), price, ▲/▼ day % in emerald/rose; expandable per-ticker detail chart with range tabs (1D/5D/1M/3M/6M/1Y, per-range in-memory cache); add-ticker form with validation states.
- **API:** `https://query1.finance.yahoo.com/v8/finance/chart/{T}?range={r}&interval={i}` via `fetchViaProxy`; quotes at range 5d/1d, 15-min refresh via `Promise.allSettled` (indices fetched alongside in the same load, separate state).
- **localStorage:** `dashboard_stockTickers` (defaults NVDA, GOOGL, AMZN, AVGO, AMD, SOFI, PLTR, NVO). Indices are **never** stored or counted in it.
- **Interactions:** sort toggle (% ▼ / A–Z), expand row → detail chart, remove (X), add with pre-commit validation (`validateTicker` distinguishes "invalid symbol" from "network error"; spinner in the Add button — the app's only spinner). Index rows and status dots are display-only.
- **Notes:** failed state only when *zero* watchlist quotes load; per-ticker and per-index "no data"/"—" otherwise. Market status = weekday + exchange-local hours via `Intl.DateTimeFormat` (LSE 08:00–16:30 Europe/London, NYSE 09:30–16:00 America/New_York), 60s tick, no holiday calendar (accepted simplification). **Exports `fetchQuote`, `STOCK_DEFAULTS` for BriefingStrip — load-bearing, keep intact.**

### WordWidget (`src/components/WordWidget.jsx`)
- **Displays:** deterministic word of the day (`dayOfYear() % vocab.length`) with pronunciation/part-of-speech, definition, example; quiz mode blanks the word (regex `______`), guess input, correct/incorrect verdict, quiz accuracy line; known/new vote buttons with lifetime tally, once per day.
- **API:** none (local `vocabulary.json`).
- **localStorage:** `dashboard_wordMode`, `dashboard_wordStats`, `dashboard_wordVoteDate`, `dashboard_quizStats`.
- **Interactions:** learn/quiz segmented control, guess+Reveal form, vote buttons (aria-disabled after voting, "Done for today ✓"), haptic on vote/reveal.
- **Notes:** quiz mode shows a header accuracy chip (`.num` %, "—" with zero attempts) plus the inline accuracy line ("No quiz attempts yet" at zero).

### GermanWidget (`src/components/GermanWidget.jsx`)
- **Displays:** one dialogue exercise (id/theme/level header, lines with blanks), per-line single-line answer inputs (`inputCls`), per-line ✓/✗ verdicts + expected answer, per-line "Show translation" toggle; pool progress bar (completed/pool), then a labelled stat row (streak + accuracy as distinct `.num` stat blocks, lucide `Flame` at ≥7) above the Mon-first week calendar.
- **API:** none (local `german-exercises.json`).
- **localStorage:** `dashboard_germanLevel`, `dashboard_germanCompleted`, `dashboard_germanMistakes`, `dashboard_germanDates`, `dashboard_germanStats`, `dashboard_germanStreak`.
- **Interactions:** level segmented (All/A2/B1/B2), Check (haptic), Next, Skip, Review Mistakes (aria-disabled when none, helper text — no tooltip-only state).
- **Notes:** streak increments once per local day; dates array capped at 60.

### CimaWidget (`src/components/CimaWidget.jsx`) — 2-col span
- **Displays:** BA1–BA4 module tabs (identity colours), 2×2 stat-cell grid (Attempted, Accuracy, Streak with best sub-line + lucide `Flame` at ≥7, Overall — `bg-card2` cells, values `.num` bold, holds at 412px), module progress bar + 4 mini per-module bars each labelled with its `.num` module code in the module's text colour, question card (module pill, topic, difficulty dot+word, A–D options with ✓/✗ reveal + explanation), mode buttons (Daily Challenge marked with lucide `Star`), study-history accordion (last 50 stored / 10 shown, tap to revisit), two-step reset with 5-s auto-cancel.
- **API:** none (local `cima-questions.json`).
- **localStorage:** `dashboard_cima_activeModule`, `dashboard_cima_attempts`, `dashboard_cima_reviewQueue`, `dashboard_cima_streak`, `dashboard_cima_history`, `dashboard_cima_dailyCompleted`.
- **Interactions:** module tabs, answer buttons (haptic, disabled after pick), Practice / Review Mistakes / Weak Topics / Daily Challenge modes, Skip, history rows, reset.
- **Notes:** spaced repetition — wrong answers enter the queue at interval 1 day, correct answers double it (cap 30); review picks entries past their interval. Daily Challenge is deterministic (unattempted sorted by id, `dayOfYear % length`) and renders a completed state once done per module per day. Module colours `bg-blue-500/emerald-500/violet-500/amber-500` are the reserved identity hexes from the boot prompt.

### EyWidget (`src/components/EyWidget.jsx`)
- **Displays:** hero countdown (days until `startDate` 2026-09-01) + Week n of 22 + window progress bar (from 2026-04-01); category filter chips; an "Overdue" accordion (only when overdue items exist) with an amber `(n)` count badge holding all overdue-incomplete milestones — never duplicated in the main list; main list default = next **3** actionable (incomplete, not overdue, soonest first), "Show all n" toggle reveals the full non-overdue list; rows share one renderer (category dot, checkbox, title, `.num` deadline, amber overdue/due-soon badges); weekly hours form ("Log" **replaces** the current week's value, capped 26 weeks), 8-week bar history with target line + ✓ over target weeks; monthly check-in reminder from the 26th.
- **API:** none (local `ey-milestones.json`).
- **localStorage:** `dashboard_ey_milestoneStatus`, `dashboard_ey_hoursLog`, `dashboard_ey_categoryFilter`.
- **Interactions:** filter chips, milestone toggle (haptic), show-all toggle, hours form.
- **Notes:** EY category colours (cyan/pink/indigo + slate for cima) are the non-overlapping reserved set. `showAll` and `hoursInput` are session-only (not persisted) by design.

### StudyActivityWidget (`src/components/StudyActivityWidget.jsx`)
- **Displays:** GitHub-style contribution grid of the last 12 weeks (Mon-first columns, one 10-unit cell per day, M/W/F row labels) as a single responsive SVG; inline summary line below (default: active-day count; selected: date + activity breakdown); Less→More legend row.
- **Data:** reads `dashboard_cima_dailyCompleted` (modules completed per day), `dashboard_germanDates`, `dashboard_wordVoteDate` — read-only, parsed defensively (corrupt values ignored). Grid/intensity logic in `src/lib/studyActivity.js`. Intensity = cima modules + german + word (capped at 4): four opacity steps of the neutral `ink` token (0.22/0.45/0.7/1); empty days `card2`; future days of the current week not rendered. Deliberately **not** emerald (colour policy — no new accents).
- **localStorage:** none written.
- **Interactions:** day cells are far below the 44px minimum, so the grid is **one** interactive surface — taps delegate from the `<svg>` (data-iso on rects), arrow keys move the selection when focused (`focusRing` on the svg), selected cell gets a `--focus` stroke; summary is inline (`aria-live="polite"`), never a tooltip.
- **Notes:** no fetch, no skeleton (synchronous localStorage read); renders sanely on a fresh install (all-`card2` grid, "0 active days" line).

### ReadinessWidget (`src/components/ReadinessWidget.jsx`) — "Today's Focus"
- **Displays:** the top 2 most-urgent study tracks by deterministic readiness score (0–100, higher = more urgent): rank digit, track name ("CIMA BA3" / "German" / "EY milestones"), one-line plain-English reason ("Accuracy 61%, last studied 4 days ago" / "3 communication milestones overdue"), score. Helper line "Higher score = more urgent · tap to jump".
- **Data:** reads `dashboard_cima_attempts`, `dashboard_cima_reviewQueue`, `dashboard_germanStats`, `dashboard_germanDates`, `dashboard_germanStreak`, `dashboard_germanMistakes`, `dashboard_ey_milestoneStatus` + `ey-milestones.json` — read-only, parsed defensively; static per-load snapshot (useState initialiser), no fetch, no skeleton. Scoring is pure in `src/lib/readiness.js` (formula documented in its comment block: CIMA/German = accuracy pressure +45 below the 80% goal, recency decay +35 via 1−e^(−days/4), backlog +20 at 2/item cap 10; EY = overdue pressure +60 at 12/milestone cap 5, deadline proximity +40 inside 14 days; fixed tiebreak ey < BA1–BA4 < german).
- **localStorage:** none written.
- **Interactions:** each row is a full-width ≥44px button scrolling to its card via the `widget-<id>` anchors (smooth; `auto` under reduced motion — same pattern as BriefingStrip).
- **Notes:** untouched tracks emit no row (no nagging about un-adopted tracks); fresh install → one-line empty state; all scores 0 → distinct "All caught up" state. Every digit in `.num` (reason strings pass through a `numify` splitter); amber appears only on the EY score when milestones are overdue, and the reason then always contains the word "overdue" (never colour-only). Deliberately **not** a replacement for BriefingStrip — glance strip vs recommendation are different jobs.

## 4. Shared Utilities

- **`src/config.js`** — `LOCATION` (Edinburgh 55.9533, −3.1883, Europe/London); `PROXIES` chain and `fetchViaProxy(url, {timeout=8000})`: tries `/api/proxy?url=` (same-origin Vercel function) → `api.allorigins.win` → `corsproxy.io`, each attempt with its own AbortController timeout, first OK response wins; `PROXY` (legacy export = first proxy); date helpers `todayISO` (local, never `toISOString`), `parseISO` (local midnight), `dayOfYear`, `mondayOf` (Mon-first).
- **`api/proxy.js`** — Vercel serverless function; host-allowlist (`feeds.bbci.co.uk`, `www.theguardian.com`, `query1/query2.finance.yahoo.com`), 9-s upstream timeout, browser-like UA, passes upstream status/content-type, `s-maxage=120, stale-while-revalidate=600` edge caching.
- **`src/hooks/useFetchData.js`** — `{data, loading, error, lastUpdated, refresh}`; optional `transform` (e.g. RSS→JSON), `fetcher` (proxy chain), `refreshInterval`, `enabled`; alive-ref guard against post-unmount setState.
- **`src/hooks/useLocalStorage.js`** — JSON parse/stringify with try/catch, functional updates supported.
- **`src/lib/backup.js`** — pure backup logic for App.jsx's Edit-layout Export/Import: `collectBackup` (every `dashboard_` key, values as raw JSON strings for byte-for-byte round-trips), `validateBackup` (whole-file validation before any write), `applyBackup` (all-or-nothing with snapshot rollback, removes keys it added on failure), `backupFilename`. Never reads or writes non-`dashboard_` keys.
- **`src/lib/studyActivity.js`** — pure heatmap logic: `readActivity` (defensive multi-key read), `activityTotal`/`intensityLevel` (4 steps, capped), `LEVEL_OPACITY`, `buildGrid` (12 Mon-first week columns, local-time maths, future flags).
- **`src/lib/readiness.js`** — pure readiness scoring for ReadinessWidget: `readTrackInputs(storage)` (defensive multi-key read, entries dropped rather than trusted), `recency(days)` (saturating exponential), `scoreTracks(inputs, {milestones, today})` (per-track scores + reason strings, deterministic tiebreak; milestones injectable for tests). All three lib modules are JSX-free and exercised in node by their `*.test.js` siblings.
- **`src/components/ui.jsx`** — all shared primitives (list in §2) plus `focusRing`, `press`, `buzz()` haptic.
- **CORS:** Open-Meteo called directly (has CORS); BBC RSS and Yahoo Finance always via the proxy chain. Service worker: `/api/` is **NetworkOnly** (never cached — a cached proxy response once shadowed fresh ticker fetches); Open-Meteo and public proxies NetworkFirst (15 min), Google Fonts CacheFirst (30 days).
- **Error handling:** per-widget `ErrorBoundary` (crash → message + "Reload widget"); fetch errors → shared `ErrorState` with Retry; StockWidget degrades per-ticker ("no data") and only shows the error state when nothing loads; ticker add distinguishes invalid symbol vs network failure.

## 5. Styling System

Canonical token table, card pattern, colour policy, type scale, and motion rules live in **`../dashboard-boot-prompt.md`** ("Design tokens" section) — that file is the source of truth; this section records how they are implemented.

- **Themes:** two dark themes as CSS variables in `index.css` — `:root`/`html[data-theme='slate']` (bg `#0f172a`, card `#1e293b`, card2 `#283548`, ink `#e2e8f0`, mut `#94a3b8`, line/line2/veil slate-alpha, focus `#cbd5e1`) and `html[data-theme='amoled']` (bg `#000000`, card `#0b0d13`, card2 `#161923`, ink `#e5e8ee`, mut `#8d97a9`); plus `tint` rgba(148,163,184,.15) — muted badge/status fill, identical in both themes (2026-07-12, replaces Badge's raw `bg-slate-400/15`). Mapped to Tailwind colour names (`bg-card`, `text-mut`, …) in `tailwind.config.js`. Pre-paint script in `index.html` applies the saved theme and syncs `theme-color` meta; `App.jsx` keeps both in sync on toggle.
- **Accents (semantic only):** emerald-400/rose-400 for stock moves + quiz right/wrong + completion ✓; amber-400 warnings; gold `#f0b429` reserved to SunsetWidget's best day; CIMA module identity colours (blue/emerald/violet/amber 500); EY categories cyan/pink/indigo/slate 500. No blue UI accent.
- **Type:** DM Sans body, Space Grotesk `font-display` (titles/h1 only), JetBrains Mono for every digit via `.num` (`slashed-zero tabular-nums` — works because self-hosted). Strict five-size scale enforced by the Tailwind `fontSize` override (12/14/16/20/28).
- **Layout:** `max-w-grid` (1600px); grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`; only CIMA spans 2. Card = `bg-card rounded-2xl border border-line p-4`, no shadows anywhere. `#root` pads all four safe-area insets.
- **Reusable classes (index.css):** `.num`, `.press` (scale 0.97 on :active), `.shimmer` (skeleton highlight), `.scroller` (hidden-scrollbar horizontal scroll with edge fade masks), `.card-enter` (entrance animation, below). Global `prefers-reduced-motion` kill-switch. Shared Tailwind strings from ui.jsx: `focusRing`, button/input/badge/chip/segmented/accordion treatments.
- **Entrance animation:** `.card-enter` (keyframe `card-in`: fade + 8px rise, 300ms ease-out, `both` fill) on the BriefingStrip and each grid wrapper, staggered 40ms by grid position via inline `--enter-i`. Runs once per page load (mount-only; reorder/theme toggles don't remount). Explicit `animation: none !important` under reduced motion — required because the global kill-switch zeroes duration but not delay.
- **Ambience:** per-theme `--glow` radial gradient (slate: faint navy from top; amoled: near-invisible) painted by `body::before` (fixed, z-index −1, static). 1px gradient hairline under the header (`via-line2`).
- **Icons:** no emoji anywhere. Weather conditions via the shared `WeatherIcon`/`weatherLabel` in ui.jsx (exact WMO code-range → lucide); streak flame = lucide `Flame`; daily challenge = lucide `Star`.

## 6. State Management

useState + two custom hooks only — no Context/Redux/reducers. Nothing is shared between widgets except the theme (via CSS variables) and layout order (via App). Widget-to-widget data sharing: none.

**localStorage keys (all `dashboard_` prefix, ISO dates, JSON-encoded):**

| Key | Owner | Shape |
|---|---|---|
| `dashboard_theme` | App | `"slate"` \| `"amoled"` |
| `dashboard_widgetOrder` | App | `string[]` of widget ids; healed on load (unknown ids dropped, new ids appended) |
| `dashboard_stockTickers` | Stocks | `string[]` ticker symbols |
| `dashboard_wordMode` | Word | `"learn"` \| `"quiz"` |
| `dashboard_wordStats` | Word | `{known: number, new: number}` |
| `dashboard_wordVoteDate` | Word | `"YYYY-MM-DD"` |
| `dashboard_quizStats` | Word | `{quizAttempts: number, quizCorrect: number}` |
| `dashboard_germanLevel` | German | `"All"` \| `"A2"` \| `"B1"` \| `"B2"` |
| `dashboard_germanCompleted` | German | `number[]` exercise ids |
| `dashboard_germanMistakes` | German | `number[]` exercise ids |
| `dashboard_germanDates` | German | `string[]` ISO dates, last 60 |
| `dashboard_germanStats` | German | `{done: number, correct: number}` |
| `dashboard_germanStreak` | German | `{current, best, lastDate}` |
| `dashboard_cima_activeModule` | CIMA | `"BA1"`…`"BA4"` |
| `dashboard_cima_attempts` | CIMA | `{[qid]: {attempts, correct, lastAttempted}}` |
| `dashboard_cima_reviewQueue` | CIMA | `[{questionId, lastAttempted, interval, timesWrong}]` |
| `dashboard_cima_streak` | CIMA | `{current, best, lastStudyDate}` |
| `dashboard_cima_history` | CIMA | `[{questionId, module, topic, correct, date}]`, max 50, newest first |
| `dashboard_cima_dailyCompleted` | CIMA | `{[isoDate]: {[module]: true}}` |
| `dashboard_ey_milestoneStatus` | EY | `{[id]: {completed: bool, completedDate: string\|null}}` |
| `dashboard_ey_hoursLog` | EY | `[{weekStart: isoMonday, hours: number}]`, max 26 |
| `dashboard_ey_categoryFilter` | EY | `"All"` \| category |

**Retired:** `dashboard_darkMode` — no longer read; never delete or repurpose.

**Heatmap + backup round (2026-07-11): no new keys.** Study Activity reads `dashboard_cima_dailyCompleted` / `dashboard_germanDates` / `dashboard_wordVoteDate` and writes nothing (`dashboard_widgetOrder` gains the `study` id via the existing healing append). Export/Import covers every `dashboard_`-prefixed key by prefix scan — raw string values, whole-file validation, all-or-nothing apply — so new keys are automatically included in backups.

**Readiness + hygiene round (2026-07-12): no new keys.** Today's Focus reads `dashboard_cima_attempts`, `dashboard_cima_reviewQueue`, `dashboard_germanStats`, `dashboard_germanDates`, `dashboard_germanStreak`, `dashboard_germanMistakes`, `dashboard_ey_milestoneStatus` and writes nothing (`dashboard_widgetOrder` gains the `readiness` id via the existing healing append). The Vitest suite touches localStorage only inside jsdom test environments.

## 7. Data Files

All parsed and counted directly from the JSON on 2026-07-11:

- **`vocabulary.json` — 279 entries.** Array of `{word, pronunciation, partOfSpeech, definition, example}`. Selection: `dayOfYear() % 279`.
- **`german-exercises.json` — 140 entries** (A2 = 50, B1 = 64, B2 = 26). Array of `{id, level, theme, dialogue: [{speaker, german, blank, answer, english}]}`.
- **`cima-questions.json` — 200 questions: BA1 = 50, BA2 = 50, BA3 = 50, BA4 = 50.** Object keyed by module → array of `{id (module-prefixed, e.g. "BA1-…"), topic, difficulty (easy|medium|hard), question, options {A,B,C,D}, correct, explanation}`. CIMA logic depends on ids being module-prefixed (`id.startsWith(module)`).
- **`ey-milestones.json` — 22 milestones** + `startDate: "2026-09-01"` + `weeklyHourTarget: 7`. Milestones `{id, title, description, category, deadline}`; categories: communication = 15 (5 monthly client memos + 10 mock client scenarios), cima = 4, modelling = 2, tools = 1.

## 8. Current Issues or Gaps

- **Build/dev:** clean — build exit 0, no warnings beyond none; dev 200. No console errors observable without a browser (see USER VERIFY).
- **Public proxy fallbacks are best-effort:** `api.allorigins.win` and `corsproxy.io` are third-party and historically flaky; the same-origin `/api/proxy` is primary. `www.theguardian.com` is allowlisted in `api/proxy.js` but nothing calls it (leftover — harmless).
- ~~Weather emoji icons~~ / ~~weather 7-day 4+3 wrap~~ — **resolved in the 2026-07-11 overhaul** (shared `WeatherIcon` with exact WMO matching; single 7-across `.scroller` strip).
- ~~Main JS chunk 518 kB~~ — **resolved 2026-07-12**: CIMA + German are `React.lazy` chunks (main 291.44 kB, no Vite warning). Known limitation: React 18's `lazy` caches a failed chunk load until page reload, so "Reload widget" won't refetch it — practically unreachable installed, since all chunks are precached by the service worker.
- ~~German "Show translation" toggle `min-h-[24px]`~~ — **resolved 2026-07-12** via an `after:` overlay (24px visual box + 4px up + 16px down = 44px hit area, `-inset-x-2` widening; zero layout shift, dialogue rhythm unchanged).
- **BriefingStrip duplicates two fetches once per page load** (sunset forecast, watchlist quotes) rather than sharing widget state — deliberate: widgets stay self-contained; the strip has no refresh interval.
- **Raw palette classes outside tokens (deliberate, reserved):** CIMA module colours, EY category colours, and emerald/rose/amber semantic accents. `Badge`'s muted tint moved to the `tint` token on 2026-07-12 — no raw `slate-*` remains in components.
- **`useFetchData` interval doesn't restart on manual `refresh()`** and its `load` deliberately omits `transform`/`fetcher` from deps (eslint-disabled) — fine in practice since both are static per widget.
- **Accordion `maxHeight` measured once per toggle** (`ref.current?.scrollHeight`): content that grows while open (CIMA history gaining entries) can clip until re-toggled. Minor.
- **StockWidget effect keys off `tickers.join(',')`** (eslint-disabled) — correct behaviour, just a lint suppression to note.
- **Hardcoded values that could be config:** pollen thresholds (`TYPES` in PollenWidget), news keyword lists (`FILTERS` in NewsWidget), stock defaults (`DEFAULTS`), EY check-in day (26), window start `2026-04-01`. All deliberate so far.
- ~~No tests, no linting~~ — **resolved 2026-07-12**: Vitest suite (96 tests / 7 files — config date helpers, backup, studyActivity, readiness, StockWidget ticker validation, CIMA spaced repetition + daily determinism, backup round-trip; mutation-checked: 8 deliberate logic breaks each failed their covering test) + ESLint 9 flat config (`npm run lint` exit 0; expected residue is 7 `react-refresh/only-export-components` **warnings** on the load-bearing mixed-export files — ui.jsx, SunsetWidget, StockWidget). Design conventions beyond that are still enforced by prompts/audits.
- **Case-sensitivity:** deploy target is case-sensitive; component filenames are canonical as listed (notably `CimaWidget.jsx`, not `CIMAWidget.jsx`).

**USER VERIFY** (no browser tooling available in this session — checked build + tests + HTTP only):
- Open the dev/prod app with DevTools console: confirm zero errors/warnings on load in both themes.
- Confirm PWA install + offline render still works after the code-split (SW now precaches 17 entries incl. the two lazy widget chunks + 3 woff2) — in particular that CIMA and German render offline.
- On the phone: tap a Today's Focus row and confirm it scrolls to the right card; confirm the CIMA/German skeletons are only briefly visible on first load.
- Spot-check slashed zeros on a real device at 12px (Stocks prices, CIMA dates, Today's Focus scores).

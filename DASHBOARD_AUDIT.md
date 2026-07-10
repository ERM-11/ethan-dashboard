# DASHBOARD_AUDIT.md

Generated 2026-07-11 by a full-codebase audit (post visual redesign `fe4899d`, post fix round `58f14fb` + `9352367`). Section numbers are a contract — other prompts reference them by number.

Build verified: `npm run build` exit code **0** (Vite 5.4.21, 1806 modules, PWA precache 14 entries / 792.83 KiB). `npm run dev` responds **200** on `/`.

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

Fonts: DM Sans + Space Grotesk from Google Fonts (`index.html` `<link>`); **JetBrains Mono self-hosted** (three woff2 in `src/assets/fonts/`, `@font-face` in `src/index.css`) so its slashed-zero OpenType feature survives (Google's build strips GSUB). The woff2 files are in the service-worker precache (`globPatterns` includes `woff2`).

No test framework, no linter config, no TypeScript. Scripts: `dev`, `build`, `preview`, `icons`.

## 2. File Structure

```
dashboard/                      ← git repo root (remote "github")
├── api/
│   └── proxy.js                Vercel serverless CORS proxy, host-allowlisted
├── public/icons/               icon-192 / icon-512 / icon-maskable-512 (PNG)
├── scripts/make-icons.mjs      generates the PNG icons (pngjs), npm run icons
├── index.html                  meta/PWA tags, Google Fonts link, pre-paint theme script
├── vite.config.js              react + VitePWA (manifest, workbox runtimeCaching rules)
├── tailwind.config.js          strict 5-size fontSize scale, CSS-var colour tokens, font stacks
├── postcss.config.js           tailwind + autoprefixer
└── src/
    ├── main.jsx                ReactDOM root, StrictMode
    ├── index.css               @font-face, theme CSS vars, .num/.press/.shimmer/.scroller, reduced-motion kill-switch, safe-area padding
    ├── config.js               LOCATION (Edinburgh), proxy chain + fetchViaProxy, date helpers (todayISO, parseISO, dayOfYear, mondayOf)
    ├── hooks/
    │   ├── useFetchData.js     shared fetch hook (interval refresh, transform, custom fetcher)
    │   └── useLocalStorage.js  JSON get/set with functional updates
    ├── data/
    │   ├── vocabulary.json         279 words
    │   ├── german-exercises.json   140 exercises
    │   ├── cima-questions.json     4×50 questions
    │   └── ey-milestones.json      22 milestones + startDate + weeklyHourTarget
    └── components/
        ├── ui.jsx              shared primitives: Card, Skeleton, ErrorState, Empty, Badge, Chip, Segmented, Accordion, ProgressBar, Primary/Secondary/GhostBtn, inputCls, focusRing, press, buzz
        ├── ErrorBoundary.jsx   per-widget class boundary with "Reload widget" reset
        ├── WeatherWidget.jsx   7-day forecast + expandable hourly scroller
        ├── PollenWidget.jsx    6 pollen types + tree/overall rollups
        ├── SunsetWidget.jsx    sun arc + 5-day sunset-quality ring forecast
        ├── NewsWidget.jsx      BBC Business RSS with keyword filter chips
        ├── StockWidget.jsx     watchlist, sparklines, detail chart, validated add
        ├── WordWidget.jsx      word of the day, learn/quiz modes
        ├── GermanWidget.jsx    fill-the-blank dialogues, streak + week calendar
        ├── CimaWidget.jsx      4-module MCQ bank, spaced repetition, daily challenge
        └── EyWidget.jsx        countdown, milestone checklist, weekly hours log
```

The prompt library (boot prompt, task prompts) lives one level **above** the repo root in `dashboard artifacts/` and is not committed here.

## 3. Widget Inventory

Order/config lives in `App.jsx` `WIDGETS` map; default order: weather, pollen, sunset, stocks, news, word, cima, german, ey. Only CIMA spans 2 columns (`sm:col-span-2 lg:col-span-2`). All widgets are self-contained (useState/useLocalStorage), wrapped in `ErrorBoundary`.

### WeatherWidget (`src/components/WeatherWidget.jsx`)
- **Displays:** 7 day-tiles (weekday, WMO emoji icon, high/low °), tap a day → horizontal hourly scroller (every 3rd hour: time, icon, temp, precip-probability micro-bar + %), "Last updated" line.
- **API:** `https://api.open-meteo.com/v1/forecast?latitude=55.9533&longitude=-3.1883&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Europe%2FLondon` — direct fetch (Open-Meteo has CORS), 15-min refresh.
- **localStorage:** none.
- **Interactions:** day tiles toggle the hourly panel (aria-expanded); retry button on error.
- **Notes:** day grid is `grid-cols-4 sm:grid-cols-7` — wraps 4+3 at phone width. Icons are emoji via a WMO threshold table (`icon()` scans `code >= c`, an approximation, not exact WMO matching).

### PollenWidget (`src/components/PollenWidget.jsx`)
- **Displays:** "Tree pollen" rollup row, 6 rows (Grass, Birch, Alder, Olive, Ragweed, Mugwort) with raw value + Low/Medium/High badge, "Overall" rollup, last-updated + "zero values out of season are normal" note.
- **API:** `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=…&longitude=…&current=grass_pollen,birch_pollen,alder_pollen,olive_pollen,ragweed_pollen,mugwort_pollen` — direct fetch, 15-min refresh.
- **localStorage:** none. **Interactions:** retry only — display-only otherwise.
- **Notes:** per-type thresholds `[low, high)` hard-coded in `TYPES`; levels always paired with the word (never colour-only).

### SunsetWidget (`src/components/SunsetWidget.jsx`)
- **Displays:** (1) semicircle sun arc with live sun position (minute tick), sunrise/sunset times, daylight duration, ▲/▼ delta vs yesterday, golden-hour time, tomorrow's times; (2) 5-day sunset-quality forecast — SVG ring gauges scored 0–100 by `calcSunsetScore` (documented in the file: mid-cloud Gaussian peaked at 40% σ=20 (+35), high cloud linear (+20); low cloud (−20), humidity>70% (−10), precip>30% (−10 hard), visibility<10 km (−5); +45 shift, clamped), label bands Poor<25 / Fair / Decent / Good / Great / Spectacular≥85, sunset time per day, **gold `#f0b429` ring + "best" badge on the highest-scoring day (reserved, this widget only)**.
- **API:** one Open-Meteo forecast call: `daily=sunrise,sunset,daylight_duration&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,precipitation_probability,visibility&past_days=1&forecast_days=5` — 60-min refresh. Hourly sample matched to each day's sunset hour (`findHourlyIndex`), with neutral fallbacks when missing.
- **localStorage:** none. **Interactions:** none (rings display-only); retry on error.
- **Notes:** daily index 0 = yesterday (delta only); quality loop runs indices 1..end. Skeleton mirrors arc + stats + 5-ring row.

### NewsWidget (`src/components/NewsWidget.jsx`)
- **Displays:** 5 headlines from BBC Business RSS filtered by chip (All, EY/Big Four, UK Banking, Fintech, Consulting — keyword lists in `FILTERS`), each expandable to description + "Read more" link; source + date line per item.
- **API:** `https://feeds.bbci.co.uk/news/business/rss.xml` via `fetchViaProxy` (proxy chain, §4), 30-min refresh, DOMParser transform (first 30 items).
- **localStorage:** none. **Interactions:** filter chips, expand/collapse per headline, external links, retry.

### StockWidget (`src/components/StockWidget.jsx`)
- **Displays:** watchlist rows — ticker, 5-day sparkline (gradient fill, dashed prev-close line), price, ▲/▼ day % in emerald/rose; expandable per-ticker detail chart with range tabs (1D/5D/1M/3M/6M/1Y, per-range in-memory cache); add-ticker form with validation states.
- **API:** `https://query1.finance.yahoo.com/v8/finance/chart/{T}?range={r}&interval={i}` via `fetchViaProxy`; quotes at range 5d/1d, 15-min refresh via `Promise.allSettled`.
- **localStorage:** `dashboard_stockTickers` (defaults NVDA, GOOGL, AMZN, AVGO, AMD, SOFI, PLTR, NVO).
- **Interactions:** sort toggle (% ▼ / A–Z), expand row → detail chart, remove (X), add with pre-commit validation (`validateTicker` distinguishes "invalid symbol" from "network error"; spinner in the Add button — the app's only spinner).
- **Notes:** failed state only when *zero* quotes load; per-ticker "no data" otherwise.

### WordWidget (`src/components/WordWidget.jsx`)
- **Displays:** deterministic word of the day (`dayOfYear() % vocab.length`) with pronunciation/part-of-speech, definition, example; quiz mode blanks the word (regex `______`), guess input, correct/incorrect verdict, quiz accuracy line; known/new vote buttons with lifetime tally, once per day.
- **API:** none (local `vocabulary.json`).
- **localStorage:** `dashboard_wordMode`, `dashboard_wordStats`, `dashboard_wordVoteDate`, `dashboard_quizStats`.
- **Interactions:** learn/quiz segmented control, guess+Reveal form, vote buttons (aria-disabled after voting, "Done for today ✓"), haptic on vote/reveal.

### GermanWidget (`src/components/GermanWidget.jsx`)
- **Displays:** one dialogue exercise (id/theme/level header, lines with blanks), per-line answer inputs, per-line ✓/✗ verdicts + expected answer, per-line "Show translation" toggle; pool progress bar (completed/pool), Mon-first week calendar of practice days, streak + accuracy line (🔥 at ≥7).
- **API:** none (local `german-exercises.json`).
- **localStorage:** `dashboard_germanLevel`, `dashboard_germanCompleted`, `dashboard_germanMistakes`, `dashboard_germanDates`, `dashboard_germanStats`, `dashboard_germanStreak`.
- **Interactions:** level segmented (All/A2/B1/B2), Check (haptic), Next, Skip, Review Mistakes (aria-disabled when none, helper text — no tooltip-only state).
- **Notes:** streak increments once per local day; dates array capped at 60.

### CimaWidget (`src/components/CimaWidget.jsx`) — 2-col span
- **Displays:** BA1–BA4 module tabs (identity colours), stats line (Attempted x/50, Accuracy %, Streak (best), Overall x/200), module progress bar + 4 mini per-module bars, question card (module pill, topic, difficulty dot+word, A–D options with ✓/✗ reveal + explanation), mode buttons, study-history accordion (last 50 stored / 10 shown, tap to revisit), two-step reset with 5-s auto-cancel.
- **API:** none (local `cima-questions.json`).
- **localStorage:** `dashboard_cima_activeModule`, `dashboard_cima_attempts`, `dashboard_cima_reviewQueue`, `dashboard_cima_streak`, `dashboard_cima_history`, `dashboard_cima_dailyCompleted`.
- **Interactions:** module tabs, answer buttons (haptic, disabled after pick), Practice / Review Mistakes / Weak Topics / ⭐ Daily Challenge modes, Skip, history rows, reset.
- **Notes:** spaced repetition — wrong answers enter the queue at interval 1 day, correct answers double it (cap 30); review picks entries past their interval. Daily Challenge is deterministic (unattempted sorted by id, `dayOfYear % length`) and renders a completed state once done per module per day. Module colours `bg-blue-500/emerald-500/violet-500/amber-500` are the reserved identity hexes from the boot prompt.

### EyWidget (`src/components/EyWidget.jsx`)
- **Displays:** hero countdown (days until `startDate` 2026-09-01) + Week n of 22 + window progress bar (from 2026-04-01); category filter chips; milestone list (category dot, checkbox, title, deadline, overdue/due-soon badges) — default view = first 5 incomplete, "Show all n" toggle; weekly hours form ("Log" **replaces** the current week's value, capped 26 weeks), 8-week bar history with target line + ✓ over target weeks; monthly check-in reminder from the 26th.
- **API:** none (local `ey-milestones.json`).
- **localStorage:** `dashboard_ey_milestoneStatus`, `dashboard_ey_hoursLog`, `dashboard_ey_categoryFilter`.
- **Interactions:** filter chips, milestone toggle (haptic), show-all toggle, hours form.
- **Notes:** EY category colours (cyan/pink/indigo + slate for cima) are the non-overlapping reserved set. `showAll` and `hoursInput` are session-only (not persisted) by design.

## 4. Shared Utilities

- **`src/config.js`** — `LOCATION` (Edinburgh 55.9533, −3.1883, Europe/London); `PROXIES` chain and `fetchViaProxy(url, {timeout=8000})`: tries `/api/proxy?url=` (same-origin Vercel function) → `api.allorigins.win` → `corsproxy.io`, each attempt with its own AbortController timeout, first OK response wins; `PROXY` (legacy export = first proxy); date helpers `todayISO` (local, never `toISOString`), `parseISO` (local midnight), `dayOfYear`, `mondayOf` (Mon-first).
- **`api/proxy.js`** — Vercel serverless function; host-allowlist (`feeds.bbci.co.uk`, `www.theguardian.com`, `query1/query2.finance.yahoo.com`), 9-s upstream timeout, browser-like UA, passes upstream status/content-type, `s-maxage=120, stale-while-revalidate=600` edge caching.
- **`src/hooks/useFetchData.js`** — `{data, loading, error, lastUpdated, refresh}`; optional `transform` (e.g. RSS→JSON), `fetcher` (proxy chain), `refreshInterval`, `enabled`; alive-ref guard against post-unmount setState.
- **`src/hooks/useLocalStorage.js`** — JSON parse/stringify with try/catch, functional updates supported.
- **`src/components/ui.jsx`** — all shared primitives (list in §2) plus `focusRing`, `press`, `buzz()` haptic.
- **CORS:** Open-Meteo called directly (has CORS); BBC RSS and Yahoo Finance always via the proxy chain. Service worker: `/api/` is **NetworkOnly** (never cached — a cached proxy response once shadowed fresh ticker fetches); Open-Meteo and public proxies NetworkFirst (15 min), Google Fonts CacheFirst (30 days).
- **Error handling:** per-widget `ErrorBoundary` (crash → message + "Reload widget"); fetch errors → shared `ErrorState` with Retry; StockWidget degrades per-ticker ("no data") and only shows the error state when nothing loads; ticker add distinguishes invalid symbol vs network failure.

## 5. Styling System

Canonical token table, card pattern, colour policy, type scale, and motion rules live in **`../dashboard-boot-prompt.md`** ("Design tokens" section) — that file is the source of truth; this section records how they are implemented.

- **Themes:** two dark themes as CSS variables in `index.css` — `:root`/`html[data-theme='slate']` (bg `#0f172a`, card `#1e293b`, card2 `#283548`, ink `#e2e8f0`, mut `#94a3b8`, line/line2/veil slate-alpha, focus `#cbd5e1`) and `html[data-theme='amoled']` (bg `#000000`, card `#0b0d13`, card2 `#161923`, ink `#e5e8ee`, mut `#8d97a9`). Mapped to Tailwind colour names (`bg-card`, `text-mut`, …) in `tailwind.config.js`. Pre-paint script in `index.html` applies the saved theme and syncs `theme-color` meta; `App.jsx` keeps both in sync on toggle.
- **Accents (semantic only):** emerald-400/rose-400 for stock moves + quiz right/wrong + completion ✓; amber-400 warnings; gold `#f0b429` reserved to SunsetWidget's best day; CIMA module identity colours (blue/emerald/violet/amber 500); EY categories cyan/pink/indigo/slate 500. No blue UI accent.
- **Type:** DM Sans body, Space Grotesk `font-display` (titles/h1 only), JetBrains Mono for every digit via `.num` (`slashed-zero tabular-nums` — works because self-hosted). Strict five-size scale enforced by the Tailwind `fontSize` override (12/14/16/20/28).
- **Layout:** `max-w-grid` (1600px); grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`; only CIMA spans 2. Card = `bg-card rounded-2xl border border-line p-4`, no shadows anywhere. `#root` pads all four safe-area insets.
- **Reusable classes (index.css):** `.num`, `.press` (scale 0.97 on :active), `.shimmer` (skeleton highlight), `.scroller` (hidden-scrollbar horizontal scroll with edge fade masks). Global `prefers-reduced-motion` kill-switch. Shared Tailwind strings from ui.jsx: `focusRing`, button/input/badge/chip/segmented/accordion treatments.

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

## 7. Data Files

All parsed and counted directly from the JSON on 2026-07-11:

- **`vocabulary.json` — 279 entries.** Array of `{word, pronunciation, partOfSpeech, definition, example}`. Selection: `dayOfYear() % 279`.
- **`german-exercises.json` — 140 entries** (A2 = 50, B1 = 64, B2 = 26). Array of `{id, level, theme, dialogue: [{speaker, german, blank, answer, english}]}`.
- **`cima-questions.json` — 200 questions: BA1 = 50, BA2 = 50, BA3 = 50, BA4 = 50.** Object keyed by module → array of `{id (module-prefixed, e.g. "BA1-…"), topic, difficulty (easy|medium|hard), question, options {A,B,C,D}, correct, explanation}`. CIMA logic depends on ids being module-prefixed (`id.startsWith(module)`).
- **`ey-milestones.json` — 22 milestones** + `startDate: "2026-09-01"` + `weeklyHourTarget: 7`. Milestones `{id, title, description, category, deadline}`; categories: communication = 15 (5 monthly client memos + 10 mock client scenarios), cima = 4, modelling = 2, tools = 1.

## 8. Current Issues or Gaps

- **Build/dev:** clean — build exit 0, no warnings beyond none; dev 200. No console errors observable without a browser (see USER VERIFY).
- **Public proxy fallbacks are best-effort:** `api.allorigins.win` and `corsproxy.io` are third-party and historically flaky; the same-origin `/api/proxy` is primary. `www.theguardian.com` is allowlisted in `api/proxy.js` but nothing calls it (leftover — harmless).
- **Weather emoji icons:** conditions render as emoji via an approximate WMO threshold scan (`code >= c` picks the last matching entry, not exact code matching — e.g. code 77 renders as ❄️'s neighbour band). Currently *allowed* by the boot prompt ("emoji only for weather conditions and the streak flame"); the planned visual overhaul replaces them with a WeatherIcon component.
- **Weather 7-day grid wraps 4+3** on phones (`grid-cols-4 sm:grid-cols-7`) — a known target of the next overhaul, not a bug.
- **Raw palette classes outside tokens (deliberate, reserved):** CIMA module colours, EY category colours, emerald/rose/amber semantic accents, and `Badge`'s muted tint `bg-slate-400/15` (ui.jsx) — the last is the one raw `slate-*` in a component and could move to a token someday.
- **`useFetchData` interval doesn't restart on manual `refresh()`** and its `load` deliberately omits `transform`/`fetcher` from deps (eslint-disabled) — fine in practice since both are static per widget.
- **Accordion `maxHeight` measured once per toggle** (`ref.current?.scrollHeight`): content that grows while open (CIMA history gaining entries) can clip until re-toggled. Minor.
- **StockWidget effect keys off `tickers.join(',')`** (eslint-disabled) — correct behaviour, just a lint suppression to note.
- **Hardcoded values that could be config:** pollen thresholds (`TYPES` in PollenWidget), news keyword lists (`FILTERS` in NewsWidget), stock defaults (`DEFAULTS`), EY check-in day (26), window start `2026-04-01`. All deliberate so far.
- **No tests, no linting** — the strict conventions are enforced by prompts/audits only.
- **Case-sensitivity:** deploy target is case-sensitive; component filenames are canonical as listed (notably `CimaWidget.jsx`, not `CIMAWidget.jsx`).

**USER VERIFY** (no browser tooling available in this session — checked build + HTTP only):
- Open the dev/prod app with DevTools console: confirm zero errors/warnings on load in both themes.
- Confirm PWA install + offline render still works after the font precache change (SW precaches 14 entries incl. 3 woff2).
- Spot-check slashed zeros on a real device at 12px (Stocks prices, CIMA dates).

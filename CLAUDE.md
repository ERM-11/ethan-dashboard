# CLAUDE.md — Ethan's Dashboard

Personal React + Vite + Tailwind PWA, 9 widgets, dark-only (slate/amoled themes). Primary device: installed PWA on a Pixel 9a (~412px).

## Canonical references — read these, don't restate them

- **`../dashboard-boot-prompt.md`** (one level above the repo root, in the prompt library) — the **canonical design tokens and hard rules**: theme tokens, card pattern, colour policy, `.num` typography rules, type scale, motion, z-index, icon/skeleton conventions. Token values live there only.
- **`DASHBOARD_AUDIT.md`** (repo root) — the **current-state reference**: §3 widget inventory, §4 shared utilities, §5 styling implementation, §6 localStorage keys, §7 data-file counts, §8 known issues. Regenerate via `../dashboard-audit-prompt.md` after significant changes; its section numbers are a contract.

## localStorage contract

- Every key uses the `dashboard_` prefix; values are JSON; dates are local-time ISO (`YYYY-MM-DD`). Full key list + shapes: DASHBOARD_AUDIT.md §6.
- Never rename, repurpose, or change the shape of an existing key. The retired `dashboard_darkMode` is no longer read but must never be deleted or reused.
- Never reset `dashboard_widgetOrder` — when adding a widget, append its id (App.jsx already heals saved orders).

## Git & deploy

- The git remote is **`github`** (not `origin`): `https://github.com/ERM-11/ethan-dashboard.git`, branch `master`. Push with `git push github master`.
- Deploys on Vercel as project **ethan-dashboard**, linked at this repo root (`.vercel/project.json`). `api/proxy.js` runs as a Vercel serverless function (same-origin CORS proxy — first hop of the proxy chain in `src/config.js`).
- `dashboard-deploy-prompt.md` in the prompt library predates the current remote setup — where it says `origin`/`main`, the reality is `github`/`master`.

## Device-testing hard rules (details in the boot prompt)

1. ≥44×44px hit area on every interactive element.
2. All calendar logic in local time: `parseISO(iso)` / `todayISO()` from `src/config.js`, never bare `new Date(iso)` or `toISOString()`. Weeks start Monday.
3. Once-per-day actions render a distinct completed state.
4. No tooltip-only state — inline helper text instead.
5. SVGs/charts use `viewBox` + `width="100%"`, never fixed pixel widths.
6. Verify every change at 412px in **both** themes (slate and amoled).
7. New widgets: ErrorBoundary wrapper, explicit grid position, append to saved order.

## Conventions

- Digits render in `.num` (self-hosted JetBrains Mono, slashed-zero) — never in DM Sans/Space Grotesk. Five font sizes only.
- Use the shared primitives in `src/components/ui.jsx` (Card, buttons, Segmented, Accordion, Skeleton…) — don't restyle.
- Component filenames are canonical and case-sensitive in deploy (`CimaWidget.jsx`, not `CIMAWidget.jsx`).
- No test framework or linter — `npm run build` must exit 0 before any commit.

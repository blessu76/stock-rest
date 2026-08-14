# Responsive QA — coverage matrix (stock.ipe.rest green gate)

> **Owner**: Paul (Reach/Platform) · **Enforces**: [`RESPONSIVE_UI.md`](https://github.com/…/studio/brand/design-system/RESPONSIVE_UI.md) (studio SoT, Quill)
> **Suite**: [`tests/responsive.spec.js`](./responsive.spec.js) · **Config**: [`../playwright.config.js`](../playwright.config.js) · **CI**: [`../.github/workflows/responsive-gate.yml`](../.github/workflows/responsive-gate.yml)
> **Status**: green (44 passed) · **Created**: 2026-08-14 · **Hardened**: 2026-08-14 (Dane adversarial review — P0 mode-pop + P1 R11/R3b/coverage)

## Why this exists

A real bug shipped: on mobile the **P&L summary numbers were only *scaled down*** — the layout never re-flowed — so the digits became unreadable / clipped at 768px. `RESPONSIVE_UI.md` turned the fix into a **standard**; this suite turns the standard into an **automated gate** so the violation can never merge again.

## How it works (no login needed)

The dashboard is passphrase-gated (`index.html` → login shell until unlocked), so a headless run can never reach the real cards. Instead the suite loads **deterministic fixture HTML** that mounts the **real markup** (copied from the JS injectors in `app.js`/`pnl.js`/`positions.js`/`assets.js`/`risk.js`/`orders.js`) with the **real CSS** (`style.css` + `three.css`) via `<link>`. Offline, no network, no `data.json` drift — but the exact classes/breakpoints `RESPONSIVE_UI.md` governs are exercised.

Fonts are forced to a local mono fallback in the fixtures so measurements don't depend on webfont load timing; the metrics asserted (overflow, `text-overflow`, font-size floors, tap size) are font-agnostic.

## Fixtures

| Fixture | CSS owner | Surfaces covered |
|---|---|---|
| `fixtures/overview.html` | `style.css` | topbar, mode-pop, pnl-hero, hero-grid (balance/challenge/risk), holdings-live, intraday, positions table, footer, off-canvas nav (`#navToggle` via `drawer.js`) |
| `fixtures/pnl.html` | `style.css`+`three.css` | **pnl-hero (the original bug)** — grand + 2-up cards, `.pnl-cum`; hist-grid/hist-card; range-tabs |
| `fixtures/stats.html` | `style.css`+`three.css` | `.stats.four` (Assets/Positions/Risk/Orders), `.cards3` position cards (`.price b`), `.order-row` wide grid (+ `.order-row small` meta R3b), `.risk-hero3`, `.risk-row` wide grid, gates, `.stats>div` min-width guard (R11) |
| `fixtures/login.html` | `style.css` | passphrase gate `.login-shell` (2-col split → 1-col ≤760), big display `h1` (42→35px, the 320px overflow risk), `.login-input`/`.login-button` |
| `fixtures/settings.html` | `style.css`+`three.css` | off-canvas nav, `.uni-search`/`.login-input`, `.order-table`/`.order-row` (uni-row) wide grid, `.cmdbox code` — mobile page-scroll target |

## Test viewports (RESPONSIVE_UI §1)

`320` (smallest supported) · `375` (iPhone SE/standard — **note: ≤420 → falls in the *small* band on this dashboard**) · `768` (tablet edge, where the pnl bug appeared) · `1280` (desktop, no-regression).

Breakpoint bands (locked to live CSS): desktop ≥1101 · tablet 761–1100 · **mobile 421–760** · **small ≤420**.

## Coverage matrix — what each group asserts and which rule/bug it guards

| Group | Assertion | RESPONSIVE_UI rule | Guards against |
|---|---|---|---|
| **A** | Page (`scrollingElement`) `scrollWidth ≤ clientWidth` at 320/375/768/1280 for **5 fixtures** (overview, pnl, stats, login, settings) | §4 "No horizontal page scroll"; §1 320px | Sideways page scroll on phones (shrink-only symptom). **Caught a real 320px overflow in `.hist-grid` (fixed).** |
| **B** | `.pnl-cum`, `.stats b`, `.price b`: `scrollWidth ≤ clientWidth` **AND** `text-overflow ≠ ellipsis` | §2 un-clamp; §4 "No number/label ellipsis on primary values" | **THE ORIGINAL BUG** — 768px pnl number clipped/ellipsized. |
| **C** | Primary numbers ≥16px; meta/`.stats small`/`.eyebrow` ≥10px on mobile. **R3b**: `.pnl-total small` + `.order-row small` ≥10px (both were 9px). | §3 + ACCESSIBILITY §5 | "Calm ≠ tiny" — micro-sized unreadable numbers/meta. |
| **D** | `#navToggle` ≥44×44; nav links ≥44px hit height; range pills reachable | §4 44×44 tap target (WCAG 2.5.5) | Un-tappable controls. **Caught a 43px nav-link shortfall (fixed → min-height:44px).** |
| **E** | `.stats.four` grid columns change 4→2→2→1 across 1100/760/420; `.pnl-hero .grand` full-width ≤760 | §2 reflow ladder; "grand card full width first" | **Shrink-only** (cards get narrower, columns never change). |
| **F** | `#navToggle` visible ≤760 / hidden ≥761; `.sidebar` `position:fixed` + off-canvas transform ≤760 | §4 "Off-canvas nav on mobile" | Desktop nav bar crammed onto a phone. |
| **G** | **(i) `.mode-pop` popover ON-SCREEN when opened** @ 320/375: focus the `.mode-tip` → assert `rect.left ≥ 0 && rect.right ≤ innerWidth` | §4 "no off-screen content"; **Dane reg②** | **(i) popover pushed off the LEFT edge** on mobile (position:absolute; right:0 on a tiny anchor). **Group A is BLIND to this** (fixed/absolute doesn't grow page scrollWidth). |
| **H** | `.stats>div` + `.pnl-total` computed **`min-width:0`** (structural, not pixel) | §2 un-clamp prerequisite; **Dane R11** | Dropping `three.css:203` / per-item `min-width:0` silently re-enables number clip + sideways scroll (reg①③). |

## Findings from initial build (2026-08-14)

Building the gate surfaced **two live violations** beyond the 4 already-fixed items; both fixed in the same change:

1. **`.hist-grid` horizontal overflow at ≤352px** — `repeat(auto-fit,minmax(320px,1fr))` forces a 320px min track that exceeds a 320px viewport (minus 16px gutters) → 16px page scroll. Fixed: `@media(max-width:420px){.hist-grid{grid-template-columns:1fr}.hist-card{min-width:0}}` (`style.css`). Affects `pnl.html` + `history.html`.
2. **Mobile nav link 43px tap height** (1px under §4). Fixed: `.sidebar nav a{min-height:44px;box-sizing:border-box}` (`style.css`).

## Dane adversarial review — hardening round (2026-08-14)

Dane's adversarial re-review (`c5d74e3` base) proved **2 false-greens (P0)** + flagged 3 soft gaps (P1). All resolved; suite grew 30 → **44**:

1. **P0 — (i) mode-pop off-screen was UNCOVERED.** Removing the mobile bottom-sheet fix left the gate 30/30 green while the popover sat off-screen-left. **Fix: new Group G** (focus `.mode-tip`, assert popover rect in viewport @320/@375) — proven RED on fix removal while Group A stays green (see "Proving the gate" table).
2. **P0 — hard block not effective** (no branch protection → RED doesn't stop Pages). **Fix: documented exact registration procedure above, marked pending Founder approval** (Paul lacks admin rights — not executed).
3. **P1 R11 — structural `min-width:0` guard** (new Group H): asserts computed `min-width:0` on `.stats>div` + `.pnl-total` so dropping `three.css:203` is caught structurally.
4. **P1 R3b — meta floor** raised `.pnl-total small` (`style.css`) + `.order-row small` (`three.css`) 9px → **10px**, with new §C R3b asserts (consistent with the earlier `.stats em` 9→10 fix).
5. **P1 coverage** — added `login.html` (passphrase gate) + `settings.html` (uni-search/order-table) fixtures; both join Group A page-scroll coverage.

Cache-busters bumped: `style.css?v=20260814e→f`, `three.css?v=20260814d→e` across all pages.

## Proving the gate actually catches regressions (not a false green)

Per ENGINEERING_STANDARDS ("일부러 빨강을 유도… 실측한 뒤 채택"), each regression class is proven by injecting the fault, observing **RED**, then reverting to **GREEN**. Verified 2026-08-14:

| Regression injected | Result | Notes |
|---|---|---|
| Original bug: `.pnl-cum{text-overflow:ellipsis}` ≤760 | **RED** @375/@320 (Group B) | The founding bug. |
| **P0 reg② — remove `@media(≤760){.mode-pop{position:fixed…}}` bottom-sheet fix** | **Group G RED** @375 (`left=-89.98`) & @320 (`left=-73.6`); **Group A stays GREEN** | This is the decisive proof: the popover goes off-screen-left, **Group A (page scroll) does NOT catch it** (fixed/absolute doesn't grow `documentElement.scrollWidth`). Group G is the test that actually guards reg②. |
| **R11 — drop `.stats>*`/`.pnl-total` `min-width:0`** | **Group H RED** (`min-width:auto` ≠ `0px`) | Structural guard; catches the CSS drop before pixels break. |
| **R3b — revert `.pnl-total small`/`.order-row small` to 9px** | **Group C R3b RED** (`<10px`) | Meta floor. |

Each was reverted → full suite **44 passed**. The gate demonstrably blocks every regression class it exists for, including the two Dane proved were false-green.

## How this gates deploys — hard block (⚠️ Founder approval / permission required)

Pages deploys `stock-rest/main` on branch push. The `responsive-gate` workflow runs on the **same push/PR**, but **without branch protection on `main` a RED run does NOT stop the Pages deploy** — the gate is advisory only (this was Dane P0 #2). To make it a **hard block**, `main` needs a required status check. **Registering branch protection needs repo-admin rights (Founder) — do NOT run this from a non-admin session (it will 403).**

**Required check name**: `responsive` (the job `name:` in `responsive-gate.yml`).

**Option A — `gh` CLI** (repo admin):
```bash
gh api -X PUT repos/blessu76/stock-rest/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=responsive' \
  -f 'enforce_admins=true' \
  -f 'required_pull_request_reviews=' \
  -f 'restrictions='
```
(If the API rejects the empty `required_pull_request_reviews`/`restrictions`, pass them as JSON `null` via `--input`.)

**Option B — GitHub UI**: Settings → Branches → Add branch protection rule → Branch name pattern `main` → check **"Require status checks to pass before merging"** → search & select **`responsive`** → (optional) "Require branches to be up to date" (`strict`) → Save.

**Status**: ⏳ **pending Founder approval/execution** (Paul lacks repo-admin on blessu76/stock-rest). Until registered, `responsive-gate` is a visible notify-on-fail signal on every push, not an enforced merge/deploy block.

## Running locally

```bash
cd /Users/davy.kim/stock-rest
npm ci                              # or: npm install
npx playwright install chromium
npx playwright test                 # green gate
npx playwright test --ui            # interactive
```

## When you edit the dashboard

- Confirm which CSS file owns the surface (Overview = `style.css`; other pages = `three.css`).
- If you add a new card/stat/number surface, add its markup to the matching fixture and extend the relevant group.
- **Cache-bust** the production `<link href="style.css?v=…">` / `three.css?v=…` query when you change CSS so live users get the fix (fixtures link unversioned CSS, so tests always see HEAD).

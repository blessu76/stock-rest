# Responsive QA — coverage matrix (stock.ipe.rest green gate)

> **Owner**: Paul (Reach/Platform) · **Enforces**: [`RESPONSIVE_UI.md`](https://github.com/…/studio/brand/design-system/RESPONSIVE_UI.md) (studio SoT, Quill)
> **Suite**: [`tests/responsive.spec.js`](./responsive.spec.js) · **Config**: [`../playwright.config.js`](../playwright.config.js) · **CI**: [`../.github/workflows/responsive-gate.yml`](../.github/workflows/responsive-gate.yml)
> **Status**: green (30 passed) · **Created**: 2026-08-14

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
| `fixtures/stats.html` | `style.css`+`three.css` | `.stats.four` (Assets/Positions/Risk/Orders), `.cards3` position cards (`.price b`), `.order-row` wide grid, `.risk-hero3`, `.risk-row` wide grid, gates |

## Test viewports (RESPONSIVE_UI §1)

`320` (smallest supported) · `375` (iPhone SE/standard — **note: ≤420 → falls in the *small* band on this dashboard**) · `768` (tablet edge, where the pnl bug appeared) · `1280` (desktop, no-regression).

Breakpoint bands (locked to live CSS): desktop ≥1101 · tablet 761–1100 · **mobile 421–760** · **small ≤420**.

## Coverage matrix — what each group asserts and which rule/bug it guards

| Group | Assertion | RESPONSIVE_UI rule | Guards against |
|---|---|---|---|
| **A** | Page (`scrollingElement`) `scrollWidth ≤ clientWidth` at 320/375/768/1280 for all 3 fixtures | §4 "No horizontal page scroll"; §1 320px | Sideways page scroll on phones (shrink-only symptom). **Caught a real 320px overflow in `.hist-grid` (fixed).** |
| **B** | `.pnl-cum`, `.stats b`, `.price b`: `scrollWidth ≤ clientWidth` **AND** `text-overflow ≠ ellipsis` | §2 un-clamp; §4 "No number/label ellipsis on primary values" | **THE ORIGINAL BUG** — 768px pnl number clipped/ellipsized. |
| **C** | Primary numbers ≥16px; meta/`.stats small`/`.eyebrow` ≥10px on mobile | §3 + ACCESSIBILITY §5 | "Calm ≠ tiny" — micro-sized unreadable numbers. |
| **D** | `#navToggle` ≥44×44; nav links ≥44px hit height; range pills reachable | §4 44×44 tap target (WCAG 2.5.5) | Un-tappable controls. **Caught a 43px nav-link shortfall (fixed → min-height:44px).** |
| **E** | `.stats.four` grid columns change 4→2→2→1 across 1100/760/420; `.pnl-hero .grand` full-width ≤760 | §2 reflow ladder; "grand card full width first" | **Shrink-only** (cards get narrower, columns never change). |
| **F** | `#navToggle` visible ≤760 / hidden ≥761; `.sidebar` `position:fixed` + off-canvas transform ≤760 | §4 "Off-canvas nav on mobile" | Desktop nav bar crammed onto a phone. |

## Findings from initial build (2026-08-14)

Building the gate surfaced **two live violations** beyond the 4 already-fixed items; both fixed in the same change:

1. **`.hist-grid` horizontal overflow at ≤352px** — `repeat(auto-fit,minmax(320px,1fr))` forces a 320px min track that exceeds a 320px viewport (minus 16px gutters) → 16px page scroll. Fixed: `@media(max-width:420px){.hist-grid{grid-template-columns:1fr}.hist-card{min-width:0}}` (`style.css`). Affects `pnl.html` + `history.html`.
2. **Mobile nav link 43px tap height** (1px under §4). Fixed: `.sidebar nav a{min-height:44px;box-sizing:border-box}` (`style.css`).

## Proving the gate actually catches regressions (not a false green)

Per ENGINEERING_STANDARDS ("일부러 빨강을 유도… 실측한 뒤 채택"), verified on 2026-08-14 by re-injecting the original bug (`.pnl-cum{text-overflow:ellipsis}` at ≤760) → suite went **red** at 375px & 320px with the message *"pnl-cum uses text-overflow:ellipsis … forbidden on primary numbers (RESPONSIVE_UI §4; original 768px bug)"*, non-zero exit → then reverted → green. The gate demonstrably blocks the exact regression class it exists for.

## How this gates deploys

Pages deploys `stock-rest/main` on branch push. The `responsive-gate` workflow runs on the **same push/PR**. To make it a hard block, add `responsive-gate / responsive` as a **required status check** on `main` (Settings → Branches → branch protection). Until then it is a visible, notify-on-fail signal on every push.

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

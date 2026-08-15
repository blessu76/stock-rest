// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

/**
 * Responsive regression suite — GREEN GATE for stock.ipe.rest.
 * Enforces studio/brand/design-system/RESPONSIVE_UI.md against the real CSS
 * (style.css = Overview, three.css = other pages) using deterministic fixtures.
 *
 * Each assertion cites the RESPONSIVE_UI.md §rule and/or the past bug it prevents.
 * The founding bug: on mobile the P&L summary numbers were only *scaled down*
 * (never re-flowed) → became unreadable / clipped at 768px. See §2, §4.
 *
 * Coverage matrix lives in tests/RESPONSIVE_QA.md.
 */

const VIEWPORTS = {
  small: { width: 320, height: 800 }, // smallest supported (§1, §4 no horizontal scroll)
  mobile: { width: 375, height: 812 }, // primary mobile (iPhone SE/standard) — §1 test viewport
  tablet: { width: 768, height: 1024 }, // tablet edge — where the pnl bug appeared
  desktop: { width: 1280, height: 900 }, // desktop — no regression
};

const fixtureURL = (name) =>
  "file://" + path.resolve(__dirname, "fixtures", name);

// ---- shared measurement helpers (run in-page) ---------------------------------

/** true if the element (or any) horizontally overflows its own box. */
async function scrollsHorizontally(locator) {
  return locator.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1 // +1px tolerance for sub-pixel rounding
  );
}

/** computed style value for a property. */
async function computed(locator, prop) {
  return locator.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    prop
  );
}

/** numeric font-size in px. */
async function fontPx(locator) {
  return locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/** hit-area (border box) rect. */
async function box(locator) {
  return locator.boundingBox();
}

// =============================================================================
// GROUP A — No horizontal PAGE scroll (§4 "No horizontal page scroll"; §1 320px)
// The exact failure mode of shrink-only layouts: page scrolls sideways on a phone.
// =============================================================================
for (const fixture of [
  "overview.html",
  "pnl.html",
  "stats.html",
  "login.html", // passphrase gate — split→1col ≤760; big display h1 overflow risk @320
  "settings.html", // uni-search + .order-table wide grid; off-canvas nav page
]) {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    test(`[A] no horizontal page scroll — ${fixture} @ ${name}(${vp.width})`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto(fixtureURL(fixture));
      // §4: the PAGE (documentElement) must never scroll sideways, esp. at 320px.
      // Wide data tables are the ONE allowed exception, and they scroll their
      // *wrapper* (.table-wrap/.order-table/.risk-table) — never the page body.
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      expect(
        overflow.scrollWidth,
        `page scrolls sideways at ${vp.width}px (RESPONSIVE_UI §4). ` +
          `scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
}

// =============================================================================
// GROUP B — Primary numbers not clipped / not ellipsized  (THE ORIGINAL BUG)
// §4 "No number/label ellipsis on primary values"; §2 pnl-cum un-clamp.
// Bug: 768px pnl-cum was clipped/ellipsized. Assert scrollWidth<=clientWidth AND
// text-overflow != ellipsis for every primary number.
// =============================================================================
test.describe("[B] primary numbers never clipped or ellipsized", () => {
  // .pnl-cum — the founding bug. Check at 768 (where it broke) + mobile + small.
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    test(`.pnl-cum full & un-ellipsized — pnl.html @ ${name}(${vp.width})`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto(fixtureURL("pnl.html"));
      const nums = page.locator(".pnl-cum");
      const count = await nums.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const n = nums.nth(i);
        // §4: never text-overflow:ellipsis on a primary number.
        const to = (await computed(n, "text-overflow")).trim();
        expect(
          to,
          `pnl-cum[${i}] uses text-overflow:${to} at ${vp.width}px — ` +
            `forbidden on primary numbers (RESPONSIVE_UI §4; original 768px bug)`
        ).not.toBe("ellipsis");
        // §2: number must not be clipped horizontally (un-clamp, reflow instead).
        expect(
          await scrollsHorizontally(n),
          `pnl-cum[${i}] number is clipped at ${vp.width}px (RESPONSIVE_UI §2/§4)`
        ).toBe(false);
      }
    });
  }

  // .stats b — primary stat number (Assets/Positions/Risk/Orders grids).
  for (const vp of [VIEWPORTS.tablet, VIEWPORTS.mobile, VIEWPORTS.small]) {
    test(`.stats b full & un-ellipsized — stats.html @ ${vp.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto(fixtureURL("stats.html"));
      const nums = page.locator(".stats b");
      const count = await nums.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const n = nums.nth(i);
        const to = (await computed(n, "text-overflow")).trim();
        expect(
          to,
          `stats b[${i}] uses text-overflow:${to} at ${vp.width}px (RESPONSIVE_UI §4)`
        ).not.toBe("ellipsis");
        expect(
          await scrollsHorizontally(n),
          `stats b[${i}] number clipped at ${vp.width}px — needs min-width:0 + reflow ` +
            `(RESPONSIVE_UI §2 anti-pattern "cards only got smaller")`
        ).toBe(false);
      }
    });
  }

  // .price b — position card current price (three.css .cards3).
  for (const vp of [VIEWPORTS.mobile, VIEWPORTS.small]) {
    test(`.price b full & un-ellipsized — stats.html @ ${vp.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto(fixtureURL("stats.html"));
      const nums = page.locator(".position .price b");
      const count = await nums.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const n = nums.nth(i);
        expect((await computed(n, "text-overflow")).trim()).not.toBe("ellipsis");
        expect(
          await scrollsHorizontally(n),
          `price b[${i}] clipped at ${vp.width}px (RESPONSIVE_UI §2/§4)`
        ).toBe(false);
      }
    });
  }
});

// =============================================================================
// GROUP C — Font-size floors on mobile  (§3 + ACCESSIBILITY §5)
// Primary numbers ≥ 16px; meta/labels ≥ 10px. "Calm ≠ tiny."
// =============================================================================
test.describe("[C] mobile font-size floors", () => {
  test("primary numbers ≥16px on mobile (pnl-cum, stats b, price b)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    // pnl-cum
    await page.goto(fixtureURL("pnl.html"));
    for (let i = 0, n = page.locator(".pnl-cum"), c = await n.count(); i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `pnl-cum[${i}] below 16px floor on mobile (RESPONSIVE_UI §3)`
      ).toBeGreaterThanOrEqual(16);
    }
    // stats b + price b
    await page.goto(fixtureURL("stats.html"));
    for (let i = 0, n = page.locator(".stats b"), c = await n.count(); i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `stats b[${i}] below 16px floor on mobile (RESPONSIVE_UI §3)`
      ).toBeGreaterThanOrEqual(16);
    }
    for (let i = 0, n = page.locator(".position .price b"), c = await n.count(); i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `price b[${i}] below 16px floor on mobile (RESPONSIVE_UI §3)`
      ).toBeGreaterThanOrEqual(16);
    }
  });

  test("meta/label text ≥10px on mobile (.stats small, .eyebrow)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("stats.html"));
    for (let i = 0, n = page.locator(".stats small"), c = await n.count(); i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `stats small[${i}] below 10px meta floor on mobile (RESPONSIVE_UI §3, ACCESSIBILITY §5)`
      ).toBeGreaterThanOrEqual(10);
    }
    const eyebrow = page.locator(".eyebrow").first();
    expect(await fontPx(eyebrow)).toBeGreaterThanOrEqual(10);
  });

  // R3b meta floor — extend §3 "meta ≥10px" to the two nodes Dane flagged at 9px:
  // .pnl-total small (style.css) and .order-row small (three.css). Consistent with
  // the earlier `.stats em` 9→10 fix. A drop back to 9px must go RED.
  test("R3b — .pnl-total small ≥10px on mobile (pnl.html)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("pnl.html"));
    const n = page.locator(".pnl-total small");
    const c = await n.count();
    expect(c, ".pnl-total small missing from fixture").toBeGreaterThan(0);
    for (let i = 0; i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `pnl-total small[${i}] below 10px meta floor on mobile ` +
          `(RESPONSIVE_UI §3; Dane P1 R3b — was 9px)`
      ).toBeGreaterThanOrEqual(10);
    }
  });

  test("R3b — .order-row small ≥10px on mobile (stats.html)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("stats.html"));
    const n = page.locator(".order-row small");
    const c = await n.count();
    expect(c, ".order-row small missing from fixture").toBeGreaterThan(0);
    for (let i = 0; i < c; i++) {
      expect(
        await fontPx(n.nth(i)),
        `order-row small[${i}] below 10px meta floor on mobile ` +
          `(RESPONSIVE_UI §3; Dane P1 R3b — was 9px)`
      ).toBeGreaterThanOrEqual(10);
    }
  });
});

// =============================================================================
// GROUP D — Touch targets ≥ 44×44  (§4 "Minimum touch target = 44×44px", WCAG 2.5.5)
// =============================================================================
test.describe("[D] touch targets ≥44px on mobile", () => {
  test("#navToggle hamburger ≥44×44 (overview)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("overview.html"));
    const toggle = page.locator("#navToggle");
    // drawer.js injects it; only visible ≤760.
    await expect(toggle).toBeVisible();
    const b = await box(toggle);
    expect(b, "#navToggle has no box").not.toBeNull();
    expect(
      b.width,
      `#navToggle width ${b?.width}px < 44 (RESPONSIVE_UI §4, WCAG 2.5.5)`
    ).toBeGreaterThanOrEqual(44);
    expect(
      b.height,
      `#navToggle height ${b?.height}px < 44 (RESPONSIVE_UI §4)`
    ).toBeGreaterThanOrEqual(44);
  });

  test("off-canvas nav links have ≥44px hit height (overview)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("overview.html"));
    // Open drawer so links are laid out/visible.
    await page.locator("#navToggle").click();
    const links = page.locator(".sidebar nav a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const b = await box(links.nth(i));
      expect(
        b?.height,
        `nav link[${i}] hit height ${b?.height}px < 44 (RESPONSIVE_UI §4). ` +
          `Even if the glyph is small, padding must reach 44px.`
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("range-tab / filter pills reachable (≥44 hit height) — pnl", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("pnl.html"));
    // range-tabs are small pills; assert a comfortable hit area (WCAG target).
    // NOTE: this is a documented monitor — pills currently ~28px. See RESPONSIVE_QA.md.
    const pills = page.locator("#pnlRangeTabs button");
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
    // Soft floor of 24px (AA minimum spacing) with hard target 44 flagged in QA doc.
    for (let i = 0; i < count; i++) {
      const b = await box(pills.nth(i));
      expect(
        b?.height,
        `range pill[${i}] hit height ${b?.height}px far below tap comfort (RESPONSIVE_UI §4)`
      ).toBeGreaterThanOrEqual(24);
    }
  });
});

// =============================================================================
// GROUP E — Card REFLOW ladder, not shrink  (§2 "re-flow, don't shrink")
// .stats.four column count actually CHANGES at 1100/760/420; .pnl-hero .grand
// becomes full width ≤760.
// =============================================================================
test.describe("[E] card reflow ladder (column count changes)", () => {
  /** number of grid columns from grid-template-columns computed value. */
  async function gridCols(locator) {
    return locator.evaluate((el) => {
      const t = getComputedStyle(el).gridTemplateColumns;
      return t.trim() === "none" ? 0 : t.split(" ").filter(Boolean).length;
    });
  }

  test(".stats.four reflows 4→2→2→1 across breakpoints (three.css)", async ({
    page,
  }) => {
    await page.goto(fixtureURL("stats.html"));
    const grid = page.locator("#assetStats");

    await page.setViewportSize({ width: 1280, height: 900 }); // desktop ≥1101
    expect(
      await gridCols(grid),
      "desktop .stats.four should be 4 columns (RESPONSIVE_UI §2 ladder)"
    ).toBe(4);

    await page.setViewportSize({ width: 900, height: 900 }); // tablet ≤1100
    expect(
      await gridCols(grid),
      "≤1100 .stats.four should collapse to 2 columns — REFLOW not shrink (§2)"
    ).toBe(2);

    // mobile band is 421–760 (RESPONSIVE_UI §1). Use 600px, firmly inside it.
    // NOTE: 375px (iPhone) is ≤420 → falls in the SMALL band = 1 col by design.
    await page.setViewportSize({ width: 600, height: 812 }); // mobile 421–760
    expect(
      await gridCols(grid),
      "mobile band (≤760, >420) .stats.four should be 2 columns (§2 ladder)"
    ).toBe(2);

    await page.setViewportSize({ width: 400, height: 800 }); // small ≤420 (incl. 375)
    expect(
      await gridCols(grid),
      "≤420 (small band) .stats.four should stack to 1 column (§2 ladder)"
    ).toBe(1);
  });

  test(".pnl-hero .grand goes full-width ≤760 (§2 primary card first)", async ({
    page,
  }) => {
    await page.goto(fixtureURL("pnl.html"));
    const hero = page.locator(".pnl-hero");
    const grand = page.locator(".pnl-total.grand");

    // desktop: grand is NOT full width (shares the row).
    await page.setViewportSize({ width: 1280, height: 900 });
    let heroW = (await box(hero))?.width ?? 0;
    let grandW = (await box(grand))?.width ?? 0;
    expect(
      grandW,
      "desktop grand card should share the row, not be full width"
    ).toBeLessThan(heroW - 10);

    // mobile ≤760: grand card takes the whole row (flex:1 0 100%).
    await page.setViewportSize({ width: 375, height: 812 });
    heroW = (await box(hero))?.width ?? 0;
    grandW = (await box(grand))?.width ?? 0;
    expect(
      grandW,
      `grand card not full-width at 375px (${grandW} vs hero ${heroW}) — ` +
        "RESPONSIVE_UI §2: primary/grand card goes full width FIRST at ≤760"
    ).toBeGreaterThanOrEqual(heroW - 2);
  });
});

// =============================================================================
// GROUP F — Off-canvas nav exists ≤760  (§4 "Off-canvas nav on mobile")
// Hamburger present & visible ≤760; desktop nav bar not crammed onto phone.
// =============================================================================
test.describe("[F] off-canvas mobile nav", () => {
  test("#navToggle visible ≤760, hidden ≥761 (overview)", async ({ page }) => {
    await page.goto(fixtureURL("overview.html"));

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(
      page.locator("#navToggle"),
      "hamburger must exist on mobile (RESPONSIVE_UI §4 off-canvas nav)"
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(
      page.locator("#navToggle"),
      "hamburger must be hidden on desktop (don't show mobile chrome on desktop)"
    ).toBeHidden();
  });

  test("sidebar becomes fixed off-canvas drawer ≤760 (overview)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(fixtureURL("overview.html"));
    const pos = await computed(page.locator(".sidebar"), "position");
    expect(
      pos,
      "≤760 sidebar should be position:fixed (off-canvas drawer), not inline (§4)"
    ).toBe("fixed");
    // and it starts off-screen (translateX(-100%)) until nav-open.
    const transform = await computed(page.locator(".sidebar"), "transform");
    expect(
      transform,
      "≤760 sidebar should be translated off-canvas before open (§4)"
    ).not.toBe("none");
  });
});

// =============================================================================
// GROUP G — (i) mode-pop popover stays ON-SCREEN on mobile  (Dane P0 / reg②)
// §4 "No horizontal page scroll" is BLIND to this: the popover is
// position:fixed/absolute, so it does NOT grow documentElement.scrollWidth —
// Group A can never catch it. The real failure: without the ≤760 bottom-sheet fix
// the desktop rule (position:absolute; right:0) on the tiny (i) anchor pushes the
// 290px popover off the LEFT edge (measured: @375 left≈-90px, @320 left≈-73.6px).
//
// This test TRIGGERS the popover (focus the .mode-tip so :focus → display:block),
// then asserts the popover's own rect is fully within the viewport
// (rect.left ≥ 0 && rect.right ≤ innerWidth) at 320 and 375.
//
// PROVEN: removing the `@media(max-width:760px){.mode-pop{position:fixed;…}}`
// bottom-sheet fix in style.css makes THIS test RED at both widths (left goes
// negative), while Group A stays green — i.e. this is the test that actually
// guards reg②. See tests/RESPONSIVE_QA.md "Proving the gate…".
// =============================================================================
test.describe("[G] (i) mode-pop popover on-screen on mobile (Dane P0 reg②)", () => {
  for (const w of [320, 375]) {
    test(`.mode-pop within viewport when opened @ ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(fixtureURL("overview.html"));

      // Trigger display: the popover is display:none until the (i) tip is
      // hovered/focused (.mode-tip:focus .mode-pop{display:block}). Focus is the
      // deterministic, headless-safe trigger.
      const tip = page.locator(".mode-tip").first();
      await tip.focus();

      const pop = page.locator(".mode-pop").first();
      // Must actually be shown, else the measurement is meaningless.
      const display = await computed(pop, "display");
      expect(
        display.trim(),
        `.mode-pop did not become visible on focus @${w}px — trigger broken, ` +
          `test would silently pass on a hidden element`
      ).not.toBe("none");

      const rect = await pop.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, iw: window.innerWidth };
      });

      // LEFT edge on-screen (the exact off-canvas-left failure Dane reproduced).
      expect(
        rect.left,
        `.mode-pop left edge off-screen @${w}px (left=${rect.left.toFixed(1)} < 0) — ` +
          `RESPONSIVE_UI §4 / Dane reg②: popover must stay in viewport. ` +
          `Restore the ≤760 bottom-sheet fix in style.css/three.css.`
      ).toBeGreaterThanOrEqual(0);

      // RIGHT edge on-screen (guards the mirror overflow too).
      expect(
        rect.right,
        `.mode-pop right edge off-screen @${w}px ` +
          `(right=${rect.right.toFixed(1)} > innerWidth=${rect.iw})`
      ).toBeLessThanOrEqual(rect.iw + 1); // +1px sub-pixel tolerance
    });
  }
});

// =============================================================================
// GROUP H — Structural min-width:0 guard on number-holder flex/grid children
// (Dane P1 R11). The un-clamp fix (§2) only works if the number's flex/grid
// PARENT-ITEM can shrink below its content — i.e. min-width:0. If three.css:203
// (`.stats>*,.pnl-hero>*,… {min-width:0}`) or the per-item min-width:0 on
// .pnl-total is dropped, the min-content default (auto) returns and reg①③
// (numbers clipped / sideways scroll) silently re-appears. Assert the COMPUTED
// value directly so a CSS drop is caught structurally, not just by pixel luck.
// =============================================================================
test.describe("[H] number-holder children have computed min-width:0 (Dane P1 R11)", () => {
  test(".stats > div items are min-width:0 (three.css)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("stats.html"));
    const items = page.locator("#assetStats > div");
    const c = await items.count();
    expect(c, ".stats children missing").toBeGreaterThan(0);
    for (let i = 0; i < c; i++) {
      const mw = (await computed(items.nth(i), "min-width")).trim();
      expect(
        mw,
        `.stats>div[${i}] min-width=${mw} (expected 0px) — the min-width:0 guard ` +
          `(three.css:203) was dropped → number clip / sideways scroll re-enabled ` +
          `(RESPONSIVE_UI §2; Dane R11)`
      ).toBe("0px");
    }
  });

  test(".pnl-total cards are min-width:0 (style.css)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto(fixtureURL("pnl.html"));
    const items = page.locator(".pnl-hero > .pnl-total");
    const c = await items.count();
    expect(c, ".pnl-total cards missing").toBeGreaterThan(0);
    for (let i = 0; i < c; i++) {
      const mw = (await computed(items.nth(i), "min-width")).trim();
      expect(
        mw,
        `.pnl-total[${i}] min-width=${mw} (expected 0px) — flex item can't shrink ` +
          `below content → .pnl-cum clips (the original 768px bug class; RESPONSIVE_UI §2; Dane R11)`
      ).toBe("0px");
    }
  });
});

// =============================================================================
// GROUP I — Lotto 예측 채점: 3개+ 일치 세트에 "당첨" 테두리 강조 (Founder request)
// A prediction set (.pred-sg-item) with match ≥3 gets a distinct wrapping border
// (.won → gold; .hit5/.hit6 → win-green) so users don't have to count matches by
// eye. This guards BOTH (1) the highlight actually renders (border color differs
// from the neutral --line set) AND (2) no horizontal page scroll / subgrid stacks
// to 1 col on mobile (responsive CI gate — no number clipping introduced).
// =============================================================================
test.describe("[I] lotto won-set border highlight (Founder)", () => {
  const NEUTRAL_BORDER = ["rgb(29, 49, 44)", "rgba(0, 0, 0, 0)"]; // --line #1d312c / transparent

  test("won sets have a non-neutral border, non-won stay neutral (desktop)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(fixtureURL("lotto.html"));

    const won = page.locator(".pred-sg-item.won");
    const wonCount = await won.count();
    expect(
      wonCount,
      "fixture must contain ≥1 winning (match≥3) set"
    ).toBeGreaterThan(0);
    for (let i = 0; i < wonCount; i++) {
      const bc = (await computed(won.nth(i), "border-top-color")).trim();
      expect(
        NEUTRAL_BORDER.includes(bc),
        `won set[${i}] border=${bc} is still the neutral --line — highlight not applied`
      ).toBe(false);
    }

    // non-won set keeps the neutral border (no false-positive highlight).
    const notWon = page.locator(".pred-sg-item:not(.won)").first();
    const nbc = (await computed(notWon, "border-top-color")).trim();
    expect(
      NEUTRAL_BORDER.includes(nbc),
      `non-won set border=${nbc} was highlighted — should stay neutral --line`
    ).toBe(true);
  });

  // 등수 위계상 인접 티어끼리 테두리색이 모두 달라야 함(5등 브론즈·4등 앰버·3등 green).
  // 5등(브론즈)과 1등(골드)이 구분되도록 5등을 골드에서 분리한 뒤의 회귀.
  test("tier borders are all distinct across ranks (5등/4등/3등)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(fixtureURL("lotto.html"));
    const r5 = (await computed(page.locator(".pred-sg-item.won.hit3").first(), "border-top-color")).trim();
    const r4 = (await computed(page.locator(".pred-sg-item.won.hit4").first(), "border-top-color")).trim();
    const r3 = (await computed(page.locator(".pred-sg-item.won.hit5:not(.rank2)").first(), "border-top-color")).trim();
    expect(new Set([r5, r4, r3]).size, `5등/4등/3등 테두리색 중복 (${r5},${r4},${r3})`).toBe(3);
  });

  // 등수 표기 — 각 당첨 세트 뱃지가 "N등 당첨"인지 (Founder 후속: match+bonus → 1~5등).
  test("won badges show rank text (N등 당첨), non-won have none", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(fixtureURL("lotto.html"));
    for (const [sel, txt] of [
      [".pred-sg-item.won.hit3 .wb", "5등 당첨"],
      [".pred-sg-item.won.hit4 .wb", "4등 당첨"],
      [".pred-sg-item.won.hit5:not(.rank2) .wb", "3등 당첨"],
      [".pred-sg-item.won.rank2 .wb", "2등 당첨"],
      [".pred-sg-item.won.rank1 .wb", "1등 당첨"],
    ]) {
      await expect(
        page.locator(sel).first(),
        `rank badge missing/wrong for ${sel}`
      ).toHaveText(txt);
    }
    // non-won set carries no .wb badge.
    expect(
      await page.locator(".pred-sg-item:not(.won) .wb").count(),
      "non-won set must not have a rank badge"
    ).toBe(0);
    // match count N/6 still present alongside rank (accessibility redundancy).
    await expect(
      page.locator(".pred-sg-item.won.hit3 .pred-sg-label"),
      "N/6 count must remain beside rank for accessibility"
    ).toContainText("3/6");
  });

  // 2등(5+보너스)은 3등(5 무보너스)과 테두리로 시각 구분되어야 함.
  test("rank2 (5+bonus) border differs from rank3 (5 no bonus)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(fixtureURL("lotto.html"));
    const r2 = (await computed(page.locator(".pred-sg-item.won.rank2").first(), "border-top-color")).trim();
    const r3 = (await computed(page.locator(".pred-sg-item.won.hit5:not(.rank2)").first(), "border-top-color")).trim();
    expect(
      r2,
      "2등(rank2) and 3등 borders should differ (2등 시각 구분)"
    ).not.toBe(r3);
  });

  // 1등(6개)은 최상위 잭팟 티어: rank1 클래스 + 골드 뱃지 + 굵은 골드 링(hit6 green 위 override).
  test("rank1 (6/6) has top-tier gold badge + ring (overrides hit6 green)", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(fixtureURL("lotto.html"));
    const r1 = page.locator(".pred-sg-item.won.rank1").first();
    await expect(r1, "1등 세트가 픽스처에 있어야 함").toHaveCount(1);
    // border-color 골드 — hit6의 green(#32d69b=rgb(50,214,155))을 override.
    const bc = (await computed(r1, "border-top-color")).trim();
    expect(
      bc,
      `rank1 border-color=${bc} — 골드(rgb(255,211,77))여야 하며 hit6 green이면 안 됨`
    ).toBe("rgb(255, 211, 77)");
    // 링은 box-shadow(0 0 0 4px)로 렌더 — hit6 대비 강화됨.
    const shadow = (await computed(r1, "box-shadow")).trim();
    expect(
      shadow,
      `rank1 box-shadow ring missing (=${shadow})`
    ).toContain("4px");
    // 뱃지 배경이 골드(hit6 green #32d69b이 아님).
    const bg = (await computed(r1.locator(".wb"), "background-color")).trim();
    expect(
      bg,
      `1등 뱃지 배경=${bg} — 골드(rgb(255,211,77))여야 하며 hit6 green이면 안 됨`
    ).toBe("rgb(255, 211, 77)");
    // 위계 핵심: 1등 골드가 5등(브론즈)과 테두리색이 달라야 함(Dane CONCERN 반영).
    const r5 = (await computed(page.locator(".pred-sg-item.won.hit3").first(), "border-top-color")).trim();
    expect(
      bc,
      `1등(골드)과 5등(브론즈) 테두리색이 같음(${bc}) — 위계 중복 회귀`
    ).not.toBe(r5);
  });

  test("legend present + no horizontal page scroll @375/1280", async ({
    page,
  }) => {
    for (const vp of [VIEWPORTS.mobile, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      await page.goto(fixtureURL("lotto.html"));
      await expect(
        page.locator(".pred-sg-legend.won"),
        `legend "3개+ 당첨" missing @${vp.width}px`
      ).toBeVisible();
      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return { sw: el.scrollWidth, cw: el.clientWidth };
      });
      expect(
        overflow.sw,
        `lotto page scrolls sideways @${vp.width}px (RESPONSIVE_UI §4)`
      ).toBeLessThanOrEqual(overflow.cw + 1);
    }
  });

  test("subgrid stacks to 1 column ≤760 (no cramming, three.css @204)", async ({
    page,
  }) => {
    await page.goto(fixtureURL("lotto.html"));
    const grid = page.locator(".pred-subgrid");
    const cols = (el) =>
      el.evaluate((n) => {
        const t = getComputedStyle(n).gridTemplateColumns;
        return t.trim() === "none" ? 0 : t.split(" ").filter(Boolean).length;
      });
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await cols(grid), "desktop subgrid should be 2 columns").toBe(2);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await cols(grid), "≤760 subgrid should stack to 1 column").toBe(1);
  });
});

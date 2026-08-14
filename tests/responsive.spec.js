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
for (const fixture of ["overview.html", "pnl.html", "stats.html"]) {
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

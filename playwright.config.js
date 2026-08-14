// @ts-check
const { defineConfig } = require("@playwright/test");

/**
 * Responsive regression config for stock.ipe.rest.
 *
 * Why fixtures (file://) instead of the live dashboard?
 * The dashboard is passphrase-gated (index.html redirects to a login shell until
 * unlocked), so a headless run can never reach the real cards. Instead each spec
 * loads a deterministic fixture HTML that mounts the *real* markup (copied from the
 * JS injectors in app.js/pnl.js/positions.js/...) with the *real* CSS
 * (style.css + three.css) via <link>. This makes the checks decisive and
 * offline — no network, no login, no data.json drift — while still exercising the
 * exact classes/breakpoints RESPONSIVE_UI.md governs.
 */
module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    // fixtures are loaded via file:// per-test (page.goto with a file URL);
    // no baseURL/webServer needed.
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ isMobile: true, hasTouch: true });
    await page.route('https://**/*', route => route.abort());
    const pages = ['index.html', ...fs.readdirSync('public/pages').filter(file => file.endsWith('.html')).map(file => `pages/${file}`)];
    let checked = 0;
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const file of pages) {
        await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:4000'}/${file}`, { waitUntil: 'domcontentloaded' });
        const toggle = page.locator('#menuToggle, #mobile-menu, #ham-btn, #portal-menu-toggle').first();
        if (!await toggle.count()) continue;
        await toggle.click();
        await page.waitForTimeout(350);
        const menu = page.locator('.mw-nav-menu.open, .mw-nav-menu.active, #mobile-nav.open');
        assert.equal(await menu.count(), 1, `${file} at ${width}px: menu must open`);
        const links = await menu.locator('a').evaluateAll(anchors => anchors.map(anchor => {
          const rect = anchor.getBoundingClientRect();
          const menu = anchor.closest('.mw-nav-menu, #mobile-nav').getBoundingClientRect();
          const x = rect.x + rect.width / 2;
          const y = rect.y + rect.height / 2;
          return {
            label: anchor.textContent,
            contained: rect.top >= menu.top && rect.bottom <= menu.bottom + 1,
            reachable: anchor.contains(document.elementFromPoint(x, y)),
            withinScreen: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
            tapHeight: rect.height
          };
        }));
        assert.equal(links.length, 5, `${file}: expected five navigation links`);
        for (const link of links) {
          assert(link.contained && link.reachable && link.withinScreen && link.tapHeight >= 44,
            `${file} at ${width}px: ${link.label} is clipped or not tappable (${JSON.stringify(link)})`);
        }
        checked++;
      }
    }
    console.log(`Mobile navbar checks passed: ${checked} page/viewport combinations; all five links visible and tappable.`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

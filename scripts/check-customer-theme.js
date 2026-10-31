const fs = require('node:fs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const files = fs.readdirSync('public/pages').filter(file => file.endsWith('.html') && fs.readFileSync('public/pages/' + file, 'utf8').includes('/assets/css/customer-theme.css'));
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      for (const file of files) {
        await page.goto('http://127.0.0.1:4173/pages/' + file, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(150);
        const styles = await page.evaluate(() => ({
          font: getComputedStyle(document.body).fontFamily,
          footer: getComputedStyle(document.querySelector('footer')).backgroundColor,
          overflow: document.documentElement.scrollWidth > innerWidth
        }));
        assert(styles.font.includes('Poppins'), file + ' font');
        assert.equal(styles.footer, 'rgb(16, 24, 40)', file + ' footer');
        assert.equal(styles.overflow, false, file + ' overflow at ' + width);
        const booking = page.locator('.customer-booking-button');
        assert.equal(await booking.count(), file === 'mechanic.html' ? 0 : 1, file + ' booking button');
        if (file !== 'mechanic.html') {
          assert.equal(await booking.getAttribute('href'), '/pages/mechanic.html');
          assert.equal(await booking.isVisible(), true);
          const accessible = await booking.evaluate(element => {
            const r = element.getBoundingClientRect();
            return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          assert(accessible, file + ' booking button clipped or covered at ' + width);
        }
        if (['service.html', 'about.html', 'contact.html', 'shop.html', 'restore.html', 'payment.html'].includes(file)) {
          await page.screenshot({ path: `artifacts/frontend/theme-${file}-${width}.png`, fullPage: true });
        }
      }
      console.log(`${files.length} customer pages: theme and layout checks passed at ${width}px.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('https://photon.komoot.io/api/**', route => route.fulfill({
        json: { features: [
          { properties: { name: 'Outside India', state: 'Uttar Pradesh', countrycode: 'US' } },
          { properties: { name: 'Delhi result', state: 'Delhi', countrycode: 'IN' } },
          { properties: { name: 'Missing state', countrycode: 'IN' } },
          { properties: { name: 'Meja Road', city: 'Prayagraj', state: 'Uttar Pradesh', country: 'India', countrycode: 'IN' }, geometry: { coordinates: [82.0843, 25.2176] } }
        ] }
      }));
      await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
      const input = page.locator('#locationInput');
      await input.fill('meja');
      await page.locator('#location-results li').waitFor();
      assert.equal(await page.locator('#location-results li').count(), 1);
      await page.screenshot({ path: `artifacts/frontend/live-location-${width}.png` });
      await input.press('ArrowDown');
      await input.press('Enter');
      assert.equal(await input.inputValue(), 'Meja Road, Prayagraj, Uttar Pradesh, India');
      assert.equal(await input.getAttribute('aria-expanded'), 'false');
      await input.fill('meja');
      await page.locator('#location-results li').waitFor();
      await page.locator('#location-results li').click();
      assert.equal(await input.inputValue(), 'Meja Road, Prayagraj, Uttar Pradesh, India');
      await page.unroute('https://photon.komoot.io/api/**');
      await page.route('https://photon.komoot.io/api/**', route => route.fulfill({
        json: { features: [{ properties: { name: 'Delhi', state: 'Delhi', countrycode: 'IN' } }] }
      }));
      await input.fill('delhi');
      await page.getByText('No matching places in Uttar Pradesh.', { exact: false }).waitFor();
      assert.equal(await page.locator('#location-results li').count(), 0);
      await page.unroute('https://photon.komoot.io/api/**');
      await page.route('https://photon.komoot.io/api/**', route => route.fulfill({ status: 503, body: '' }));
      await input.fill('unknown');
      await page.getByText('Location search unavailable.', { exact: false }).waitFor();
      await input.press('Escape');
      assert.equal(await input.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#marquee-toggle, .brand-heading, datalist').count(), 0);
      assert.equal(await page.locator('#locationButton').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const moving = await page.locator('.brand-loop').evaluate(async element => {
        const start = getComputedStyle(element).transform;
        await new Promise(resolve => setTimeout(resolve, 250));
        return start !== getComputedStyle(element).transform;
      });
      assert(moving);
      console.log(`${width}px: live-search UI, selection, failure fallback and marquee passed (mock API).`);
      await page.close();

      const bookingPage = await browser.newPage({ viewport: { width, height: 900 } });
      await bookingPage.route('https://photon.komoot.io/api/**', route => route.fulfill({
        json: { features: [{ properties: { name: 'Meja Road', city: 'Prayagraj', state: 'Uttar Pradesh', country: 'India', countrycode: 'IN' }, geometry: { coordinates: [82.0843, 25.2176] } }] }
      }));
      await bookingPage.goto('http://127.0.0.1:4173/pages/mechanic.html', { waitUntil: 'domcontentloaded' });
      const bookingLocation = bookingPage.locator('#message');
      assert.equal(await bookingLocation.evaluate(element => element.tagName), 'INPUT');
      await bookingLocation.fill('meja');
      await bookingPage.locator('#location-results li').waitFor();
      await bookingLocation.press('ArrowDown');
      await bookingLocation.press('Enter');
      assert.equal(await bookingLocation.inputValue(), 'Meja Road, Prayagraj, Uttar Pradesh, India');
      assert.equal(await bookingLocation.getAttribute('aria-expanded'), 'false');
      assert.equal(await bookingPage.locator('#getLocationBtn').isVisible(), true);
      assert.equal(await bookingPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await bookingPage.screenshot({ path: `artifacts/frontend/mechanic-location-${width}.png` });
      console.log(`${width}px: mechanic booking location input and selection passed (mock API).`);
      await bookingPage.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

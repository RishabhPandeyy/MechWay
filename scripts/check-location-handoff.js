const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const mode of ['suggestion', 'current-location']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (mode === 'current-location') {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 25.4358, longitude: 81.8463 });
      }
      const page = await context.newPage();
      await page.route('https://photon.komoot.io/api/**', route => route.fulfill({ json: {
        features: [{ properties: { name: 'Civil Lines', city: 'Prayagraj', state: 'Uttar Pradesh', country: 'India', countrycode: 'IN' }, geometry: { coordinates: [81.8463, 25.4358] } }]
      } }));
      await page.goto('http://127.0.0.1:4000/index.html', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-vehicle="bike"]').first().click();
      await page.selectOption('#serviceSelect', 'Tyre Puncture Repair');
      if (mode === 'suggestion') {
        await page.fill('#locationInput', 'civil');
        await page.locator('#location-results li').click();
      } else {
        await page.locator('#locationButton').click();
        await page.waitForFunction(() => document.querySelector('#locationInput').value.startsWith('Current location:'));
      }
      await page.locator('#bookingSubmit').click();
      await page.waitForURL('**/pages/mechanic.html?**');
      const url = new URL(page.url());
      assert.equal(url.searchParams.get('latitude'), '25.4358');
      assert.equal(url.searchParams.get('longitude'), '81.8463');
      assert.equal(await page.evaluate(() => window.userLat), 25.4358);
      assert.equal(await page.evaluate(() => window.userLng), 81.8463);
      assert((await page.locator('#message').inputValue()).length > 0);
      await page.fill('#name', 'Test Customer');
      await page.fill('#phone', '9876543210');
      await page.locator('#submit-booking-btn').click();
      await page.locator('#confirmation-modal.active').waitFor();
      console.log(`${mode}: coordinates retained and confirmation opened.`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

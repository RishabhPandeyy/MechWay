const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.ASSISTANT_TEST_URL || 'http://localhost:4000';
const pages = ['/', '/pages/service.html', '/pages/why-us.html', '/pages/mechanic.html', '/pages/startrestoration.html', '/pages/contact.html', '/pages/about.html', '/pages/shop.html', '/pages/restore.html', '/pages/book.html', '/pages/blog-oil-change.html', '/pages/blog-battery-signs.html'];
const feature = (name, state = 'Uttar Pradesh') => ({ type: 'Feature', properties: { name, state, city: 'Prayagraj', countrycode: 'IN' }, geometry: { type: 'Point', coordinates: [81.84, 25.43] } });
const next = page => page.locator('.ba-next').click();
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return date.toLocaleDateString('en-CA'); };

async function getToLocation(page, vehicle = 'Bike', scheduled = false) {
  await page.locator('.ba-launcher').click();
  await page.locator('[data-ba-reset]').click();
  await page.locator(`[name="ba-vehicle"][value="${vehicle}"]`).check();
  await next(page);
  await page.locator('#ba-service').selectOption('Battery Issue');
  await next(page);
  if (scheduled) {
    await page.locator('[name="ba-mode"][value="timeslot"]').check();
    await page.locator('#ba-date').fill(tomorrow());
    await page.locator('#ba-slot').selectOption('morning');
  }
  await next(page);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 25.43, longitude: 81.84 } });
    await context.route('https://photon.komoot.io/**', route => {
      if (route.request().url().includes('offline')) return route.fulfill({ status: 503, body: 'Unavailable' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [feature('Meja Road'), feature('Delhi', 'Delhi')] }) });
    });
    let writes = 0;
    await context.route('**/api/**', route => {
      if (route.request().method() === 'POST') { writes++; return route.abort(); }
      return route.fallback();
    });
    const page = await context.newPage();
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await page.locator('.ba-launcher').click();
      assert.equal(await page.locator('#ba-dialog').evaluate(dialog => dialog.open), true, path);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ba-dialog').evaluate(dialog => dialog.open), false, path);
      assert.equal(await page.locator('.ba-launcher').evaluate(button => document.activeElement === button), true, path);
    }

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.ba-launcher').click();
    await page.locator('[data-ba-reset]').click();
    await next(page);
    assert.equal(await page.locator('.ba-error').textContent(), 'Please select Bike or Car.');
    await page.locator('[data-ba-close]').click();
    await getToLocation(page, 'Bike', true);
    await page.locator('#ba-location').fill('Meja');
    await page.locator('.ba-result').first().waitFor();
    assert.equal(await page.locator('.ba-result').count(), 1, 'Only Uttar Pradesh suggestions');
    await page.locator('#ba-location').press('ArrowDown');
    await page.locator('#ba-location').press('Enter');
    assert.match(await page.locator('#ba-location').inputValue(), /Meja Road/);
    await next(page);
    assert.match(await page.locator('.ba-fee').textContent(), /199/);
    await page.locator('[data-ba-back]').click();
    assert.match(await page.locator('#ba-location').inputValue(), /Meja Road/);
    await next(page);
    await Promise.all([page.waitForURL('**/pages/mechanic.html?**'), next(page)]);
    assert.equal(await page.locator('#vehicle-type').inputValue(), 'Bike');
    assert.equal(await page.locator('#problem').inputValue(), 'Battery Issue');
    assert.equal(await page.locator('#service-type').inputValue(), 'timeslot');
    assert.equal(await page.locator('#booking-date').inputValue(), tomorrow());
    assert.equal(await page.locator('#time-slot').inputValue(), 'morning');
    assert.deepEqual(await page.evaluate(() => [userLat, userLng]), [25.43, 81.84]);

    await page.locator('#name').fill('Test Driver');
    const originalUrl = page.url();
    await getToLocation(page, 'Car');
    await page.locator('#ba-current').click();
    await page.locator('.ba-status').filter({ hasText: 'Current location added.' }).waitFor();
    await page.locator('#ba-location').fill('Civil Lines, Prayagraj');
    await next(page);
    await next(page);
    assert.equal(page.url(), originalUrl, 'Same-page prefilling does not navigate');
    assert.equal(await page.locator('#name').inputValue(), 'Test Driver');
    assert.equal(await page.locator('#vehicle-type').inputValue(), 'Car');
    assert.equal(await page.locator('#service-type').inputValue(), 'emergency');
    assert.equal(await page.locator('#message').inputValue(), 'Civil Lines, Prayagraj');
    assert.equal(await page.locator('#estimated-price').textContent(), '279');
    assert.deepEqual(await page.evaluate(() => [userLat, userLng]), ['', ''], 'Typed address clears stale coordinates');

    await getToLocation(page);
    await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (success, failure) => failure({ code: 1 }); });
    await page.locator('#ba-current').click();
    assert.match(await page.locator('.ba-status').textContent(), /enter your address/);
    await page.locator('#ba-location').fill('offline address');
    await page.locator('.ba-status').filter({ hasText: 'Search unavailable.' }).waitFor();
    await next(page);
    assert.match(await page.locator('.ba-summary').textContent(), /offline address/);
    await page.locator('[data-ba-close]').click();

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const overlaps = await page.evaluate(() => {
        const a = document.querySelector('.ba-launcher').getBoundingClientRect(), b = document.querySelector('.mobile-booking-bar').getBoundingClientRect();
        return b.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      });
      assert.equal(overlaps, false, 'Launcher avoids the mobile booking bar');
      await getToLocation(page, 'Car', true);
      await page.locator('#ba-location').fill('Meja');
      await page.locator('.ba-result').first().waitFor();
      await page.locator('.ba-result').first().click();
      await next(page);
      const fits = await page.locator('#ba-dialog').evaluate(dialog => {
        const box = dialog.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth;
      });
      assert.equal(fits, true, `Dialog fits ${width}px viewport`);
      await page.screenshot({ path: `/tmp/mechway-assistant-review-${width}.png` });
      await page.locator('[data-ba-close]').click();
    }
    assert.equal(writes, 0, 'Assistant only prepares the booking form');
    await context.close();
    console.log('Booking assistant passed: 12 pages, scheduled handoff, current location, UP search, form preservation, errors and responsive review.');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

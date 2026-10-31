const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
let browser;

(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const output = path.resolve(__dirname, '../artifacts/frontend');
  fs.mkdirSync(output, { recursive: true });
  const failures = [];
  const legacyPage = await browser.newPage();
  await legacyPage.goto('http://127.0.0.1:4173/mechanic_new.html?service=Battery%20Issue');
  assert.match(legacyPage.url(), /\/pages\/mechanic\.html\?service=Battery%20Issue$/);
  await legacyPage.close();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.hero-photo').evaluate(img => img.complete && img.naturalWidth > 0), true);
    await page.locator('[data-vehicle="bike"]').click();
    assert.equal(await page.locator('.price-table tr[data-service="Battery Issue"] .rate').innerText(), '₹250');
    assert.equal(await page.locator('#scheduled-fee').innerText(), '₹99');
    await page.locator('input[name="price-vehicle"][value="Car"]').check();
    assert.equal(await page.locator('#emergency-fee').innerText(), '₹199');
    assert.equal(await page.locator('.price-table tr[data-service="Battery Issue"] .rate').innerText(), '₹400');
    await page.locator('input[name="price-vehicle"][value="Bike"]').check();
    assert.match(await page.locator('.price-table tr[data-service="Battery Issue"] a').getAttribute('href'), /vehicleType=Bike/);
    assert.equal(await page.locator('.brand-track img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
    assert.equal(await page.locator('.brand-track img').evaluateAll(images => images.some(img => { const rect = img.getBoundingClientRect(); return rect.left < innerWidth && rect.right > 0; })), true);
    assert.equal(await page.locator('#marquee-toggle').count(), 0);
    assert.equal(await page.locator('.brand-heading').count(), 0);
    await page.selectOption('#serviceSelect', 'Tyre Puncture Repair');
    await page.fill('#locationInput', 'Civil Lines, Prayagraj');
    await page.locator('#locationInput').press('Escape');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const section of await page.locator('main > section').all()) await section.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `home-${viewport.width}.png`), fullPage: true });
    if (viewport.width < 900) {
      await page.locator('#menuToggle').click();
      assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
    }
    await page.locator('#bookingSubmit').click();
    await page.waitForURL('**/pages/mechanic.html?**');
    assert.equal(await page.inputValue('#vehicle-type'), 'Bike');
    assert.equal(await page.inputValue('#problem'), 'Tyre Puncture Repair');
    assert.equal(await page.inputValue('#message'), 'Civil Lines, Prayagraj');
    assert.equal(await page.locator('#vehicle-number').count(), 0);
    assert.equal(await page.locator('#vehicle-color').count(), 0);
    assert.equal(await page.locator('#name').isVisible(), true);
    assert.equal(await page.locator('#name').getAttribute('required'), '');
    await page.locator('#submit-booking-btn').click();
    assert.equal(await page.locator('#name').evaluate(input => input.validity.valid), false);
    await page.fill('#name', 'Test Customer');
    assert.equal(await page.locator('#name').evaluate(input => input.validity.valid), true);
    await page.selectOption('#service-type', 'timeslot');
    assert.equal(await page.locator('#timeslot-row').isVisible(), true);
    await page.selectOption('#service-type', 'emergency');
    assert.equal(await page.locator('#timeslot-row').isVisible(), false);
    await page.locator('.optional-details summary').click();
    assert.equal(await page.locator('#vehicle-brand').isVisible(), true);
    await page.locator('.optional-details summary').click();
    await page.screenshot({ path: path.join(output, `booking-${viewport.width}.png`), fullPage: true });
    await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '25.4358', lon: '81.8463', display_name: 'Civil Lines, Prayagraj' }] }));
    await page.fill('#phone', '9876543210');
    await page.fill('#message', 'Civil Lines, Prayagraj');
    await page.locator('#submit-booking-btn').click();
    await page.locator('#confirmation-modal').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#confirmation-modal').isVisible(), true);
    await page.locator('#confirmation-modal .modal-x').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const routes = require('../public/routes.json');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const route of Object.values(routes)) {
    const errors = [];
    const handler = error => errors.push(error.message);
    page.on('pageerror', handler);
    await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (['/pages/service.html', '/pages/contact.html', '/pages/mech-login.html', '/pages/payment.html'].includes(route)) await page.screenshot({ path: path.join(output, path.basename(route, '.html') + '-mobile.png'), fullPage: true });
    if (overflow || errors.length) {
      const wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })));
      failures.push({ route, overflow, errors, wideElements });
    }
    page.off('pageerror', handler);
  }
  await browser.close();
  console.log(JSON.stringify({ screenshots: output, pageProblems: failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });

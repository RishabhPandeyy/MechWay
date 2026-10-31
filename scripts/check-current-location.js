const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

async function main() {
  const app = express();
  app.use(express.static(path.join(__dirname, '../public')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const cases = [
      { name: 'permission denied', codes: [1], title: 'Location access blocked', attempts: 1 },
      { name: 'GPS timeout fallback', codes: [3, 0], title: 'Location updated', attempts: 2, success: true },
      { name: 'GPS unavailable fallback', codes: [2, 0], title: 'Location updated', attempts: 2, success: true },
      { name: 'both attempts time out', codes: [3, 3], title: 'Location request timed out', attempts: 2 },
      { name: 'position unavailable', codes: [2, 2], title: 'Current location unavailable', attempts: 2 },
      { name: 'fallback permission denied', codes: [3, 1], title: 'Location access blocked', attempts: 2 },
      { name: 'insecure HTTP', insecure: true, codes: [], title: 'Secure connection needed', attempts: 0 },
      { name: 'policy denied', policyBlocked: true, codes: [], title: 'Location blocked on this page', attempts: 0 },
      { name: 'native API throws', throws: true, codes: [], title: 'Location access blocked', attempts: 1 }
    ];
    for (const width of [390, 1280]) {
      for (const test of cases) {
        const page = await browser.newPage({ viewport: { width, height: 844 } });
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(test => {
          window.locationAttempts = [];
          if (test.insecure) Object.defineProperty(window, 'isSecureContext', { value: false });
          if (test.policyBlocked) Object.defineProperty(document, 'permissionsPolicy', { value: { allowsFeature: () => false } });
          Object.defineProperty(navigator, 'geolocation', { value: {
            getCurrentPosition(success, failure, options) {
              const attempt = window.locationAttempts.length;
              window.locationAttempts.push(options);
              if (test.throws) throw new DOMException('Blocked', 'SecurityError');
              const code = test.codes[attempt];
              setTimeout(() => code ? failure({ code }) : success({ coords: { latitude: 25.4358, longitude: 81.8463 } }), 10);
            }
          } });
        }, test);
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
        await page.locator('#locationButton').click();
        await page.waitForFunction(title => document.querySelector('#toastTitle').textContent === title, test.title);
        assert.equal(await page.locator('#locationButton').isEnabled(), true, test.name);
        const attempts = await page.evaluate(() => window.locationAttempts);
        assert.equal(attempts.length, test.attempts, test.name);
        if (test.attempts === 2) assert.deepEqual(attempts.map(o => o.enableHighAccuracy), [true, false]);
        if (test.success) {
          assert.match(await page.locator('#locationInput').inputValue(), /25\.43580, 81\.84630/);
          await page.selectOption('#serviceSelect', 'Tyre Puncture Repair');
          await page.locator('#bookingSubmit').click();
          await page.waitForURL('**/pages/mechanic.html?**');
          assert.equal(new URL(page.url()).searchParams.get('latitude'), '25.4358');
          assert.equal(new URL(page.url()).searchParams.get('longitude'), '81.8463');
        }
        await page.close();
      }
    }
    const context = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 25.4358, longitude: 81.8463 } });
    const page = await context.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#locationButton').click();
    await page.waitForFunction(() => document.querySelector('#toastTitle').textContent === 'Location updated');
    assert.match(await page.locator('#locationInput').inputValue(), /25\.43580, 81\.84630/);
    await context.close();
    console.log('Current-location checks passed: 18 mobile/desktop error and recovery cases, booking coordinate handoff, and granted browser permission.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

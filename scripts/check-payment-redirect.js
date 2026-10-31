const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const callbacks = source.split('\n').filter(line => line.includes('callback_url:'));
  assert.equal(callbacks.length, 2);
  callbacks.forEach(line => assert(line.includes('/pages/booking-confirmed.html'), 'Payment links must use the deployed page path'));
  const app = express();
  app.use(express.static(path.join(__dirname, '../public')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.route('https://**/*', route => route.abort());
      await page.route('**/api/create-order', route => route.fulfill({ json: { key_id: 'mock_key', id: 'mock_order', amount: 19900, currency: 'INR' } }));
      await page.route('**/api/payment', route => route.fulfill({ json: { ok: true, id: 'mock_record' } }));
      await page.addInitScript(() => {
        window.Razorpay = class {
          constructor(options) { this.options = options; }
          open() { this.options.handler({ razorpay_payment_id: 'mock_payment', razorpay_order_id: 'mock_order', razorpay_signature: 'mock_signature' }); }
        };
      });
      const params = new URLSearchParams({ name: 'Test Customer', phone: '9999999999', vehicleType: 'Bike', service: 'General Checkup', servicePrice: '199', bookingId: 'mock_booking' });
      await page.goto(`http://127.0.0.1:${server.address().port}/pages/payment.html?${params}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => launchRazorpayPayment());
      await page.waitForURL('**/pages/booking-confirmed.html?**');
      await page.waitForFunction(() => document.querySelector('#conf-customer-name')?.textContent === 'Test Customer');
      assert.equal(new URL(page.url()).searchParams.get('bookingId'), 'mock_booking');
      assert.equal(await page.locator('#conf-total').textContent(), '\u20b9199.00');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#conf-customer-name')?.textContent === 'Test Customer');
      assert.equal(new URL(page.url()).pathname, '/pages/booking-confirmed.html');
      await page.close();
    }
    console.log('Payment redirect checks passed: two canonical backend callbacks; mobile/desktop checkout success and confirmation refresh (mock payments only).');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

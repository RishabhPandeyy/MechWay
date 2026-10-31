const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        let requests = 0;
        await context.route('**/api/mechanic/**', async route => {
            requests++;
            const reset = route.request().url().endsWith('/reset-password');
            const verify = route.request().url().endsWith('/verify-reset-otp');
            if (verify) {
                assert.deepEqual(route.request().postDataJSON(), { challenge: 'c'.repeat(64), otp: '123456' });
            }
            if (reset) {
                const body = route.request().postDataJSON();
                assert.match(body.token, /^[a-f0-9]{64}$/);
                assert.equal(body.password, 'Test-password-123');
            }
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, challenge: 'c'.repeat(64), token: verify ? 'd'.repeat(64) : undefined, message: reset ? 'Password updated successfully. Please log in with your new password.' : 'If this account has a registered email, a 6-digit OTP will be sent.' }) });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto('about:blank');
            await page.goto(`http://localhost:4000/pages/reset-password.html#token=${'a'.repeat(64)}`);
            assert.equal(new URL(page.url()).hash, '');
            assert.equal(await page.locator('#password-form').isVisible(), true);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.locator('header img').evaluate(image => image.complete && image.naturalWidth > 0), true);
            await page.screenshot({ path: `/tmp/mechway-reset-${width}.png`, fullPage: true });
        }
        await page.locator('#new-password').fill('Test-password-123');
        await page.locator('#confirm-password').fill('Not-matching-123');
        await page.locator('#reset-submit').click();
        assert.match(await page.locator('#reset-status').textContent(), /do not match/);
        assert.equal(requests, 0);
        await page.locator('#confirm-password').fill('Test-password-123');
        await page.locator('#show-password').check();
        assert.equal(await page.locator('#new-password').getAttribute('type'), 'text');
        await page.locator('#reset-submit').click();
        await page.locator('#reset-status.success').waitFor();
        assert.equal(await page.locator('#password-form').isVisible(), false);
        await page.goto('http://localhost:4000/pages/reset-password.html');
        assert.match(await page.locator('#reset-status').textContent(), /invalid/);
        assert.equal(await page.locator('#password-form').isVisible(), false);
        await page.goto('http://localhost:4000/pages/mech-login.html');
        await page.locator('#forgotPasswordBtn').click();
        assert.equal(await page.locator('#forgotPasswordBtn').getAttribute('aria-expanded'), 'true');
        await page.locator('#resetIdentifier').fill('mechanic@example.test');
        await page.locator('#sendResetBtn').click();
        await page.locator('#resetMessage.success').waitFor();
        assert.equal(requests, 2);
        assert.equal(await page.locator('#reset-otp-form').isVisible(), true);
        assert.equal(await page.locator('#sendResetBtn').isDisabled(), true);
        await page.locator('#resetOtp').fill('123456');
        await page.locator('#verifyOtpBtn').click();
        await page.waitForURL('**/pages/reset-password.html*');
        await page.locator('#new-password').fill('Test-password-123');
        await page.locator('#confirm-password').fill('Test-password-123');
        await page.locator('#reset-submit').click();
        await page.locator('#reset-status.success').waitFor();
        assert.equal(requests, 4);
        assert.deepEqual(errors, []);
        console.log('Password reset browser checks passed: desktop/mobile, invalid link, confirmation, success and complete email OTP flow. API requests were mocked.');
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

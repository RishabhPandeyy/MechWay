const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const mechanic = { _id: '507f1f77bcf86cd799439011', name: 'Test Mechanic', phone: '9876543210', isApproved: false };
        const calls = [];
        await context.addInitScript(() => localStorage.setItem('mechwayAdminKey', 'browser-test-only'));
        await context.route('**/api/admin/**', async route => {
            const request = route.request();
            if (request.url().endsWith('/submissions')) {
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, mechanics: [mechanic] }) });
            }
            calls.push({ url: request.url(), body: request.postDataJSON() });
            if (request.url().endsWith('/approve')) mechanic.isApproved = request.postDataJSON().isApproved;
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, message: request.url().endsWith('/approve') ? 'Mechanic verified.' : 'Password updated. Mechanic must log in again.' }) });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://localhost:4000/server/admin.html');
        await page.locator('[data-tab="mechanics"]').click();
        await page.locator('[data-action="approve"]').click();
        assert.equal(await page.locator('#mechanic-action-dialog').evaluate(node => node.open), true);
        assert.match(await page.locator('#mechanic-action-description').textContent(), /log in/);
        await page.locator('#mechanic-action-submit').click();
        await page.locator('#mechanic-action-status.success').waitFor();
        assert.equal(calls[0].body.isApproved, true);
        await page.locator('[data-action="set-password"]').click();
        assert.equal(await page.locator('#mechanic-new-password').getAttribute('type'), 'password');
        await page.locator('#mechanic-new-password').fill('New-password-123');
        await page.locator('#mechanic-action-submit').click();
        await page.locator('#mechanic-action-dialog').waitFor({ state: 'hidden' });
        assert.equal(calls[1].body.newPassword, 'New-password-123');
        assert.equal(calls.length, 2);
        assert.deepEqual(errors, []);
        console.log('Admin mechanic browser checks passed: verification and masked password update. API writes were mocked.');
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

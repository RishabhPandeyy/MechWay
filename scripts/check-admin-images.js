const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const backend = 'https://newonwheels.onrender.com';
        const rows = [
            { _id: '1', vehiclePhotos: { front: '/uploads/restoration/front.png', rear: '/uploads/restoration/missing.png' } },
            { _id: '2', restorationImages: [backend + '/uploads/restoration/legacy.png'] },
            { _id: '3', vehiclePhotos: { left: '/uploads/restoration/left.png' } }
        ];
        const requested = [];
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
        await context.addInitScript(() => localStorage.setItem('mechwayAdminKey', 'test-only'));
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/api/admin/')) {
                assert.equal(url.origin, backend);
                return route.fulfill({ json: { ok: true, restorations: rows, count: rows.length } });
            }
            if (url.pathname.startsWith('/uploads/')) {
                requested.push(url.href);
                assert.equal(url.origin, backend);
                return route.fulfill(url.pathname.includes('missing') ? { status: 404 } : { contentType: 'image/png', body: png });
            }
            if (url.origin === 'https://www.mechway.in') {
                const file = path.resolve(__dirname, '../public', '.' + url.pathname);
                try {
                    return await route.fulfill({ body: await fs.readFile(file), contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
                } catch { return route.fulfill({ status: 404 }); }
            }
            return route.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('https://www.mechway.in/server/admin.html');
        await page.locator('[data-tab="restorations"]').click();
        await page.getByText('Back: Photo unavailable', { exact: true }).waitFor();
        assert.equal(await page.locator('#tbody-restorations img').count(), 3);
        assert.equal(await page.locator('#tbody-restorations img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true);
        assert(requested.includes(backend + '/uploads/restoration/left.png'));
        await page.goto('https://www.mechway.in/server/restoration_admin.html');
        await page.locator('#admin-key').fill('test-only');
        await page.locator('#load').click();
        await page.getByText('3 restorations', { exact: true }).waitFor();
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#list img')).every(img => img.complete && img.naturalWidth > 0));
        assert.equal(await page.locator('#list img').count(), 2);
        assert.deepEqual(errors, []);
        console.log('Admin image browser checks passed: backend URLs, legacy absolute URLs, partial photo sets, loaded thumbnails, and missing-file feedback. Network calls were mocked.');
    } finally {
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

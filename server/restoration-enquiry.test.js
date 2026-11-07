const { test } = require('node:test');
const assert = require('node:assert/strict');
const { budgets, createRestorationEnquiryHandler } = require('./restoration-enquiry');
const { formatSubmission } = require('./telegram-notifications');

function fixture({ saveFails = false, notifyFails = false } = {}) {
    const records = [], messages = [];
    const handler = createRestorationEnquiryHandler({
        RestorationQuote: { async create(record) {
            if (saveFails) throw new Error('Database down');
            const saved = { _id: 'enquiry-123456', ...record };
            records.push(saved);
            return saved;
        } },
        async notify(event, record) {
            assert.equal(records.length, 1, 'save must finish before notification');
            if (notifyFails) throw new Error('Telegram unavailable');
            messages.push(formatSubmission(event, record));
            return { status: 'sent' };
        },
        logger: { error() {} }
    });
    return { records, messages, async submit(body) {
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await handler({ body }, res);
        return res;
    } };
}
const enquiry = { name: ' Test User ', location: ' Prayagraj ', whatsappNumber: '9876543210', vehicleType: 'Bike', budgetOption: '15000' };

test('all six preset budgets save and notify with the correct vehicle and amount', async () => {
    for (const [vehicleType, options] of Object.entries(budgets)) {
        for (const [budgetOption, label] of Object.entries(options)) {
            const f = fixture();
            const res = await f.submit({ ...enquiry, vehicleType, budgetOption });
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.telegramNotification.status, 'sent');
            assert.equal(f.records[0].fullName, 'Test User');
            assert.equal(f.records[0].city, 'Prayagraj');
            assert.equal(f.records[0].whatsappNumber, '9876543210');
            assert(f.messages[0].includes('<b>WhatsApp:</b> 9876543210'));
            assert.equal(f.records[0].budgetRange, label);
            assert.equal(f.records[0].enquirySource, 'restore-quick-form');
            assert(f.messages[0].includes(`<b>Vehicle:</b> ${vehicleType}`));
            assert(f.messages[0].includes(`<b>Budget:</b> ${label}`));
        }
    }
});

test('custom budgets for both vehicles are stored numerically and escaped in Telegram', async () => {
    for (const vehicleType of ['Bike', 'Car']) {
        const f = fixture();
        const res = await f.submit({ ...enquiry, name: '<b>User</b>', vehicleType, budgetOption: 'custom', customBudget: '250000' });
        assert.equal(res.statusCode, 201);
        assert.equal(f.records[0].customBudget, 250000);
        assert.equal(f.records[0].budgetRange, 'Custom: ₹2,50,000');
        assert(f.messages[0].includes('&lt;b&gt;User&lt;/b&gt;'));
    }
});

test('invalid fields and cross-vehicle or forged budgets never save or notify', async () => {
    const invalid = [null, {}, { name: ' ' }, { name: { $gt: '' } }, { whatsappNumber: '' }, { whatsappNumber: '123' }, { whatsappNumber: '1234567890' }, { whatsappNumber: {} }, { location: '' }, { location: 'x'.repeat(301) },
        { vehicleType: 'Truck' }, { vehicleType: '__proto__' }, { budgetOption: '300000-plus' },
        { budgetOption: '__proto__' }, { budgetOption: 'custom' },
        ...['', 0, -1, 1.5, Infinity, 100000001, {}, 'abc'].map(customBudget => ({ budgetOption: 'custom', customBudget }))];
    for (const change of invalid) {
        const f = fixture();
        const res = await f.submit(change === null ? null : Object.keys(change).length ? { ...enquiry, ...change } : {});
        assert.equal(res.statusCode, 400, JSON.stringify(change));
        assert.equal(f.records.length, 0);
        assert.equal(f.messages.length, 0);
    }
});

test('database failure does not send a notification or report success', async () => {
    const f = fixture({ saveFails: true });
    const res = await f.submit(enquiry);
    assert.equal(res.statusCode, 500);
    assert.equal(f.messages.length, 0);
});

test('Telegram failure preserves the saved enquiry and reports delivery status', async () => {
    const f = fixture({ notifyFails: true });
    const res = await f.submit(enquiry);
    assert.equal(res.statusCode, 201);
    assert.equal(f.records.length, 1);
    assert.equal(res.body.telegramNotification.status, 'failed');
});

test('WhatsApp country prefix is normalized before saving', async () => {
    const f = fixture();
    const res = await f.submit({ ...enquiry, whatsappNumber: '+91 98765 43210' });
    assert.equal(res.statusCode, 201);
    assert.equal(f.records[0].whatsappNumber, '9876543210');
    assert.equal(Object.hasOwn(f.records[0], 'mobileNumber'), false);
});

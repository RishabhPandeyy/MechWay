const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { saveSubmission } = require('./submission-request');
const { createRestorationEnquiryHandler } = require('./restoration-enquiry');

function model() {
    const records = new Map();
    return {
        records,
        async findById(id) { return records.get(id) || null; },
        async create(fields) {
            await new Promise(resolve => setImmediate(resolve));
            const _id = fields._id || crypto.randomUUID();
            if (records.has(_id)) throw Object.assign(new Error('Duplicate key'), { code: 11000 });
            const record = { ...fields, _id };
            records.set(_id, record);
            return record;
        }
    };
}

test('five simultaneous retries create one booking; a new request with identical details creates another', async () => {
    const Model = model();
    const id = crypto.randomUUID();
    const fields = { name: 'Test', phone: '9000000000' };
    const results = await Promise.all(Array.from({ length: 5 }, () => saveSubmission(Model, 'booking', id, fields)));
    assert.equal(Model.records.size, 1);
    assert.equal(results.filter(result => result.created).length, 1);
    assert.equal(new Set(results.map(result => result.record._id)).size, 1);
    const retry = await saveSubmission(Model, 'booking', id, fields);
    assert.equal(retry.created, false);
    await saveSubmission(Model, 'booking', crypto.randomUUID(), fields);
    assert.equal(Model.records.size, 2);
});

test('restoration requests and quick enquiries have independent IDs and support retries', async () => {
    const Model = model();
    const id = crypto.randomUUID();
    for (const scope of ['restoration', 'restoration-enquiry']) {
        const first = await saveSubmission(Model, scope, id, { fullName: 'Test' });
        const retry = await saveSubmission(Model, scope, id, { fullName: 'Test' });
        assert.equal(first.created, true);
        assert.equal(retry.created, false);
        assert.equal(first.record._id, retry.record._id);
    }
    assert.equal(Model.records.size, 2);
});

test('invalid IDs fail, legacy clients still save, and failed saves can be retried', async () => {
    const Model = model();
    await assert.rejects(saveSubmission(Model, 'booking', {}, {}), { status: 400 });
    await saveSubmission(Model, 'booking', undefined, {});
    assert.equal(Model.records.size, 1);
    const failing = { ...Model, create: async () => { throw new Error('Unavailable'); } };
    const id = crypto.randomUUID();
    await assert.rejects(saveSubmission(failing, 'booking', id, {}), /Unavailable/);
    assert.equal((await saveSubmission(Model, 'booking', id, {})).created, true);
});

test('browser preserves retry ID across reloads and issues a new ID after success or changed details', () => {
    const data = new Map();
    const context = vm.createContext({ window: {}, crypto: crypto.webcrypto, Uint8Array,
        sessionStorage: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } });
    vm.runInContext(fs.readFileSync(require.resolve('../public/assets/js/submission-request.js'), 'utf8'), context);
    const first = context.window.createSubmissionRequest('restoration');
    const payload = { name: 'Test' };
    const id = first.id(payload);
    assert.equal(first.id(payload), id);
    const reloaded = context.window.createSubmissionRequest('restoration');
    assert.equal(reloaded.id(payload), id);
    reloaded.complete();
    assert.notEqual(reloaded.id(payload), id);
    assert.notEqual(reloaded.id({ name: 'Other' }), reloaded.id(payload));
});

test('quick enquiry retries return the original reference and notify only once', async () => {
    const Model = model();
    let notifications = 0;
    const handler = createRestorationEnquiryHandler({ RestorationQuote: Model,
        notify: async () => { notifications++; return { status: 'sent' }; } });
    const request = { body: { name: 'Test', location: 'Prayagraj', vehicleType: 'Bike',
        budgetOption: '15000', whatsappNumber: '9876543210', requestId: crypto.randomUUID() } };
    const send = async () => {
        const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        await handler(request, response);
        assert.equal(response.body.ok, true);
        return response.body.id;
    };
    const ids = await Promise.all(Array.from({ length: 5 }, send));
    assert.equal(new Set(ids).size, 1);
    assert.equal(notifications, 1);
    assert.equal(Model.records.size, 1);
});

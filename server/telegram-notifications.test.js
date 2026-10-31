const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createTelegramNotifier, formatSubmission } = require('./telegram-notifications');

const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' };
const logger = { error() {} };

test('only safe allowlisted fields appear in submission alerts', () => {
    for (const event of ['booking', 'signup', 'contact', 'payment', 'workSlip', 'profile', 'payout']) {
        const message = formatSubmission(event, {
            _id: 'test-id', name: 'A&B <Mechanic>', phone: '9876543210', customerName: 'A&B <Customer>',
            latitude: 25.43, longitude: 81.84,
            password: 'do-not-send-password', aadharNo: 'do-not-send-aadhar', bankAccountNo: 'do-not-send-bank', razorpaySignature: 'do-not-send-signature'
        });
        assert.match(message, /test-id/);
        assert.match(message, /Open location/);
        assert.doesNotMatch(message, /do-not-send|<Mechanic>|<Customer>/);
    }
    assert.match(formatSubmission('signup', { name: '<b>A&B</b>' }), /&lt;b&gt;A&amp;B&lt;\/b&gt;/);
});

test('long customer input is bounded without cutting escaped entities or HTML tags', () => {
    const message = formatSubmission('contact', { name: '&'.repeat(10000), message: '<'.repeat(10000) });
    assert(message.length < 4096);
    assert.match(message, /\.\.\./);
    assert.doesNotMatch(message, /<script>/);
});

test('Telegram success is acknowledged and diagnostics contain no secrets', async () => {
    let payload;
    const notifier = createTelegramNotifier({ env, logger, post: async (url, body, options) => {
        assert.equal(options.timeout, 8000);
        payload = body;
        return { data: { ok: true } };
    } });
    assert.deepEqual(await notifier.send('hello', 'signup'), { status: 'sent' });
    assert.equal(payload.chat_id, 'test-chat');
    assert.doesNotMatch(JSON.stringify(notifier.getStatus()), /test-token|test-chat|hello/);
    assert.equal(notifier.getStatus().lastDelivery.signup.status, 'sent');
});

test('missing credentials do not attempt network delivery', async () => {
    const notifier = createTelegramNotifier({ env: {}, logger, post: () => { throw new Error('must not call'); } });
    assert.deepEqual(await notifier.send('hello'), { status: 'not_configured', reason: 'missing_credentials' });
});

test('temporary failure retries once', async () => {
    let calls = 0;
    const notifier = createTelegramNotifier({ env, logger, sleep: async () => {}, post: async () => {
        if (++calls === 1) throw { response: { status: 503 } };
        return { data: { ok: true } };
    } });
    assert.equal((await notifier.send('hello')).status, 'sent');
    assert.equal(calls, 2);
});

test('rate limit retry follows Telegram retry_after within the request budget', async () => {
    let calls = 0, waited;
    const notifier = createTelegramNotifier({ env, logger, sleep: async ms => { waited = ms; }, post: async () => {
        if (++calls === 1) return { data: { ok: false, error_code: 429, parameters: { retry_after: 2 } } };
        return { data: { ok: true } };
    } });
    assert.equal((await notifier.send('hello')).status, 'sent');
    assert.equal(waited, 2000);
});

test('permanent and long rate-limit failures do not retry or expose Axios secrets', async () => {
    for (const [code, reason] of [[400, 'invalid_chat_or_message'], [401, 'invalid_bot_token'], [403, 'bot_access_denied'], [429, 'rate_limited']]) {
        let calls = 0;
        const logs = [];
        const notifier = createTelegramNotifier({ env, logger: { error: text => logs.push(text) }, post: async () => {
            calls++;
            throw { secret: 'test-token', response: { status: code, data: { parameters: { retry_after: 60 } } } };
        } });
        assert.deepEqual(await notifier.send('secret-customer-text'), { status: 'failed', reason });
        assert.equal(calls, 1);
        assert.doesNotMatch(logs.join(''), /test-token|secret-customer-text/);
    }
});

function loadRoutes(deliveryOK = true) {
    const sourcePath = path.join(__dirname, '../server.js');
    const realRequire = createRequire(sourcePath);
    const routes = new Map(), messages = [], records = [];
    const app = { use() {} };
    for (const method of ['get', 'post', 'put']) app[method] = (paths, ...handlers) => {
        for (const route of Array.isArray(paths) ? paths : [paths]) routes.set(`${method} ${route}`, handlers);
    };
    const express = () => app;
    express.json = express.static = () => () => {};
    const user = { _id: 'test-mechanic', name: 'Test <Mechanic>', phone: '9876543210', sessionVersion: 0 };
    const models = {};
    const mongoose = { Schema: realRequire('mongoose').Schema, models, connect: async () => {}, model: name => {
        const model = {
            create: async values => { const record = { ...values, _id: `test-${name}` }; records.push(record); return record; },
            findOne: async () => null,
            findById: async () => user,
            findByIdAndUpdate: async (id, values) => ({ ...user, ...values })
        };
        models[name] = model;
        return model;
    } };
    const replacements = {
        './server/restoration-files': { createRestorationFiles: () => ({ async save() {}, async remove() {} }) },
        express, mongoose,
        dotenv: { config() {} },
        fs: { ...fs, mkdirSync() {} },
        http: { createServer: () => ({ listen() {} }) },
        'socket.io': { Server: class { on() {} } },
        bcryptjs: { hash: async () => 'test-hash', compare: async (password, hash) => password === 'correct-password' && hash === 'test-hash' },
        razorpay: class {
            constructor() {
                this.key_id = 'mock-key';
                this.key_secret = 'mock-secret';
                this.paymentLink = { create: async () => ({ short_url: 'https://example.test/payment' }) };
            }
        },
        axios: { post: async (url, body) => { messages.push(body.text); return { data: { ok: deliveryOK, error_code: 400 } }; } }
    };
    vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), {
        require: name => replacements[name] || realRequire(name), __dirname: path.dirname(sourcePath),
        process: { env: { ...env, ADMIN_KEY: 'test-admin', RAZORPAY_KEY_ID: 'mock-key', RAZORPAY_KEY_SECRET: 'mock-secret' } },
        console: { log() {}, error() {} }, Buffer, setTimeout, clearTimeout, URL
    });
    async function invoke(method, pathname, body = {}, extras = {}) {
        const req = { path: pathname, body, query: {}, get: () => '', mechanicAuth: { userId: 'test-mechanic' }, ...extras };
        let result, status = 200;
        const res = { status(code) { status = code; return this; }, json(data) { result = data; } };
        await routes.get(`${method} ${pathname}`).at(-1)(req, res);
        return { status, body: result };
    }
    return { invoke, messages, records, routes, models };
}

test('signup, booking, contact, shop and profile routes await the notification; profile reads do not send', async () => {
    const server = loadRoutes();
    const requests = [
        ['post', '/api/mechanic/signup', { name: 'A&B <Mechanic>', phone: '9876543210', password: 'private-password', email: 'test@example.test', serviceArea: 'Civil Lines' }],
        ['post', '/api/book', { name: 'A&B', phone: '9876543210', vehicleType: 'Bike', message: 'Civil <Lines>' }],
        ['post', '/api/contact', { name: 'A&B', phone: '9876543210', message: '<help>' }],
        ['post', '/api/inquiry', { name: 'A&B', phone: '9876543210', product_name: 'Engine Oil' }],
        ['put', '/api/mechanic/update-profile', { name: 'Updated Name' }],
        ['post', '/api/payment', { customerName: 'A&B', customerPhone: '9876543210', totalAmount: 199, paymentMethod: 'cash' }]
    ];
    for (const [method, url, body] of requests) {
        const result = await server.invoke(method, url, body);
        assert.equal(result.status, 200, url);
        assert.equal(result.body.ok, true, url);
        assert.equal(result.body.telegramNotification.status, 'sent', url);
    }
    assert.equal(server.messages.length, requests.length);
    assert.doesNotMatch(server.messages.join(''), /private-password|test-hash|<Mechanic>|<Lines>|<help>/);
    assert.match(server.messages.join(''), /Engine Oil/);
    await server.invoke('get', '/api/mechanic/profile');
    await server.invoke('put', '/api/mechanic/availability', { isAvailable: true });
    assert.equal(server.messages.length, requests.length);
    assert.equal(server.routes.get('get /api/admin/telegram-status').length, 2);
});

test('failed Telegram delivery does not reject a saved mechanic registration', async () => {
    const server = loadRoutes(false);
    const result = await server.invoke('post', '/api/mechanic/signup', { name: 'Test', phone: '9876543210', password: 'private-password' });
    assert.equal(result.body.ok, true);
    assert.equal(result.body.telegramNotification.status, 'failed');
    assert.equal(server.records.length, 1);
});

test('mechanic signup reports duplicate phone, email and Aadhaar before creating an account', async () => {
    const body = { name: 'Test', phone: '9876543210', email: 'test@example.test', aadharNo: '111122223333', password: 'test-password' };
    for (const field of ['phone', 'email', 'aadharNo']) {
        const server = loadRoutes();
        server.models.User.findOne = async query => {
            assert(query.$or.some(condition => condition[field] === body[field]));
            return { [field]: body[field] };
        };
        const result = await server.invoke('post', '/api/mechanic/signup', body);
        assert.equal(result.status, 409);
        assert.equal(result.body.field, field);
        assert.match(result.body.error, /already registered/);
        assert.equal(server.records.length, 0);
        assert.equal(server.messages.length, 0);
    }
});

test('duplicate key races return a useful conflict instead of a generic server error', async () => {
    for (const field of ['phone', 'email', 'aadharNo']) {
        const server = loadRoutes();
        server.models.User.create = async () => { throw { code: 11000, keyPattern: { [field]: 1 } }; };
        const result = await server.invoke('post', '/api/mechanic/signup', { name: 'Test', phone: '9876543210', password: 'test-password' });
        assert.equal(result.status, 409);
        assert.equal(result.body.field, field);
        assert.match(result.body.error, /already registered/);
        assert.equal(server.messages.length, 0);
    }
});

test('optional empty email and Aadhaar do not match other accounts or occupy unique identity values', async () => {
    const server = loadRoutes();
    server.models.User.findOne = async query => {
        assert.deepEqual(JSON.parse(JSON.stringify(query)), { $or: [{ phone: '9876543210' }] });
        return null;
    };
    const result = await server.invoke('post', '/api/mechanic/signup', { name: 'Test', phone: '9876543210', password: 'test-password' });
    assert.equal(result.body.ok, true);
    assert.equal(server.records[0].email, undefined);
    assert.equal(server.records[0].aadharNo, undefined);
});

test('mechanic login accepts approved accounts, rejects invalid passwords and preserves approval requirement', async () => {
    for (const state of ['approved', 'pending', 'wrong-password', 'missing']) {
        const server = loadRoutes();
        server.models.User.findOne = () => ({ select: async () => state === 'missing' ? null : {
            _id: 'test-mechanic', name: 'Test', phone: '9876543210', password: 'test-hash', isApproved: state !== 'pending'
        } });
        const result = await server.invoke('post', '/api/mechanic/login', { identifier: '9876543210', password: state === 'wrong-password' ? 'wrong' : 'correct-password' });
        assert.equal(result.status, state === 'approved' ? 200 : state === 'pending' ? 403 : 401);
        if (state === 'approved') {
            assert.equal(result.body.ok, true);
            assert.equal(typeof result.body.token, 'string');
            assert.equal(result.body.mechanic.password, undefined);
        } else if (state === 'pending') assert.match(result.body.error, /pending approval/);
    }
});

test('quick restoration enquiries save before sending their Telegram alert', async () => {
    const server = loadRoutes();
    const result = await server.invoke('post', '/api/restoration-enquiry', {
        name: 'Test Customer', location: 'Prayagraj', vehicleType: 'Car', budgetOption: 'custom', customBudget: 250000
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.telegramNotification.status, 'sent');
    assert.equal(server.records[0].enquirySource, 'restore-quick-form');
    assert.equal(server.records[0].customBudget, 250000);
    assert.match(server.messages[0], /Prayagraj/);
    assert.match(server.messages[0], /₹2,50,000/);
});

test('restoration, work slips and payout requests also notify with protected documents omitted', async () => {
    const server = loadRoutes();
    const files = Object.fromEntries(['rcImage', 'frontImage', 'rearImage', 'leftImage', 'rightImage'].map(name => [name, [{ filename: `${name}.jpg`, path: '/unused/test-file' }]]));
    const restoration = await server.invoke('post', '/api/restoration', {
        fullName: 'Test <Customer>', mobileNumber: '9876543210', email: 'test@example.test', city: 'Prayagraj',
        pickupAddress: 'Civil Lines', vehicleType: 'Car', brand: 'Honda', modelName: 'City', condition: 'Needs paint'
    }, { files });
    assert.equal(restoration.body.telegramNotification.status, 'sent');
    assert.doesNotMatch(server.messages.at(-1), /rcImage.jpg/);
    server.models.Booking.findById = async () => ({ _id: 'test-booking', name: 'Test Customer', phone: '9876543210', mechanicId: 'test-mechanic', save: async () => {} });
    const slip = await server.invoke('post', '/api/mechanic/work-slip', { bookingId: 'test-booking', labourCharge: 100, partsCharge: 200 });
    assert.equal(slip.body.telegramNotification.status, 'sent');
    assert.match(server.messages.at(-1), /Total \(INR\).*300/);
    server.models.User.findById = () => ({ lean: async () => ({ name: 'Test Mechanic' }) });
    server.models.Booking.aggregate = async () => [{ mechanicEarnings: 100, vehicleType: 'Bike' }];
    server.models.PayoutRequest.aggregate = async () => [];
    const payout = await server.invoke('post', '/api/mechanic/request-payout', { amount: 100 });
    assert.equal(payout.body.telegramNotification.status, 'sent');
    assert.equal(server.messages.length, 3);
});

test('invalid submissions and unverified payments do not send alerts', async () => {
    const server = loadRoutes();
    assert.equal((await server.invoke('post', '/api/book', { phone: 'bad' })).status, 400);
    assert.equal((await server.invoke('post', '/api/payment', { customerName: 'Test', customerPhone: '9876543210', totalAmount: 199, paymentMethod: 'online' })).status, 400);
    assert.equal(server.messages.length, 0);
    assert.equal(server.records.length, 0);
});

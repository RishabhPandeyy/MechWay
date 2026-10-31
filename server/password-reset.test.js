const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createPasswordResetHandlers, emailConfiguration, hashToken, sessionMatches } = require('./password-reset');

function fixture({ configured = true, fails = false, email = 'mechanic@example.test', telegramFails = false, telegramConfigured = true } = {}) {
    let clock = Date.now();
    const user = { _id: 'test-account', email, phone: '9876543210', password: 'original-hash', sessionVersion: 0 };
    const mails = [];
    const notifications = [];
    const matches = query => {
        if (query._id && query._id !== user._id) return false;
        if (query.passwordResetOtpChallengeHash && query.passwordResetOtpChallengeHash !== user.passwordResetOtpChallengeHash) return false;
        if (query.passwordResetOtpHash && query.passwordResetOtpHash !== user.passwordResetOtpHash) return false;
        if (query.passwordResetOtpExpires && !(user.passwordResetOtpExpires > query.passwordResetOtpExpires.$gt)) return false;
        if (query.passwordResetOtpAttempts && !(user.passwordResetOtpAttempts < query.passwordResetOtpAttempts.$lt)) return false;
        if (query.passwordResetHash && query.passwordResetHash !== user.passwordResetHash) return false;
        if (query.passwordResetExpires && !(user.passwordResetExpires > query.passwordResetExpires.$gt)) return false;
        if (query.email instanceof RegExp && !query.email.test(user.email)) return false;
        if (query.email?.$type && !user.email) return false;
        if (query.phone && !query.phone.$in.includes(user.phone)) return false;
        if (query.$or && user.passwordResetRequestedAt && user.passwordResetRequestedAt > query.$or[1].passwordResetRequestedAt.$lte) return false;
        return true;
    };
    const apply = update => {
        Object.assign(user, update.$set || {});
        for (const key of Object.keys(update.$unset || {})) delete user[key];
        for (const [key, amount] of Object.entries(update.$inc || {})) user[key] = (user[key] || 0) + amount;
    };
    const User = {
        findOne(query) { return { select() { return { async lean() { return matches(query) ? { _id: user._id, name: user.name, email: user.email, phone: user.phone } : null; } }; } }; },
        async findOneAndUpdate(query, update) { if (!matches(query)) return null; apply(update); return { ...user }; },
        async updateOne(query, update) { if (matches(query)) apply(update); },
        async exists(query) { return matches(query); }
    };
    const handlers = createPasswordResetHandlers({
        User, baseUrl: 'https://www.mechway.in', from: 'MechWay <mechwaysupport@gmail.com>', now: () => clock,
        logger: { error() {} },
        notifyPasswordHelp: telegramConfigured ? async text => { if (telegramFails) throw new Error('Telegram failed'); notifications.push(text); } : null,
        mailer: configured ? { async sendMail(mail) { if (fails) throw new Error('SMTP failed'); mails.push(mail); } } : null
    });
    async function call(handler, body, ip = 'test-ip') {
        const response = { statusCode: 200, headers: {}, headersSent: false,
            set(key, value) { this.headers[key] = value; return this; },
            status(code) { this.statusCode = code; return this; },
            json(value) { this.body = value; this.headersSent = true; return this; }
        };
        await handlers[handler]({ body, ip }, response);
        return response;
    }
    const otp = () => mails.at(-1).text.match(/OTP is: (\d{6})/)[1];
    async function issue() {
        const response = await call('request', { identifier: user.email });
        return { challenge: response.body.challenge, otp: otp() };
    }
    async function verifiedToken() {
        const response = await call('verify', await issue());
        assert.equal(response.statusCode, 200);
        return response.body.token;
    }
    return { user, mails, notifications, call, otp, issue, verifiedToken, advance: milliseconds => { clock += milliseconds; } };
}

test('password help works without SMTP and sends account details without changing the password', async () => {
    const f = fixture({ configured: false });
    const response = await f.call('help', { identifier: '+91 9876543210' });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.message, /^Your request is submitted/);
    assert.match(f.notifications[0], /Registered phone:<\/b> 9876543210/);
    assert.match(f.notifications[0], /Open admin panel/);
    assert.doesNotMatch(f.notifications[0], /original-hash/);
    assert.equal(f.user.password, 'original-hash');
    assert.equal(f.user.passwordResetHash, undefined);
    assert.equal(f.mails.length, 0);
});

test('password help confirms submission only after notification succeeds', async () => {
    for (const options of [{ telegramFails: true }, { telegramConfigured: false }]) {
        const f = fixture(options);
        const response = await f.call('help', { identifier: f.user.email });
        assert.equal(response.statusCode, 503);
        assert.equal(response.body.ok, undefined);
    }
});

test('password help gives the same confirmation for unknown accounts and escapes Telegram HTML', async () => {
    const f = fixture();
    const known = await f.call('help', { identifier: f.user.email });
    const unknown = await f.call('help', { identifier: '<name>@example.test' });
    assert.deepEqual(known.body, unknown.body);
    assert.match(f.notifications[1], /&lt;name&gt;@example.test/);
    assert.match(f.notifications[1], /No matching account found/);
});

test('password help rejects invalid identifiers and throttles repeated requests', async () => {
    const f = fixture();
    for (const identifier of ['', 'bad', '123', { email: 'test@example.test' }]) {
        assert.equal((await f.call('help', { identifier })).statusCode, 400);
    }
    for (let i = 0; i < 3; i++) assert.equal((await f.call('help', { identifier: f.user.phone })).statusCode, 200);
    assert.equal((await f.call('help', { identifier: '+91 9876543210' })).statusCode, 429);
    assert.equal(f.notifications.length, 3);
});

test('emails a hashed, challenge-bound OTP to registered email without changing password', async () => {
    const f = fixture();
    const response = await f.call('request', { identifier: 'MECHANIC@example.test' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(f.mails[0].to, f.user.email);
    assert.equal(f.mails[0].from, 'MechWay <mechwaysupport@gmail.com>');
    assert.match(f.otp(), /^\d{6}$/);
    assert.equal(f.user.passwordResetOtpHash, hashToken(`${response.body.challenge}:${f.otp()}`));
    assert.equal(f.user.passwordResetOtpChallengeHash, hashToken(response.body.challenge));
    assert.equal(f.user.passwordResetHash, undefined);
    assert.equal(f.user.password, 'original-hash');
    assert.equal(response.body.otp, undefined);
});

test('unknown account and accounts without email receive generic response with random challenge', async () => {
    const registered = fixture();
    const unknown = fixture();
    const noEmail = fixture({ email: '' });
    const responses = await Promise.all([
        registered.call('request', { identifier: '9876543210' }),
        unknown.call('request', { identifier: 'unknown@example.test' }),
        noEmail.call('request', { identifier: '9876543210' })
    ]);
    for (const response of responses) {
        assert.equal(response.body.message, responses[0].body.message);
        assert.match(response.body.challenge, /^[a-f0-9]{64}$/);
    }
    assert.equal(unknown.mails.length, 0);
    assert.equal(noEmail.mails.length, 0);
});

test('missing SMTP is explicit; failed delivery clears OTP', async () => {
    const missing = fixture({ configured: false });
    assert.equal((await missing.call('request', { identifier: missing.user.email })).statusCode, 503);
    const failed = fixture({ fails: true });
    await failed.call('request', { identifier: failed.user.email });
    assert.equal(failed.user.passwordResetOtpHash, undefined);
    assert.equal(failed.user.passwordResetOtpChallengeHash, undefined);
    assert.equal(failed.user.password, 'original-hash');
});

test('OTP verification then reset hashes password, consumes token and invalidates old sessions', async () => {
    const f = fixture();
    const token = await f.verifiedToken();
    assert.equal(f.user.passwordResetOtpHash, undefined);
    assert.equal(f.user.passwordResetHash, hashToken(token));
    assert.equal((await f.call('reset', { token, password: 'Strong-new-password' })).statusCode, 200);
    assert.equal(await bcrypt.compare('Strong-new-password', f.user.password), true);
    assert.equal(f.user.passwordResetHash, undefined);
    assert.equal(f.user.sessionVersion, 1);
    assert.equal(sessionMatches({}, f.user), false);
    assert.equal(sessionMatches({ sessionVersion: 1 }, f.user), true);
    assert.equal(sessionMatches({}, null), false);
    assert.equal((await f.call('reset', { token, password: 'Another-password' })).statusCode, 400);
});

test('wrong, expired, reused and cross-challenge OTPs fail; five guesses exhaust challenge across IPs', async () => {
    const f = fixture();
    const code = await f.issue();
    assert.equal((await f.call('reset', { token: code.challenge, password: 'Valid-password' })).statusCode, 400);
    assert.equal((await f.call('verify', { ...code, challenge: 'b'.repeat(64) })).statusCode, 400);
    for (let i = 0; i < 5; i++) {
        assert.equal((await f.call('verify', { ...code, otp: '000000' }, `ip-${i}`)).statusCode, 400);
    }
    assert.equal((await f.call('verify', code, 'new-ip')).statusCode, 400);
    const expired = fixture();
    const old = await expired.issue();
    expired.advance(10 * 60000);
    assert.equal((await expired.call('verify', old)).statusCode, 400);
    const used = fixture();
    const once = await used.issue();
    assert.equal((await used.call('verify', once)).statusCode, 200);
    assert.equal((await used.call('verify', once)).statusCode, 400);
});

test('invalid and expired reset tokens and invalid passwords cannot change account', async () => {
    const f = fixture();
    const token = await f.verifiedToken();
    for (const password of ['short', 'x'.repeat(73), '\u00e9'.repeat(37), { value: 'password' }]) {
        assert.equal((await f.call('reset', { token, password })).statusCode, 400);
    }
    assert.equal((await f.call('verify', { challenge: token, otp: 123456 })).statusCode, 400);
    assert.equal((await f.call('reset', { token: 'bad-token', password: 'Valid-password' })).statusCode, 400);
    f.advance(5 * 60000);
    assert.equal((await f.call('reset', { token, password: 'Valid-password' })).statusCode, 400);
    assert.equal(f.user.password, 'original-hash');
});

test('only one concurrent OTP verification and one concurrent reset succeed', async () => {
    const f = fixture();
    const code = await f.issue();
    const verified = await Promise.all([f.call('verify', code), f.call('verify', code)]);
    assert.deepEqual(verified.map(r => r.statusCode).sort(), [200, 400]);
    const token = verified.find(r => r.statusCode === 200).body.token;
    const results = await Promise.all([
        f.call('reset', { token, password: 'First-password' }),
        f.call('reset', { token, password: 'Second-password' })
    ]);
    assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 400]);
    assert.equal(f.user.sessionVersion, 1);
});

test('cooldown, OTP replacement and rate limits', async () => {
    const f = fixture();
    const first = await f.issue();
    await f.call('request', { identifier: f.user.email });
    assert.equal(f.mails.length, 1);
    f.advance(61000);
    const next = await f.issue();
    assert.notEqual(next.challenge, first.challenge);
    assert.equal((await f.call('verify', first)).statusCode, 400);
    assert.equal((await f.call('verify', next)).statusCode, 200);
    const blocked = await f.call('request', { identifier: f.user.email });
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.headers['Retry-After'], '900');
    f.advance(15 * 60000);
    assert.equal((await f.call('request', { identifier: f.user.email })).statusCode, 200);
});

test('Gmail sender and SMTP configuration', () => {
    assert.equal(emailConfiguration({}).mailer, null);
    assert.equal(emailConfiguration({}).from, 'MechWay <mechwaysupport@gmail.com>');
    assert.equal(emailConfiguration({ NODE_ENV: 'production' }).baseUrl, 'https://www.mechway.in');
    assert.throws(() => emailConfiguration({ PASSWORD_RESET_BASE_URL: 'http://untrusted.test' }));
    const configured = emailConfiguration({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'mechwaysupport@gmail.com', SMTP_PASS: 'test-only', SMTP_PORT: '587' });
    assert.equal(configured.from, 'MechWay <mechwaysupport@gmail.com>');
    assert.equal(configured.mailer.options.requireTLS, true);
    assert.equal(configured.mailer.options.secure, false);
    configured.mailer.close();
});

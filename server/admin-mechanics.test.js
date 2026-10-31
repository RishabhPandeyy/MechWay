const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createAdminMechanicHandlers } = require('./admin-mechanics');

const id = '507f1f77bcf86cd799439011';

function fixture() {
    const mechanic = { _id: id, isApproved: false, isAvailable: true, isOnline: true, password: 'old-hash', passwordResetHash: 'pending', sessionVersion: 0 };
    const User = {
        async exists(query) { return query._id === id; },
        async findByIdAndUpdate(value, update) {
            if (value !== id) return null;
            Object.assign(mechanic, update.$set || {});
            for (const key of Object.keys(update.$unset || {})) delete mechanic[key];
            for (const [key, amount] of Object.entries(update.$inc || {})) mechanic[key] += amount;
            return { ...mechanic };
        }
    };
    const handlers = createAdminMechanicHandlers(User);
    async function call(action, body, mechanicId = id) {
        const response = {
            code: 200,
            status(code) { this.code = code; return this; },
            json(data) { this.data = data; return this; }
        };
        await handlers[action]({ params: { id: mechanicId }, body }, response);
        return response;
    }
    return { mechanic, call };
}

test('verify, suspend, and invalidate active sessions', async () => {
    const f = fixture();
    assert.equal((await f.call('approve', { isApproved: true })).data.ok, true);
    assert.equal(f.mechanic.isApproved, true);
    assert.equal(f.mechanic.sessionVersion, 1);
    assert.equal((await f.call('approve', { isApproved: false })).data.ok, true);
    assert.equal(f.mechanic.isApproved, false);
    assert.equal(f.mechanic.isAvailable, false);
    assert.equal(f.mechanic.isOnline, false);
    assert.equal(f.mechanic.sessionVersion, 2);
});

test('admin password change hashes password, clears reset link, and expires sessions', async () => {
    const f = fixture();
    const response = await f.call('setPassword', { newPassword: 'New-password-123' });
    assert.equal(response.code, 200);
    assert.equal(await bcrypt.compare('New-password-123', f.mechanic.password), true);
    assert.equal(f.mechanic.passwordResetHash, undefined);
    assert.equal(f.mechanic.sessionVersion, 1);
});

test('rejects invalid IDs, approval values, and weak passwords', async () => {
    const f = fixture();
    assert.equal((await f.call('approve', { isApproved: 'true' })).code, 400);
    assert.equal((await f.call('approve', { isApproved: true }, 'bad')).code, 400);
    assert.equal((await f.call('setPassword', { newPassword: 'short' })).code, 400);
    assert.equal((await f.call('setPassword', { newPassword: 'a'.repeat(73) })).code, 400);
    assert.equal(f.mechanic.sessionVersion, 0);
});

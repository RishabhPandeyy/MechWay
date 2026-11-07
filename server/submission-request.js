const crypto = require('node:crypto');

// A retry uses the same MongoDB primary key, including across server restarts.
async function saveSubmission(Model, scope, requestId, fields) {
    if (requestId == null) return { record: await Model.create(fields), created: true };
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
        const error = new Error('Invalid submission request ID');
        error.status = 400;
        throw error;
    }
    const _id = crypto.createHash('sha256').update(`${scope}:${requestId}`).digest('hex').slice(0, 24);
    const existing = await Model.findById(_id);
    if (existing) return { record: existing, created: false };
    try {
        return { record: await Model.create({ ...fields, _id }), created: true };
    } catch (error) {
        if (error.code !== 11000) throw error;
        const record = await Model.findById(_id);
        if (!record) throw error;
        return { record, created: false };
    }
}

module.exports = { saveSubmission };

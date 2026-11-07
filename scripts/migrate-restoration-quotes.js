const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../server/.env'), quiet: true });

// Preview by default. --apply moves only historical quick-form enquiries,
// preserving their IDs and fields. Copy and removal commit together.
async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mechway', {
        serverSelectionTimeoutMS:10000
    });
    const db = mongoose.connection.db;
    const requests = db.collection('restoration_requests');
    const quotes = db.collection('restoration_quotes');
    const filter = { enquirySource: 'restore-quick-form' };
    if (!process.argv.includes('--apply')) {
        console.log(JSON.stringify({ mode: 'preview', database: db.databaseName,
            enquiriesToMove: await requests.countDocuments(filter) }));
        return;
    }
    const session = await mongoose.startSession();
    let moved = 0;
    try {
        await session.withTransaction(async () => {
            const records = await requests.find(filter, { session }).toArray();
            moved = records.length;
            if (!records.length) return;
            for (const record of records) {
                const existing = await quotes.findOne({ _id: record._id }, { session });
                if (existing && !isDeepStrictEqual(existing, record)) {
                    throw new Error('A destination record differs; migration cancelled without changes.');
                }
                if (!existing) await quotes.insertOne(record, { session });
            }
            const result = await requests.deleteMany({ ...filter,
                _id: { $in: records.map(record => record._id) } }, { session });
            if (result.deletedCount !== records.length) {
                throw new Error('Source records changed; migration cancelled without changes.');
            }
        });
    } finally {
        await session.endSession();
    }
    console.log(JSON.stringify({ mode: 'applied', database: db.databaseName, moved,
        remainingQuickRequests: await requests.countDocuments(filter),
        quickQuotes: await quotes.countDocuments(filter) }));
}

main().catch(() => {
    console.error('Migration failed; transaction changes were not committed. Check database access and conflicting records.');
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());

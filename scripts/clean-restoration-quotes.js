const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../server/.env'), quiet: true });

const legacyFields = ['email', 'pickupAddress', 'latitude', 'longitude', 'brand',
    'modelName', 'yearOfManufacture', 'condition', 'restorationImages', 'vehiclePhotos',
    'rcDocument', 'govtIdDocument', 'rcPrivate', 'restorationType', 'specialNotes', 'vehicleColor',
    'registrationNumber'];
const empty = value => value == null || value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(empty));

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mechway', { serverSelectionTimeoutMS: 10000 });
    const collection = mongoose.connection.db.collection('restoration_quotes');
    const records = await collection.find({ enquirySource: 'restore-quick-form' }).toArray();
    const operations = [];
    for (const record of records) {
        const remove = legacyFields.filter(field => Object.hasOwn(record, field) && empty(record[field]));
        if (record.rcPrivate === false) remove.push('rcPrivate');
        if (Object.hasOwn(record, 'mobileNumber') && (empty(record.mobileNumber) ||
            (record.mobileNumber === record.whatsappNumber && record.whatsappNumber))) remove.push('mobileNumber');
        if (Object.hasOwn(record, '__v')) remove.push('__v');
        if (!remove.length) continue;
        // Match original values so a concurrent edit cannot lose newly entered data.
        operations.push({ updateOne: {
            filter: { _id: record._id, enquirySource: 'restore-quick-form',
                ...Object.fromEntries(remove.map(field => [field, { $eq: record[field] }])) },
            update: { $unset: Object.fromEntries(remove.map(field => [field, ''])) }
        } });
    }
    if (!process.argv.includes('--apply')) {
        console.log(JSON.stringify({ mode: 'preview', recordsToClean: operations.length }));
        return;
    }
    const result = operations.length ? await collection.bulkWrite(operations) : { modifiedCount: 0 };
    console.log(JSON.stringify({ mode: 'applied', recordsCleaned: result.modifiedCount }));
}
main().catch(() => {
    console.error('Quote cleanup failed. Check database access before retrying.');
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());

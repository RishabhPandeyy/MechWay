// Preview by default; pass --apply to retain existing referenced uploads in MongoDB.
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const { createRestorationFiles } = require('../server/restoration-files');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const storage = createRestorationFiles(() => mongoose.connection.db);
        const requests = await mongoose.connection.db.collection('restoration_requests').find({}).toArray();
        const files = new Map();
        for (const row of requests) {
            for (const url of [...(row.restorationImages || []), ...Object.values(row.vehiclePhotos || {})]) {
                if (typeof url !== 'string' || !/^\/uploads\/restoration\/[A-Za-z0-9._-]+$/.test(url)) continue;
                files.set(`vehicle/${path.basename(url)}`, { filename: path.basename(url), fieldname: 'frontImage', path: path.resolve(__dirname, '..' + url) });
            }
            if (row.rcPrivate && row.rcDocument && path.basename(row.rcDocument) === row.rcDocument) {
                files.set(`rc/${row.rcDocument}`, { filename: row.rcDocument, fieldname: 'rcImage', path: path.resolve(__dirname, '../private-uploads/restoration-rc', row.rcDocument) });
            }
            if (row.govtIdDocument && path.basename(row.govtIdDocument) === row.govtIdDocument) {
                files.set(`rc/${row.govtIdDocument}`, { filename: row.govtIdDocument, fieldname: 'govtIdImage', path: path.resolve(__dirname, '../private-uploads/restoration-rc', row.govtIdDocument) });
            }
        }
        let available = 0;
        let missing = 0;
        let retained = 0;
        for (const [key, file] of files) {
            if (await mongoose.connection.db.collection('restoration_files').findOne({ _id: key }, { projection: { _id: 1 } })) {
                retained++;
                continue;
            }
            try { await fs.access(file.path); } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                missing++;
                continue;
            }
            const extension = path.extname(file.filename).toLowerCase();
            file.mimetype = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extension];
            if (!file.mimetype) throw new Error('Unsupported image extension');
            const stat = await fs.stat(file.path);
            if (stat.size > 10 * 1024 * 1024) throw new Error('Existing image exceeds 10 MB');
            available++;
            if (process.argv.includes('--apply')) await storage.save(file);
        }
        console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'saved' : 'preview', available, alreadyRetained: retained, missing }));
    } finally {
        await mongoose.disconnect();
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

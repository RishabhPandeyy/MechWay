const fs = require('node:fs/promises');

// Each upload is capped at 10 MB, below MongoDB's 16 MB document limit.
// Separate namespaces keep RC and government ID documents out of the public photo route.
function createRestorationFiles(getDb) {
    const collection = () => getDb().collection('restoration_files');
    const key = (filename, privateFile) => `${privateFile ? 'rc' : 'vehicle'}/${filename}`;
    return {
        async save(file) {
            const _id = key(file.filename, ['rcImage', 'govtIdImage'].includes(file.fieldname));
            const data = await fs.readFile(file.path);
            await collection().updateOne({ _id }, { $setOnInsert: {
                data, contentType: file.mimetype, createdAt: new Date()
            } }, { upsert: true });
        },
        async remove(file) {
            await collection().deleteOne({ _id: key(file.filename, ['rcImage', 'govtIdImage'].includes(file.fieldname)) });
        },
        async send(res, filename, { privateFile = false, downloadName } = {}) {
            if (!/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(filename)) return false;
            const file = await collection().findOne({ _id: key(filename, privateFile) });
            if (!file) return false;
            res.set('Content-Type', file.contentType);
            res.set('X-Content-Type-Options', 'nosniff');
            if (privateFile) res.set('Cache-Control', 'private, no-store');
            if (downloadName) res.attachment(downloadName);
            res.send(Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data.buffer));
            return true;
        }
    };
}

module.exports = { createRestorationFiles };

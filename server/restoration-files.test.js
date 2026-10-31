const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { BSON } = require('mongodb');
const { createRestorationFiles } = require('./restoration-files');

test('photos survive loss of disk files; RC bytes stay in a separate namespace', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'restoration-files-'));
    const documents = new Map();
    const collection = {
        async updateOne({ _id }, update) {
            documents.set(_id, BSON.deserialize(BSON.serialize({ _id, ...update.$setOnInsert })));
        },
        async findOne({ _id }) { return documents.get(_id); },
        async deleteOne({ _id }) { documents.delete(_id); }
    };
    const getDb = () => ({ collection: () => collection });
    const response = () => ({
        headers: {}, set(name, value) { this.headers[name] = value; },
        attachment(name) { this.downloadName = name; }, send(data) { this.body = data; }
    });
    try {
        const file = { filename: 'photo.jpg', fieldname: 'frontImage', path: path.join(dir, 'photo.jpg'), mimetype: 'image/jpeg' };
        const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x80]);
        await fs.writeFile(file.path, bytes);
        const storage = createRestorationFiles(getDb);
        await storage.save(file);
        await storage.save({ ...file, filename: 'private.jpg', fieldname: 'rcImage' });
        await fs.unlink(file.path);
        const restartedStorage = createRestorationFiles(getDb);
        const photo = response();
        assert.equal(await restartedStorage.send(photo, 'photo.jpg'), true);
        assert.deepEqual(photo.body, bytes);
        assert.equal(photo.headers['Content-Type'], 'image/jpeg');
        assert.equal(await restartedStorage.send(response(), 'private.jpg'), false);
        const rc = response();
        assert.equal(await restartedStorage.send(rc, 'private.jpg', { privateFile: true, downloadName: 'RC.jpg' }), true);
        assert.deepEqual(rc.body, bytes);
        assert.equal(rc.headers['Cache-Control'], 'private, no-store');
        assert.equal(rc.downloadName, 'RC.jpg');
        assert.equal(await restartedStorage.send(response(), '../private.jpg'), false);
        assert.equal(await restartedStorage.send(response(), 'missing.jpg'), false);
        await storage.remove(file);
        assert.equal(await restartedStorage.send(response(), 'photo.jpg'), false);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

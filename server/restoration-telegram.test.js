const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatRestorationTelegram } = require('./restoration-telegram');

test('restoration alert includes customer, vehicle, scope, location and four photos without exposing RC', () => {
    const message = formatRestorationTelegram({
        _id: '507f1f77bcf86cd799439011', fullName: 'Test <Customer>', mobileNumber: '9876543210',
        whatsappNumber: '9876543210', email: 'test@example.test', city: 'Prayagraj',
        pickupAddress: 'Civil Lines', latitude: 25.43, longitude: 81.84,
        vehicleType: 'Bike', brand: 'Honda', modelName: 'CB', yearOfManufacture: '2019',
        registrationNumber: 'UP70AA0000', condition: 'Needs repair', restorationType: 'Paint',
        budgetRange: '20000-30000', specialNotes: '<script>hello</script>',
        rcDocument: 'private-rc.jpg',
        vehiclePhotos: { front: '/uploads/restoration/front.jpg', rear: '/uploads/restoration/rear.jpg', left: '/uploads/restoration/left.jpg', right: '/uploads/restoration/right.jpg' }
    }, { dashboardBaseUrl: 'https://www.mechway.in', assetBaseUrl: 'https://api.example.test' });
    assert.match(message, /Test &lt;Customer&gt;/);
    assert.match(message, /Honda CB/);
    assert.match(message, /Civil Lines, Prayagraj/);
    assert.match(message, /Paint/);
    assert.match(message, /20000-30000/);
    assert.match(message, /https:\/\/www.openstreetmap.org/);
    for (const side of ['front', 'rear', 'left', 'right']) assert.match(message, new RegExp(`https://api.example.test/uploads/restoration/${side}.jpg`));
    assert.match(message, /https:\/\/www.mechway.in\/server\/admin.html/);
    assert.doesNotMatch(message, /private-rc.jpg|<script>/);
    assert.ok(message.length < 4096);
});

test('invalid or injected photo paths are omitted', () => {
    const message = formatRestorationTelegram({ _id: '1', vehiclePhotos: { front: 'https://evil.example/test', rear: '/uploads/restoration/../../rc.jpg' } }, {
        dashboardBaseUrl: 'https://www.mechway.in', assetBaseUrl: 'https://api.example.test'
    });
    assert.doesNotMatch(message, /evil.example|rc.jpg/);
});

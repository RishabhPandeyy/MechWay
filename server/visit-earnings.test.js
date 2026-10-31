const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VISIT_PRICE_BY_VEHICLE, calculateEarningSplit, bookingMechanicEarnings } = require('./visit-earnings');

test('current bike and car visits allocate the fixed mechanic and MechWay shares', () => {
    assert.equal(VISIT_PRICE_BY_VEHICLE.Bike, 199);
    assert.equal(VISIT_PRICE_BY_VEHICLE.Car, 279);
    assert.deepEqual(calculateEarningSplit(199, 'Bike'), {
        grossAmount: 199, platformCommission: 99, mechanicEarnings: 100
    });
    assert.deepEqual(calculateEarningSplit(279, 'Car'), {
        grossAmount: 279, platformCommission: 129, mechanicEarnings: 150
    });
});

test('earnings summary corrects previously completed current-price visits', () => {
    assert.equal(bookingMechanicEarnings({ servicePrice: 199, vehicleType: 'Bike', mechanicEarnings: 199 }), 100);
    assert.equal(bookingMechanicEarnings({ servicePrice: 279, vehicleType: 'Car', mechanicEarnings: 279 }), 150);
    assert.equal(bookingMechanicEarnings({ servicePrice: 199, vehicleType: 'Bike' }), 100);
    assert.equal(bookingMechanicEarnings({ servicePrice: 279, vehicleType: 'Car' }), 150);
});

test('legacy visits and older car visits at 199 retain their previous earnings', () => {
    assert.equal(bookingMechanicEarnings({ servicePrice: 99, vehicleType: 'Bike' }), 89);
    assert.equal(bookingMechanicEarnings({ servicePrice: 169, vehicleType: 'Car' }), 125);
    assert.equal(bookingMechanicEarnings({ servicePrice: 199, vehicleType: 'Car', mechanicEarnings: 175 }), 175);
    assert.deepEqual(calculateEarningSplit(199, 'Car'), {
        grossAmount: 199, platformCommission: 0, mechanicEarnings: 199
    });
});

test('rejects invalid visit price', () => {
    assert.throws(() => calculateEarningSplit(-1, 'Bike'), RangeError);
    assert.throws(() => calculateEarningSplit(NaN, 'Bike'), RangeError);
});

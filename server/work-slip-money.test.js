const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateWorkSlipMoney } = require('./work-slip-money');

test('10 percent commission is derived from the work slip total', () => {
    assert.deepEqual(calculateWorkSlipMoney(700, 300), {
        labourCharge: 700,
        partsCharge: 300,
        totalCharge: 1000,
        platformCommission: 100,
        mechanicEarnings: 900
    });
});

test('rounds money in paise without changing the customer total', () => {
    assert.deepEqual(calculateWorkSlipMoney(49.995, 50.005), {
        labourCharge: 50,
        partsCharge: 50.01,
        totalCharge: 100.01,
        platformCommission: 10,
        mechanicEarnings: 90.01
    });
});

test('rejects invalid charges', () => {
    for (const value of [-1, Infinity, NaN, 'invalid', 1000001]) {
        assert.throws(() => calculateWorkSlipMoney(value, 0), RangeError);
    }
});

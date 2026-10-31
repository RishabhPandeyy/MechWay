function calculateWorkSlipMoney(labourCharge, partsCharge) {
    const labour = Number(labourCharge);
    const parts = Number(partsCharge);
    if (![labour, parts].every(value => Number.isFinite(value) && value >= 0 && value <= 1000000)) {
        throw new RangeError('Enter valid non-negative labour and parts charges');
    }
    const labourPaise = Math.round(labour * 100);
    const partsPaise = Math.round(parts * 100);
    const totalPaise = labourPaise + partsPaise;
    const commissionPaise = Math.round(totalPaise * 0.10);
    return {
        labourCharge: labourPaise / 100,
        partsCharge: partsPaise / 100,
        totalCharge: totalPaise / 100,
        platformCommission: commissionPaise / 100,
        mechanicEarnings: (totalPaise - commissionPaise) / 100
    };
}

module.exports = { calculateWorkSlipMoney };

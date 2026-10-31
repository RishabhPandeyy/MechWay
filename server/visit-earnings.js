const VISIT_PRICE_BY_VEHICLE = Object.freeze({ Bike: 199, Car: 279 });

const MECHANIC_EARNING_BY_PRICE = Object.freeze({
    99: 89,
    129: 89,
    169: 125,
    199: 100,
    279: 150
});

function mappedVisitEarning(servicePrice, vehicleType) {
    if (servicePrice === 199 && vehicleType === 'Car') return undefined;
    if (servicePrice === 279 && vehicleType === 'Bike') return undefined;
    return MECHANIC_EARNING_BY_PRICE[servicePrice];
}

function calculateEarningSplit(servicePrice, vehicleType) {
    const grossAmount = Number(servicePrice);
    if (!Number.isFinite(grossAmount) || grossAmount < 0) throw new RangeError('Invalid visit price');
    const mappedEarning = mappedVisitEarning(grossAmount, vehicleType);
    const mechanicEarnings = Number.isFinite(mappedEarning) ? mappedEarning : grossAmount;
    return {
        grossAmount,
        platformCommission: grossAmount - mechanicEarnings,
        mechanicEarnings
    };
}

function bookingMechanicEarnings(booking) {
    const servicePrice = Number(booking.servicePrice);
    const mappedEarning = mappedVisitEarning(servicePrice, booking.vehicleType);
    if (Number.isFinite(mappedEarning)) {
        return mappedEarning;
    }
    const stored = booking.mechanicEarnings == null ? NaN : Number(booking.mechanicEarnings);
    if (Number.isFinite(stored) && stored >= 0) return stored;
    return calculateEarningSplit(servicePrice, booking.vehicleType).mechanicEarnings;
}

module.exports = { VISIT_PRICE_BY_VEHICLE, calculateEarningSplit, bookingMechanicEarnings };

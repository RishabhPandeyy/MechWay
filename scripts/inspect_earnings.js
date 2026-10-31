const mongoose = require('mongoose');
const { bookingMechanicEarnings } = require('../server/visit-earnings');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mechway';
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');

  const completed = await Booking.find({ status: 'completed' }).lean();
  const byMechanic = new Map();
  completed.forEach(booking => {
    const mechanicId = booking.mechanicId ? String(booking.mechanicId) : '(no-mech)';
    const row = byMechanic.get(mechanicId) || { _id: mechanicId, totalEarnings: 0, totalJobs: 0 };
    row.totalEarnings += bookingMechanicEarnings(booking);
    row.totalJobs += 1;
    byMechanic.set(mechanicId, row);
  });

  const agg = [...byMechanic.values()]
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, 50);

  console.log('Top mechanics by completed earnings:');
  agg.forEach(row => {
    console.log(`${row._id || '(no-mech)'} -> ₹${row.totalEarnings} across ${row.totalJobs} jobs`);
  });

  // Show recent completed bookings with small amounts
  const smalls = await Booking.find({ status: 'completed', servicePrice: { $lte: 200 } }).sort({ completedAt: -1 }).limit(30).lean();
  console.log('\nRecent small completed bookings (<= ₹200):');
  smalls.forEach(b => {
    console.log(`${b._id} | mech:${b.mechanicId || '(none)'} | price: ${b.servicePrice} | earning: ₹${bookingMechanicEarnings(b)} | customer:${b.name || b.customerName}`);
  });

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

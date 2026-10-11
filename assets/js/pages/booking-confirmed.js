
// ── Navbar
document.getElementById('ham-btn').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.toggle('open');
});
document.getElementById('mob-close').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.remove('open');
});
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').style.background =
    window.scrollY > 50 ? 'rgba(13,13,13,0.98)' : 'rgba(13,13,13,0.95)';
});

// ── Read URL params (set by payment.html on success)
const p             = new URLSearchParams(window.location.search);
const customerName  = p.get('customerName')  || 'Customer';
const customerPhone = p.get('customerPhone') || '';
const vehicleType   = p.get('vehicleType')   || '';
const vehicleBrand  = p.get('vehicleBrand')  || '';
const vehicleModel  = p.get('vehicleModel')  || '';
const vehicleNumber = p.get('vehicleNumber') || '';
const service       = p.get('service')       || '';
const totalAmount   = p.get('totalAmount')   || '0';
const paymentMethod = p.get('paymentMethod') || '';
const paymentId     = p.get('paymentId')     || '';
const mechanicName  = p.get('mechanicName')  || '';
const mechanicPhone = p.get('mechanicPhone') || '';
const bookingId     = p.get('bookingId')     || '';

// Security guard
if (!customerName || customerName === 'Customer' && !service && !totalAmount) {
  window.location.href = '/index.html';
}

// ── Payment ID chip
if (paymentId) {
  document.getElementById('chip-payment-id').textContent = paymentId;
  document.getElementById('payment-id-chip').style.display = 'inline-flex';
}

// ── Booking summary
document.getElementById('conf-customer-name').textContent  = customerName;
document.getElementById('conf-customer-phone').textContent = customerPhone || '—';
const vehicleStr = [vehicleType, vehicleBrand, vehicleModel].filter(Boolean).join(' · ');
document.getElementById('conf-vehicle').textContent  = vehicleStr || '—';
document.getElementById('conf-reg').textContent      = vehicleNumber || '—';
document.getElementById('conf-service').textContent  = service || '—';

// ── Payment summary
const amount = parseFloat(totalAmount) || 0;
document.getElementById('conf-service-price').textContent = `₹${amount.toFixed(2)}`;
document.getElementById('conf-total').textContent          = `₹${amount.toFixed(2)}`;
const methodLabel = { cash: 'Cash on Service', razorpay: 'Online (Razorpay)', online: 'Online (Razorpay)' };
document.getElementById('conf-pay-method').textContent = methodLabel[paymentMethod] || paymentMethod || '—';

// ── Mechanic details
if (mechanicName) {
  document.getElementById('mechanic-section').style.display = 'block';
  document.getElementById('no-mechanic-section').style.display = 'none';
  document.getElementById('conf-mech-name').textContent = mechanicName;

  if (mechanicPhone) {
    const phoneClean = mechanicPhone.replace(/\D/g, '');
    const phoneLink = document.getElementById('conf-mech-phone-link');
    phoneLink.textContent = mechanicPhone;
    phoneLink.href = `tel:${phoneClean}`;

    const callBtn = document.getElementById('btn-call-mech');
    callBtn.href = `tel:${phoneClean}`;
    const firstName = mechanicName.split(' ')[0];
    document.getElementById('btn-call-label').textContent = `Call ${firstName}`;

    const waBtn = document.getElementById('btn-wa-mech');
    const waMsg = encodeURIComponent(
      `Hi ${mechanicName}, I've completed my payment on MechWay. My name is ${customerName}, phone: ${customerPhone}. Please confirm my booking.`
    );
    waBtn.href = `https://wa.me/91${phoneClean}?text=${waMsg}`;
  } else {
    document.getElementById('conf-mech-phone-link').textContent = 'Will call you shortly';
    document.getElementById('btn-call-mech').style.display = 'none';
    document.getElementById('btn-wa-mech').style.display   = 'none';
  }
} else {
  document.getElementById('mechanic-section').style.display  = 'none';
  document.getElementById('no-mechanic-section').style.display = 'block';
}

// ── OTP GENERATION ────────────────────────────────────────────────────────────
// Generates a deterministic 6-digit OTP from the booking seed.
// Mechanic dashboard verifies by re-deriving the same hash and comparing.
// Seed = customerPhone + bookingId  (both known on the customer page).

function generateBookingOTP(seed) {
  // Consistent djb2-style hash → 6-digit number (100000–999999)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return (100000 + (Math.abs(hash) % 900000)).toString();
}

// Build seed — same logic as mech-dashboard.js deriveExpectedOTP()
const otpSeed = (customerPhone || '') + (bookingId || '');

let currentOTP = '';

if (otpSeed.trim().length >= 4) {
  currentOTP = generateBookingOTP(otpSeed);
  document.getElementById('otp-display').textContent = currentOTP;
  document.getElementById('otp-section').style.display = 'block';

  // Also store in sessionStorage so page refresh gives same OTP
  sessionStorage.setItem('mw_otp_' + (bookingId || customerPhone), currentOTP);
} else if (customerPhone && customerPhone.length >= 4) {
  // Fallback — use phone alone if bookingId missing
  currentOTP = generateBookingOTP(customerPhone);
  document.getElementById('otp-display').textContent = currentOTP;
  document.getElementById('otp-section').style.display = 'block';
  sessionStorage.setItem('mw_otp_' + customerPhone, currentOTP);
}

function copyOTP() {
  if (!currentOTP) return;
  navigator.clipboard.writeText(currentOTP).then(() => {
    const btn = document.getElementById('otp-copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.style.background = 'rgba(34,197,94,0.15)';
    btn.style.borderColor = 'rgba(34,197,94,0.5)';
    btn.style.color = 'var(--green)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = currentOTP;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('OTP copied: ' + currentOTP);
  });
}

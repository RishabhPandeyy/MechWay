
// ── Animate blink
const style = document.createElement('style');
style.textContent = '@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}';
document.head.appendChild(style);

// ── Navbar mobile
document.getElementById('ham-btn').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.toggle('open');
});
document.getElementById('mob-close').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.remove('open');
});

// ── Backend URL helper
const getBackendURL = () =>
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
    ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

// ── Scroll navbar
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').style.background =
    window.scrollY > 50 ? 'rgba(13,13,13,0.98)' : 'rgba(13,13,13,0.9)';
});

// ── URL params
const p = new URLSearchParams(window.location.search);
const customerName  = p.get('name')          || 'Customer';
const customerPhone = p.get('phone')         || 'N/A';
const vehicleType   = p.get('vehicleType')   || '';
const vehicleBrand  = p.get('vehicleBrand')  || '';
const vehicleModel  = p.get('vehicleModel')  || '';
const vehicleNumber = p.get('vehicleNumber') || '';
const vehicleColor  = p.get('vehicleColor')  || '';
const service       = p.get('service')       || '';
const servicePrice  = p.get('servicePrice')  || '';
const message       = p.get('message')       || '';
const mechanicId    = p.get('mechanicId')    || '';
const mechanicName  = p.get('mechanicName')  || '';
const mechanicPhone = p.get('mechanicPhone') || '';
const bookingId     = p.get('bookingId')     || '';

// Get user & mechanic coords from URL
const userLat = parseFloat(p.get('lat') || p.get('userLat') || '0') || 0;
const userLng = parseFloat(p.get('lng') || p.get('userLng') || '0') || 0;
const mechanicLat = parseFloat(p.get('mechanicLat') || '0') || 0;
const mechanicLng = parseFloat(p.get('mechanicLng') || '0') || 0;

// ── Populate customer details
document.getElementById('disp-name').textContent  = customerName;
document.getElementById('disp-phone').textContent = customerPhone;
document.getElementById('disp-vtype').textContent  = vehicleType  || '—';
document.getElementById('disp-brand').textContent  = vehicleBrand || '—';
document.getElementById('disp-model').textContent  = vehicleModel || '—';
document.getElementById('disp-vnumber').textContent = vehicleNumber || '—';

// ── Pre-fill form
const vtSel = document.getElementById('vehicle-type');
const svSel = document.getElementById('service-performed');
if (vehicleType) vtSel.value = vehicleType;

if (service) {
  let found = false;
  Array.from(svSel.options).forEach(opt => {
    if (opt.value === service || opt.textContent.trim() === service) {
      svSel.value = opt.value;
      found = true;
    }
  });
  if (!found) {
    svSel.value = 'other';
    document.getElementById('other-service-group').classList.remove('hidden');
    document.getElementById('other-service-details').value = service;
  }
}

// ── Service pricing table
const PRICING = {
  'General Checkup':              { Car: 500,  Bike: 300 },
  'Tire Issue (Flat, Puncture)':  { Car: 200,  Bike: 150 },
  'Battery Issue':                { Car: 400,  Bike: 250 },
  'Engine Problem':               { Car: 800,  Bike: 600 },
  'Brake Problem':                { Car: 600,  Bike: 400 },
  'Lockout Service':              { Car: 300,  Bike: 200 },
  'Fuel Delivery':                { Car: 200,  Bike: 150 },
  'Other':                        { Car: 500,  Bike: 300 },
  'Full Service (Oil, Filters)':  { Car: 1200, Bike: 800 },
  'Battery Replacement':          { Car: 1500, Bike: 800 },
  'Brake Pad Replacement':        { Car: 1000, Bike: 600 },
  'AC Gas Refill':                { Car: 800,  Bike: 0   },
  'Tire Puncture Repair':         { Car: 200,  Bike: 150 },
  'Clutch Assembly Replacement':  { Car: 2500, Bike: 1200},
  'General Service (Oil, Wash)':  { Car: 0,    Bike: 600 },
  'Chain Cleaning & Lube':        { Car: 0,    Bike: 200 },
  'Brake Shoe/Pad Replacement':   { Car: 0,    Bike: 400 },
  'Carburetor Cleaning':          { Car: 0,    Bike: 300 },
  'Bike Puncture Repair':         { Car: 0,    Bike: 150 },
  'Clutch Cable Replacement':     { Car: 0,    Bike: 300 },
};

function getPrice() {
  const svc = svSel.value === 'other'
    ? document.getElementById('other-service-details').value.trim()
    : svSel.value;
  const vt  = vtSel.value; // 'Car' or 'Bike'
  const entry = PRICING[svc];
  // If from URL (already calculated), prefer that on first load
  let base = 0;
  if (entry) {
    base = entry[vt] || entry['Car'] || 0;
  }
  return base;
}

function updatePriceDisplay() {
  // ALWAYS prioritize URL servicePrice from mechanic.html - authoritative value
  const urlPrice = parseFloat(servicePrice) || 0;
  let base = urlPrice;

  // ONLY fallback to local PRICING if no URL price (direct payment.html access)
  if (base === 0) {
    base = getPrice();
  }

  document.getElementById('disp-service-price').textContent = `₹${base.toFixed(2)}`;
  document.getElementById('disp-total').textContent         = `₹${base.toFixed(2)}`;
  document.getElementById('service-price').value            = base;

  // document.getElementById('qr-amount').textContent          = `₹${base.toFixed(2)}`; // QR removed


  // Enable online if price > 0
  const onlineOpt = document.getElementById('razorpay-option');
  if (base > 0) {
    onlineOpt.classList.remove('disabled');
    onlineOpt.querySelector('input[type="radio"]').disabled = false;
  }
  return base;
}

updatePriceDisplay();

svSel.addEventListener('change', () => {
  if (svSel.value === 'other') {
    document.getElementById('other-service-group').classList.remove('hidden');
  } else {
    document.getElementById('other-service-group').classList.add('hidden');
  }
  updatePriceDisplay();
});
document.getElementById('other-service-details').addEventListener('input', updatePriceDisplay);

// ── Payment method switching
const razorpayOpt = document.getElementById('razorpay-option');
let isLaunchingPayment = false;

async function launchRazorpayPayment() {
  if (isLaunchingPayment) return;
  if (razorpayOpt.classList.contains('disabled')) return;

  const totalAmount = parseFloat(document.getElementById('service-price').value);
  if (totalAmount <= 0) {
    alert('Please select a service first');
    return;
  }

  isLaunchingPayment = true;
  razorpayOpt.querySelector('input').checked = true;
  razorpayOpt.classList.add('selected');
  updatePriceDisplay();

  try {
    // Create Razorpay order
    const response = await fetch(`${getBackendURL()}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: totalAmount })
    });

    const order = await response.json();
    if (!response.ok || !order.key_id) throw new Error(order.error || 'Payment gateway is not configured');

    // Razorpay options
    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'MechWay',
      description: `Service Payment - ${service}`,
      order_id: order.id,

    handler: async function (response) {
      try {
        // Submit payment record to backend after Razorpay success
        const paymentData = {
          customerName,
          customerPhone,
          vehicleType,
          vehicleBrand,
          vehicleModel,
          vehicleNumber,
          vehicleColor,
          service,
          servicePrice: parseFloat(document.getElementById('service-price').value),
          platformFee: 0,
          totalAmount: parseFloat(document.getElementById('service-price').value),
          paymentMethod: 'online',
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
          mechanicName,
          mechanicPhone,
          mechanicId,
          bookingId,
          originalMessage: message
        };

        const res = await fetch(`${getBackendURL()}/api/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });

        const result = await res.json();

        if (res.ok && result.ok) {
          // ✅ Payment successful — redirect to booking confirmed page with mechanic details
          const confirmedParams = new URLSearchParams({
            customerName:  paymentData.customerName,
            customerPhone: paymentData.customerPhone,
            vehicleType:   paymentData.vehicleType,
            vehicleBrand:  vehicleBrand,
            vehicleModel:  vehicleModel,
            vehicleNumber: vehicleNumber,
            service:       paymentData.service,
            totalAmount:   paymentData.totalAmount,
            paymentMethod: 'online',
            paymentId:     response.razorpay_payment_id,
            mechanicName:  paymentData.mechanicName  || '',
            mechanicPhone: paymentData.mechanicPhone || '',
            bookingId:     paymentData.bookingId     || ''
          });
          window.location.href = '/pages/booking-confirmed.html?' + confirmedParams.toString();
        } else {
          alert('Payment recorded but verification failed. Contact support with Payment ID: ' + response.razorpay_payment_id);
        }
      } catch (error) {
        console.error('Payment submission error:', error);
        alert('Payment successful but could not save record. Payment ID: ' + response.razorpay_payment_id + '\nContact support.');
      }
    },

      prefill: {
        name: customerName,
        contact: customerPhone
      },
      modal: {
        ondismiss: function () {
          // User closed/cancelled Razorpay modal
        }
      },
      theme: {
        color: '#d32f2f'
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Razorpay error:', error);
    alert('Payment initialization failed. Please try again or contact support.');
  } finally {
    isLaunchingPayment = false;
  }
}


// ── Mechanic Card Logic
let leafMap = null;



// ── Form submission
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const base = updatePriceDisplay();
  if (base === 0) {
    alert('Please select a valid service to continue.');
    return;
  }

  const payMethod = document.querySelector('input[name="payment-method"]:checked').value;

  if (payMethod === 'razorpay') {
    const btn = document.getElementById('submit-pay-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening Razorpay…';

    try {
      await launchRazorpayPayment();
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-shield-alt"></i> Confirm & Complete Payment';
    }
  } else {
    // Cash on Service flow
    const btn = document.getElementById('submit-pay-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';

    const svcValue  = svSel.value === 'other'
      ? document.getElementById('other-service-details').value.trim()
      : svSel.value;

    const formData = {
      customerName,
      customerPhone,
      vehicleType: vtSel.value,
      vehicleBrand,
      vehicleModel,
      vehicleNumber,
      vehicleColor,
      service:        svcValue,
      servicePrice:   base,
      platformFee:    0,
      totalAmount:    base,
      paymentMethod:  payMethod,
      mechanicName:   mechanicName || 'To be assigned',
      mechanicPhone:  mechanicPhone || '',
      mechanicId:     mechanicId   || '',
      bookingId:      bookingId    || '',
      originalMessage: message
    };

    try {
      const res = await fetch(`${getBackendURL()}/api/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();

      if (res.ok && result.ok) {
        const confirmedParams = new URLSearchParams({
          customerName:  formData.customerName,
          customerPhone: formData.customerPhone,
          vehicleType:   formData.vehicleType,
          vehicleBrand:  vehicleBrand,
          vehicleModel:  vehicleModel,
          vehicleNumber: vehicleNumber,
          service:       formData.service,
          totalAmount:   formData.totalAmount,
          paymentMethod: formData.paymentMethod,
          paymentId:     result.id || '',
          mechanicName:  formData.mechanicName  || '',
          mechanicPhone: formData.mechanicPhone || '',
          bookingId:     formData.bookingId     || ''
        });
        window.location.href = '/pages/booking-confirmed.html?' + confirmedParams.toString();
      } else {
        throw new Error(result.error || 'Payment processing failed');
      }
    } catch(err) {
      alert('❌ Payment Failed!\n\n' + err.message + '\n\nPlease try again or call support.');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-shield-alt"></i> Confirm & Complete Payment';
    }
  }
});

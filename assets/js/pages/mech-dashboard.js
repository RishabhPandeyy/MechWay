
/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
const USE_DEPLOYED = false;
const BACKEND = (() => {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
  if (USE_DEPLOYED) return 'https://newonwheels.onrender.com';
  return isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
})();

let mechData = null;
let token = localStorage.getItem('mechanicToken');
let pollTimer = null;
let pendingRequests = [];  // bookings waiting for accept/reject
let activeJob = null;      // currently accepted job
let lastCompletedJob = null;
let savedWorkSlips = [];

// Guard: redirect if no token
if (!token) location.href = '/pages/mech-login.html';

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  requestNotifPermission();
});

/* ══════════════════════════════════════════
   PROFILE LOAD
══════════════════════════════════════════ */
async function loadProfile() {
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/profile`, { headers: auth() });
    const d = await r.json();
    if (!d.ok) { doLogout(); return; }
    mechData = d.mechanic;
    updateHeaderUI();
    updateAvailUI();
    populateModals();
    await loadEarnings();
    await loadWorkSlips();
    
    // Start real-time polling if already available
    if (mechData.isAvailable) startPolling();
  } catch(e) { console.error('Profile load error:', e); }
}

function auth() { return { 'Authorization': `Bearer ${token}` }; }

function updateHeaderUI() {
  document.getElementById('hdrName').textContent = mechData.name || 'Mechanic';
  document.getElementById('wName').textContent = mechData.name || 'Mechanic';
}

function updateAvailUI() {
  const tog = document.getElementById('availToggle');
  const lbl = document.getElementById('statusLbl');
  const pill = document.getElementById('livePill');
  const liveText = document.getElementById('liveText');
  const avail = mechData.isAvailable;
  tog.checked = avail;
  lbl.textContent = avail ? 'Available' : 'Unavailable';
  lbl.className = 'status-lbl ' + (avail ? 'on' : 'off');
  pill.className = 'live-pill ' + (avail ? 'live' : 'offline');
  liveText.textContent = avail ? '🟢 Live — Visible to customers' : '⚫ Offline';
}

function populateModals() {
  document.getElementById('profName').value  = mechData.name || '';
  document.getElementById('profPhone').value = mechData.phone || '';
  document.getElementById('profType').value  = mechData.mechanicType || 'both';
  document.getElementById('profArea').value  = mechData.serviceArea || '';
  document.getElementById('profLoc').value   = mechData.serviceArea || '';
  document.getElementById('profLat').value   = mechData.latitude || '';
  document.getElementById('profLng').value   = mechData.longitude || '';
  document.getElementById('bankUpi').value      = mechData.upiId || '';
  document.getElementById('bankBankName').value = mechData.bankName || '';
  document.getElementById('bankAcc').value      = mechData.bankAccountNo ? '****' + mechData.bankAccountNo.slice(-4) : '';
  document.getElementById('bankIfsc').value     = mechData.bankIfsc || '';
}

/* ══════════════════════════════════════════
   EARNINGS
══════════════════════════════════════════ */
async function loadEarnings() {
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/earnings`, { headers: auth() });
    const d = await r.json();
    if (!d.ok) return;
    const s = d.summary;
    const totalEarnings = Number(s.totalEarnings) || 0;
    const pendingPayout = Number(s.pendingPayout) || 0;
    const totalPayouts = Number(s.totalPayouts) || 0;
    const availableBalance = Number.isFinite(Number(s.availableBalance))
      ? Number(s.availableBalance)
      : Math.max(0, totalEarnings - pendingPayout - totalPayouts);

    document.getElementById('statEarn').textContent = '₹' + totalEarnings;
    document.getElementById('statPend').textContent = '₹' + pendingPayout;
    document.getElementById('statJobs').textContent = s.totalJobs || 0;
    document.getElementById('statBal').textContent  = '₹' + availableBalance;
    document.getElementById('payBal').value = '₹' + availableBalance;
    // History
    const tbody = document.getElementById('histBody');
    if (d.payoutRequests?.length) {
      tbody.innerHTML = d.payoutRequests.map(p => `
        <tr>
          <td>${new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
          <td>₹${p.amount}</td>
          <td>${p.paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'}</td>
          <td><span class="badge-pill ${p.status}">${p.status}</span></td>
        </tr>`).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--slate);">No payout history yet</td></tr>';
    }
  } catch(e) { console.error('Earnings error:', e); }
}

async function loadWorkSlips() {
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/work-slips`, { headers: auth() });
    const d = await r.json();
    if (!d.ok) return;
    const slips = Array.isArray(d.slips) ? d.slips : [];
    savedWorkSlips = slips;
    const list = document.getElementById('workSlipList');
    if (!list) return;
    if (!slips.length) {
      list.innerHTML = '<div class="slip-empty">No work slips submitted yet</div>';
      return;
    }
    list.innerHTML = slips.slice(0, 6).map(item => `
      <div class="slip-card">
        <h4>${escapeHtml(item.customerName || 'Customer')} • ${escapeHtml(item.vehicleType || 'Vehicle')}</h4>
        <p><strong>Summary:</strong> ${escapeHtml(item.workSlip?.summary || '—')}</p>
        <p><strong>Work Done:</strong> ${escapeHtml(item.workSlip?.workDone || '—')}</p>
        <p><strong>Total:</strong> ₹${Number(item.workSlip?.totalCharge || 0)}</p>
        <p><strong>MechWay share (10%):</strong> ${item.workSlip?.platformCommission == null ? 'Not calculated' : `₹${Number(item.workSlip.platformCommission).toFixed(2)}`} · <strong>Estimated mechanic share:</strong> ${item.workSlip?.mechanicEarnings == null ? 'Not calculated' : `₹${Number(item.workSlip.mechanicEarnings).toFixed(2)}`}</p>
        <p><strong>Saved:</strong> ${item.workSlip?.submittedAt ? new Date(item.workSlip.submittedAt).toLocaleString('en-IN') : '—'}</p>
        <p><strong>Customer delivery:</strong> ${item.workSlip?.delivery?.status === 'sent' ? 'Accepted by WhatsApp' : 'Not confirmed'}</p>
        ${item.customerPhone ? `<button type="button" class="slip-card-share" data-share-slip="${escapeHtml(item._id)}"><i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp</button> <button type="button" class="slip-card-share" data-sms-slip="${escapeHtml(item._id)}"><i class="fas fa-comment-sms" aria-hidden="true"></i> SMS</button>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('Work slips error:', e);
  }
}

document.getElementById('workSlipList').addEventListener('click', event => {
  const button = event.target.closest('[data-share-slip], [data-sms-slip]');
  if (!button) return;
  const item = savedWorkSlips.find(slip => String(slip._id) === (button.dataset.shareSlip || button.dataset.smsSlip));
  if (!item) return;
  const payload = {
    ...item.workSlip,
    bookingId: item._id
  };
  const url = button.dataset.smsSlip ? buildWorkSlipSmsUrl(item.customerPhone, item.customerName, payload) : buildWorkSlipWhatsAppUrl(item.customerPhone, item.customerName, payload);
  if (url) window.location.href = url;
});

/* ══════════════════════════════════════════
   AVAILABILITY TOGGLE
══════════════════════════════════════════ */
async function toggleAvail() {
  const isAvail = document.getElementById('availToggle').checked;
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/availability`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: isAvail })
    });
    const d = await r.json();
    if (d.ok) {
      mechData = d.mechanic || d.user || { ...mechData, isAvailable: isAvail };
      localStorage.setItem('mechanicData', JSON.stringify(mechData));
      updateAvailUI();
      if (isAvail) {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      document.getElementById('availToggle').checked = !isAvail;
    }
  } catch(e) {
    document.getElementById('availToggle').checked = !isAvail;
    console.error('Toggle error:', e);
  }
}

/* ══════════════════════════════════════════
   REAL-TIME POLLING — robust, with error visibility
   Tries /api/mechanic/nearby-bookings first,
   then /api/bookings/pending as fallback.
   Polls every 6 seconds. Shows status on page.
══════════════════════════════════════════ */
let pollConsecutiveErrors = 0;

function startPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } // reset cleanly
  setPollUI('active', 'Listening for new booking requests…');
  checkBookings(); // fire immediately on start
  pollTimer = setInterval(checkBookings, 6000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  setPollUI('hidden', '');
  document.getElementById('drawerPollBar').classList.remove('show');
}

function setPollUI(state, text) {
  const bar  = document.getElementById('pollBar');
  const span = document.getElementById('pollBarText');
  const dBar = document.getElementById('drawerPollBar');
  const dTxt = document.getElementById('drawerPollText');
  if (state === 'active') {
    bar.classList.add('show');
    bar.classList.remove('error');
    span.textContent = text;
    dBar.classList.add('show');
    dTxt.textContent = text;
  } else if (state === 'error') {
    bar.classList.add('show', 'error');
    span.textContent = text;
    dBar.classList.add('show');
    dTxt.textContent = text;
  } else {
    bar.classList.remove('show', 'error');
    dBar.classList.remove('show');
  }
}

async function checkBookings() {
  if (!mechData?.isAvailable) return;

  // ── Try primary endpoint ──────────────────────────────────────────
  let bookings = null;
  let lastErr  = '';

  // Try 1: /api/mechanic/nearby-bookings  (authenticated, uses mechanic GPS)
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/nearby-bookings`, {
      headers: auth(),
      signal: AbortSignal.timeout(7000)
    });
    if (r.ok) {
      const d = await r.json();
      if (d.ok && Array.isArray(d.bookings)) {
        bookings = d.bookings;
      } else if (d.ok && Array.isArray(d.data)) {
        bookings = d.data;
      } else if (Array.isArray(d)) {
        bookings = d;
      }
    } else {
      lastErr = `nearby-bookings HTTP ${r.status}`;
    }
  } catch(e) { lastErr = 'nearby-bookings: ' + e.message; }

  // Try 2: /api/bookings/pending  (fallback — broader endpoint)
  if (bookings === null) {
    try {
      const r2 = await fetch(`${BACKEND}/api/bookings/pending`, {
        headers: auth(),
        signal: AbortSignal.timeout(7000)
      });
      if (r2.ok) {
        const d2 = await r2.json();
        if (Array.isArray(d2.bookings)) bookings = d2.bookings;
        else if (d2.ok && Array.isArray(d2.data)) bookings = d2.data;
        else if (Array.isArray(d2)) bookings = d2;
        else if (d2.ok) bookings = []; // ok but empty
      } else {
        lastErr += ' | pending HTTP ' + r2.status;
      }
    } catch(e2) { lastErr += ' | pending: ' + e2.message; }
  }

  // Try 3: /api/booking/pending  (singular form)
  if (bookings === null) {
    try {
      const r3 = await fetch(`${BACKEND}/api/booking/pending`, {
        headers: auth(),
        signal: AbortSignal.timeout(7000)
      });
      if (r3.ok) {
        const d3 = await r3.json();
        if (Array.isArray(d3.bookings)) bookings = d3.bookings;
        else if (Array.isArray(d3)) bookings = d3;
        else if (d3.ok) bookings = [];
      }
    } catch(e3) { /* ignore */ }
  }

  // ── Handle result ─────────────────────────────────────────────────
  if (bookings === null) {
    // All endpoints failed
    pollConsecutiveErrors++;
    if (pollConsecutiveErrors >= 3) {
      setPollUI('error', `⚠ Can't reach server (${lastErr.slice(0,60)})`);
    }
    return;
  }

  pollConsecutiveErrors = 0;

  // Filter: only show bookings that match this mechanic's service area (within ~5 km)
  // and have status = 'pending' or no status field
  const mechLat = parseFloat(mechData.latitude  || 0);
  const mechLng = parseFloat(mechData.longitude || 0);

  const relevant = bookings.filter(b => {
    const status = (b.status || 'pending').toLowerCase();
    if (status !== 'pending' && status !== 'new' && status !== '') return false;

    const preferredMechanicId = String(b.preferredMechanicId || '').trim();
    const currentMechanicId = String(mechData._id || mechData.id || '').trim();
    
    if (preferredMechanicId && currentMechanicId) {
      if (preferredMechanicId !== currentMechanicId) return false;
      return true; // Bypass distance filter for direct requests!
    }

    // If mechanic has GPS, filter by distance
    if (mechLat && mechLng && b.latitude && b.longitude) {
      const dist = haversineKm(mechLat, mechLng, parseFloat(b.latitude), parseFloat(b.longitude));
      return dist <= 10; // Increased to 10 km to avoid dropping edge cases
    }
    return true; // no GPS data — show all pending
  });

  const now = Date.now();
  setPollUI('active', `🟢 Live — last checked ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`);

  const relevantIds = new Set(relevant.map(b => String(b._id || b.id || '')));
  const beforeCount = pendingRequests.length;
  pendingRequests = pendingRequests.filter(b => relevantIds.has(String(b._id || b.id || '')));
  const removedTaken = beforeCount - pendingRequests.length;
  if (removedTaken > 0) {
    renderRequests();
    setPollUI('active', `🟢 Live — ${removedTaken} work item${removedTaken > 1 ? 's were' : ' was'} already taken by someone else`);
  }

  // Surface only genuinely new bookings
  const knownIds = pendingRequests.map(p => p._id || p.id);
  const fresh    = relevant.filter(b => !knownIds.includes(b._id || b.id));

  if (!fresh.length) return;

  pendingRequests = [...pendingRequests, ...fresh];
  renderRequests();
  flashBell(fresh.length);
  browserNotif(fresh.length);
  // Auto-open drawer so mechanic sees it immediately
  document.getElementById('notifDrawer').classList.add('open');
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function renderRequests() {
  const list = document.getElementById('notifList');
  if (!pendingRequests.length) {
    list.innerHTML = '<div class="nd-empty"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.3;"></i>No pending requests</div>';
    document.getElementById('badge').classList.remove('show');
    return;
  }
  const count = pendingRequests.length;
  document.getElementById('badge').textContent = count;
  document.getElementById('badge').classList.add('show');

  list.innerHTML = pendingRequests.map(b => {
    const id       = b._id || b.id || '';
    const ago      = timeAgo(b.createdAt);
    const phone    = b.phone    || b.customerPhone    || 'N/A';
    const custName = b.name     || b.customerName     || 'Customer';
    const vType    = b.vehicleType || b.vehicle_type  || 'Vehicle';
    const vBrand   = b.vehicleBrand || '';
    const vModel   = b.vehicleModel || '';
    const problem  = b.problem  || b.service          || b.serviceType || '—';
    const locMsg   = b.message  || b.location         || b.address     || '—';
    const dist     = b.distance != null ? Number(b.distance).toFixed(2) + ' km' : '';

    return `<div class="req-card" id="rc_${id}">
      <div class="rc-head">
        <div class="rc-title">
          <i class="fas fa-${vType.toLowerCase()==='bike'?'motorcycle':'car'}"></i>
          ${vType}${vBrand || vModel ? ` ${vBrand} ${vModel}`.trim() : ''} — ${problem}
        </div>
        <span class="rc-time">${ago}</span>
      </div>
      <div class="rc-row"><strong>Customer:</strong> ${custName}</div>
      <div class="rc-row"><strong>Phone:</strong> ${phone}</div>
      <div class="rc-row"><strong>Model:</strong> ${vBrand} ${vModel || ''}</div>
      <div class="rc-row"><strong>Issue:</strong> ${problem}</div>
      <div class="rc-row"><strong>Location:</strong> ${truncate(locMsg, 90)}</div>
      ${dist ? `<div class="rc-row"><strong>Distance:</strong> <span style="color:var(--primary);font-weight:600;">${dist} away</span></div>` : ''}
      <div class="rc-btns">
        <button class="rc-btn accept" id="acc_${id}" data-action="accept-booking" data-id="${id}">
          <i class="fas fa-check"></i> Accept
        </button>
        <button class="rc-btn reject" data-action="reject-booking" data-id="${id}">
          <i class="fas fa-times"></i> Decline
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   ACCEPT BOOKING  →  Share real mechanic details to customer
══════════════════════════════════════════ */
async function acceptBooking(bookingId) {
  const bookingObj = pendingRequests.find(b => String(b._id || b.id) === String(bookingId));
  const custName = bookingObj?.name || bookingObj?.customerName || 'Customer';
  const custPhone = bookingObj?.phone || bookingObj?.customerPhone || '';
  const vType = bookingObj?.vehicleType || bookingObj?.vehicle_type || 'Vehicle';
  const vBrand = bookingObj?.vehicleBrand || '';
  const vModel = bookingObj?.vehicleModel || '';
  const problem = bookingObj?.problem || bookingObj?.service || bookingObj?.serviceType || '—';
  const locStr = truncate(bookingObj?.message || bookingObj?.location || bookingObj?.address || '—', 60);
  const accBtn = document.getElementById('acc_' + bookingId);
  if (accBtn) { accBtn.disabled = true; accBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accepting…'; }

  try {
    const r = await fetch(`${BACKEND}/api/mechanic/accept-booking`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        mechanicDetails: {
          id:           mechData._id  || mechData.id,
          name:         mechData.name,
          phone:        mechData.phone,
          mechanicType: mechData.mechanicType,
          serviceArea:  mechData.serviceArea,
          latitude:     mechData.latitude,
          longitude:    mechData.longitude,
          rating:       mechData.rating     || 4.5,
          experience:   mechData.experience || '3-5 yrs'
        }
      })
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Server rejected accept');

    // Remove from pending
    pendingRequests = pendingRequests.filter(b => (b._id || b.id) !== bookingId);

    // Replace card with confirmed card
    const card = document.getElementById('rc_' + bookingId);
    if (card) {
      card.outerHTML = `<div class="accepted-card">
        <h5><i class="fas fa-check-circle"></i> Accepted — ${vType || ''} job</h5>
        <div class="cust-detail"><strong>Customer:</strong> ${custName}</div>
        <div class="cust-detail"><strong>Problem:</strong> ${problem}</div>
        <div class="cust-detail"><strong>Location:</strong> ${locStr}</div>
        <div class="cust-detail" style="color:var(--success);font-size:0.78rem;margin-top:0.3rem;">
          ✅ Your name &amp; phone shared with customer
        </div>
        <a class="call-btn" href="tel:${custPhone}">
          <i class="fas fa-phone"></i> Call ${custName}
        </a>
      </div>`;
    }

    // Update badge
    const remaining = pendingRequests.length;
    document.getElementById('badge').textContent = remaining;
    if (!remaining) document.getElementById('badge').classList.remove('show');

    // Show active job banner
    activeJob = { bookingId, custName, custPhone, vType, vBrand, vModel, problem, locStr };
    showActiveJob();
    setTimeout(loadEarnings, 2000);

  } catch(e) {
    if (
      String(e.message || '').includes('Someone has already accepted the work') ||
      String(e.message || '').includes('This work is already') ||
      String(e.message || '').includes('no longer available')
    ) {
      pendingRequests = pendingRequests.filter(b => (b._id || b.id) !== bookingId);
      renderRequests();
      alert('This work is already taken by someone.');
      return;
    }
    if (String(e.message || '').includes('This work was sent to another mechanic first')) {
      pendingRequests = pendingRequests.filter(b => (b._id || b.id) !== bookingId);
      renderRequests();
    }
    alert('Could not accept booking: ' + e.message);
    if (accBtn) { accBtn.disabled = false; accBtn.innerHTML = '<i class="fas fa-check"></i> Accept'; }
  }
}

async function rejectBooking(bookingId) {
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/reject-booking`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Could not decline booking');

    pendingRequests = pendingRequests.filter(b => (b._id || b.id) !== bookingId);
    const card = document.getElementById('rc_' + bookingId);
    if (card) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => { if(card.parentNode) card.remove(); }, 320);
    }
    const remaining = pendingRequests.length;
    document.getElementById('badge').textContent = remaining;
    if (!remaining) document.getElementById('badge').classList.remove('show');
  } catch (e) {
    alert('Could not decline booking: ' + e.message);
  }
}

document.getElementById('notifList').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const bookingId = button.dataset.id;
  if (!bookingId) return;

  if (button.dataset.action === 'accept-booking') {
    acceptBooking(bookingId);
    return;
  }

  if (button.dataset.action === 'reject-booking') {
    rejectBooking(bookingId);
  }
});

function showActiveJob() {
  if (!activeJob) return;
  const banner = document.getElementById('activeJobBanner');
  document.getElementById('ajName').textContent    = activeJob.custName || '—';
  document.getElementById('ajService').textContent = activeJob.problem  || '—';
  document.getElementById('ajLocation').textContent= activeJob.locStr   || '—';
  document.getElementById('ajCall').href           = 'tel:' + (activeJob.custPhone || '');
  banner.classList.add('show');
}

function getSlipTargetJob() {
  return activeJob || lastCompletedJob || null;
}

function openWorkSlipModal() {
  const target = getSlipTargetJob();
  document.getElementById('slipMsg').className = 'msg';
  document.getElementById('slipMsg').innerHTML = '';
  document.getElementById('slipShareLink').hidden = true;
  document.getElementById('slipSmsLink').hidden = true;

  if (!target?.bookingId) {
    document.getElementById('slipBookingLabel').value = 'No booking selected yet';
    document.getElementById('slipBookingId').value = '';
    openModal('workSlipModal');
    showMsg('slipMsg', 'Accept or complete a booking first, then send the work slip.', 'err');
    return;
  }

  if (document.getElementById('slipBookingId').value !== target.bookingId) {
    for (const id of ['slipWorkDone', 'slipPartsUsed', 'slipLabourCharge', 'slipPartsCharge', 'slipTotalCharge', 'slipNotes']) {
      document.getElementById(id).value = '';
    }
    updateSlipTotal();
  }
  document.getElementById('slipBookingId').value = target.bookingId;
  document.getElementById('slipBookingLabel').value = `${target.custName || 'Customer'} • ${target.problem || 'Service'} • ${target.bookingId}`;
  document.getElementById('slipSummary').value = target.problem ? `${target.problem} completed` : '';
  openModal('workSlipModal');
}

function updateSlipTotal() {
  const labour = Number(document.getElementById('slipLabourCharge').value || 0);
  const parts = Number(document.getElementById('slipPartsCharge').value || 0);
  const totalPaise = Math.round(labour * 100) + Math.round(parts * 100);
  const commissionPaise = Math.round(totalPaise * 0.1);
  document.getElementById('slipTotalCharge').value = totalPaise / 100;
  document.getElementById('slipCommission').textContent = `₹${(commissionPaise / 100).toFixed(2)}`;
  document.getElementById('slipMechanicShare').textContent = `₹${((totalPaise - commissionPaise) / 100).toFixed(2)}`;
}
['slipLabourCharge', 'slipPartsCharge'].forEach(id => document.getElementById(id).addEventListener('input', updateSlipTotal));

async function submitWorkSlip() {
  const bookingId = document.getElementById('slipBookingId').value;
  if (!bookingId) {
    showMsg('slipMsg', 'No booking selected for work slip', 'err');
    return;
  }

  const labourCharge = Number(document.getElementById('slipLabourCharge').value || 0);
  const partsCharge = Number(document.getElementById('slipPartsCharge').value || 0);
  const totalCharge = (Math.round(labourCharge * 100) + Math.round(partsCharge * 100)) / 100;
  if (![labourCharge, partsCharge, totalCharge].every(value => Number.isFinite(value) && value >= 0)) {
    showMsg('slipMsg', 'Enter valid non-negative labour and parts charges.', 'err');
    return;
  }

  const payload = {
    bookingId,
    summary: document.getElementById('slipSummary').value.trim(),
    workDone: document.getElementById('slipWorkDone').value.trim(),
    partsUsed: document.getElementById('slipPartsUsed').value.trim(),
    labourCharge,
    partsCharge,
    totalCharge,
    notes: document.getElementById('slipNotes').value.trim()
  };

  const btn = document.querySelector('#workSlipModal .mb');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/work-slip`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!d.ok) {
      showMsg('slipMsg', '❌ ' + (d.error || 'Could not send work slip'), 'err');
      return;
    }
    const customerPhone = String(d.customerPhone || getSlipTargetJob()?.custPhone || '').replace(/\D/g, '');
    const customerName = d.customerName || getSlipTargetJob()?.custName || 'Customer';
    const savedSlip = d.workSlip || payload;
    const shareLink = document.getElementById('slipShareLink');
    const smsLink = document.getElementById('slipSmsLink');
    const whatsappUrl = buildWorkSlipWhatsAppUrl(customerPhone, customerName, { ...savedSlip, paymentLink: d.paymentLink || '' });
    const smsUrl = buildWorkSlipSmsUrl(customerPhone, customerName, { ...savedSlip, paymentLink: d.paymentLink || '' });
    shareLink.href = whatsappUrl;
    smsLink.href = smsUrl;
    smsLink.hidden = !smsUrl;
    shareLink.hidden = true;
    document.getElementById('slipCommission').textContent = `₹${Number(savedSlip.platformCommission || 0).toFixed(2)}`;
    document.getElementById('slipMechanicShare').textContent = `₹${Number(savedSlip.mechanicEarnings || 0).toFixed(2)}`;
    showMsg('slipMsg', 'Work slip saved. Checking WhatsApp delivery...', 'ok');
    await loadWorkSlips();
    try {
      const sendRes = await fetch(`${BACKEND}/api/mechanic/send-workslip-whatsapp`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      if (sendRes.ok && sendJson.ok) {
        showMsg('slipMsg', 'WhatsApp accepted the work slip for the customer.', 'ok');
        await loadWorkSlips();
      } else {
        showMsg('slipMsg', 'Work slip saved, but automatic delivery is unavailable. Open WhatsApp or SMS below and press Send on your phone.', 'err');
        shareLink.hidden = !whatsappUrl;
      }
    } catch (err) {
      showMsg('slipMsg', 'Work slip saved, but automatic delivery failed. Open WhatsApp or SMS below and press Send on your phone.', 'err');
      shareLink.hidden = !whatsappUrl;
    }
  } catch (e) {
    showMsg('slipMsg', '❌ ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Work Slip';
  }
}

function buildWorkSlipMessage(customerName, payload) {
  const labour = Number(payload.labourCharge || 0);
  const parts = Number(payload.partsCharge || 0);
  const total = Number(payload.totalCharge || (labour + parts));
  const paymentLink = payload.paymentLink || '';
  return [
    '🔧 MechWay Work Slip',
    '',
    `Hello ${customerName || 'Customer'},`,
    `Summary: ${payload.summary || '—'}`,
    `Work Done: ${payload.workDone || '—'}`,
    `Parts Used: ${payload.partsUsed || '—'}`,
    `Labour Charge: ₹${labour}`,
    `Parts Charge: ₹${parts}`,
    `Total Charge: ₹${total}`,
    ...(paymentLink ? [`Pay securely with Razorpay: ${paymentLink}`] : []),
    `Notes: ${payload.notes || '—'}`,
    '',
    `Mechanic: ${mechData?.name || 'Mechanic'}`,
    `Phone: ${mechData?.phone || '—'}`
  ].join('\n');
}

function buildWorkSlipWhatsAppUrl(phone, customerName, payload) {
  let raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) raw = '91' + raw;
  if (!/^91[6-9]\d{9}$/.test(raw)) return '';
  return `https://wa.me/${raw}?text=${encodeURIComponent(buildWorkSlipMessage(customerName, payload))}`;
}

function buildWorkSlipSmsUrl(phone, customerName, payload) {
  let raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) raw = '91' + raw;
  if (!/^91[6-9]\d{9}$/.test(raw)) return '';
  return `sms:+${raw}?body=${encodeURIComponent(buildWorkSlipMessage(customerName, payload))}`;
}

async function markJobComplete() {
  if (!activeJob) return;
  
  // Open OTP modal instead of directly marking complete
  document.getElementById('otpCustomerPhone').textContent = activeJob.custPhone || '—';
  document.getElementById('otpInput').value = '';
  document.getElementById('otpMsg').style.display = 'none';
  document.getElementById('verifyOtpBtn').style.display = 'none';
  document.getElementById('generateOtpBtn').style.display = 'inline-flex';
  openModal('otpModal');
}

async function generateOTP() {
  if (!activeJob) {
    showMsg('otpMsg', 'No active job found', 'err');
    return;
  }
  
  const btn = document.getElementById('generateOtpBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
  
  try {
    const response = await fetch(`${BACKEND}/api/mechanic/generate-otp`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: activeJob.bookingId })
    });
    const data = await response.json();
    
    if (data.ok) {
      showMsg('otpMsg', '✅ OTP sent to customer!', 'ok');
      // Display OTP for testing purposes
      if (data.otp) {
        showMsg('otpMsg', `✅ OTP: <strong style="font-size:1.5rem;letter-spacing:3px;">${data.otp}</strong><br><small>Also logged in server console</small>`, 'ok');
      }
      document.getElementById('generateOtpBtn').style.display = 'none';
      document.getElementById('verifyOtpBtn').style.display = 'inline-flex';
      document.getElementById('otpInput').focus();
    } else {
      showMsg('otpMsg', '❌ ' + (data.error || 'Failed to send OTP'), 'err');
    }
  } catch(e) {
    showMsg('otpMsg', '❌ Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP to Customer';
  }
}

async function verifyOTP() {
  if (!activeJob) {
    showMsg('otpMsg', 'No active job found', 'err');
    return;
  }
  
  const otp = document.getElementById('otpInput').value.trim();
  if (!otp || otp.length !== 6) {
    showMsg('otpMsg', '❌ Please enter a valid 6-digit OTP', 'err');
    return;
  }
  
  const btn = document.getElementById('verifyOtpBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
  
  try {
    const response = await fetch(`${BACKEND}/api/mechanic/verify-otp`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: activeJob.bookingId, otp: otp })
    });
    const data = await response.json();
    
    if (data.ok) {
      showMsg('otpMsg', '✅ Job completed successfully!', 'ok');
      closeModal('otpModal');
      if (typeof data.amount === 'number' && data.amount > 0) {
        const currentEarn = parseFloat(document.getElementById('statEarn').textContent.replace(/[^\d.]/g, '')) || 0;
        const currentPend = parseFloat(document.getElementById('statPend').textContent.replace(/[^\d.]/g, '')) || 0;
        const nextEarn = currentEarn + data.amount;
        const nextBal = Math.max(0, nextEarn - currentPend);
        document.getElementById('statEarn').textContent = '₹' + nextEarn;
        document.getElementById('statBal').textContent = '₹' + nextBal;
        document.getElementById('payBal').value = '₹' + nextBal;
      }
      lastCompletedJob = { ...activeJob };
      activeJob = null;
      document.getElementById('activeJobBanner').classList.remove('show');
      await loadEarnings();
      await loadWorkSlips();
      alert('✅ Job completed successfully!\n\nThe customer has verified the service with OTP.');
    } else {
      showMsg('otpMsg', '❌ ' + (data.error || 'Wrong OTP'), 'err');
    }
  } catch(e) {
    showMsg('otpMsg', '❌ Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Verify OTP';
  }
}

/* ══════════════════════════════════════════
   BELL / NOTIFICATIONS
══════════════════════════════════════════ */
function toggleDrawer() {
  document.getElementById('notifDrawer').classList.toggle('open');
}

function flashBell(count) {
  const bell = document.getElementById('bellWrap');
  bell.classList.add('ringing');
  setTimeout(() => bell.classList.remove('ringing'), 3000);
}

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function browserNotif(count) {
  if (Notification.permission === 'granted') {
    new Notification('🔧 New Booking Request!', {
      body: `You have ${count} new service request${count > 1 ? 's' : ''} near you!`,
      icon: '/assets/images/mechway.png'
    });
  }
}

/* ══════════════════════════════════════════
   PAYOUT
══════════════════════════════════════════ */
async function doPayout() {
  const meth = document.getElementById('payMeth').value;
  const availableText = document.getElementById('payBal').value || '';
  const availableAmount = parseFloat(String(availableText).replace(/[^\d.]/g, ''));
  if (!availableAmount || availableAmount <= 0) { showMsg('payMsg', 'No available balance to withdraw', 'err'); return; }
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/request-payout`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: meth })
    });
    const d = await r.json();
    if (d.ok) {
      showMsg('payMsg', '✅ Payout request submitted!', 'ok');
      setTimeout(() => { closeModal('payoutModal'); loadEarnings(); }, 2000);
    } else { showMsg('payMsg', '❌ ' + d.error, 'err'); }
  } catch(e) { showMsg('payMsg', '❌ ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request'; }
}

/* ══════════════════════════════════════════
   PROFILE UPDATE
══════════════════════════════════════════ */
let locTimer;
function searchLoc(q) {
  const box = document.getElementById('locSugg');
  clearTimeout(locTimer);
  if (q.length < 3) { box.style.display = 'none'; return; }
  locTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q+', India')}&limit=5`);
      const data = await r.json();
      if (data?.length) {
        box.innerHTML = data.map(x =>
          `<div onclick="pickLoc('${x.display_name.replace(/'/g,"\\'")}',${x.lat},${x.lon})"><i class="fas fa-map-marker-alt"></i>${x.display_name}</div>`
        ).join('');
        box.style.display = 'block';
      } else box.style.display = 'none';
    } catch(e) { box.style.display = 'none'; }
  }, 300);
}
function pickLoc(addr, lat, lon) {
  document.getElementById('profLoc').value = addr;
  document.getElementById('profLat').value = lat;
  document.getElementById('profLng').value = lon;
  document.getElementById('locSugg').style.display = 'none';
}
document.addEventListener('click', e => {
  if (!document.getElementById('profLoc')?.contains(e.target)) {
    const b = document.getElementById('locSugg');
    if(b) b.style.display = 'none';
  }
});

async function doUpdateProfile() {
  const lat = document.getElementById('profLat').value;
  const lng = document.getElementById('profLng').value;
  if (!lat || !lng) { showMsg('profMsg', 'Please select a location from the suggestions', 'err'); return; }
  const payload = {
    name:          document.getElementById('profName').value.trim(),
    phone:         document.getElementById('profPhone').value.trim(),
    mechanicType:  document.getElementById('profType').value,
    serviceArea:   document.getElementById('profArea').value.trim() || document.getElementById('profLoc').value.trim(),
    latitude:      lat,
    longitude:     lng
  };
  const btn = event.target;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/update-profile`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.ok) {
      mechData = d.mechanic;
      localStorage.setItem('mechanicData', JSON.stringify(mechData));
      showMsg('profMsg', '✅ Profile updated!', 'ok');
      setTimeout(() => { closeModal('profileModal'); updateHeaderUI(); populateModals(); }, 1500);
    } else { showMsg('profMsg', '❌ ' + d.error, 'err'); }
  } catch(e) { showMsg('profMsg', '❌ ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
}

async function doUpdateBank() {
  const upi = document.getElementById('bankUpi').value.trim();
  const acc = document.getElementById('bankAcc').value.trim();
  if (!upi && !acc) { showMsg('bankMsg', 'Provide UPI ID or Bank Account details', 'err'); return; }
  const payload = {
    upiId:         upi,
    bankName:      document.getElementById('bankBankName').value.trim(),
    bankAccountNo: acc.startsWith('****') ? '' : acc,
    bankIfsc:      document.getElementById('bankIfsc').value.trim()
  };
  const btn = event.target;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  try {
    const r = await fetch(`${BACKEND}/api/mechanic/update-profile`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.ok) {
      showMsg('bankMsg', '✅ Bank details updated!', 'ok');
      setTimeout(() => closeModal('bankModal'), 1500);
    } else { showMsg('bankMsg', '❌ ' + d.error, 'err'); }
  } catch(e) { showMsg('bankMsg', '❌ ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Bank Details'; }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showMsg(id, txt, type) {
  const el = document.getElementById(id);
  el.innerHTML = txt;
  el.className = 'msg ' + type;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function doLogout() {
  stopPolling();
  localStorage.removeItem('mechanicToken');
  localStorage.removeItem('mechanicData');
  location.href = '/pages/mech-login.html';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return new Date(dateStr).toLocaleDateString('en-IN');
}

function truncate(str, n) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// Close drawer on outside click
document.addEventListener('click', e => {
  const drawer = document.getElementById('notifDrawer');
  const bell   = document.getElementById('bellWrap');
  if (!drawer.contains(e.target) && !bell.contains(e.target)) {
    drawer.classList.remove('open');
  }
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
});

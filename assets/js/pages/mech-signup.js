
  const menuToggle = document.getElementById('mobile-menu');
  const navMenu = document.getElementById('nav-menu');
  function setMenuOpen(open) {
    navMenu.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    menuToggle.querySelector('i').className = open ? 'fas fa-times' : 'fas fa-bars';
  }
  menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
  navMenu.addEventListener('click', event => { if (event.target.closest('a')) setMenuOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenuOpen(false); });

  /* ── CONFIG ── */
  const BACKEND = (() => {
    const explicitBackend =
      window.__MECHWAY_API__ ||
      localStorage.getItem('mechwayApiBase') ||
      '';
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
    if (explicitBackend) return explicitBackend.replace(/\/$/, '');
    return isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
  })();

  let curPage = 1;

  /* ── STEP UI ── */
  function goTo(n) {
    if (n > curPage && !validate(curPage)) return;
    // Hide current
    document.getElementById('pg' + curPage).classList.remove('active');
    // Update steps
    for (let i = 1; i <= 4; i++) {
      const s = document.getElementById('stp' + i);
      s.classList.remove('active','done');
      const num = s.querySelector('.step-num');
      if (i < n) { s.classList.add('done'); num.innerHTML = '<i class="fas fa-check" style="font-size:0.65rem;"></i>'; }
      else { if(i === n) s.classList.add('active'); num.textContent = i; }
    }
    for (let i = 1; i <= 3; i++) {
      const l = document.getElementById('ln' + i);
      if (l) l.classList.toggle('done', i < n);
    }
    curPage = n;
    document.getElementById('pg' + n).classList.add('active');
    clearToast();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── VALIDATION ── */
  function validate(p) {
    clearToast();
    if (p === 1) {
      if (!v('name')) return err('Please enter your full name');
      if (!/^\d{10}$/.test(v('phone'))) return err('Enter a valid 10-digit phone number');
      if (!v('address')) return err('Please enter your service address');
      if (!/^\d{12}$/.test(v('aadharNo'))) return err('Enter a valid 12-digit Aadhar number');
      if (!v('mechanicType')) return err('Please select a service type');
    }
    if (p === 2) {
      if (!document.getElementById('latitude').value) return err('Please capture your GPS location — required for nearby customer matching');
    }
    if (p === 3) {
      const upi = v('upiId'), bank = v('bankAccountNo');
      if (!upi && !bank) return err('Provide either UPI ID or Bank Account details for payouts');
    }
    return true;
  }
  const v = id => document.getElementById(id).value.trim();
  function err(msg) { showToast(msg, 'err'); return false; }
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    t.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  function clearToast() { document.getElementById('toast').className = 'toast'; }

  /* ── LOCATION AUTOSUGGEST ── */
  const serviceAreaInput = document.getElementById('serviceArea');
  const serviceAreaSuggBox = document.getElementById('serviceArea-suggestions');
  let serviceSearchTimer;

  serviceAreaInput.addEventListener('input', function() {
    const q = this.value.trim();
    clearTimeout(serviceSearchTimer);
    if (q.length < 3) { serviceAreaSuggBox.style.display = 'none'; return; }
    serviceSearchTimer = setTimeout(async () => {
      try {
        const resp = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ', Prayagraj'));
        const data = await resp.json();
        if (data?.length > 0) {
          serviceAreaSuggBox.innerHTML = data.slice(0,5).map(r =>
            `<div class="sugg-item" onclick="selectServiceLocation('${r.display_name.replace(/'/g,"\\'")}',${r.lat},${r.lon})"><i class="fas fa-map-marker-alt"></i>${r.display_name}</div>`
          ).join('');
          serviceAreaSuggBox.style.display = 'block';
        } else { serviceAreaSuggBox.style.display = 'none'; }
      } catch(e) { serviceAreaSuggBox.style.display = 'none'; }
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!serviceAreaInput.contains(e.target) && !serviceAreaSuggBox.contains(e.target)) {
      serviceAreaSuggBox.style.display = 'none';
    }
  });

  function selectServiceLocation(addr, lat, lon) {
    serviceAreaInput.value = addr;
    document.getElementById('latitude').value = parseFloat(lat).toFixed(6);
    document.getElementById('longitude').value = parseFloat(lon).toFixed(6);
    serviceAreaSuggBox.style.display = 'none';
    document.getElementById('locOk').classList.add('show');
    document.getElementById('locText').textContent = '📍 Area selected: ' + addr;
    document.getElementById('locBtn').innerHTML = '<i class="fas fa-crosshairs"></i> Update with Exact GPS Location';
    document.getElementById('locBtn').style.borderColor = 'var(--border)';
  }

  function applyCapturedLocation(lat, lon, labelPrefix = '📍 GPS: ') {
    document.getElementById('latitude').value = Number(lat).toFixed(6);
    document.getElementById('longitude').value = Number(lon).toFixed(6);
    document.getElementById('locOk').classList.add('show');
    const fallbackLabel = `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
    document.getElementById('locText').textContent = labelPrefix + fallbackLabel;

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => {
        const a = d?.address;
        const label = [a?.road, a?.suburb, a?.city_district, a?.city, a?.town, a?.state]
          .filter(Boolean)
          .join(', ') || fallbackLabel;
        document.getElementById('locText').textContent = labelPrefix + label;
        serviceAreaInput.value = label;
      })
      .catch(() => {
        document.getElementById('locText').textContent = labelPrefix + fallbackLabel;
        if (!serviceAreaInput.value.trim()) serviceAreaInput.value = fallbackLabel;
      });
  }

  function handleGeoError(errObj) {
    const code = errObj?.code;
    if (!window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      err('Exact GPS works only on HTTPS in mobile browsers. Open this page on a secure deployed URL.');
      return;
    }
    if (code === 1) {
      err('Location permission denied. Please allow location access in your browser settings and try again.');
      return;
    }
    if (code === 2) {
      err('Could not detect your location. Please turn on GPS/location services and try again.');
      return;
    }
    if (code === 3) {
      err('Location request timed out. Move to open sky or better network and try again.');
      return;
    }
    err('Could not capture exact location. Please try again.');
  }

  /* ── GPS ── */
  document.getElementById('locBtn').addEventListener('click', function() {
    if (!navigator.geolocation) { err('Geolocation not supported on this device/browser'); return; }
    if (!window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      err('Exact GPS works only on HTTPS in mobile browsers. Use your secure deployed URL.');
      return;
    }

    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting exact location…';

    const success = pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      btn.innerHTML = '<i class="fas fa-check" style="color:var(--success);"></i> Exact Location Captured!';
      btn.style.borderColor = 'var(--success)';
      btn.disabled = false;
      applyCapturedLocation(lat, lon);
    };

    const fallbackSuccess = pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      btn.innerHTML = '<i class="fas fa-check" style="color:var(--success);"></i> Approx Location Captured!';
      btn.style.borderColor = 'var(--success)';
      btn.disabled = false;
      applyCapturedLocation(lat, lon, '📍 Approx GPS: ');
    };

    const failure = geoErr => {
      navigator.geolocation.getCurrentPosition(
        fallbackSuccess,
        secondErr => {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-crosshairs"></i> Capture Exact GPS Location';
          handleGeoError(secondErr || geoErr);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      success,
      failure,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ── PASSWORD STRENGTH ── */
  document.getElementById('password').addEventListener('input', function() {
    const pw = this.value;
    let sc = 0;
    if (pw.length >= 6) sc++;
    if (pw.length >= 10) sc++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) sc++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) sc++;
    const colors = ['','#ef4444','#f97316','#eab308','#22c55e'];
    const labels = ['','Weak','Fair','Good','Strong 💪'];
    for (let i = 1; i <= 4; i++) {
      document.getElementById('pb' + i).style.background = i <= sc ? colors[sc] : 'var(--border)';
    }
    const lbl = document.getElementById('pwLbl');
    lbl.textContent = sc > 0 ? 'Strength: ' + labels[sc] : '';
    lbl.style.color = colors[sc] || 'var(--slate)';
  });

  /* ── SUBMIT ── */
  document.getElementById('signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate(4)) return;
    const pw = v('password'), cpw = v('confirmPassword');
    if (pw !== cpw) { err('Passwords do not match!'); return; }
    if (!v('email')) { err('Email address is required for password reset.'); return; }
    if (!document.getElementById('terms').checked) { err('Please accept the Terms & Conditions'); return; }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account…';

    const payload = {
      name:          v('name'),
      phone:         v('phone'),
      email:         v('email'),
      address:       v('address'),
      aadharNo:      v('aadharNo'),
      mechanicType:  v('mechanicType'),
      experience:    v('experience'),
      serviceArea:   v('serviceArea'),
      latitude:      document.getElementById('latitude').value,
      longitude:     document.getElementById('longitude').value,
      upiId:         v('upiId'),
      bankName:      v('bankName'),
      bankAccountNo: v('bankAccountNo'),
      bankIfsc:      v('bankIfsc'),
      password:      pw,
      isAvailable:   false  // Pending approval
    };

    try {
      const res = await fetch(`${BACKEND}/api/mechanic/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Registration failed');

      // Show success
      document.getElementById('mainPanel').style.display = 'none';
      document.getElementById('steps').style.display = 'none';
      document.getElementById('footerNote').style.display = 'none';
      clearToast();
      document.getElementById('showMechId').textContent = data.mechanic?._id || data.mechanic?.id || '—';
      document.getElementById('successWrap').classList.add('show');
    } catch (ex) {
      showToast('❌ ' + ex.message, 'err');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Register as Mechanic';
    }
  });

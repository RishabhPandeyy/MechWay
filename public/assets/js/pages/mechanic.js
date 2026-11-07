
  var leafletMap, userLat = '', userLng = '', selectedLocationText = '', bookingData = {}, selectedMech = null;
  const PRAYAGRAJ = { lat: 25.4358, lng: 81.8463 };

  const getBackendURL = () =>
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:')
      ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

  function distKm(lat, lng) {
    const R = 6371, dLat = (PRAYAGRAJ.lat - lat) * Math.PI/180, dLon = (PRAYAGRAJ.lng - lng) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(PRAYAGRAJ.lat*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  const inPrayagraj = (lat, lng) => distKm(lat, lng) <= 15;

  // Mobile nav
  document.getElementById('ham-btn').onclick = () => document.getElementById('mobile-nav').classList.add('open');
  document.getElementById('mob-close').onclick = () => document.getElementById('mobile-nav').classList.remove('open');

  // Vehicle brands and common model suggestions
  const VEHICLE_DATA = {
    Car: {
      Maruti: ['Swift', 'Baleno', 'WagonR', 'Dzire', 'Alto', 'Brezza', 'Ertiga', 'Celerio', 'Fronx', 'Ignis'],
      Hyundai: ['i10', 'Grand i10', 'i20', 'Verna', 'Creta', 'Venue', 'Exter', 'Aura', 'Alcazar', 'Santro'],
      Tata: ['Tiago', 'Tigor', 'Altroz', 'Punch', 'Nexon', 'Harrier', 'Safari', 'Indica', 'Nano'],
      Mahindra: ['Bolero', 'Scorpio', 'Thar', 'XUV300', 'XUV700', 'XUV500', 'Marazzo'],
      Kia: ['Seltos', 'Sonet', 'Carens', 'Carnival', 'Syros'],
      Toyota: ['Innova', 'Innova Crysta', 'Fortuner', 'Glanza', 'Urban Cruiser', 'Hyryder', 'Etios'],
      Honda: ['City', 'Amaze', 'Jazz', 'WR-V', 'Brio', 'Elevate'],
      Renault: ['Kwid', 'Triber', 'Kiger', 'Duster'],
      Nissan: ['Magnite', 'Micra', 'Sunny', 'Terrano'],
      Skoda: ['Slavia', 'Kushaq', 'Rapid', 'Superb'],
      Volkswagen: ['Polo', 'Vento', 'Virtus', 'Taigun', 'Ameo'],
      Ford: ['EcoSport', 'Figo', 'Aspire', 'Endeavour'],
      MG: ['Hector', 'Astor', 'Gloster', 'Comet', 'ZS EV']
    },
    Bike: {
      Hero: ['Splendor', 'HF Deluxe', 'Passion', 'Glamour', 'Xpulse', 'Xtreme', 'Super Splendor', 'Pleasure'],
      Honda: ['Shine', 'SP 125', 'Activa', 'Dio', 'Unicorn', 'Hornet', 'CB350', 'Livo'],
      TVS: ['Apache RTR 160', 'Apache RTR 200', 'Jupiter', 'Ntorq', 'Raider', 'Sport', 'XL100'],
      Bajaj: ['Pulsar 125', 'Pulsar 150', 'Pulsar NS200', 'Platina', 'CT 110', 'Avenger', 'Dominar'],
      'Royal Enfield': ['Classic 350', 'Bullet 350', 'Hunter 350', 'Meteor 350', 'Himalayan', 'Thunderbird'],
      Yamaha: ['R15', 'FZ', 'FZ-S', 'MT-15', 'RayZR', 'Fascino'],
      Suzuki: ['Access 125', 'Burgman', 'Gixxer', 'Avenis'],
      KTM: ['Duke 125', 'Duke 200', 'RC 200', 'Adventure 250'],
      Jawa: ['42', 'Classic', 'Perak'],
      'Hero Honda': ['Splendor', 'Passion', 'CD Deluxe', 'Karizma']
    }
  };
  const BRANDS = {
    Car: Object.keys(VEHICLE_DATA.Car),
    Bike: Object.keys(VEHICLE_DATA.Bike)
  };

  function updateVehicleModelSuggestions() {
    const type = document.getElementById('vehicle-type').value;
    const brand = document.getElementById('vehicle-brand').value;
    const modelInput = document.getElementById('vehicle-model');
    const dataList = document.getElementById('vehicle-model-suggestions');
    const models = VEHICLE_DATA[type]?.[brand] || [];
    dataList.innerHTML = models.map(model => `<option value="${model}">`).join('');
    modelInput.placeholder = models.length
      ? `e.g. ${models[0]}`
      : 'Enter model and year';
  }

  document.getElementById('vehicle-type').addEventListener('change', function() {
    const sel = document.getElementById('vehicle-brand');
    sel.innerHTML = '<option value="">Select Brand…</option>';
    (BRANDS[this.value]||[]).forEach(b => sel.add(new Option(b,b)));
    document.getElementById('vehicle-specifics').classList.toggle('show', !!this.value);
    document.getElementById('vehicle-model').value = '';
    updateVehicleModelSuggestions();
    updatePrice();
  });
  document.getElementById('vehicle-brand').addEventListener('change', updateVehicleModelSuggestions);

  const initialSelection = new URLSearchParams(window.location.search);
  const initialVehicle = initialSelection.get('vehicleType');
  const initialService = initialSelection.get('service');
  if (['Car', 'Bike'].includes(initialVehicle)) {
    const vehicleInput = document.getElementById('vehicle-type');
    vehicleInput.value = initialVehicle;
    vehicleInput.dispatchEvent(new Event('change'));
  }
  const serviceInput = document.getElementById('problem');
  const homepageServices = ['Full Vehicle Inspection', 'Basic Diagnosis', 'Tyre Puncture Repair', 'Brake Adjustment', 'Clutch and Throttle Cable Adjustment', 'Chain Cleaning and Lubrication', 'Electrical and Lights Check', 'Battery Jump-Start', 'Brake Inspection', 'AC Diagnosis', 'Flat Tyre Spare Fitting', 'Engine Overheating Diagnosis', 'Basic Electrical Inspection', 'Tyre Repair'];
  if (homepageServices.includes(initialService) && ![...serviceInput.options].some(option => option.value === initialService)) serviceInput.add(new Option(initialService, initialService));
  if ([...serviceInput.options].some(option => option.value === initialService)) serviceInput.value = initialService;
  document.getElementById('message').value = (initialSelection.get('location') || '').slice(0, 1000);
  const initialLatitude = Number(initialSelection.get('latitude'));
  const initialLongitude = Number(initialSelection.get('longitude'));
  if (initialSelection.get('location') && Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude)
      && Math.abs(initialLatitude) <= 90 && Math.abs(initialLongitude) <= 180
      && initialSelection.has('latitude') && initialSelection.has('longitude')) {
    userLat = initialLatitude;
    userLng = initialLongitude;
    selectedLocationText = document.getElementById('message').value;
  }
  document.getElementById('booking-date').min = new Date().toLocaleDateString('en-CA');
  updatePrice();

  document.getElementById('phone').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
  });

  document.getElementById('name').addEventListener('input', function() {
    this.setCustomValidity('');
  });

  document.getElementById('vehicle-model').addEventListener('input', function() {
    this.value = this.value.replace(/[^a-zA-Z0-9 .-]/g, '').slice(0, 40);
  });

  function getVisitPrice() {
    const isCar = document.getElementById('vehicle-type').value === 'Car';
    return isCar ? 279 : 199;
  }

  function updatePrice() {
    const st = document.getElementById('service-type').value;
    if (!st && !document.getElementById('problem').value) return;
    document.getElementById('estimated-price').textContent = getVisitPrice();
    document.getElementById('original-visit-price').textContent = document.getElementById('vehicle-type').value === 'Car' ? '₹899' : '₹499';
    document.getElementById('price-display').classList.remove('hidden');
  }

  document.getElementById('service-type').addEventListener('change', function() {
    const isTimeslot = this.value === 'timeslot';
    document.getElementById('timeslot-row').style.display = isTimeslot ? 'flex' : 'none';
    if (!isTimeslot) {
      document.getElementById('time-slot').value = '';
      if (document.getElementById('booking-date')) document.getElementById('booking-date').value = '';
    }
    updatePrice();
  });
  document.getElementById('problem').addEventListener('change', updatePrice);

  const initialMode = initialSelection.get('serviceType');
  if (['emergency', 'timeslot'].includes(initialMode)) {
    const visitInput = document.getElementById('service-type');
    visitInput.value = initialMode;
    visitInput.dispatchEvent(new Event('change'));
    if (initialMode === 'timeslot') {
      const date = initialSelection.get('bookingDate') || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= document.getElementById('booking-date').min) {
        document.getElementById('booking-date').value = date;
      }
      const slot = initialSelection.get('timeSlot');
      if (['morning', 'afternoon', 'evening', 'night'].includes(slot)) document.getElementById('time-slot').value = slot;
    }
  }

  // Geolocation
  document.getElementById('getLocationBtn').addEventListener('click', function() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';
    navigator.geolocation.getCurrentPosition(p => {
      const lat = p.coords.latitude, lon = p.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lon)
        .then(r => r.json()).then(d => {
          const addr = d?.display_name || `${lat}, ${lon}`;
          selectedLocationText = addr;
          document.getElementById('message').value = 'Location: ' + addr;
          userLat = lat; userLng = lon;
          this.disabled = false; this.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
        }).catch(() => {
          selectedLocationText = `${lat}, ${lon}`;
          document.getElementById('message').value = `Location: ${lat}, ${lon}`;
          userLat = lat; userLng = lon;
          this.disabled = false; this.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
        });
    }, () => {
      alert('Location access denied');
      this.disabled = false; this.innerHTML = '<i class="fas fa-location-crosshairs" aria-hidden="true"></i>';
    });
  });

  // The shared place search keeps the chosen address and coordinates together.
  const msgInput = document.getElementById('message');
  msgInput.addEventListener('input', () => { selectedLocationText = ''; userLat = ''; userLng = ''; });
  msgInput.addEventListener('location-selected', event => {
    selectedLocationText = event.detail.address;
    userLat = Number(event.detail.lat);
    userLng = Number(event.detail.lon);
  });

  function getTypedLocationQuery() {
    if (selectedLocationText && userLat && userLng) return '';
    const raw = document.getElementById('message').value.trim();
    if (!raw) return '';

    const coordinateMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (coordinateMatch) {
      userLat = parseFloat(coordinateMatch[1]);
      userLng = parseFloat(coordinateMatch[2]);
      return '';
    }

    return raw
      .split('\n')
      .map(line => line.replace(/^location\s*:\s*/i, '').trim())
      .find(Boolean) || '';
  }

  async function geocodeTypedLocation() {
    if (userLat && userLng) return true;

    const query = getTypedLocationQuery();
    if (!query) return Boolean(userLat && userLng);

    try {
      const fullQuery = /prayagraj|allahabad|uttar pradesh/i.test(query) ? query : query + ', Prayagraj, Uttar Pradesh, India';
      const response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' + encodeURIComponent(fullQuery));
      const results = await response.json();
      if (!Array.isArray(results) || !results.length) return false;

      userLat = parseFloat(results[0].lat);
      userLng = parseFloat(results[0].lon);
      const locationText = results[0].display_name;
      selectedLocationText = locationText;
      document.getElementById('message').value = 'Location: ' + locationText;
      return Number.isFinite(userLat) && Number.isFinite(userLng);
    } catch (err) {
      console.error('Location geocode failed:', err);
      return false;
    }
  }

  // ── HAVERSINE — real distance only, zero fake data ───────────────────────
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // ── SAVE BOOKING TO BACKEND ─────────────────────────────────────────────
  async function saveBookingToBackend(selectedMechanic = null) {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const vt = document.getElementById('vehicle-type').value;
    const vehicleBrand = document.getElementById('vehicle-brand').value;
    const vehicleModel = document.getElementById('vehicle-model').value.trim();
    const vehicleNumber = '';
    const vehicleColor = '';
    const problem = document.getElementById('problem').value;
    const servicePrice = getVisitPrice();
    const message = document.getElementById('message').value.trim();
    
    const bookingPayload = {
      name,
      phone: phone.replace(/\D/g,''),
      vehicleType: vt,
      vehicleBrand,
      vehicleModel,
      vehicleNumber,
      vehicleColor,
      problem,
      serviceType: document.getElementById('service-type')?.value || '',
      timeSlot: document.getElementById('time-slot')?.value || bookingData.timeSlot || '',
      bookingDate: document.getElementById('booking-date')?.value || bookingData.bookingDate || '',
      servicePrice,
      message,
      latitude: userLat.toString(),
      longitude: userLng.toString(),
      mechanicId: selectedMechanic?.id || '',
      mechanicName: selectedMechanic?.name || '',
      mechanicPhone: selectedMechanic?.phone || ''
    };

    try {
      const response = await fetch(getBackendURL() + '/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });
      const result = await response.json();
      
      if (result.ok) {
        console.log('✅ Booking saved to backend:', result.id);
        return result.id; // Return booking ID
      } else {
        console.warn('Backend booking save failed, using local storage');
        return null;
      }
    } catch (err) {
      console.error('Error saving booking:', err);
      return null;
    }
  }

  // Submit - collect details first, show confirmation popup before dispatch
  document.getElementById('submit-booking-btn').addEventListener('click', async function() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const vt = document.getElementById('vehicle-type').value;
    const vehicleBrand = document.getElementById('vehicle-brand').value;
    const vehicleModel = document.getElementById('vehicle-model').value.trim();
    const vehicleNumber = '';
    const vehicleColor = '';
    const problem = document.getElementById('problem').value;
    const msg = document.getElementById('message').value.trim();
    const selectedTimeslot = document.getElementById('time-slot')?.value;

    if (!name) {
      const nameInput = document.getElementById('name');
      nameInput.focus();
      nameInput.setCustomValidity('Please enter your name.');
      nameInput.reportValidity();
      return;
    }
    if (!phone || !vt || !problem || !msg) {
      alert('Please add your phone number, vehicle, service and location.');
      return;
    }
    if (document.getElementById('service-type').value === 'timeslot' && (!selectedTimeslot || !document.getElementById('booking-date').value)) {
      alert('Please choose a date and time slot for scheduled service.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }
    if (vehicleModel && vehicleModel.length < 2) {
      alert('Please enter a valid vehicle model.');
      return;
    }
    if (!userLat || !userLng) {
      const resolved = await geocodeTypedLocation();
      if (!resolved) {
        alert('Please enter a clearer location or use "Use My Current Location" button');
        return;
      }
    }

    bookingData = {
      name,
      phone: phone.replace(/\D/g,''),
      vehicleType: vt,
      vehicleBrand,
      vehicleModel,
      vehicleNumber,
      vehicleColor,
      problem,
      serviceType: document.getElementById('service-type').value,
      timeSlot: selectedTimeslot || '',
      bookingDate: document.getElementById('booking-date')?.value || '',
      message: msg,
      bookingId: '',
      mechanicId: '',
      mechanicName: '',
      mechanicPhone: ''
    };

    renderConfirmationSummary();
    openConfirmationModal();
  });

  function openConfirmationModal() {
    document.getElementById('confirmation-modal').classList.add('active');
    document.getElementById('confirm-details-checkbox').checked = false;
    document.getElementById('confirm-submit-btn').disabled = true;
  }

  function closeConfirmationModal() {
    document.getElementById('confirmation-modal').classList.remove('active');
  }

  function renderConfirmationSummary() {
    const content = document.getElementById('confirm-content');
    const serviceTypeText = document.getElementById('service-type').selectedOptions[0]?.textContent || '';
    const timeSlotText = document.getElementById('time-slot')?.selectedOptions[0]?.textContent || 'None';
    const locationText = selectedLocationText || bookingData.message || 'N/A';

    content.innerHTML = `
      <div class="confirm-item"><label>Date</label><span>${document.getElementById('booking-date')?.value || 'ASAP'}</span></div>
      <div class="confirm-item"><label>Name</label><span>${bookingData.name || 'N/A'}</span></div>
      <div class="confirm-item"><label>Phone</label><span>${bookingData.phone || 'N/A'}</span></div>
      <div class="confirm-item"><label>Vehicle Type</label><span>${bookingData.vehicleType || 'N/A'}</span></div>
      <div class="confirm-item"><label>Brand</label><span>${bookingData.vehicleBrand || 'N/A'}</span></div>
      <div class="confirm-item"><label>Model</label><span>${bookingData.vehicleModel || 'N/A'}</span></div>
      <div class="confirm-item"><label>Vehicle Number</label><span>${bookingData.vehicleNumber || 'N/A'}</span></div>
      <div class="confirm-item"><label>Service Type</label><span>${serviceTypeText}</span></div>
      <div class="confirm-item"><label>Time Slot</label><span>${timeSlotText}</span></div>
      <div class="confirm-item"><label>Service Required</label><span>${bookingData.problem || 'N/A'}</span></div>
      <div class="confirm-item"><label>Vehicle Color</label><span>${bookingData.vehicleColor || 'N/A'}</span></div>
      <div class="confirm-item"><label>Location</label><span style="text-align:left;white-space:pre-line;word-break:break-word;">${locationText}</span></div>
      <p class="confirm-note">Please review your details carefully and tick the checkbox before confirming.</p>
    `;
  }

  document.getElementById('confirm-details-checkbox')?.addEventListener('change', function() {
    document.getElementById('confirm-submit-btn').disabled = !this.checked;
  });

  function confirmBookingAndSearch() {
    closeConfirmationModal();
    showMechanics(userLat, userLng);
  }

  function closeModal() { document.getElementById('mechanic-modal').classList.remove('active'); }

  function initMap(lat, lng, mechanics) {
    const mapDiv = document.getElementById('map');
    const loadingDiv = document.getElementById('map-loading');
    if (!mapDiv) return;
    try {
      if (leafletMap) { leafletMap.remove(); }
      mapDiv.innerHTML = '';
      leafletMap = L.map('map').setView([lat||25.4358, lng||81.8463], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leafletMap);

      // Draw 3–4 km radius circle around user
      L.circle([lat, lng], {
        color: '#d32f2f', fillColor: 'rgba(211,47,47,0.07)',
        fillOpacity: 0.4, weight: 2, dashArray: '6,4', radius: 4000
      }).addTo(leafletMap).bindPopup('<b>4 km Search Radius</b>');

      const blueIcon = L.icon({ iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', iconSize:[25,41], iconAnchor:[12,41] });
      const redIcon  = L.icon({ iconUrl:'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',  iconSize:[25,41], iconAnchor:[12,41] });

      L.marker([lat, lng], {icon: blueIcon}).addTo(leafletMap).bindPopup('<b>📍 Your Location</b>');

      if (mechanics && mechanics.length) {
        mechanics.forEach(m => {
          if (m.latitude && m.longitude) {
            L.marker([m.latitude, m.longitude], {icon: redIcon}).addTo(leafletMap)
             .bindPopup(`<b>🔧 ${m.name}</b><br>${m.distance.toFixed(2)} km away<br>⭐ ${m.rating}`);
          }
        });
      }

      setTimeout(() => {
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (leafletMap) leafletMap.invalidateSize();
      }, 500);
    } catch(e) { if (loadingDiv) loadingDiv.innerHTML = 'Map unavailable'; }
  }

  // ── SHOW REAL MECHANICS FROM MONGODB ─────────────────────────────────────
  // No fake data, no offline fallback. Shows only mechanics who:
  //   • Are registered in MongoDB
  //   • Have isAvailable = true
  //   • Are within 4 km of customer's GPS
  async function showMechanics(lat, lng) {
    userLat = lat; userLng = lng;
    document.getElementById('mechanic-modal').classList.add('active');
    renderSearching();

    const vt = (document.getElementById('vehicle-type')?.value || '').toLowerCase();
    let mechanics = [];
    let fetchError = false;

    try {
      let url = `${getBackendURL()}/api/mechanics?lat=${lat}&lng=${lng}&radius=4`;
      if (vt) url += `&type=${vt}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const data = await res.json();

      if (data.ok && data.mechanics?.length > 0) {
        mechanics = data.mechanics.map(m => {
          // Normalise speciality array from mechanicType string
          const typeMap = { car: ['Car'], bike: ['Bike'], both: ['Car','Bike'] };
          const speciality = typeMap[(m.mechanicType||'').toLowerCase()] || ['Car','Bike'];
          const dist = m.distance != null
            ? parseFloat(m.distance)
            : haversineKm(lat, lng, parseFloat(m.latitude), parseFloat(m.longitude));
          const isAvailable = m.isAvailable !== false;
          return { ...m, _id: m._id || m.id, speciality, distance: dist, isAvailable };
        })
        .filter(m => m.isAvailable)
        .filter(m => Number.isFinite(m.distance))
        .filter(m => m.distance <= 4.0)
        .sort((a, b) => a.distance - b.distance);
      }
    } catch(err) {
      fetchError = true;
      console.error('Backend error:', err);
    }

    // Render map (even if empty, show user pin + radius)
    setTimeout(() => initMap(lat, lng, mechanics), 200);

    if (fetchError) {
      // Backend unreachable — do NOT simulate. Tell the user.
      document.getElementById('mechanics-list').innerHTML = `
        <div style="text-align:center;padding:2rem;">
          <i class="fas fa-wifi" style="font-size:2.5rem;color:#444;display:block;margin-bottom:1rem;"></i>
          <div style="font-family:var(--heading);font-size:1.1rem;font-weight:800;text-transform:uppercase;color:var(--white);margin-bottom:0.5rem;">Connection Error</div>
          <p style="font-size:0.88rem;margin-bottom:1.5rem;line-height:1.6;">Could not reach the server. Please check your internet connection and try again.</p>
          <button class="btn-accept" onclick="retrySearch()" style="width:100%;padding:0.9rem;">
            <i class="fas fa-redo" style="margin-right:6px;"></i>Retry
          </button>
        </div>`;
      return;
    }

    if (mechanics.length === 0) {
      // Real result: no registered mechanics are available nearby right now
      document.getElementById('mechanics-list').innerHTML = `
        <div style="text-align:center;padding:2rem;">
          <i class="fas fa-map-marker-alt" style="font-size:2.5rem;color:#444;display:block;margin-bottom:1rem;"></i>
          <div style="font-family:var(--heading);font-size:1.2rem;font-weight:800;text-transform:uppercase;color:var(--white);margin-bottom:0.5rem;">No Mechanics Available Nearby</div>
          <p style="font-size:0.9rem;margin-bottom:0.6rem;line-height:1.6;">
            No registered mechanics are currently online within 4 km of your location.
          </p>
          <p style="font-size:0.82rem;color:#666;margin-bottom:1.5rem;">Submit the request and our team will manually assign a mechanic and call you shortly.</p>
          <button class="btn-accept" onclick="proceedAnyway()" style="width:100%;padding:0.9rem;">
            <i class="fas fa-headset" style="margin-right:6px;"></i>Submit Booking — We'll Call You
          </button>
        </div>`;
      return;
    }

    // ── Render real mechanics ──
    const availableMechanics = mechanics.filter(m => m.isAvailable);
    const within3 = availableMechanics.filter(m => m.distance <= 3).length;
    let html = `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:var(--green);
                  padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:0.85rem;
                  font-weight:600;display:flex;align-items:center;gap:0.5rem;">
        <i class="fas fa-check-circle"></i>
        <span>
          Found <strong>${availableMechanics.length}</strong> available of <strong>${mechanics.length}</strong> nearby mechanic${mechanics.length>1?'s':''}
          ${within3 > 0 ? `· <span style="color:#7effc4">${within3} within 3 km</span>` : ''}
        </span>
      </div>`;

    mechanics.forEach(m => {
      const isAvailable = Boolean(m.isAvailable);
      const dist       = m.distance.toFixed(2);
      const distColor  = m.distance <= 2 ? '#22c55e' : m.distance <= 3 ? '#facc15' : 'var(--orange)';
      const eta        = isAvailable ? Math.round(m.distance * 4 + 5) : null;
      const rating     = m.rating || '—';
      const experience = m.experience || '—';
      const specialBadge = m.speciality.map(s =>
        `<span style="font-size:0.68rem;background:rgba(211,47,47,0.15);border:1px solid rgba(211,47,47,0.3);
                      color:var(--orange);padding:0.1rem 0.45rem;border-radius:100px;margin-right:3px;">${s}</span>`
      ).join('');

      // Safe-escape name and phone for onclick attribute
      const safeName  = (m.name  || 'Mechanic').replace(/'/g, "\\'");
      const safePhone = (m.phone || '').replace(/'/g, "\\'");

      html += `
        <div class="mech-card ${isAvailable ? '' : 'unavailable'}" style="flex-direction:column;gap:0.7rem;align-items:stretch;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="mech-name" style="margin-bottom:0.3rem;">
                <i class="fas fa-wrench" style="color:var(--orange);font-size:0.8rem;margin-right:6px;"></i>
                ${m.name || 'Mechanic'}
              </div>
              <div style="margin-bottom:0.35rem;">${specialBadge}</div>
              <div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">
                ${rating !== '—' ? `<span style="font-size:0.78rem;color:var(--text);">⭐ ${rating}</span>` : ''}
                ${experience !== '—' ? `<span style="font-size:0.78rem;color:var(--text);">· ${experience}</span>` : ''}
                <span style="font-size:0.78rem;font-weight:700;color:${distColor};">
                  <i class="fas fa-map-marker-alt" style="margin-right:3px;"></i>${dist} km
                </span>
                ${isAvailable
                  ? `<span style="font-size:0.78rem;color:var(--text);"><i class="fas fa-clock" style="margin-right:3px;color:var(--orange);"></i>~${eta} min ETA</span>`
                  : `<span style="font-size:0.78rem;color:#888;"><i class="fas fa-ban" style="margin-right:3px;"></i>Unavailable now</span>`}
              </div>
            </div>
            <span class="mech-status ${isAvailable ? '' : 'unavailable'}" style="flex-shrink:0;">${isAvailable ? 'Available' : 'Unavailable'}</span>
          </div>
          ${isAvailable
            ? `<button class="btn-accept" style="width:100%;padding:0.65rem;" onclick="sendRequest('${m._id}','${safeName}','${safePhone}','${bookingData.bookingId||''}')"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Send Request</button>`
            : `<button class="btn-accept" style="width:100%;padding:0.65rem;" disabled><i class="fas fa-lock" style="margin-right:6px;"></i>Unavailable</button>`}
        </div>`;
    });

    html += `
      <button class="btn-proceed" onclick="proceedAnyway()">
        <i class="fas fa-headset" style="margin-right:6px;"></i>Let MechWay Assign a Mechanic
      </button>`;

    document.getElementById('mechanics-list').innerHTML = html;
  }

  function renderSearching() {
    document.getElementById('mechanics-list').innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;">
        <i class="fas fa-satellite-dish" style="font-size:2rem;color:var(--orange);display:block;margin-bottom:1rem;"></i>
        <div style="font-size:0.9rem;color:var(--white);font-weight:600;margin-bottom:0.4rem;">Finding nearby mechanics…</div>
        <div style="font-size:0.82rem;color:var(--text);">Finding mechanics registered &amp; online within 4 km</div>
      </div>`;
  }

  function retrySearch() {
    if (userLat && userLng) showMechanics(userLat, userLng);
  }

  // ── SEND REAL REQUEST TO MECHANIC ─────────────────────────────────────────
  // Posts the booking request to backend so mechanic sees it on their dashboard.
  // Then polls /api/booking/:id every 4 s to check if the mechanic accepted.
  async function sendRequest(mechanicId, mechanicName, mechanicPhone, bookingId) {
    selectedMech = { id: mechanicId, name: mechanicName, phone: mechanicPhone };
    bookingData  = { ...bookingData, mechanicId, mechanicName, mechanicPhone };

    document.getElementById('mechanics-list').innerHTML = `
      <div class="booking-status">
        <div class="icon"><i class="fas fa-circle-notch fa-spin"></i></div>
        <h4>Request Sent to ${mechanicName}</h4>
        <p style="font-size:0.88rem;">Waiting for <strong>${mechanicName}</strong> to accept…</p>
        <p style="font-size:0.8rem;color:#666;margin-top:0.5rem;">This usually takes under 60 seconds</p>
      </div>`;

    try {
      let activeBookingId = bookingId || bookingData.bookingId || '';

      if (!activeBookingId) {
        activeBookingId = await saveBookingToBackend(selectedMech);
        if (!activeBookingId) throw new Error('Could not create booking request');
      } else {
        const notifyRes = await fetch(`${getBackendURL()}/api/mechanic/notify-booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: activeBookingId,
            mechanicId,
            mechanicName,
            mechanicPhone,
            customerName: bookingData.name,
            customerPhone: bookingData.phone,
            vehicleType: bookingData.vehicleType,
            problem: bookingData.problem,
            message: bookingData.message,
            bookingDate: bookingData.bookingDate || document.getElementById('booking-date')?.value || '',
            latitude: userLat,
            longitude: userLng
          })
        });
        const notifyData = await notifyRes.json().catch(() => ({}));
        if (!notifyRes.ok || !notifyData.ok) throw new Error(notifyData.error || 'Could not send request to selected mechanic');
      }

      bookingData.bookingId = activeBookingId;
      pollForAcceptance(activeBookingId, mechanicName, mechanicPhone, 0);
    } catch(e) {
      document.getElementById('mechanics-list').innerHTML = `
        <div class="booking-status">
          <div class="icon" style="color:var(--orange);"><i class="fas fa-triangle-exclamation"></i></div>
          <h4 style="color:var(--white);">Request Failed</h4>
          <p style="font-size:0.88rem;">${e.message || 'Could not send request right now. Please try again.'}</p>
        </div>
        <button class="btn-accept" onclick="showMechanics(userLat, userLng)" style="width:100%;padding:0.9rem;margin-top:0.5rem;">
          <i class="fas fa-redo" style="margin-right:6px;"></i>Try Again
        </button>`;
      return;
    }

  }

  let acceptancePollTimer = null;
  async function releasePreferredMechanic(bookingId) {
    if (!bookingId) return false;
    try {
      const res = await fetch(`${getBackendURL()}/api/booking/release-preferred-mechanic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const data = await res.json().catch(() => ({}));
      return !!(res.ok && data.ok);
    } catch (e) {
      return false;
    }
  }

  function renderOpenPoolWaiting(selectedName) {
    document.getElementById('mechanics-list').innerHTML = `
      <div class="booking-status">
        <div class="icon"><i class="fas fa-circle-notch fa-spin"></i></div>
        <h4>Finding Another Mechanic</h4>
        <p style="font-size:0.88rem;"><strong>${selectedName}</strong> did not respond in time. The request is now visible to other nearby mechanics.</p>
        <p style="font-size:0.8rem;color:#666;margin-top:0.5rem;">Waiting for the next available mechanic to accept...</p>
        <button class="btn-proceed" style="margin-top:1.5rem;" onclick="proceedAnyway()">
          <i class="fas fa-headset" style="margin-right:5px;"></i>Let MechWay Assign
        </button>
      </div>`;
  }

  async function pollForAcceptance(bookingId, name, phone, attempts) {
    if (attempts >= 30) {
      // 30 × 4s = 120s total timeout
      acceptancePollTimer = null;
      document.getElementById('mechanics-list').innerHTML = `
        <div class="booking-status">
          <div class="icon" style="color:var(--orange);"><i class="fas fa-clock"></i></div>
          <h4 style="color:var(--white);">No Mechanic Accepted Yet</h4>
          <p style="font-size:0.88rem;">No mechanic accepted the request within 120 seconds. Please choose again or let MechWay assign one manually.</p>
        </div>
        <button class="btn-accept" onclick="showMechanics(userLat, userLng)" style="width:100%;padding:0.9rem;margin-top:0.5rem;">
          <i class="fas fa-redo" style="margin-right:6px;"></i>See Other Mechanics
        </button>
        <button class="btn-proceed" onclick="proceedAnyway()" style="margin-top:0.5rem;">
          <i class="fas fa-headset" style="margin-right:6px;"></i>Let MechWay Assign
        </button>`;
      return;
    }

    acceptancePollTimer = setTimeout(async () => {
      try {
        const res  = await fetch(`${getBackendURL()}/api/booking/${bookingId}`);
        const data = await res.json();

        if (data.ok && data.booking?.status === 'accepted') {
          // ✅ Mechanic accepted — show their REAL details from MongoDB
          acceptancePollTimer = null;
          const md = data.booking.mechanicDetails || {};
          showRealAccepted(
            md.name  || data.booking.mechanicName  || name,
            md.phone || data.booking.mechanicPhone || phone,
            md
          );
        } else {
          if (attempts === 9) {
            renderOpenPoolWaiting(name);
            releasePreferredMechanic(bookingId);
          }
          await pollForAcceptance(bookingId, name, phone, attempts + 1);
        }
      } catch(e) {
        if (attempts === 9) {
          renderOpenPoolWaiting(name);
          releasePreferredMechanic(bookingId);
        }
        await pollForAcceptance(bookingId, name, phone, attempts + 1);
      }
    }, 4000);
  }

  // Show real mechanic details after they accept on their dashboard
// NOTE: Only mechanic NAME is shown here. Full contact details are revealed only after payment.
function showRealAccepted(name, phone, details) {
  // Capture mechanic coordinates for payment.html map
  bookingData.mechanicLat = details.latitude || '';
  bookingData.mechanicLng = details.longitude || '';

    document.getElementById('mechanics-list').innerHTML = `
      <div class="booking-status">
        <div class="icon"><i class="fas fa-check-circle"></i></div>
        <h4>${name} Accepted!</h4>
        <p>Your mechanic has accepted the request and is ready to help.</p>
      </div>
      <div class="contact-box">
        <h5>Assigned Mechanic</h5>
        <div style="margin-bottom:0.8rem;">
          <div style="font-family:var(--heading);font-size:1.2rem;font-weight:800;color:var(--white);text-transform:uppercase;margin-bottom:0.4rem;">
            <i class="fas fa-hard-hat" style="color:var(--orange);margin-right:6px;"></i>${name}
          </div>
          <div style="font-size:0.82rem;color:var(--text);margin-bottom:0.6rem;">Mobile Mechanic · Prayagraj</div>
        </div>
        <div style="background:rgba(211,47,47,0.08);border:1px solid rgba(211,47,47,0.25);border-radius:8px;padding:0.75rem 1rem;display:flex;align-items:center;gap:0.6rem;">
          <i class="fas fa-lock" style="color:var(--orange);font-size:1rem;"></i>
          <div style="text-align:left;">
            <div style="font-size:0.8rem;font-weight:700;color:var(--white);">Contact Details Locked</div>
            <div style="font-size:0.75rem;color:var(--text);">Complete payment to unlock phone number &amp; contact options</div>
          </div>
        </div>
      </div>
      <button class="btn-accept" onclick="goToPayment()" style="width:100%;padding:0.9rem;margin-top:1rem;">
        <i class="fas fa-shield-alt" style="margin-right:6px;"></i>Pay Now to Unlock Mechanic Details
      </button>`;
  }

  async function proceedAnyway() {
    if (acceptancePollTimer) { clearTimeout(acceptancePollTimer); acceptancePollTimer = null; }
    bookingData = { ...bookingData, mechanicId: '', mechanicName: 'To be assigned', mechanicPhone: '' };

    if (!bookingData.bookingId) {
      const bookingId = await saveBookingToBackend();
      if (!bookingId) {
        alert('Could not submit booking right now. Please try again.');
        return;
      }
      bookingData.bookingId = bookingId;
    }

    document.getElementById('mechanics-list').innerHTML = `
      <div class="booking-status">
        <div class="icon"><i class="fas fa-check-circle"></i></div>
        <h4>Request Submitted!</h4>
        <p>Since no mechanic could accept immediately, our team will manually assign the nearest available mechanic and call you shortly.</p>
      </div>
      <div class="contact-box">
        <h5>Need Immediate Help?</h5>
        <a href="tel:+919794575236" class="call-link"><i class="fas fa-headset"></i> Call Support</a>
      </div>
      <button class="btn-proceed" onclick="window.location.href='/index.html'" style="width:100%;padding:0.9rem;margin-top:1rem;">
        <i class="fas fa-home"></i> Return to Home
      </button>`;
  }

  function goToPayment() {
    closeModal();
    const vt = document.getElementById('vehicle-type')?.value;
    const params = new URLSearchParams({
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value.replace(/\D/g,''),
      vehicleType: vt, vehicleBrand: document.getElementById('vehicle-brand').value,
      vehicleModel: document.getElementById('vehicle-model').value,
      vehicleNumber: '',
      vehicleColor: '',
      service: document.getElementById('problem').value,
      servicePrice: getVisitPrice(),
      message: document.getElementById('message').value,
      mechanicId: bookingData.mechanicId||'',
      mechanicName: bookingData.mechanicName||'',
      mechanicPhone: bookingData.mechanicPhone||'',
      bookingId: bookingData.bookingId||'',
      mechanicLat: bookingData.mechanicLat || '',
      mechanicLng: bookingData.mechanicLng || ''
    });
    window.location.href = '/pages/payment.html?' + params.toString();
  }

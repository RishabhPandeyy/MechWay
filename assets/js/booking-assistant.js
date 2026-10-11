(() => {
  if (document.getElementById('ba-dialog')) return;
  const steps = ['Vehicle', 'Service', 'Visit', 'Location', 'Review'];
  const services = ['General Checkup', 'Tire Issue (Flat, Puncture)', 'Battery Issue', 'Engine Problem', 'Brake Problem', 'Lockout Service', 'Other'];
  const serviceLabels = ['General checkup', 'Puncture / tyre issue', 'Battery / starting issue', 'Engine problem', 'Brake problem', 'Locked vehicle', 'Other'];
  const timeSlots = { morning: 'Morning, 8AM - 12PM', afternoon: 'Afternoon, 12PM - 4PM', evening: 'Evening, 4PM - 8PM', night: 'Night, 8PM - 11PM' };
  const blank = () => ({ vehicle: '', service: '', mode: 'emergency', date: '', slot: '', location: '', coordinates: null });
  let state = blank(), step = 0, timer, controller, requestVersion = 0;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'ba-launcher';
  if (document.querySelector('.mobile-booking-bar')) launcher.classList.add('ba-with-booking-bar');
  launcher.setAttribute('aria-label', 'Open booking assistant');
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'ba-dialog');
  launcher.title = 'Booking assistant';
  launcher.innerHTML = '<i class="fas fa-comment-dots" aria-hidden="true"></i><span>Booking help</span>';
  const dialog = document.createElement('dialog');
  dialog.id = 'ba-dialog';
  dialog.className = 'ba-dialog';
  dialog.setAttribute('aria-labelledby', 'ba-title');
  dialog.innerHTML = `
    <header class="ba-header">
      <img src="/assets/images/mechwaynew.png" alt="MechWay">
      <h2 id="ba-title">Booking assistant</h2>
      <div class="ba-actions">
        <button class="ba-icon-button" type="button" data-ba-reset title="Start again" aria-label="Start again"><i class="fas fa-rotate-left" aria-hidden="true"></i></button>
        <button class="ba-icon-button" type="button" data-ba-close title="Close assistant" aria-label="Close assistant"><i class="fas fa-xmark" aria-hidden="true"></i></button>
      </div>
    </header>
    <form class="ba-form" novalidate>
      <div class="ba-body">
        <p class="ba-progress-label"></p><progress class="ba-progress" max="5" value="1" aria-label="Booking progress"></progress>
        <h3 class="ba-question" tabindex="-1"></h3>
        <div class="ba-fields"></div><p class="ba-error" role="alert" hidden></p>
      </div>
      <footer class="ba-footer">
        <button class="ba-icon-button" type="button" data-ba-back title="Previous step" aria-label="Previous step"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
        <a class="ba-support" href="tel:+919794575236" title="Call MechWay support" aria-label="Call MechWay support"><i class="fas fa-phone" aria-hidden="true"></i></a>
        <button class="ba-next" type="submit"><span>Next</span><i class="fas fa-arrow-right" aria-hidden="true"></i></button>
      </footer>
    </form>`;
  document.body.append(launcher, dialog);
  const find = selector => dialog.querySelector(selector);
  const fields = find('.ba-fields');
  const today = () => new Date().toLocaleDateString('en-CA');
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  function cancelSearch() {
    clearTimeout(timer);
    controller?.abort();
    requestVersion++;
  }
  function error(message) {
    find('.ba-error').textContent = message;
    find('.ba-error').hidden = !message;
  }
  function readDraft() {
    const type = document.getElementById('vehicle-type')?.value || document.getElementById('vehicleType')?.value;
    if (type) state.vehicle = type.toLowerCase() === 'car' ? 'Car' : 'Bike';
    const service = document.getElementById('problem')?.value || document.getElementById('serviceSelect')?.value;
    if (services.includes(service)) state.service = service;
    state.location = document.getElementById('vehicle-type')
      ? document.getElementById('message')?.value || ''
      : document.getElementById('locationInput')?.value || '';
    state.mode = document.getElementById('service-type')?.value || 'emergency';
    state.date = document.getElementById('booking-date')?.value || '';
    state.slot = document.getElementById('time-slot')?.value || '';
  }
  function options(name, items, selected) {
    const group = document.createElement('fieldset');
    group.className = 'ba-options';
    const legend = document.createElement('legend');
    legend.className = 'ba-sr-only';
    legend.textContent = find('.ba-question').textContent;
    group.append(legend);
    items.forEach(([value, label, icon]) => {
      const item = document.createElement('label');
      item.className = 'ba-option';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = name; input.value = value; input.checked = value === selected;
      const symbol = document.createElement('i');
      symbol.className = 'fas ' + icon; symbol.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = label;
      item.append(input, symbol, text); group.append(item);
    });
    return group;
  }
  function render() {
    cancelSearch();
    error('');
    fields.replaceChildren();
    find('.ba-progress-label').textContent = `${steps[step]} / ${step + 1} of ${steps.length}`;
    find('.ba-progress').value = step + 1;
    find('[data-ba-back]').hidden = step === 0;
    find('.ba-next span').textContent = step === 4 ? 'Continue booking' : 'Next';
    find('.ba-question').textContent = [
      'What are you riding?', 'What needs attention?', 'When do you need a mechanic?', 'Where should we come?', 'Your visit details'
    ][step];
    if (step === 0) {
      fields.append(options('ba-vehicle', [['Bike', 'Bike', 'fa-motorcycle'], ['Car', 'Car', 'fa-car']], state.vehicle));
      const restoration = document.createElement('a');
      restoration.className = 'ba-link'; restoration.href = '/pages/startrestoration.html'; restoration.textContent = 'Vehicle restoration enquiry';
      fields.append(restoration);
    } else if (step === 1) {
      fields.innerHTML = '<label class="ba-label" for="ba-service">Required service</label><select class="ba-field" id="ba-service"><option value="">Select a service</option></select>';
      services.forEach((service, index) => find('#ba-service').add(new Option(serviceLabels[index], service)));
      find('#ba-service').value = state.service;
    } else if (step === 2) {
      fields.append(options('ba-mode', [['emergency', 'Immediate', 'fa-bolt'], ['timeslot', 'Scheduled', 'fa-calendar-check']], state.mode));
      const schedule = document.createElement('div');
      schedule.className = 'ba-schedule';
      schedule.innerHTML = '<label class="ba-label" for="ba-date">Visit date</label><input class="ba-field" id="ba-date" type="date"><label class="ba-label" for="ba-slot">Time slot</label><select class="ba-field" id="ba-slot"><option value="">Select a time slot</option></select>';
      fields.append(schedule);
      find('#ba-date').min = today(); find('#ba-date').value = state.date;
      Object.entries(timeSlots).forEach(([value, label]) => find('#ba-slot').add(new Option(label, value)));
      find('#ba-slot').value = state.slot;
      schedule.hidden = state.mode !== 'timeslot';
      fields.querySelectorAll('[name="ba-mode"]').forEach(input => input.addEventListener('change', () => { schedule.hidden = input.value !== 'timeslot'; }));
    } else if (step === 3) {
      fields.innerHTML = `
        <label class="ba-label" for="ba-location">Service location</label>
        <input class="ba-field" id="ba-location" type="text" placeholder="Area, landmark or full address" autocomplete="off" maxlength="1000" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ba-results">
        <div class="ba-results" id="ba-results" role="listbox" aria-label="Suggested locations" hidden></div>
        <button class="ba-location-button" type="button" id="ba-current"><i class="fas fa-location-crosshairs" aria-hidden="true"></i>Use current location</button>
        <p class="ba-status" role="status"></p>
        <a class="ba-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Location data: OpenStreetMap</a>`;
      find('#ba-location').value = state.location;
      attachLocationSearch();
    } else {
      const summary = document.createElement('dl'); summary.className = 'ba-summary';
      const details = [['Vehicle', state.vehicle], ['Service', serviceLabels[services.indexOf(state.service)]], ['Visit', state.mode === 'emergency' ? 'Immediate' : `${state.date} / ${timeSlots[state.slot]}`], ['Location', state.location]];
      details.forEach(([key, value]) => {
        const row = document.createElement('div'), title = document.createElement('dt'), text = document.createElement('dd');
        title.textContent = key; text.textContent = value; row.append(title, text); summary.append(row);
      });
      fields.append(summary);
      const fee = document.createElement('p'); fee.className = 'ba-fee';
      const label = document.createElement('span'); label.textContent = 'Visit offer';
      const old = document.createElement('del'); old.textContent = money(state.vehicle === 'Car' ? 899 : 499);
      const price = document.createElement('strong'); price.textContent = money(state.vehicle === 'Car' ? 279 : 199);
      fee.append(label, old, price); fields.append(fee);
      const note = document.createElement('p'); note.className = 'ba-note'; note.textContent = 'Repairs and replacement parts are charged separately.'; fields.append(note);
    }
    find('.ba-body').scrollTop = 0;
    find('.ba-question').focus({ preventScroll: true });
  }
  function saveStep() {
    if (step === 0) {
      state.vehicle = find('[name="ba-vehicle"]:checked')?.value || '';
      if (!state.vehicle) return error('Please select Bike or Car.'), false;
    } else if (step === 1) {
      state.service = find('#ba-service').value;
      if (!state.service) return error('Please select the service you need.'), false;
    } else if (step === 2) {
      state.mode = find('[name="ba-mode"]:checked').value;
      state.date = find('#ba-date').value; state.slot = find('#ba-slot').value;
      if (state.mode === 'timeslot' && (!state.date || state.date < today() || !state.slot)) return error('Please choose a date and time slot.'), false;
    } else if (step === 3) {
      state.location = find('#ba-location').value.trim();
      if (state.location.length < 5) return error('Please enter your area or full address.'), false;
    }
    return true;
  }
  function place(feature) {
    const p = feature.properties || {}, coordinates = feature.geometry?.coordinates;
    const address = [...new Set([p.name, p.street, p.locality, p.city, p.district, p.state, p.postcode].filter(Boolean))].join(', ');
    if (!address || !Array.isArray(coordinates) || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null;
    return { address, lat: coordinates[1], lon: coordinates[0] };
  }
  function attachLocationSearch() {
    const input = find('#ba-location'), results = find('#ba-results'), status = find('.ba-status'), current = find('#ba-current');
    let places = [], active = -1;
    const close = () => { results.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    function select(index) {
      const selected = places[index];
      if (!selected) return;
      state.location = selected.address; state.coordinates = { lat: selected.lat, lon: selected.lon };
      input.value = selected.address; cancelSearch(); close(); status.textContent = ''; input.focus();
    }
    input.addEventListener('input', () => {
      cancelSearch(); close(); results.replaceChildren(); state.coordinates = null; state.location = input.value.trim(); status.textContent = '';
      current.disabled = false;
      if (state.location.length < 3) return;
      const version = requestVersion;
      timer = setTimeout(async () => {
        controller = new AbortController();
        const request = controller, timeout = setTimeout(() => request.abort(), 8000);
        status.textContent = 'Searching locations...';
        try {
          const params = new URLSearchParams({ q: state.location, limit: '15', lang: 'en', lat: '25.4358', lon: '81.8463', countrycode: 'IN', bbox: '77,23.8,84.7,30.5' });
          const response = await fetch('https://photon.komoot.io/api/?' + params, { signal: request.signal });
          if (!response.ok) throw new Error('Search unavailable');
          const data = await response.json();
          if (version !== requestVersion) return;
          const seen = new Set();
          places = (data.features || []).filter(f => f.properties?.countrycode?.toUpperCase() === 'IN' && f.properties?.state?.toLowerCase() === 'uttar pradesh')
            .map(place).filter(p => { if (!p || seen.has(p.address)) return false; seen.add(p.address); return true; }).slice(0, 5);
          places.forEach((p, index) => {
            const option = document.createElement('button'); option.className = 'ba-result'; option.type = 'button'; option.tabIndex = -1; option.id = 'ba-place-' + index;
            option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false'); option.textContent = p.address;
            option.addEventListener('pointerdown', event => event.preventDefault()); option.addEventListener('click', () => select(index)); results.append(option);
          });
          results.hidden = !places.length; input.setAttribute('aria-expanded', String(!!places.length));
          status.textContent = places.length ? '' : 'No matching places in Uttar Pradesh. Enter your full address.';
        } catch (err) {
          if (version === requestVersion) status.textContent = 'Search unavailable. Enter your full address or use current location.';
        } finally { clearTimeout(timeout); }
      }, 400);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape' && !results.hidden) { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (results.hidden || !places.length) return;
      if (event.key === 'Enter') { event.preventDefault(); if (active >= 0) select(active); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + places.length) % places.length;
        [...results.children].forEach((item, index) => item.setAttribute('aria-selected', String(index === active)));
        input.setAttribute('aria-activedescendant', results.children[active].id); results.children[active].scrollIntoView({ block: 'nearest' });
      }
    });
    input.addEventListener('blur', close);
    current.addEventListener('click', () => {
      if (!navigator.geolocation) { status.textContent = 'Current location is unavailable. Enter your address.'; return; }
      cancelSearch(); close(); const version = requestVersion; current.disabled = true; status.textContent = 'Finding your location...';
      navigator.geolocation.getCurrentPosition(async position => {
        if (version !== requestVersion) return;
        const { latitude: lat, longitude: lon } = position.coords;
        let address = `Current location: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        controller = new AbortController(); const request = controller, timeout = setTimeout(() => request.abort(), 8000);
        try {
          const response = await fetch('https://photon.komoot.io/reverse?' + new URLSearchParams({ lat: String(lat), lon: String(lon), lang: 'en' }), { signal: request.signal });
          if (!response.ok) throw new Error('Reverse search unavailable');
          const data = await response.json();
          if (version !== requestVersion) return;
          address = place(data.features?.[0] || {})?.address || address;
        } catch (err) { /* Coordinates remain usable if the address lookup fails. */ }
        finally { clearTimeout(timeout); }
        if (version !== requestVersion) return;
        state.location = address; state.coordinates = { lat, lon }; input.value = address;
        current.disabled = false; status.textContent = 'Current location added.';
      }, () => {
        if (version !== requestVersion) return;
        current.disabled = false; status.textContent = 'Location access unavailable. Please enter your address.';
      }, { timeout: 10000, maximumAge: 60000 });
    });
  }
  function continueBooking() {
    const vehicle = document.getElementById('vehicle-type');
    if (vehicle && document.getElementById('service-type')) {
      if (vehicle.value !== state.vehicle) { vehicle.value = state.vehicle; vehicle.dispatchEvent(new Event('change')); }
      document.getElementById('problem').value = state.service;
      const mode = document.getElementById('service-type'); mode.value = state.mode; mode.dispatchEvent(new Event('change'));
      document.getElementById('booking-date').value = state.mode === 'timeslot' ? state.date : '';
      document.getElementById('time-slot').value = state.mode === 'timeslot' ? state.slot : '';
      const location = document.getElementById('message'); location.value = state.location;
      location.dispatchEvent(new Event('input'));
      if (state.coordinates) location.dispatchEvent(new CustomEvent('location-selected', { detail: { address: state.location, ...state.coordinates } }));
      dialog.close(); document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('name').focus({ preventScroll: true });
      return;
    }
    const params = new URLSearchParams({ vehicleType: state.vehicle, service: state.service, serviceType: state.mode, location: state.location });
    if (state.mode === 'timeslot') { params.set('bookingDate', state.date); params.set('timeSlot', state.slot); }
    if (state.coordinates) { params.set('latitude', String(state.coordinates.lat)); params.set('longitude', String(state.coordinates.lon)); }
    window.location.href = '/pages/mechanic.html?' + params;
  }
  launcher.addEventListener('click', () => { if (!state.vehicle && step === 0) readDraft(); dialog.showModal(); render(); });
  find('[data-ba-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { saveStep(); cancelSearch(); launcher.focus({ preventScroll: true }); });
  find('[data-ba-reset]').addEventListener('click', () => { state = blank(); step = 0; render(); });
  find('[data-ba-back]').addEventListener('click', () => { saveStep(); if (step > 0) { step--; render(); } });
  find('.ba-form').addEventListener('submit', event => { event.preventDefault(); if (!saveStep()) return; if (step === 4) continueBooking(); else { step++; render(); } });
})();

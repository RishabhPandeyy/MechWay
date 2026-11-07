
  /* Navbar scroll */
  const navbar = document.getElementById('main-navbar');
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', scrollY > 50));

  /* Mobile menu */
  document.getElementById('mobile-menu').addEventListener('click', () =>
    document.getElementById('nav-menu').classList.toggle('open'));

  /* Scroll reveal */
  const obs = new IntersectionObserver(e =>
    e.forEach(x => { if (x.isIntersecting) x.target.classList.add('visible'); }),
    { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  /* FAQ Accordion */
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const ans  = item.querySelector('.faq-a');
      const was  = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!was) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });

  /* Multi-step form logic */
  let currStep = 1;
  const totalSteps = 4;
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const btnSubmit = document.getElementById('btn-submit');
  const vehicleType = document.getElementById('resto-vehicle-type');
  const brand = document.getElementById('resto-brand');
  const brands = {
    Bike: ['Royal Enfield', 'Jawa / Yezdi', 'Yamaha', 'Hero', 'Honda', 'Bajaj', 'TVS', 'Suzuki', 'BSA / Norton', 'Others'],
    Car: ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Kia', 'Volkswagen', 'Ford', 'Others']
  };
  vehicleType.addEventListener('change', () => {
    brand.replaceChildren(new Option('-- Select Brand --', ''));
    (brands[vehicleType.value] || []).forEach(name => brand.add(new Option(name, name)));
  });

  const scopeOther = document.getElementById('resto-scope-other');
  const scopeDetail = document.getElementById('resto-scope-detail');
  const budgetRange = document.querySelector('[name="budgetRange"]');
  const budgetDetail = document.getElementById('resto-budget-detail');
  function toggleDetail(control, field) {
    field.hidden = !control;
    field.disabled = !control;
    field.required = control;
    if (!control) field.value = '';
  }
  scopeOther.addEventListener('change', () => toggleDetail(scopeOther.checked, scopeDetail));
  budgetRange.addEventListener('change', () => toggleDetail(budgetRange.value === 'Others', budgetDetail));

  const cityInput = document.getElementById('resto-city');
  const pickupInput = document.getElementById('resto-pickup');
  const locationFeedback = document.getElementById('resto-location-feedback');
  const latitudeInput = document.getElementById('resto-latitude');
  const longitudeInput = document.getElementById('resto-longitude');
  const currentLocationButton = document.getElementById('resto-current-location');
  const photoFields = [...document.querySelectorAll('.restoration-upload-grid input[type="file"]')];
  const allowedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  function validatePhoto(field) {
    const file = field.files?.[0];
    let error = '';
    if (file && !allowedPhotoTypes.has(file.type)) error = 'Use a JPG, PNG or WebP image.';
    else if (file && file.size > 10 * 1024 * 1024) error = 'Each image must be 10 MB or smaller.';
    field.setCustomValidity(error);
    return !error;
  }
  photoFields.forEach(field => field.addEventListener('change', () => {
    validatePhoto(field);
    field.reportValidity();
  }));

  function placeDetails(feature) {
    const p = feature.properties || {};
    const address = [...new Set([p.name, p.street, p.locality, p.city, p.district, p.state, p.postcode].filter(Boolean))].join(', ');
    return {
      address,
      city: p.city || p.district || p.county || p.name || '',
      lat: feature.geometry?.coordinates?.[1],
      lon: feature.geometry?.coordinates?.[0]
    };
  }

  function setPickup(place) {
    pickupInput.value = place.address;
    if (place.city) cityInput.value = place.city;
    latitudeInput.value = Number.isFinite(Number(place.lat)) ? String(place.lat) : '';
    longitudeInput.value = Number.isFinite(Number(place.lon)) ? String(place.lon) : '';
  }

  function attachLocationSearch(input, list, onSelect) {
    let timer, controller, active = -1;
    let matches = [];
    function close() {
      clearTimeout(timer);
      controller?.abort();
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    }
    function choose(index) {
      if (!matches[index]) return;
      onSelect(matches[index]);
      close();
      input.focus();
    }
    input.addEventListener('input', () => {
      close();
      if (input === pickupInput) {
        latitudeInput.value = '';
        longitudeInput.value = '';
      }
      const query = input.value.trim();
      if (query.length < 3) return;
      timer = setTimeout(async () => {
        controller = new AbortController();
        const request = controller;
        const timeout = setTimeout(() => request.abort(), 8000);
        try {
          const params = new URLSearchParams({ q: query, limit: '8', lang: 'en', countrycode: 'IN' });
          const response = await fetch('https://photon.komoot.io/api/?' + params, { signal: request.signal });
          if (!response.ok) throw new Error('Search unavailable');
          const data = await response.json();
          if (request !== controller || input.value.trim() !== query) return;
          matches = (data.features || [])
            .filter(feature => feature.properties?.countrycode?.toUpperCase() === 'IN')
            .map(placeDetails)
            .filter(place => place.address)
            .slice(0, 5);
          list.replaceChildren();
          matches.forEach((place, index) => {
            const option = document.createElement('li');
            option.setAttribute('role', 'option');
            option.textContent = place.address;
            option.addEventListener('pointerdown', event => event.preventDefault());
            option.addEventListener('click', () => choose(index));
            list.append(option);
          });
          list.hidden = !matches.length;
          input.setAttribute('aria-expanded', String(matches.length > 0));
          locationFeedback.textContent = matches.length ? '' : 'No matching place found. You can enter the address manually.';
        } catch (error) {
          if (error.name !== 'AbortError') locationFeedback.textContent = 'Location search unavailable. You can enter the address manually.';
        } finally {
          clearTimeout(timeout);
        }
      }, 450);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.key === 'Tab') return close();
      if (list.hidden || !matches.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        choose(active);
      }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
  }
  attachLocationSearch(cityInput, document.getElementById('resto-city-results'), place => {
    cityInput.value = place.city || place.address;
  });
  attachLocationSearch(pickupInput, document.getElementById('resto-pickup-results'), setPickup);

  currentLocationButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      locationFeedback.textContent = 'Current location is not supported. Enter your pickup address manually.';
      return;
    }
    currentLocationButton.disabled = true;
    locationFeedback.textContent = 'Finding your current location...';
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      try {
        const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: 'en' });
        const response = await fetch('https://photon.komoot.io/reverse?' + params);
        if (!response.ok) throw new Error('Reverse lookup failed');
        const data = await response.json();
        const feature = (data.features || []).find(item => item.properties?.countrycode?.toUpperCase() === 'IN');
        if (!feature) throw new Error('No Indian address found');
        setPickup({ ...placeDetails(feature), lat: latitude, lon: longitude });
        locationFeedback.textContent = 'Current location added. Please check the pickup address.';
      } catch (error) {
        pickupInput.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        latitudeInput.value = String(latitude);
        longitudeInput.value = String(longitude);
        locationFeedback.textContent = 'Coordinates added. Please enter your city and full pickup address.';
      } finally {
        currentLocationButton.disabled = false;
      }
    }, () => {
      currentLocationButton.disabled = false;
      locationFeedback.textContent = 'Allow location access or enter your pickup address manually.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  function updateSteps() {
    document.querySelectorAll('.step-item').forEach(item => {
      const s = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');
      if (s === currStep) item.classList.add('active');
      else if (s < currStep) item.classList.add('completed');
    });

    document.querySelectorAll('.form-step-panel').forEach(panel => {
      panel.classList.remove('active');
      if (parseInt(panel.dataset.step) === currStep) panel.classList.add('active');
    });

    btnPrev.style.display = currStep > 1 ? 'inline-flex' : 'none';
    if (currStep === totalSteps) {
      btnNext.style.display = 'none';
      btnSubmit.style.display = 'inline-flex';
    } else {
      btnNext.style.display = 'inline-flex';
      btnSubmit.style.display = 'none';
    }
  }

  btnNext.addEventListener('click', () => {
    const currentPanel = document.querySelector(`.form-step-panel[data-step="${currStep}"]`);
    const inputs = currentPanel.querySelectorAll('input[required], select[required]');
    let valid = true;
    inputs.forEach(i => {
      if (i.type === 'file') validatePhoto(i);
      if (!i.value.trim() || !i.checkValidity()) {
        valid = false;
        i.style.borderColor = 'var(--red)';
        i.reportValidity();
        i.focus();
      } else {
        i.style.borderColor = 'var(--border)';
      }
    });
    if (!valid) return;
    if (currStep < totalSteps) { currStep++; updateSteps(); }
  });

  btnPrev.addEventListener('click', () => {
    if (currStep > 1) { currStep--; updateSteps(); }
  });

  /* Form submission */
  const getBackendURL = () => {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
    return isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
  };

  document.getElementById('master-resto-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData();
    const selectedRestorationTypes = [...document.querySelectorAll('input[name="restorationType"]:checked')].map(el =>
      el === scopeOther ? `Others: ${scopeDetail.value.trim()}` : el.value
    );
    if (scopeOther.checked && !scopeDetail.value.trim()) {
      scopeDetail.focus();
      scopeDetail.reportValidity();
      return;
    }
    if (budgetRange.value === 'Others' && !budgetDetail.value.trim()) {
      budgetDetail.focus();
      budgetDetail.reportValidity();
      return;
    }

    Array.from(form.elements).forEach(field => {
      if (!field.name) return;
      if (field.type === 'file') {
        const files = field.files;
        if (files && files.length) {
          Array.from(files).forEach(file => formData.append(field.name, file));
        }
        return;
      }
      if (field.type === 'checkbox') {
        if (field.checked) {
          formData.append('restorationType', field.value);
        }
        return;
      }
      if (field.type === 'submit' || field.type === 'button') return;
      if (field.type === 'radio' && !field.checked) return;
      formData.append(field.name, field.value);
    });

    if (selectedRestorationTypes.length) {
      formData.set('restorationType', selectedRestorationTypes.join(', '));
    }
    if (budgetRange.value === 'Others') formData.set('budgetRange', `Others: ${budgetDetail.value.trim()}`);

    for (const field of photoFields) {
      if (!field.files?.length || !validatePhoto(field)) {
        currStep = 3;
        updateSteps();
        field.focus();
        field.reportValidity();
        return;
      }
    }

    try {
      const response = await fetch(getBackendURL() + '/api/restoration', {
        method: 'POST',
        body: formData
      });

      const responseText = await response.text();
      let result = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseErr) {
        console.error('Non-JSON restoration response:', responseText || '(empty)');
        const trimmed = (responseText || '').toString().trim();
        const preview = trimmed ? (trimmed.length > 300 ? trimmed.slice(0, 300) + '...' : trimmed) : '(empty)';
        throw new Error('Server error: ' + preview + '\n\n(Backend returned non-JSON response)');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Restoration request failed.');
      }

      const reqId = result.id ? 'MW-REST-' + String(result.id).slice(-6).toUpperCase() : 'MW-REST-' + Math.floor(100000 + Math.random() * 900000);
      document.getElementById('project-id-tag').textContent = reqId;
      form.style.display = 'none';
      document.getElementById('form-stepper').style.display = 'none';
      document.getElementById('form-nav').style.display = 'none';
      document.getElementById('form-success').classList.add('show');
    } catch (err) {
      alert(err.message || 'Something went wrong. Please try again.');
    }
  });


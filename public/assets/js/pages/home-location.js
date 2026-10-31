(() => {
  const input = document.getElementById('locationInput') || document.getElementById('message');
  const panel = document.getElementById('location-results-panel');
  const list = document.getElementById('location-results');
  const status = document.getElementById('location-search-status');
  const currentLocationButton = document.getElementById('locationButton') || document.getElementById('getLocationBtn');
  let timer, controller, version = 0, active = -1, results = [];

  function close() {
    clearTimeout(timer);
    controller?.abort();
    version++;
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function select(index) {
    if (!results[index]) return;
    input.value = results[index].address;
    input.dispatchEvent(new CustomEvent('location-selected', { detail: results[index] }));
    close();
    input.focus();
  }
  function open(message) {
    status.textContent = message;
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  input.addEventListener('input', () => {
    close();
    results = [];
    list.replaceChildren();
    const query = input.value.trim();
    if (query.length < 3) return;
    const requestVersion = version;
    timer = setTimeout(async () => {
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 8000);
      open('Searching locations...');
      try {
        const params = new URLSearchParams({
          q: query, limit: '15', lang: 'en', lat: '25.4358', lon: '81.8463',
          countrycode: 'IN', bbox: '77,23.8,84.7,30.5'
        });
        const response = await fetch('https://photon.komoot.io/api/?' + params, { signal: request.signal });
        if (!response.ok) throw new Error('Location search failed');
        const data = await response.json();
        if (version !== requestVersion) return;
        // The bounding box also covers neighbouring states; verify the state explicitly.
        const localFeatures = (data.features || []).filter(({ properties: p }) =>
          p?.countrycode?.toUpperCase() === 'IN' && p.state?.trim().toLowerCase() === 'uttar pradesh'
        );
        const seen = new Set();
        results = localFeatures.map(feature => {
          const p = feature.properties || {};
          const address = [...new Set([p.name, p.street, p.locality, p.city, p.district, p.state, p.postcode, p.country].filter(Boolean))].join(', ');
          return { address, lat: feature.geometry?.coordinates?.[1], lon: feature.geometry?.coordinates?.[0] };
        }).filter(result => {
          if (!result.address || seen.has(result.address)) return false;
          seen.add(result.address);
          return true;
        }).slice(0, 5);
        open(results.length ? '' : 'No matching places in Uttar Pradesh. Try a nearby landmark or enter your address.');
        results.forEach((result, index) => {
          const option = document.createElement('li');
          option.id = 'location-result-' + index;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.textContent = result.address;
          option.addEventListener('pointerdown', event => event.preventDefault());
          option.addEventListener('click', () => select(index));
          list.append(option);
        });
      } catch (error) {
        if (version === requestVersion) open('Location search unavailable. Enter your address or use current location.');
      } finally {
        clearTimeout(timeout);
      }
    }, 400);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Tab') { close(); return; }
    if (panel.hidden || !results.length) return;
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      select(active);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
      input.setAttribute('aria-activedescendant', list.children[active].id);
      list.children[active].scrollIntoView({ block: 'nearest' });
    }
  });
  input.addEventListener('blur', close);
  document.addEventListener('pointerdown', event => {
    if (!panel.contains(event.target) && event.target !== input) close();
  });
  currentLocationButton.addEventListener('click', close);
})();

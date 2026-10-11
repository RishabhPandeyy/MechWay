(() => {
  const prices = {
    'General Checkup': { Car: 500, Bike: 300 },
    'Tire Issue (Flat, Puncture)': { Car: 200, Bike: 150 },
    'Battery Issue': { Car: 400, Bike: 250 },
    'Engine Problem': { Car: 800, Bike: 600 },
    'Brake Problem': { Car: 600, Bike: 400 },
    'Lockout Service': { Car: 300, Bike: 200 }
  };
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  function update(vehicle) {
    document.querySelector(`input[name="price-vehicle"][value="${vehicle}"]`).checked = true;
    document.getElementById('scheduled-fee').textContent = money(vehicle === 'Bike' ? 199 : 279);
    document.getElementById('emergency-fee').textContent = money(vehicle === 'Bike' ? 199 : 279);
    document.querySelectorAll('[data-original-visit-price]').forEach(price => {
      price.textContent = money(vehicle === 'Bike' ? 499 : 899);
    });
    document.querySelectorAll('.price-table tr[data-service]').forEach(row => {
      row.querySelector('.rate').textContent = money(prices[row.dataset.service][vehicle]);
      row.querySelector('a').href = '/pages/mechanic.html?' + new URLSearchParams({ vehicleType: vehicle, service: row.dataset.service });
    });
  }
  document.querySelectorAll('input[name="price-vehicle"]').forEach(input => input.addEventListener('change', () => update(input.value)));
  document.querySelectorAll('[data-vehicle]').forEach(button => button.addEventListener('click', () => update(button.dataset.vehicle === 'car' ? 'Car' : 'Bike')));
  update('Bike');
  const marquee = document.getElementById('brand-marquee');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Keep the native marquee stationary; animate two identical groups seamlessly.
  marquee.stop();
  const track = marquee.querySelector('.brand-track');
  const loop = document.createElement('div');
  loop.className = 'brand-loop';
  const duplicate = track.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  marquee.append(loop);
  loop.append(track, duplicate);
  let paused = motion.matches;
  function setPaused(value) {
    paused = value;
    loop.style.animationPlayState = paused ? 'paused' : 'running';
  }
  marquee.addEventListener('mouseenter', () => setPaused(true));
  marquee.addEventListener('mouseleave', () => setPaused(motion.matches));
  motion.addEventListener('change', event => setPaused(event.matches));
  setPaused(paused);
})();

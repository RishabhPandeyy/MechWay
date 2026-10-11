
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('bookingId');
    const getBackendURL = () => location.hostname === 'localhost' ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

    if (!bookingId) {
      document.getElementById('loading').innerHTML = '<p style="color:var(--orange);">No booking ID found. <a href="/pages/mechanic.html">Book again</a></p>';
    } else {
      fetch(`${getBackendURL()}/api/booking/${bookingId}/details`)
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.booking) {
            const b = data.booking;
            document.getElementById('loading').style.display = 'none';
            document.getElementById('mech-details').style.display = 'block';
            
            document.getElementById('details-name').textContent = b.mechanicName || 'Mechanic';
            document.getElementById('details-phone').textContent = b.mechanicPhone || 'Phone unavailable';
            document.getElementById('details-otp').textContent = b.otp || '----';
            
            // Call button
            document.getElementById('call-btn').href = `tel:${b.mechanicPhone.replace(/\D/g,'')}`;
            
            // WhatsApp
            const waMsg = `Hi, I've paid for service via MechWay. Job OTP: ${b.otp}`;
            document.getElementById('whatsapp-btn').href = `https://wa.me/91${b.mechanicPhone.replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`;
            
            // Map
            if (b.mechanicDetails?.latitude && b.mechanicDetails?.longitude) {
              const map = L.map('mech-map').setView([b.mechanicDetails.latitude, b.mechanicDetails.longitude], 16);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
              L.marker([b.mechanicDetails.latitude, b.mechanicDetails.longitude]).addTo(map)
                .bindPopup(`<b>${b.mechanicName}</b>`).openPopup();
            }
          } else {
            document.getElementById('loading').innerHTML = '<p style="color:var(--orange);">Booking not found. <a href="/index.html">Go Home</a></p>';
          }
        })
        .catch(() => {
          document.getElementById('loading').innerHTML = '<p style="color:var(--orange);">Error loading details. <a href="/index.html">Go Home</a></p>';
        });
    }
  
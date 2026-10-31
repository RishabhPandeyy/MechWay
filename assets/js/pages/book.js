
    document.addEventListener('DOMContentLoaded', () => {
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

        // --- State & Config ---
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const backendURL = isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

        const PRICING_MODELS = {
            bike: { name: 'Bike', baseFare: 25, perKmLow: 7, perKmHigh: 9, icon: 'fa-motorcycle' },
            auto: { name: 'Auto', baseFare: 40, perKmLow: 11, perKmHigh: 14, icon: 'fa-car-side' },
            car: { name: 'Car', baseFare: 60, perKmLow: 16, perKmHigh: 20, icon: 'fa-car' }
        };
        const prayagrajCoords = [25.4358, 81.8463];
        let map, marker, finalFares = null, selectedVehicle = 'bike', currentTargetInput = null, selectedMapAddress = '';

        // --- UI Elements ---
        const pickupInput = document.getElementById('pickup-location-input');
        const dropoffInput = document.getElementById('dropoff-location-input');
        const submitBtn = document.getElementById('submit-booking-btn');
        const formInputs = [document.getElementById('name-input'), document.getElementById('phone-input'), pickupInput, dropoffInput];
        const fareDetailsDiv = document.getElementById('fare-details');
        const fareListUl = document.getElementById('fare-list');
        const mapModal = document.getElementById('map-modal');
        const mapSearchInput = document.getElementById('map-search-input');
        const mapSearchBtn = document.getElementById('map-search-btn');

        // --- Event Listeners ---
        formInputs.forEach(el => el.addEventListener('input', resetFareAndButton));
        document.getElementById('getPickupLocationBtn').addEventListener('click', handleGetGeolocation);
        document.getElementById('booking-form').addEventListener('submit', handleFormSubmit);
        document.getElementById('select-pickup-map-btn').addEventListener('click', () => openMap(pickupInput));
        document.getElementById('select-dropoff-map-btn').addEventListener('click', () => openMap(dropoffInput));
        document.getElementById('close-map-btn').addEventListener('click', closeMap);
        document.getElementById('confirm-location-btn').addEventListener('click', handleConfirmLocation);
        mapSearchBtn.addEventListener('click', searchLocationOnMap);
        mapSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchLocationOnMap();
            }
        });
        
        // --- Map Logic ---
        function initMapIfNeeded() {
            if (map) return;
            map = L.map('map').setView(prayagrajCoords, 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            marker = L.marker(prayagrajCoords, { draggable: true }).addTo(map);
            marker.on('dragend', (event) => reverseGeocode(event.target.getLatLng()));
        }
        function openMap(targetInput) {
            initMapIfNeeded();
            currentTargetInput = targetInput;
            mapModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            setTimeout(() => map.invalidateSize(), 100);
            mapSearchInput.value = ''; // Clear previous search
            document.getElementById('map-address-preview').textContent = 'Drag the pin or search to set a location.';
        }
        function closeMap() {
            mapModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        function handleConfirmLocation() {
            if (selectedMapAddress && currentTargetInput) {
                currentTargetInput.value = selectedMapAddress;
                currentTargetInput.dispatchEvent(new Event('input'));
            }
            closeMap();
        }
        async function searchLocationOnMap() {
            const query = mapSearchInput.value;
            if (query.length < 3) return;

            mapSearchBtn.disabled = true;
            mapSearchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in&viewbox=81.0,25.0,82.5,26.0&bounded=1`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data && data.length > 0) {
                    const result = data[0];
                    const latLng = [parseFloat(result.lat), parseFloat(result.lon)];
                    map.setView(latLng, 16);
                    marker.setLatLng(latLng);
                    selectedMapAddress = result.display_name;
                    document.getElementById('map-address-preview').textContent = selectedMapAddress;
                } else {
                    alert('Location not found. Please try a different search term.');
                }
            } catch (error) {
                alert('An error occurred during search.');
            } finally {
                mapSearchBtn.disabled = false;
                mapSearchBtn.innerHTML = '<i class="fas fa-search"></i>';
            }
        }
        async function reverseGeocode(latlng) {
            const preview = document.getElementById('map-address-preview');
            preview.textContent = 'Fetching address...';
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`;
            try {
                const data = await (await fetch(url)).json();
                selectedMapAddress = data.display_name || `Lat: ${latlng.lat.toFixed(4)}, Lon: ${latlng.lng.toFixed(4)}`;
                preview.textContent = selectedMapAddress;
            } catch { preview.textContent = 'Error fetching address.'; }
        }

        // --- Core Application Logic ---
        function resetFareAndButton() {
            submitBtn.disabled = !formInputs.every(input => input.value.trim() !== '');
            fareDetailsDiv.style.display = 'none';
            submitBtn.innerHTML = 'Get Ride Estimate';
            finalFares = null;
        }

        async function handleFormSubmit(event) {
            event.preventDefault();
            if (finalFares) {
                saveBookingToServer();
                return;
            }
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-calculator"></i> Calculating...';
            try {
                const pickupCoords = await getCoords(pickupInput.value);
                const dropoffCoords = await getCoords(dropoffInput.value);
                const distance = calculateDistance(pickupCoords, dropoffCoords);
                finalFares = calculateAllFares(distance);
                displayFares();
                updateBookingButton();
            } catch (error) {
                alert(`Error: ${error.message}. Please check addresses.`);
                resetFareAndButton();
            } finally {
                submitBtn.disabled = false;
            }
        }

        function displayFares() {
            fareListUl.innerHTML = '';
            const sortedVehicles = Object.keys(PRICING_MODELS).sort((a, b) => finalFares[a].low - finalFares[b].low);
            
            sortedVehicles.forEach(vehicle => {
                const model = PRICING_MODELS[vehicle];
                const fare = finalFares[vehicle];
                const li = document.createElement('li');
                li.dataset.vehicle = vehicle;
                li.innerHTML = `<span class="vehicle-name"><i class="fas ${model.icon}"></i> ${model.name}</span> <span class="vehicle-price">₹${fare.low} - ₹${fare.high}</span>`;
                if (vehicle === selectedVehicle) li.classList.add('selected');
                
                li.addEventListener('click', () => {
                    selectedVehicle = vehicle;
                    document.querySelectorAll('#fare-list li').forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');
                    updateBookingButton();
                });
                fareListUl.appendChild(li);
            });
            fareDetailsDiv.style.display = 'block';
        }

        function updateBookingButton() {
            if (!finalFares) return;
            const fare = finalFares[selectedVehicle];
            const model = PRICING_MODELS[selectedVehicle];
            submitBtn.innerHTML = `Book Now (${model.name}) for ₹${fare.low} - ₹${fare.high}`;
        }

        async function saveBookingToServer() {
            const bookingData = {
                name: document.getElementById('name-input').value,
                phone: document.getElementById('phone-input').value,
                pickupAddress: pickupInput.value,
                dropoffAddress: dropoffInput.value,
                selectedVehicle: PRICING_MODELS[selectedVehicle].name,
                estimatedFare: `₹${finalFares[selectedVehicle].low} - ₹${finalFares[selectedVehicle].high}`,
                bookingStatus: 'Pending'
            };
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
            try {
                const response = await fetch(backendURL + '/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData),
                });
                if (!response.ok) throw new Error('Server responded with an error.');
                const result = await response.json();
                alert(`Booking Confirmed! Your booking ID is ${result.bookingId}.`);
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Ride Booked!';
            } catch (error) {
                console.error('Error:', error);
                alert('There was a problem confirming your booking. Please try again.');
                submitBtn.disabled = false;
                updateBookingButton();
            }
        }
        
        async function getCoords(address) {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`;
            const data = await (await fetch(url)).json();
            if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            throw new Error(`Could not find coordinates for "${address}"`);
        }

        function calculateDistance(c1, c2) {
            if (!c1 || !c2) throw new Error("Invalid coordinates for distance calculation.");
            const R = 6371;
            const dLat = (c2.lat - c1.lat) * Math.PI / 180, dLon = (c2.lon - c1.lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        function calculateAllFares(distance) {
            const fares = {};
            const baseDistance = 2;
            for (const vehicle in PRICING_MODELS) {
                const model = PRICING_MODELS[vehicle];
                let lowFare = model.baseFare, highFare = model.baseFare;
                if (distance > baseDistance) {
                    const extraDistance = distance - baseDistance;
                    lowFare += extraDistance * model.perKmLow;
                    highFare += extraDistance * model.perKmHigh;
                }
                fares[vehicle] = { low: Math.round(lowFare), high: Math.round(highFare) };
            }
            return fares;
        }
        async function handleGetGeolocation() {
            const geoBtn = document.getElementById('getPickupLocationBtn');
            if (!navigator.geolocation) return alert('Geolocation is not supported.');
            geoBtn.disabled = true;
            geoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
            navigator.geolocation.getCurrentPosition(async (position) => {
                const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
                try {
                    const data = await (await fetch(url)).json();
                    if (data && data.display_name) {
                        pickupInput.value = data.display_name;
                        pickupInput.dispatchEvent(new Event('input'));
                    }
                } finally {
                    geoBtn.disabled = false;
                    geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Geolocation';
                }
            }, () => {
                alert('Unable to retrieve location.');
                geoBtn.disabled = false;
                geoBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Geolocation';
            }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        }
    });
    

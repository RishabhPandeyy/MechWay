
        const siteHeader = document.getElementById("siteHeader");
        const menuToggle = document.getElementById("menuToggle");
        const navLinks = document.getElementById("navLinks");

        const bookingForm = document.getElementById("bookingForm");
        const bookingSubmit = document.getElementById("bookingSubmit");
        const bookingStatus = document.getElementById("bookingStatus");

        const vehicleTypeInput = document.getElementById("vehicleType");
        const vehicleButtons = document.querySelectorAll("[data-vehicle]");
        const serviceSelect = document.getElementById("serviceSelect");

        const locationInput = document.getElementById("locationInput");
        const locationButton = document.getElementById("locationButton");
        const mapLocationButton = document.getElementById("mapLocationButton");
        let selectedCoordinates = null;

        locationInput.addEventListener("input", () => { selectedCoordinates = null; });
        locationInput.addEventListener("location-selected", (event) => {
            const latitude = Number(event.detail.lat);
            const longitude = Number(event.detail.lon);
            selectedCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
                ? { latitude, longitude } : null;
        });

        const mapFrame = document.getElementById("mapFrame");
        const openMapsLink = document.getElementById("openMapsLink");

        const toast = document.getElementById("toast");
        const toastIcon = document.getElementById("toastIcon");
        const toastTitle = document.getElementById("toastTitle");
        const toastMessage = document.getElementById("toastMessage");

        const services = {
            bike: [
                "Full Vehicle Inspection",
                "Basic Diagnosis",
                "Tyre Puncture Repair",
                "Brake Adjustment",
                "Clutch and Throttle Cable Adjustment",
                "Chain Cleaning and Lubrication",
                "Electrical and Lights Check",
                "Other"
            ],
            car: [
                "Full Vehicle Inspection",
                "Basic Diagnosis",
                "Battery Jump-Start",
                "Brake Inspection",
                "AC Diagnosis",
                "Flat Tyre Spare Fitting",
                "Engine Overheating Diagnosis",
                "Basic Electrical Inspection",
                "Tyre Repair",
                "Other"
            ]
        };

        let toastTimer;

        function showToast(title, message, type = "success") {
            clearTimeout(toastTimer);

            toastTitle.textContent = title;
            toastMessage.textContent = message;

            if (type === "error") {
                toastIcon.className = "fas fa-circle-exclamation toast-icon";
                toastIcon.style.color = "#d92d20";
            } else if (type === "info") {
                toastIcon.className = "fas fa-circle-info toast-icon";
                toastIcon.style.color = "#1570ef";
            } else {
                toastIcon.className = "fas fa-circle-check toast-icon";
                toastIcon.style.color = "#16803c";
            }

            toast.classList.add("visible");

            toastTimer = setTimeout(() => {
                toast.classList.remove("visible");
            }, type === "error" ? 10000 : 4000);
        }

        function renderServices(vehicle, selectedService = "") {
            serviceSelect.innerHTML = "";

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select a service";
            placeholder.disabled = true;
            placeholder.selected = !selectedService;
            serviceSelect.appendChild(placeholder);

            services[vehicle].forEach((service) => {
                const option = document.createElement("option");
                option.value = service;
                option.textContent = service === "Other" ? "Others" : service;

                if (service === selectedService) {
                    option.selected = true;
                }

                serviceSelect.appendChild(option);
            });
        }

        function setVehicle(vehicle, selectedService = "") {
            vehicleTypeInput.value = vehicle;

            vehicleButtons.forEach((button) => {
                const isActive = button.dataset.vehicle === vehicle;
                button.classList.toggle("active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });

            renderServices(vehicle, selectedService);
            bookingStatus.classList.remove("visible");
        }

        function scrollToBooking() {
            bookingForm.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            setTimeout(() => {
                serviceSelect.focus({ preventScroll: true });
            }, 650);
        }

        function toggleMenu(forceState) {
            const shouldOpen =
                typeof forceState === "boolean"
                    ? forceState
                    : !navLinks.classList.contains("open");

            navLinks.classList.toggle("open", shouldOpen);
            document.body.classList.toggle("menu-open", shouldOpen);

            menuToggle.setAttribute("aria-expanded", String(shouldOpen));
            menuToggle.setAttribute(
                "aria-label",
                shouldOpen ? "Close navigation menu" : "Open navigation menu"
            );

            menuToggle.innerHTML = shouldOpen
                ? '<i class="fas fa-xmark" aria-hidden="true"></i>'
                : '<i class="fas fa-bars" aria-hidden="true"></i>';
        }

        function updateMap(latitude, longitude) {
            const coordinates = `${latitude},${longitude}`;

            mapFrame.src =
                `https://maps.google.com/maps?q=${encodeURIComponent(coordinates)}` +
                "&z=15&output=embed";

            openMapsLink.href =
                `https://maps.google.com/?q=${encodeURIComponent(coordinates)}`;
        }

        function requestCurrentLocation(button, updateInput = true) {
            if (button.disabled) return;
            if (!window.isSecureContext) {
                showToast(
                    "Secure connection needed",
                    "Open https://www.mechway.in in Chrome or Safari, then try current location again.",
                    "error"
                );
                return;
            }

            if (!navigator.geolocation) {
                showToast(
                    "Location unavailable",
                    "Your browser does not support geolocation. Please enter your area manually.",
                    "error"
                );
                return;
            }

            const policy = document.permissionsPolicy || document.featurePolicy;
            if (policy?.allowsFeature && !policy.allowsFeature("geolocation")) {
                showToast(
                    "Location blocked on this page",
                    "Open MechWay directly in Chrome or Safari. You can also enter your service area manually.",
                    "error"
                );
                return;
            }

            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML =
                '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>';

            function restoreButton() {
                button.disabled = false;
                button.innerHTML = originalContent;
            }

            function showLocationError(error) {
                restoreButton();
                if (error.code === 1) {
                    showToast(
                        "Location access blocked",
                        "Allow Location for this website in browser site permissions and for Chrome/Safari in phone settings. Then try again.",
                        "error"
                    );
                } else if (error.code === 3) {
                    showToast(
                        "Location request timed out",
                        "GPS took too long. Check your connection, move near a window and try again, or enter your area manually.",
                        "error"
                    );
                } else {
                    showToast(
                        "Current location unavailable",
                        "Your phone could not find its location. Check GPS and your connection, or enter your area manually.",
                        "error"
                    );
                }
            }

            function locate(highAccuracy) {
                try {
                    navigator.geolocation.getCurrentPosition((position) => {
                        const latitude = position.coords.latitude;
                        const longitude = position.coords.longitude;

                        if (updateInput) {
                            locationInput.value =
                                `Current location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                            selectedCoordinates = { latitude, longitude };
                        }

                        updateMap(latitude, longitude);

                        showToast(
                            "Location updated",
                            "Your current location is now being used."
                        );

                        restoreButton();
                    }, (error) => {
                        // Mobile GPS can stall indoors; retry once without requiring a GPS fix.
                        if (highAccuracy && (error.code === 2 || error.code === 3)) {
                            locate(false);
                        } else {
                            showLocationError(error);
                        }
                    }, {
                        enableHighAccuracy: highAccuracy,
                        timeout: highAccuracy ? 20000 : 15000,
                        maximumAge: 60000
                    });
                } catch (error) {
                    showLocationError({ code: error.name === "SecurityError" ? 1 : 2 });
                }
            }

            locate(true);
        }

        vehicleButtons.forEach((button) => {
            button.addEventListener("click", () => {
                setVehicle(button.dataset.vehicle);
            });
        });

        document.querySelectorAll("[data-scroll-booking]").forEach((button) => {
            button.addEventListener("click", scrollToBooking);
        });

        document.querySelectorAll("[data-book-service]").forEach((button) => {
            button.addEventListener("click", () => {
                setVehicle(
                    button.dataset.vehicleType,
                    button.dataset.serviceName
                );

                scrollToBooking();
            });
        });

        locationButton.addEventListener("click", () => {
            requestCurrentLocation(locationButton, true);
        });

        mapLocationButton.addEventListener("click", () => {
            requestCurrentLocation(mapLocationButton, true);
        });

        bookingForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!bookingForm.checkValidity()) {
                bookingForm.reportValidity();

                showToast(
                    "Missing information",
                    "Please select a service and enter your location.",
                    "error"
                );
                return;
            }

            const params = new URLSearchParams({
                vehicleType: vehicleTypeInput.value === 'car' ? 'Car' : 'Bike',
                service: serviceSelect.value,
                location: locationInput.value.trim()
            });
            if (selectedCoordinates) {
                params.set('latitude', String(selectedCoordinates.latitude));
                params.set('longitude', String(selectedCoordinates.longitude));
            }
            window.location.href = '/pages/mechanic.html?' + params.toString();
        });

        menuToggle.addEventListener("click", () => {
            toggleMenu();
        });

        navLinks.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                toggleMenu(false);
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                toggleMenu(false);
            }
        });

        document.querySelectorAll("[data-destination]").forEach((element) => {
            element.addEventListener("click", () => {
                window.location.href = element.dataset.destination;
            });
        });

        window.addEventListener("scroll", () => {
            siteHeader.classList.toggle("scrolled", window.scrollY > 20);
        });

        // Active navigation state
        const pageSections = document.querySelectorAll("main section[id]");
        const navigationLinks = document.querySelectorAll(".nav-links a");

        const sectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const currentId = entry.target.id;

                    if (currentId !== 'home') return;

                    navigationLinks.forEach((link) => {
                        link.classList.toggle(
                            "active",
                            link.getAttribute("href") === '/index.html'
                        );
                    });
                });
            },
            {
                rootMargin: "-35% 0px -55% 0px",
                threshold: 0
            }
        );

        pageSections.forEach((section) => {
            sectionObserver.observe(section);
        });

        // Reveal animations
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            document.body.classList.add("reveal-enabled");

            const revealObserver = new IntersectionObserver(
                (entries, observer) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;

                        entry.target.classList.add("revealed");
                        observer.unobserve(entry.target);
                    });
                },
                {
                    threshold: 0.12
                }
            );

            document.querySelectorAll("[data-reveal]").forEach((element) => {
                revealObserver.observe(element);
            });
        }

        // Number counters
        const counterObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const element = entry.target;
                    const target = Number(element.dataset.count);
                    const suffix = element.dataset.suffix || "";
                    const decimals = Number.isInteger(target) ? 0 : 1;
                    const duration = 1200;
                    const startTime = performance.now();

                    function updateCounter(currentTime) {
                        const progress = Math.min(
                            (currentTime - startTime) / duration,
                            1
                        );

                        const easedProgress = 1 - Math.pow(1 - progress, 3);
                        const value = target * easedProgress;

                        element.textContent =
                            value.toFixed(decimals) + suffix;

                        if (progress < 1) {
                            requestAnimationFrame(updateCounter);
                        }
                    }

                    requestAnimationFrame(updateCounter);
                    observer.unobserve(element);
                });
            },
            {
                threshold: 0.7
            }
        );

        document.querySelectorAll("[data-count]").forEach((counter) => {
            counterObserver.observe(counter);
        });

        document.getElementById("currentYear").textContent =
            new Date().getFullYear();

        renderServices("bike");
    

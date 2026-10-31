
document.addEventListener('DOMContentLoaded', () => {
    // --- Navbar Scroll Effect ---
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // --- Mobile Menu Toggle ---
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-menu');
    if (mobileMenu && navMenu) {
        mobileMenu.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Login form handler
    const loginForm = document.querySelector('form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let identifier = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            if (!identifier || !password) {
                alert('Please enter email/phone and password.');
                return;
            }
            try {
                const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
                    || window.location.protocol === 'file:';
                const base = local && window.location.port === '4000' ? window.location.origin
                    : local ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
                const backendURL = base + '/api/login';
                
                const res = await fetch(backendURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: identifier, password })
                });
                const data = await res.json();
                if (!res.ok) {
                    alert('Login failed: ' + (data.error || 'Unknown error'));
                    return;
                }
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert('Logged in successfully! Welcome, ' + data.user.name);
                loginForm.reset();
            } catch (err) {
                alert('Network error: Unable to connect to backend');
            }
        });
    }
});

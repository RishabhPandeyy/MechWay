
    document.addEventListener('DOMContentLoaded', () => {
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

        const mobileMenu = document.getElementById('mobile-menu');
        const navMenu = document.getElementById('nav-menu');
        if (mobileMenu && navMenu) {
            mobileMenu.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Signup form handler
        const signupForm = document.querySelector('form');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('fullname').value.trim();
                const email = document.getElementById('email').value.trim();
                let phone = document.getElementById('phone').value.trim();
                const address = document.getElementById('address').value.trim();
                const aadharNo = document.getElementById('aadharNo').value.trim();
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                const mechanicType = document.getElementById('mechanic-type').value;
                
                // Strip non-digit characters from phone (keeps only 0-9)
                phone = phone.replace(/\D/g, '');
                
                if (!name || !email || !phone || !password || !confirmPassword) {
                    alert('Please fill in all fields.');
                    return;
                }
                if (!mechanicType) {
                    alert('Please select a mechanic type (Car or Bike).');
                    return;
                }
                if (password !== confirmPassword) {
                    alert('Passwords do not match.');
                    return;
                }
                try {
                    // Deployed backend URL
                    const backendURL = 'https://newonwheels.onrender.com/api/signup';
                    
                    const res = await fetch(backendURL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, phone, address, aadharNo, password, mechanicType })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        alert('Signup failed: ' + (data.error || 'Unknown error'));
                        return;
                    }
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    alert('Account created successfully! Welcome, ' + data.user.name);
                    signupForm.reset();
                } catch (err) {
                    alert('Network error: Unable to connect to backend');
                }
            });
        }
    });
    
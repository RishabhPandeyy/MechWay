document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('main-navbar');
    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));

    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-menu');
    mobileMenu.addEventListener('click', () => navMenu.classList.toggle('active'));

    const form = document.getElementById('general-contact-form');
    const phoneInput = document.getElementById('phone');
    const submitButton = document.getElementById('contact-submit');
    const submitLabel = submitButton.querySelector('span');
    const status = document.getElementById('contact-form-status');

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `contact-form-status ${type}`;
        status.hidden = false;
    }

    phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const rawDigits = phoneInput.value.replace(/\D/g, '');
        const phone = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
        phoneInput.setCustomValidity(/^[6-9]\d{9}$/.test(phone) ? '' : 'Enter a valid 10-digit Indian mobile number.');
        if (!form.reportValidity()) return;

        submitButton.disabled = true;
        submitLabel.textContent = 'Sending...';
        status.hidden = true;
        const hostname = window.location.hostname;
        const local = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
        const backendURL = local ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

        try {
            const response = await fetch(`${backendURL}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('name').value.trim(),
                    phone,
                    message: document.getElementById('message').value.trim()
                })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send your message.');
            form.reset();
            showStatus('Message sent. Our team will contact you soon.', 'success');
        } catch (error) {
            showStatus(error instanceof TypeError || error instanceof SyntaxError
                ? 'Could not reach the server. Please try again shortly.'
                : error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitLabel.textContent = 'Send Message';
        }
    });
});

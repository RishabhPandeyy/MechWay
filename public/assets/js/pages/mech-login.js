
  (() => {
    const toggle = document.getElementById('portal-menu-toggle');
    const navigation = document.getElementById('portal-navigation');
    function setOpen(open) {
      navigation.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      toggle.querySelector('i').className = open ? 'fas fa-times' : 'fas fa-bars';
    }
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', event => { if (!event.target.closest('.portal-navbar')) setOpen(false); });
    matchMedia('(max-width: 1000px)').addEventListener('change', () => setOpen(false));
  })();
  console.log('=== Mech Login Script Started ===');
  
  const getBackendURL = () => {
    if (['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '4000') {
      return window.location.origin;
    }
    const explicitBackend =
      window.__MECHWAY_API__ ||
      localStorage.getItem('mechwayApiBase') ||
      '';
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';

    if (explicitBackend) return explicitBackend.replace(/\/$/, '');
    return isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
  };

  console.log('Backend URL:', getBackendURL());

  // Check if already logged in
  const token = localStorage.getItem('mechanicToken');
  if (token) {
    console.log('Already logged in, redirecting...');
    window.location.href = '/pages/mech-dashboard.html';
  }

  function showMessage(text, type) {
    const msgEl = document.getElementById('message');
    msgEl.textContent = text;
    msgEl.className = 'message ' + type;
  }

  function showResetMessage(text, type) {
    const msgEl = document.getElementById('resetMessage');
    msgEl.textContent = text;
    msgEl.className = 'message ' + type;
  }

  document.getElementById('forgotPasswordBtn').addEventListener('click', event => {
    const open = document.getElementById('resetPanel').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('resetIdentifier').focus();
  });

  async function readApiResponse(response) {
    const raw = await response.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      const compact = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        ok: false,
        error: compact || `Server returned ${response.status} ${response.statusText}`
      };
    }
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    const formData = {
      identifier: document.getElementById('identifier').value.trim(),
      password: document.getElementById('password').value
    };

    try {
      const backendUrl = getBackendURL();
      console.log('Attempting login to:', backendUrl);
      
const response = await fetch(backendUrl + '/api/mechanic/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const result = await readApiResponse(response);

      if (response.ok && result.ok) {
        showMessage('✅ Login successful! Redirecting...', 'success');
        
        // Save token and redirect
        localStorage.setItem('mechanicToken', result.token);
        localStorage.setItem('mechanicData', JSON.stringify(result.mechanic));
        
        // ── CLEAR OLD BALANCES FROM PREVIOUS ACCOUNTS ──
        localStorage.removeItem('mw_locked_earn');
        localStorage.removeItem('mw_locked_bal');
        localStorage.removeItem('mw_locked_jobs');
        localStorage.removeItem('mw_locked_pend');

        setTimeout(() => {
          window.location.href = '/pages/mech-dashboard.html';
        }, 1500);
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      showMessage(err instanceof TypeError ? 'Cannot connect to the login server. Please try again shortly.' : err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
  });

  let resetChallenge = '';
  document.getElementById('resetIdentifier').addEventListener('input', () => {
    resetChallenge = '';
    document.getElementById('reset-otp-form').hidden = true;
  });
  document.getElementById('reset-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const sendBtn = document.getElementById('sendResetBtn');
    sendBtn.disabled = true;
    resetChallenge = '';
    document.getElementById('reset-otp-form').hidden = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    let sent = false;
    const resetIdentifierValue = document.getElementById('resetIdentifier').value.trim();

    try {
      const response = await fetch(getBackendURL() + '/api/mechanic/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resetIdentifierValue
        })
      });

      const result = await readApiResponse(response);
      if (response.ok && result.ok) {
        showResetMessage(result.message, 'success');
        sent = true;
        resetChallenge = result.challenge;
        document.getElementById('reset-otp-form').hidden = false;
        document.getElementById('resetOtp').value = '';
        document.getElementById('resetOtp').focus();
      } else {
        throw new Error(result.error || 'Could not send OTP.');
      }
    } catch (err) {
      showResetMessage(err instanceof TypeError ? 'Cannot connect to the login server. Please try again shortly.' : err.message, 'error');
    } finally {
      if (sent) {
        let remaining = 60;
        sendBtn.textContent = `Resend OTP in ${remaining}s`;
        const cooldown = setInterval(() => {
          remaining -= 1;
          sendBtn.textContent = `Resend OTP in ${remaining}s`;
          if (remaining <= 0) {
            clearInterval(cooldown);
            sendBtn.disabled = false;
            sendBtn.textContent = 'Resend OTP';
          }
        }, 1000);
      } else {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send OTP';
      }
    }
  });

  document.getElementById('reset-otp-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('verifyOtpBtn');
    button.disabled = true;
    button.textContent = 'Verifying...';
    try {
      const response = await fetch(getBackendURL() + '/api/mechanic/verify-reset-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: resetChallenge, otp: document.getElementById('resetOtp').value.trim() })
      });
      const result = await readApiResponse(response);
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not verify OTP.');
      resetChallenge = '';
      window.location.href = '/pages/reset-password.html#token=' + encodeURIComponent(result.token);
    } catch (error) {
      showResetMessage(error instanceof TypeError ? 'Cannot connect to the server. Please try again shortly.' : error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Verify OTP';
    }
  });

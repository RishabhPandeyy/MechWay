(() => {
  const form = document.getElementById('password-form');
  const status = document.getElementById('reset-status');
  const password = document.getElementById('new-password');
  const confirmation = document.getElementById('confirm-password');
  const button = document.getElementById('reset-submit');
  let token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  // Keep the token in memory, not in browser history or persistent storage.
  history.replaceState(null, '', location.pathname);
  function message(text, type) {
    status.hidden = false;
    status.className = `status ${type}`;
    status.textContent = text;
  }
  if (!/^[a-f0-9]{64}$/.test(token)) {
    form.hidden = true;
    message('This reset link is missing or invalid. Please request a new link from the login page.', 'error');
  }
  document.getElementById('show-password').addEventListener('change', event => {
    password.type = confirmation.type = event.target.checked ? 'text' : 'password';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (password.value !== confirmation.value) return message('Passwords do not match.', 'error');
    if (new TextEncoder().encode(password.value).length > 72) return message('Use a password up to 72 bytes long.', 'error');
    button.disabled = true;
    button.textContent = 'Updating...';
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const explicit = window.__MECHWAY_API__ || localStorage.getItem('mechwayApiBase');
    const base = local && location.port === '4000' ? location.origin : (explicit || (local ? 'http://localhost:4000' : 'https://newonwheels.onrender.com'));
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/api/mechanic/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.value })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not update your password.');
      token = '';
      form.reset();
      form.hidden = true;
      localStorage.removeItem('mechanicToken');
      localStorage.removeItem('mechanicData');
      message(result.message, 'success');
      document.getElementById('reset-title').textContent = 'Password updated';
    } catch (error) {
      message(error instanceof TypeError || error instanceof SyntaxError ? 'Cannot connect to the server. Please try again shortly.' : error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Update Password';
    }
  });
})();

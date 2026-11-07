(() => {
  const form = document.getElementById('quick-restoration-form');
  if (!form) return;
  const vehicle = form.elements.vehicleType;
  const budget = form.elements.budgetOption;
  const custom = form.elements.customBudget;
  const customField = document.getElementById('quick-custom-field');
  const status = document.getElementById('quick-restoration-status');
  const whatsapp = form.elements.whatsappNumber;
  whatsapp.addEventListener('input', () => whatsapp.setCustomValidity(''));
  const button = form.querySelector('button[type="submit"]');
  const submissionRequest = createSubmissionRequest('restore-enquiry');
  const choices = {
    Bike: [['15000', '₹15,000'], ['45000', '₹45,000'], ['80000', '₹80,000+']],
    Car: [['under-150000', 'Below ₹1.5 lakh'], ['150000-300000', '₹1.5–₹3 lakh'], ['300000-plus', '₹3 lakh+']]
  };
  function toggleCustom() {
    const selected = budget.value === 'custom';
    customField.hidden = !selected;
    custom.disabled = !selected;
    custom.required = selected;
    if (!selected) custom.value = '';
  }
  function updateBudgets() {
    budget.replaceChildren(new Option('Select budget', ''),
      ...choices[vehicle.value].map(([value, label]) => new Option(label, value)),
      new Option('Custom — enter your budget', 'custom'));
    toggleCustom();
  }
  vehicle.addEventListener('change', updateBudgets);
  budget.addEventListener('change', toggleCustom);
  updateBudgets();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const digits = whatsapp.value.replace(/\D/g, '');
    const whatsappNumber = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    whatsapp.setCustomValidity(/^[6-9]\d{9}$/.test(whatsappNumber) ? '' : 'Enter a valid 10-digit Indian WhatsApp number.');
    if (!form.reportValidity()) return;
    const data = {
      whatsappNumber,
      name: form.elements.name.value.trim(),
      location: form.elements.location.value.trim(),
      vehicleType: vehicle.value,
      budgetOption: budget.value,
      ...(budget.value === 'custom' ? { customBudget: Number(custom.value) } : {})
    };
    if (!data.name || !data.location) {
      status.textContent = 'Please enter your name and location.';
      return;
    }
    data.requestId = submissionRequest.id(data);
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = '';
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
    const base = local && location.port === '4000' ? location.origin
      : local ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(base + '/api/restoration-enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), signal: controller.signal
      });
      if (response.status === 404) throw new Error('The enquiry service needs a backend update. Please restart the local backend or contact MechWay.');
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The enquiry service returned an unexpected response. Please try again shortly.');
      }
      const result = await response.json();
      if (!response.ok || !result.ok || !result.id) throw new Error(result.error || 'Could not save your enquiry.');
      submissionRequest.complete();
      form.reset();
      updateBudgets();
      status.textContent = `Your enquiry has been saved. Reference: MW-REST-${String(result.id).slice(-6).toUpperCase()}.`;
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? 'The request timed out. Your enquiry may have been saved; please check before resubmitting.'
        : error instanceof TypeError || error instanceof SyntaxError
          ? 'Could not reach the enquiry service. Please try again shortly.' : error.message;
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = 'Send Enquiry';
    }
  });
})();

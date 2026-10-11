
      (() => {
        const state = {
          adminKey: localStorage.getItem('mechwayAdminKey') || '',
          bookings: [],
          payments: [],
          contacts: [],
          inquiries: [],
          restorations: [],
          mechanics: [],
          workSlips: [],
          payouts: []
        };

        const el = id => document.getElementById(id);
        const fmtDate = value => value ? new Date(value).toLocaleString('en-IN') : '—';
        const esc = value => String(value ?? '—')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const getBackendURL = () => {
          const hostname = window.location.hostname;
          const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
          return isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';
        };

        function setLoggedIn(isLoggedIn) {
          el('login-screen').style.display = isLoggedIn ? 'none' : 'flex';
          el('dashboard').style.display = isLoggedIn ? 'block' : 'none';
          el('adminKey').value = isLoggedIn ? state.adminKey : '';
        }

        async function apiFetch(path, options = {}) {
          const headers = {
            'Content-Type': 'application/json',
            'x-admin-key': state.adminKey,
            ...(options.headers || {})
          };
          const response = await fetch(getBackendURL() + path, { ...options, headers });
          const text = await response.text();
          
          let data = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch (err) {
            throw new Error(`API Error (${response.status}): Expected JSON but received HTML. The backend might not be running or accessible.`);
          }
          
          if (!response.ok) throw new Error(data.error || 'Request failed');
          return data;
        }

        function setCounts() {
          el('badge-bookings').textContent = state.bookings.length;
          el('badge-payments').textContent = state.payments.length;
          el('badge-contacts').textContent = state.contacts.length;
          el('badge-inquiries').textContent = state.inquiries.length;
          el('badge-restorations').textContent = state.restorations.length;
          el('badge-mechanics').textContent = state.mechanics.length;
          el('badge-work-slips').textContent = state.workSlips.length;
          el('badge-payouts').textContent = state.payouts.length;
          el('stat-bookings').textContent = state.bookings.length;
          el('stat-payments').textContent = state.payments.length;
          el('stat-contacts').textContent = state.contacts.length;
          el('stat-mechanics').textContent = state.mechanics.length;
          el('stat-inquiries').textContent = state.inquiries.length;
          el('stat-restorations').textContent = state.restorations.length;
          el('stat-payouts').textContent = state.payouts.length;
          const completedServiceValue = state.payments
            .filter(row => ['paid', 'captured', 'completed'].includes(String(row.status || '').toLowerCase()))
            .reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);
          el('stat-revenue').textContent = '₹' + completedServiceValue.toLocaleString('en-IN');
        }

        function fillTable(tbodyId, rowsHtml, colspan) {
          el(tbodyId).innerHTML = rowsHtml || `<tr><td class="empty-cell" colspan="${colspan}">No data found</td></tr>`;
        }

        function generateBookingOTP(seed) {
          let hash = 0;
          for (let i = 0; i < seed.length; i++) {
            const chr = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
          }
          return (100000 + (Math.abs(hash) % 900000)).toString();
        }

        function renderBookings(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.bookings
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => {
              const fallbackOtp = generateBookingOTP(String(row.phone || '') + String(row._id || row.id || ''));
              const displayOtp = row.otp || fallbackOtp;
              return `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.name)}</td>
                <td>${esc(row.phone)}</td>
                <td>${esc(row.vehicleType)}</td>
                <td>${esc([row.vehicleBrand, row.vehicleModel].filter(Boolean).join(' / '))}</td>
                <td>${esc(row.problem || row.message)}</td>
                <td>₹${esc(row.servicePrice || 0)}</td>
                <td><strong style="color:var(--orange);letter-spacing:1.5px;">${esc(displayOtp)}</strong></td>
                <td>
                  <button class="action-btn" data-action="reset-otp" data-id="${esc(row._id || row.id)}">Reset OTP</button>
                </td>
              </tr>
            `}).join('');
          fillTable('tbody-bookings', rows, 9);
        }

        function renderPayments(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.payments
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.customerName || row.name)}</td>
                <td>${esc(row.customerPhone || row.phone)}</td>
                <td>${esc(row.vehicleType)}</td>
                <td>${esc(row.service || row.originalMessage || '—')}</td>
                <td>₹${esc(row.totalAmount || row.servicePrice || 0)}</td>
                <td>${esc(row.paymentMethod || '—')}</td>
                <td>${esc(row.status || 'unverified')}</td>
                <td>—</td>
              </tr>
            `).join('');
          fillTable('tbody-payments', rows, 9);
        }

        function renderContacts(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.contacts
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.name)}</td>
                <td>${esc(row.phone)}</td>
                <td>${esc(row.email)}</td>
                <td>${esc(row.subject)}</td>
                <td>${esc(row.message)}</td>
                <td>—</td>
              </tr>
            `).join('');
          fillTable('tbody-contacts', rows, 7);
        }

        function renderInquiries(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.inquiries
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.product_name || row.product_id)}</td>
                <td>${esc(row.name)}</td>
                <td>${esc(row.phone)}</td>
                <td>${esc(row.message)}</td>
                <td>—</td>
              </tr>
            `).join('');
          fillTable('tbody-inquiries', rows, 6);
        }

        function normalizeImageUrl(path) {
          if (!path) return '';
          if (path.startsWith('http://') || path.startsWith('https://')) return path;
          if (path.startsWith('/')) return `${getBackendURL()}${path}`;
          return `${getBackendURL()}/${path.replace(/^\//, '')}`;
        }

        function renderRestorations(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.restorations
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => {
              const images = row.vehiclePhotos?.front
                ? [['Front', row.vehiclePhotos.front], ['Back', row.vehiclePhotos.rear], ['Left side', row.vehiclePhotos.left], ['Right side', row.vehiclePhotos.right]]
                : (Array.isArray(row.restorationImages) ? row.restorationImages : []).map((path, index) => [`Vehicle photo ${index + 1}`, path]);
              const maxThumbs = 5;
              const imgHtml = images.length
                ? (images.slice(0, maxThumbs).map(([label, path]) => {
                    const url = normalizeImageUrl(path);
                    return `
                      <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(label)}" aria-label="View ${esc(label)} image">
                        <img src="${esc(url)}" alt="${esc(label)}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;margin:2px;border:1px solid rgba(255,255,255,.1);" />
                      </a>
                    `;
                  }).join('') + (images.length > maxThumbs ? `<span>+${images.length - maxThumbs} more</span>` : ''))
                : '<span>—</span>';
              const rcButton = row.rcPrivate ? `<button type="button" class="action-btn" data-action="download-rc" data-id="${esc(row._id)}">Download RC</button>` : '';

              return `
                <tr>
                  <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                  <td>${esc(row.fullName || row.name || '—')}</td>
                  <td>${esc(row.mobileNumber || row.phone || '—')}</td>
                  <td>${esc([row.brand, row.modelName].filter(Boolean).join(' / '))}${row.registrationNumber ? `<br><small>${esc(row.registrationNumber)}</small>` : ''}</td>
                  <td>${esc(row.condition || '—')}</td>
                  <td>${esc(row.budgetRange || '—')}</td>
                  <td>${imgHtml}${rcButton}</td>
                  <td><span class="pill ${row.status === 'pending' ? 'off' : 'ok'}">${esc(row.status || 'pending')}</span></td>
                </tr>
              `;
            }).join('');
          fillTable('tbody-restorations', rows, 8);
        }

        function mechanicStatus(row) {
          if (!row.isApproved) return '<span class="pill off"><i class="fas fa-clock"></i> Unverified</span>';
          if (row.isOnline) return '<span class="pill ok"><i class="fas fa-circle"></i> Online</span>';
          if (row.isAvailable) return '<span class="pill ok"><i class="fas fa-check"></i> Available</span>';
          return '<span class="pill off"><i class="fas fa-pause"></i> Offline</span>';
        }

        function renderMechanics(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.mechanics
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.name)}<br>${mechanicStatus(row)}</td>
                <td>${esc(row.phone)}</td>
                <td>${esc(row.email)}</td>
                <td>${esc(row.address)}</td>
                <td>${esc(row.mechanicType)}</td>
                <td>${esc(row.aadharNo)}</td>
                <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                  ${!row.isApproved 
                    ? `<button class="action-btn" style="border-color:var(--success); color:var(--success);" data-action="approve" data-id="${esc(row._id || row.id)}">Verify</button>`
                    : `<button class="action-btn" style="border-color:var(--danger); color:var(--danger);" data-action="suspend" data-id="${esc(row._id || row.id)}">Suspend / Reject</button>`
                  }
                  <button class="action-btn" data-action="set-password" data-id="${esc(row._id || row.id)}" data-name="${esc(row.name)}">Password</button>
                </td>
              </tr>
            `).join('');
          fillTable('tbody-mechanics', rows, 8);
        }

        function renderPayouts(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.payouts
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => {
              const statusColors = { pending: 'off', processing: 'off', completed: 'ok', rejected: 'danger' };
              const stClass = statusColors[row.status] || 'off';
              const bankInfo = row.paymentMethod === 'upi' 
                ? `UPI: ${esc(row.bankDetails?.upiId || '—')}` 
                : `Bank: ${esc(row.bankDetails?.bankName || '')} <br>Acc: ${esc(row.bankDetails?.accountNo || '')}<br>IFSC: ${esc(row.bankDetails?.ifsc || '')}`;
              
              let actionBtns = `<span>—</span>`;
              if (row.status === 'pending' || row.status === 'processing') {
                actionBtns = `
                  <button class="action-btn" style="border-color:var(--success); color:var(--success);" data-action="complete-payout" data-id="${row._id}">Complete</button>
                  <button class="action-btn" style="border-color:var(--danger); color:var(--danger);" data-action="reject-payout" data-id="${row._id}">Reject</button>
                `;
              }
              
              return `
              <tr>
                <td>${esc(fmtDate(row.createdAt || row.created_at))}</td>
                <td>${esc(row.mechanicName)}</td>
                <td>₹${esc(row.amount)}</td>
                <td>${esc(row.paymentMethod)}</td>
                <td>${bankInfo}</td>
                <td><span class="pill ${stClass}">${esc(row.status)}</span></td>
                <td style="display:flex; gap:0.4rem; flex-wrap:wrap;">${actionBtns}</td>
              </tr>
            `}).join('');
          fillTable('tbody-payouts', rows, 7);
        }

        function renderWorkSlips(filter = '') {
          const q = filter.toLowerCase();
          const rows = state.workSlips
            .filter(row => JSON.stringify(row).toLowerCase().includes(q))
            .map(row => {
              const ws = row.workSlip || {};
              const waClass = ws.whatsappStatus === 'sent'
                ? 'ok'
                : (ws.whatsappStatus === 'ready_to_send' ? 'off' : (ws.whatsappStatus === 'failed' ? 'danger' : 'off'));
              const notes = ws.notes || ws.whatsappError || '—';
              return `
              <tr>
                <td>${esc(fmtDate(ws.submittedAt || row.createdAt))}</td>
                <td>${esc(row.customerName)}<br>${esc(row.customerPhone)}</td>
                <td>${esc(ws.submittedByMechanicName || '—')}<br>${esc(ws.submittedByMechanicPhone || '—')}</td>
                <td>${esc(ws.summary || '—')}<br><small>${esc(ws.workDone || '—')}</small></td>
                <td>₹${esc(ws.totalCharge || 0)}</td>
                <td><span class="pill ${waClass}">${esc(ws.whatsappStatus || 'pending')}</span></td>
                <td>${esc(notes)}</td>
              </tr>
            `;
            }).join('');
          fillTable('tbody-work-slips', rows, 7);
        }

        function renderAll() {
          setCounts();
          el('storage-badge').innerHTML = '<i class="fas fa-database"></i> Connected';
          renderBookings(el('search-bookings').value);
          renderPayments(el('search-payments').value);
          renderContacts(el('search-contacts').value);
          renderInquiries(el('search-inquiries').value);
          renderRestorations(el('search-restorations').value);
          renderMechanics(el('search-mechanics').value);
          renderWorkSlips(el('search-work-slips').value);
          renderPayouts(el('search-payouts').value);
        }

        async function loadDashboard() {
          const submissions = await apiFetch('/api/admin/submissions');
          state.bookings = submissions.bookings || [];
          state.payments = submissions.payments || [];
          state.contacts = submissions.contacts || [];
          state.inquiries = submissions.inquiries || [];
          state.restorations = submissions.restorations || submissions.restorationRequests || [];
          state.mechanics = submissions.mechanics || [];
          state.workSlips = submissions.workSlips || [];
          state.payouts = submissions.payouts || [];
          renderAll();
        }

        async function handleAdminLogin() {
          const loginError = el('login-error');
          loginError.textContent = '';
          state.adminKey = el('adminKey').value.trim();
          if (!state.adminKey) {
            loginError.textContent = 'Admin key is required';
            return;
          }

          try {
            await loadDashboard();
            localStorage.setItem('mechwayAdminKey', state.adminKey);
            setLoggedIn(true);
          } catch (err) {
            setLoggedIn(false);
            loginError.textContent = err.message;
          }
        }

        let pendingMechanicAction = null;
        function showMechanicStatus(message, type) {
          const status = el('mechanic-action-status');
          status.textContent = message;
          status.className = `mechanic-action-status ${type}`;
          status.hidden = false;
        }

        function openMechanicAction(button) {
          const action = button.dataset.action;
          if (!['approve', 'suspend', 'set-password'].includes(action)) return;
          pendingMechanicAction = { action, id: button.dataset.id };
          const passwordAction = action === 'set-password';
          const title = passwordAction ? 'Set mechanic password' : action === 'approve' ? 'Verify mechanic' : 'Suspend mechanic';
          el('mechanic-action-title').textContent = title;
          el('mechanic-action-description').textContent = passwordAction
            ? `Set a new password for ${button.dataset.name || 'this mechanic'}. Their current session will expire.`
            : action === 'approve'
              ? 'This mechanic will be able to log in. They can receive jobs when they go available.'
              : 'This mechanic will be logged out and cannot receive jobs.';
          el('mechanic-action-submit').textContent = passwordAction ? 'Update Password' : action === 'approve' ? 'Verify' : 'Suspend';
          el('mechanic-password-fields').hidden = !passwordAction;
          el('mechanic-new-password').required = passwordAction;
          el('mechanic-new-password').value = '';
          el('mechanic-dialog-error').hidden = true;
          el('mechanic-action-dialog').showModal();
          if (passwordAction) el('mechanic-new-password').focus();
        }

        el('mechanic-action-cancel').addEventListener('click', () => el('mechanic-action-dialog').close());
        el('mechanic-action-dialog').addEventListener('close', () => { pendingMechanicAction = null; el('mechanic-new-password').value = ''; });
        el('mechanic-action-form').addEventListener('submit', async event => {
          event.preventDefault();
          if (!pendingMechanicAction) return;
          const { action, id } = pendingMechanicAction;
          const newPassword = el('mechanic-new-password').value;
          const error = el('mechanic-dialog-error');
          error.hidden = true;
          if (action === 'set-password' && (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72)) {
            error.textContent = 'Use at least 8 characters, up to 72 bytes.';
            error.hidden = false;
            return;
          }
          const submit = el('mechanic-action-submit');
          submit.disabled = true;
          try {
            const path = `/api/admin/mechanics/${encodeURIComponent(id)}/${action === 'set-password' ? 'set-password' : 'approve'}`;
            const body = action === 'set-password' ? { newPassword } : { isApproved: action === 'approve' };
            const result = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
            el('mechanic-action-dialog').close();
            showMechanicStatus(result.message, 'success');
            try { await loadDashboard(); } catch (loadError) { showMechanicStatus(`${result.message} Refresh failed: ${loadError.message}`, 'error'); }
          } catch (requestError) {
            error.textContent = requestError.message;
            error.hidden = false;
          } finally {
            submit.disabled = false;
          }
        });

        async function handleProcessPayout(payoutId, status) {
          try {
            const result = await apiFetch('/api/admin/process-payout', {
              method: 'POST',
              body: JSON.stringify({ payoutId, status })
            });
            await loadDashboard(); // Refresh silently
          } catch (err) {
            window.alert(err.message);
          }
        }

        async function handleResetOtp(bookingId) {
          try {
            const result = await apiFetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/reset-otp`, {
              method: 'POST'
            });
            window.alert(`OTP Reset successful! New OTP is: ${result.otp}`);
            await loadDashboard(); // Refresh silently
          } catch (err) {
            window.alert(err.message);
          }
        }

        function activateTab(tabName) {
          document.querySelectorAll('.admin-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
          });
          document.querySelectorAll('.tab-content').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
          });
        }

        document.querySelectorAll('.admin-tab').forEach(btn => {
          btn.addEventListener('click', () => activateTab(btn.dataset.tab));
        });

        [['search-bookings', renderBookings], ['search-payments', renderPayments], ['search-contacts', renderContacts], ['search-inquiries', renderInquiries], ['search-restorations', renderRestorations], ['search-mechanics', renderMechanics], ['search-work-slips', renderWorkSlips], ['search-payouts', renderPayouts]]
          .forEach(([id, render]) => el(id).addEventListener('input', e => render(e.target.value)));

        el('login-btn').addEventListener('click', handleAdminLogin);
        el('adminKey').addEventListener('keydown', e => {
          if (e.key === 'Enter') handleAdminLogin();
        });
        el('refresh-btn').addEventListener('click', async () => {
          try {
            await loadDashboard();
          } catch (err) {
            window.alert(err.message);
          }
        });
        el('logout-btn').addEventListener('click', () => {
          state.adminKey = '';
          localStorage.removeItem('mechwayAdminKey');
          setLoggedIn(false);
        });

        el('tbody-mechanics').addEventListener('click', e => {
          const btn = e.target.closest('.action-btn');
          if (!btn) return;
          openMechanicAction(btn);
        });

        el('tbody-bookings').addEventListener('click', e => {
          const btn = e.target.closest('.action-btn');
          if (!btn) return;
          const action = btn.dataset.action;
          
          if (action === 'reset-otp') {
            if (window.confirm('Are you sure you want to generate a new OTP for this booking?')) handleResetOtp(btn.dataset.id);
          }
        });

        el('tbody-restorations').addEventListener('click', async e => {
          const button = e.target.closest('[data-action="download-rc"]');
          if (!button) return;
          button.disabled = true;
          try {
            const response = await fetch(`${getBackendURL()}/api/admin/restorations/${encodeURIComponent(button.dataset.id)}/rc`, {
              headers: { 'x-admin-key': state.adminKey }
            });
            if (!response.ok) throw new Error('Could not download RC image');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `RC-${button.dataset.id}`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          } catch (error) {
            window.alert(error.message);
          } finally {
            button.disabled = false;
          }
        });

        el('tbody-payouts').addEventListener('click', e => {
          const btn = e.target.closest('.action-btn');
          if (!btn) return;
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          
          if (action === 'complete-payout') {
            if (window.confirm('Mark this payout as COMPLETED?')) handleProcessPayout(id, 'completed');
          } else if (action === 'reject-payout') {
            if (window.confirm('Mark this payout as REJECTED? The amount will be returned to the mechanic.')) handleProcessPayout(id, 'rejected');
          }
        });

        setLoggedIn(false);
        if (state.adminKey) {
          setLoggedIn(true);
          loadDashboard().catch(err => {
            localStorage.removeItem('mechwayAdminKey');
            state.adminKey = '';
            setLoggedIn(false);
            el('login-error').textContent = err.message;
          });
        }
      })();
    

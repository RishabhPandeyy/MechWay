
  const listEl = document.getElementById('list');
  const statusEl = document.getElementById('status');
  const keyInput = document.getElementById('admin-key');

  async function load() {
    listEl.innerHTML = '';
    statusEl.textContent = 'Loading...';
    let key = keyInput.value.trim();
    if (!key) {
      key = prompt('Admin key:');
    }
    try {
      const res = await fetch('/api/admin/restorations', {
        headers: { 'x-admin-key': key }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unauthorized or error');
      statusEl.textContent = `${data.count} restorations`;
      if (!data.restorations || data.restorations.length === 0) {
        listEl.innerHTML = '<div class="no-data">No restoration requests found.</div>';
        return;
      }
      data.restorations.forEach(r => {
        const card = document.createElement('div'); card.className = 'card';
        const imgUrl = (r.restorationImages && r.restorationImages[0]) ? (window.location.origin + r.restorationImages[0]) : '';
        if (imgUrl) card.innerHTML = `<img src="${imgUrl}" onerror="this.style.display='none'"/>`;
        card.innerHTML += `<div class=meta><strong>${r.fullName || r.name || '—'}</strong> <div class=small>${r.mobileNumber||r.phone||''} · ${new Date(r.createdAt||r.createdAt||'').toLocaleString()}</div></div>`;
        card.innerHTML += `<div class=small>${r.brand||''} ${r.modelName||''} · ${r.condition||''}</div>`;
        card.innerHTML += `<div class=small style="margin-top:6px">Notes: ${r.specialNotes||r.message||''}</div>`;
        listEl.appendChild(card);
      });
    } catch (err) {
      statusEl.textContent = 'Error: ' + (err.message || err);
      listEl.innerHTML = '';
    }
  }

  document.getElementById('load').addEventListener('click', load);
  document.getElementById('refresh').addEventListener('click', load);

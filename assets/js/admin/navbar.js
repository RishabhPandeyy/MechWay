// Minimal navbar stub for admin
(function(){
  const header = document.getElementById('main-navbar');
  if (!header) return;
  header.innerHTML = `<div style="padding:12px 20px;background:transparent;color:var(--text);display:flex;align-items:center;justify-content:space-between"><div style="font-weight:700">MechWay Admin</div><div style="font-size:13px;color:var(--muted)">Admin</div></div>`;
})();

(() => {
  const toggle = document.getElementById('menuToggle');
  const links = document.getElementById('navLinks');
  function setMenu(open) {
    links.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    toggle.querySelector('i').className = open ? 'fas fa-xmark' : 'fas fa-bars';
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });
  document.getElementById('currentYear').textContent = new Date().getFullYear();
})();


  const navbar = document.getElementById('main-navbar');
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));
  document.getElementById('mobile-menu')?.addEventListener('click', () => document.getElementById('nav-menu')?.classList.toggle('open'));
  const obs = new IntersectionObserver(e => e.forEach(el => el.isIntersecting && el.target.classList.add('visible')), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

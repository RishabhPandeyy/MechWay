
  /* Navbar scroll */
  const navbar = document.getElementById('main-navbar');
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', scrollY > 50));

  /* Mobile menu */
  document.getElementById('mobile-menu').addEventListener('click', () =>
    document.getElementById('nav-menu').classList.toggle('open'));

  /* Scroll reveal */
  const obs = new IntersectionObserver(e =>
    e.forEach(x => { if (x.isIntersecting) x.target.classList.add('visible'); }),
    { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const ans  = item.querySelector('.faq-a');
      const was  = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = null;
      });
      if (!was) {
        item.classList.add('open');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });

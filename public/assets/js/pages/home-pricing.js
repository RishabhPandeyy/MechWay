(() => {
  const marquee = document.getElementById('brand-marquee');
  if (!marquee) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Animate two identical groups without relying on the obsolete marquee element.
  const track = marquee.querySelector('.brand-track');
  if (!track) return;
  const loop = document.createElement('div');
  loop.className = 'brand-loop';
  const duplicate = track.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  marquee.append(loop);
  loop.append(track, duplicate);
  let paused = motion.matches;
  function setPaused(value) {
    paused = value;
    loop.style.animationPlayState = paused ? 'paused' : 'running';
  }
  motion.addEventListener('change', event => setPaused(event.matches));
  setPaused(paused);
})();

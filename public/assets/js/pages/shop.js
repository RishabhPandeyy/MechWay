
(function() {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:';
  const BACKEND = isLocal ? 'http://localhost:4000' : 'https://newonwheels.onrender.com';

  /* ── Navbar scroll effect ─────────────────────────── */
  const navbar = document.getElementById('main-navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  /* ── Mobile menu ──────────────────────────────────── */
  document.getElementById('mobile-menu').addEventListener('click', () => {
    document.getElementById('nav-menu').classList.toggle('open');
  });

  /* ── Wishlist toggle ──────────────────────────────── */
  document.querySelectorAll('.card-wishlist').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.classList.toggle('liked');
      const icon = btn.querySelector('i');
      icon.className = btn.classList.contains('liked') ? 'fas fa-heart' : 'far fa-heart';
      showToast(btn.classList.contains('liked') ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    });
  });

  /* ── View toggle (grid / list) ────────────────────── */
  const grid    = document.getElementById('product-grid');
  const gridBtn = document.getElementById('grid-view-btn');
  const listBtn = document.getElementById('list-view-btn');
  gridBtn.addEventListener('click', () => { grid.classList.remove('list-view'); gridBtn.classList.add('active'); listBtn.classList.remove('active'); });
  listBtn.addEventListener('click', () => { grid.classList.add('list-view');    listBtn.classList.add('active'); gridBtn.classList.remove('active'); });

  /* ── Filter ───────────────────────────────────────── */
  const filterBtns = document.querySelectorAll('.filter-btn');
  let currentFilter = 'all', currentSearch = '', currentSort = 'default';

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  /* ── Search ───────────────────────────────────────── */
  document.getElementById('search-input').addEventListener('input', e => {
    currentSearch = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  /* ── Sort ─────────────────────────────────────────── */
  document.getElementById('sort-select').addEventListener('change', e => {
    currentSort = e.target.value;
    applyFilters();
  });

  function applyFilters() {
    const cards = Array.from(document.querySelectorAll('.product-card'));
    let visible = [];
    cards.forEach(card => {
      const cats   = card.dataset.category.split(' ');
      const name   = card.dataset.name.toLowerCase();
      const matchF = currentFilter === 'all' || cats.includes(currentFilter);
      const matchS = !currentSearch || name.includes(currentSearch);
      if (matchF && matchS) { card.classList.remove('hide'); visible.push(card); }
      else card.classList.add('hide');
    });
    if (currentSort !== 'default') {
      visible.sort((a, b) => {
        if (currentSort === 'price-asc')  return +a.dataset.price - +b.dataset.price;
        if (currentSort === 'price-desc') return +b.dataset.price - +a.dataset.price;
        if (currentSort === 'name')       return a.dataset.name.localeCompare(b.dataset.name);
        return 0;
      });
      visible.forEach(card => grid.appendChild(card));
    }
    document.getElementById('count-num').textContent = visible.length;
    document.getElementById('empty-state').style.display = visible.length === 0 ? 'block' : 'none';
  }

  /* ── Cart state ───────────────────────────────────── */
  const cart = {};

  function updateCartUI() {
    const items   = Object.values(cart);
    const total   = items.reduce((s, i) => s + i.price * i.qty, 0);
    const count   = items.reduce((s, i) => s + i.qty, 0);
    const badge   = document.getElementById('cart-badge');
    const body    = document.getElementById('cart-items');
    const empty   = document.getElementById('cart-empty');
    const footer  = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total');

    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
    empty.style.display  = items.length === 0 ? 'block' : 'none';
    footer.style.display = items.length === 0 ? 'none'  : 'block';
    totalEl.textContent  = '₹' + total.toLocaleString('en-IN');

    body.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="cart-item-img">
          ${item.img ? `<img src="${item.img}" alt="${item.name}" onerror="this.style.display='none'">` : '<i class="fas fa-box"></i>'}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-key="${item.key}" data-action="dec">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-key="${item.key}" data-action="inc">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-key="${item.key}" title="Remove"><i class="fas fa-trash-alt"></i></button>
      `;
      body.appendChild(div);
    });

    body.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (btn.dataset.action === 'inc') cart[key].qty++;
        else if (--cart[key].qty <= 0) delete cart[key];
        updateCartUI();
      });
    });
    body.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => { delete cart[btn.dataset.key]; updateCartUI(); });
    });
  }

  /* ── Add to cart ──────────────────────────────────── */
  document.querySelectorAll('.btn-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const name  = btn.dataset.product;
      const price = +btn.dataset.price;
      const img   = btn.dataset.img || '';
      const key   = name.toLowerCase().replace(/\s+/g, '-');
      if (cart[key]) cart[key].qty++;
      else cart[key] = { key, name, price, img, qty: 1 };
      updateCartUI();
      showToast('Added to cart 🛒');
      btn.innerHTML = '<i class="fas fa-check"></i> Added!';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart'; }, 1200);
    });
  });

  /* ── Cart drawer open/close ──────────────────────── */
  const cartDrawer  = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  function openCart()  { cartDrawer.classList.add('open'); cartOverlay.classList.add('open'); }
  function closeCart() { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('open'); }
  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  /* ── Checkout — POST order to backend ───────────────── */
  document.getElementById('checkout-btn').addEventListener('click', async () => {
    const items = Object.values(cart);
    if (!items.length) return;

    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner" style="animation:spin 1s linear infinite"></i> Placing Order…';

    const payload = {
      items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total: items.reduce((s, i) => s + i.price * i.qty, 0)
    };

    try {
      const res  = await fetch(BACKEND + '/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors', credentials: 'omit'
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Clear cart
        Object.keys(cart).forEach(k => delete cart[k]);
        updateCartUI();
        closeCart();
        showToast('Order placed! We\'ll call you to confirm ✅');
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (err) {
      showToast('Could not reach server. Please call us directly.', true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Place Order';
    }
  });

  /* ── Inquiry button opens modal ───────────────────── */
  let activeProduct = '';
  document.querySelectorAll('.btn-inquire').forEach(btn => {
    btn.addEventListener('click', () => {
      activeProduct = btn.dataset.product;
      document.getElementById('modal-product-name').textContent = activeProduct;
      document.getElementById('inq-name').value    = '';
      document.getElementById('inq-phone').value   = '';
      document.getElementById('inq-message').value = '';
      document.getElementById('modal-overlay').classList.add('open');
    });
  });

  /* ── Modal close ──────────────────────────────────── */
  function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  /* ── Modal submit — POST to backend ──────────────── */
  document.getElementById('modal-submit').addEventListener('click', async () => {
    const name    = document.getElementById('inq-name').value.trim();
    const phone   = document.getElementById('inq-phone').value.replace(/\D/g, '');
    const message = document.getElementById('inq-message').value.trim();
    if (!name)  { shakeInput('inq-name');  return; }
    if (!phone) { shakeInput('inq-phone'); return; }

    const btn = document.getElementById('modal-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner" style="animation:spin 1s linear infinite"></i> Sending…';

    const payload = { product_name: activeProduct, name, phone, message };
    try {
      const res  = await fetch(BACKEND + '/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors', credentials: 'omit'
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        closeModal();
        showToast('Inquiry sent! We\'ll contact you soon ✅');
      } else {
        throw new Error(data.error || 'Server error');
      }
    } catch (err) {
      showToast('Could not send inquiry. Please call us directly.', true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Inquiry';
    }
  });

  /* ── Toast ───────────────────────────────────────── */
  function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toast-msg');
    m.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ── Input shake effect ───────────────────────────── */
  function shakeInput(id) {
    const el = document.getElementById(id);
    el.style.borderColor = '#ff4d6d';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake .4s ease';
    setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 800);
  }

  /* Inject keyframes */
  const style = document.createElement('style');
  style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`;
  document.head.appendChild(style);

  /* ── Card animation stagger ──────────────────────── */
  document.querySelectorAll('.product-card').forEach((card, i) => {
    card.style.animationDelay = (i * 0.07) + 's';
  });

})();

/* ══════════════════════════════════════════
   ZADA PERFUMES — shop.js
   Shop · Cart · Wishlist · Checkout · Admin
══════════════════════════════════════════ */

'use strict';

/* ══════════════ STATE ══════════════ */
let products  = JSON.parse(localStorage.getItem('zada_products'))   || [];
let cart      = JSON.parse(localStorage.getItem('zada_cart'))       || [];
let wishlist  = JSON.parse(localStorage.getItem('zada_wishlist'))   || [];
let orders    = JSON.parse(localStorage.getItem('zada_orders'))     || [];
let activeFilter = 'all';
let adminTab = 'dashboard';
let editingId    = null;
let pendingDeleteId = null;
let activePayMethod = 'card';
let checkoutStep = 1; // 1=info, 2=confirm, 3=done
let dashboardPeriod = 'all';
let orderFilter = { payment: 'all', period: 'all', query: '' };

const firebaseActive = typeof firebase !== 'undefined' && firebase?.firestore && window?.firebaseDb;

async function syncProductToFirebase(product) {
  if (!firebaseActive || !product?.id) return;
  try {
    await firebaseDb.collection('products').doc(product.id).set({
      name: product.name,
      desc: product.desc,
      price: product.price,
      oldPrice: product.oldPrice || '',
      image: product.image || '',
      icon: product.icon || '✦',
      category: product.category || 'oud',
      notes: product.notes || [],
      inStock: Boolean(product.inStock)
    });
  } catch (err) {
    console.warn('Firebase sync product failed', err);
  }
}

async function deleteProductFromFirebase(productId) {
  if (!firebaseActive || !productId) return;
  try {
    await firebaseDb.collection('products').doc(productId).delete();
  } catch (err) {
    console.warn('Firebase delete product failed', err);
  }
}

async function syncOrderToFirebase(order) {
  if (!firebaseActive || !order?.id) return;
  try {
    await firebaseDb.collection('orders').doc(order.id).set(order);
  } catch (err) {
    console.warn('Firebase sync order failed', err);
  }
}

async function loadFromFirebase() {
  if (!firebaseActive) return;
  try {
    const prodSnap = await firebaseDb.collection('products').get();
    if (!prodSnap.empty) {
      products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const orderSnap = await firebaseDb.collection('orders').orderBy('date', 'desc').get();
    if (!orderSnap.empty) {
      orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    save();
    toast('Firebase data synchronized', '✔', 2200);
  } catch (err) {
    console.warn('Firebase load failed', err);
    toast('Firebase sync error', '⚠', 2200);
  }
}

/* ── Persist ── */
const save = () => {
  localStorage.setItem('zada_products', JSON.stringify(products));
  localStorage.setItem('zada_cart',     JSON.stringify(cart));
  localStorage.setItem('zada_wishlist', JSON.stringify(wishlist));
  localStorage.setItem('zada_orders',   JSON.stringify(orders));
};

/* ── Unique ID ── */
const uid = () => '_' + Math.random().toString(36).slice(2, 9);

const isShopPage = !!document.getElementById('productGrid');
const isAdminPage = !!document.getElementById('adminBody');

/* ══════════════ CURSOR ══════════════ */
const cursor    = document.getElementById('cursor');
const cursorRing = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
});
(function loop() {
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  cursorRing.style.left = rx + 'px'; cursorRing.style.top = ry + 'px';
  requestAnimationFrame(loop);
})();
document.addEventListener('mouseover', e => {
  if (e.target.matches('button, a, input, select, textarea, .product-card, .wish-btn')) {
    cursor.style.transform = 'translate(-50%,-50%) scale(2.2)';
    cursorRing.style.transform = 'translate(-50%,-50%) scale(1.4)';
    cursorRing.style.borderColor = 'rgba(201,168,76,0.8)';
  }
});
document.addEventListener('mouseout', e => {
  if (e.target.matches('button, a, input, select, textarea, .product-card, .wish-btn')) {
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    cursorRing.style.transform = 'translate(-50%,-50%) scale(1)';
    cursorRing.style.borderColor = '';
  }
});

/* ══════════════ SCROLL PROGRESS & NAV ══════════════ */
const scrollProgress = document.getElementById('scrollProgress');
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
  const s = window.scrollY, max = document.body.scrollHeight - window.innerHeight;
  scrollProgress.style.width = (s / max * 100) + '%';
  nav.classList.toggle('scrolled', s > 40);
});

/* ══════════════ TOAST ══════════════ */
function toast(msg, icon = '✦', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* ══════════════ OVERLAY / PANEL LOGIC ══════════════ */
const overlay = document.getElementById('overlay');

function openPanel(id) {
  overlay.classList.add('open');
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAllPanels() {
  overlay.classList.remove('open');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  document.body.style.overflow = '';
}
overlay.addEventListener('click', closeAllPanels);

/* ══════════════ BADGES ══════════════ */
function updateBadges() {
  const cartBadge = document.getElementById('cartBadge');
  const wishBadge = document.getElementById('wishBadge');
  if (!cartBadge || !wishBadge) return;

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const wishCount = wishlist.length;
  cartBadge.textContent = cartCount;
  cartBadge.classList.toggle('visible', cartCount > 0);
  wishBadge.textContent = wishCount;
  wishBadge.classList.toggle('visible', wishCount > 0);
}

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/); if (lines.length <= 1) return []; // no data
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const cols = line.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? '');
    return obj;
  }).filter(Boolean);
  return rows;
}

function getOrdersForPeriod(ordersList, period) {
  if (period === 'all') return [...ordersList];
  const now = new Date();
  return ordersList.filter(o => {
    const d = new Date(o.date);
    if (Number.isNaN(d.getTime())) return false;
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
    if (period === 'today') return diffDays < 1;
    if (period === 'week') return diffDays < 7;
    if (period === 'month') return diffDays < 31;
    return true;
  });
}

function applyOrderFilters(ordersList) {
  let filtered = getOrdersForPeriod(ordersList, orderFilter.period);
  if (orderFilter.payment !== 'all') {
    filtered = filtered.filter(o => o.payment === orderFilter.payment);
  }
  const q = orderFilter.query.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.toLowerCase().includes(q));
  }
  return filtered;
}

function bulkUploadProducts() {
  const fileInput = document.getElementById('bulkUploadFile');
  if (!fileInput || !fileInput.files?.length) { toast('Select a CSV file first', '⚠'); return; }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const data = parseCSV(reader.result);
    if (!data.length) { toast('CSV is empty or invalid', '⚠'); return; }

    let added = 0;
    data.forEach(row => {
      const name = (row.name || '').trim();
      const desc = (row.desc || '').trim();
      const price = (row.price || '').trim();
      if (!name || !desc || !price) return;
      const product = {
        id: uid(), name, desc, price,
        oldPrice: (row.oldprice || '').trim(),
        image: (row.image || '').trim(),
        icon: (row.icon || '✦').trim() || '✦',
        category: (row.category || 'oud').trim() || 'oud',
        notes: (row.notes || '').split(';').map(n => n.trim()).filter(Boolean),
        inStock: String(row.instock || 'true').toLowerCase() !== 'false'
      };
      products.push(product); added++;
    });

    if (added > 0) {
      save(); if (isShopPage) renderGrid(); if (isAdminPage) renderAdmin(); updateBadges();
      toast(`Bulk upload complete (${added} products)`, '✔');
    } else {
      toast('No valid products found to upload', '⚠');
    }
    fileInput.value = '';
  };
  reader.onerror = () => toast('Could not read CSV', '⚠');
  reader.readAsText(file);
}

/* ══════════════ FILTER ══════════════ */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid();
  });
});

/* ══════════════ PRODUCT GRID ══════════════ */
function renderGrid() {
  const grid = document.getElementById('productGrid');
  const count = document.getElementById('shopCount');
  if (!grid || !count) return;

  let visible = activeFilter === 'all'
    ? products
    : products.filter(p => p.category === activeFilter);

  count.textContent =
    visible.length === 0 ? 'No fragrances yet'
    : `${visible.length} fragrance${visible.length !== 1 ? 's' : ''}`;

  if (visible.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌿</div>
        <div class="empty-title">No Fragrances Yet</div>
        <div class="empty-sub">Add your first product via the admin panel</div>
      </div>`;
    return;
  }

  grid.innerHTML = visible.map((p, i) => {
    const inWish = wishlist.some(w => w.id === p.id);
    const inCart = cart.some(c => c.id === p.id);
    const hasDiscount = p.oldPrice && parseFloat(p.oldPrice) > parseFloat(p.price);
    return `
    <div class="product-card" style="animation-delay:${i * 0.06}s" data-id="${p.id}">
      <div class="card-shimmer"></div>
      ${!p.inStock ? `<div class="card-oos"><div class="oos-label">Out of Stock</div></div>` : ''}
      <button class="wish-btn ${inWish ? 'active' : ''}" data-id="${p.id}" title="Wishlist">♡</button>
      ${p.image ? `<div class="card-image-wrap"><img class="card-image" src="${p.image}" alt="${p.name}" /> </div>` : ''}
      <div class="card-body">
        <span class="card-num">— ${String(products.indexOf(p) + 1).padStart(2,'0')}</span>
        <div class="card-icon">${p.icon || '✦'}</div>
        <div class="card-name">${p.name}</div>
        <p class="card-desc">${p.desc}</p>
        <div class="card-notes">
          ${(p.notes || []).map(n => `<span class="note-tag">${n}</span>`).join('')}
        </div>
        <div class="card-footer">
          <div class="card-price">
            ${hasDiscount ? `<span class="old-price">${p.oldPrice} EGP</span>` : ''}
            ${p.price} EGP
          </div>
          ${p.inStock
            ? `<button class="add-btn ${inCart ? 'in-cart' : ''}" data-id="${p.id}">
                ${inCart ? 'In Cart ✦' : 'Add to Cart'}
               </button>`
            : `<button class="add-btn" disabled style="opacity:0.3;cursor:not-allowed;">Unavailable</button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');

  /* attach events */
  grid.querySelectorAll('.wish-btn').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); toggleWishlist(btn.dataset.id); }));
  grid.querySelectorAll('.add-btn:not([disabled])').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); addToCart(btn.dataset.id); }));
}

/* ══════════════ CART ══════════════ */
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product || !product.inStock) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }
  save(); updateBadges(); renderGrid(); renderCart();
  toast(`${product.name} added to cart`, '🛒');
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  save(); updateBadges(); renderCart(); renderGrid();
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  save(); updateBadges(); renderCart();
}

function cartTotal() {
  return cart.reduce((sum, c) => {
    const p = products.find(pr => pr.id === c.id);
    return sum + (p ? parseFloat(p.price) * c.qty : 0);
  }, 0);
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="empty-state" style="padding:60px 0">
        <div class="empty-icon">🛒</div>
        <div class="empty-title">Your Cart is Empty</div>
        <div class="empty-sub">Add fragrances to begin your journey</div>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = cart.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return '';
    return `
    <div class="cart-item">
      <div class="cart-item-icon">${p.icon || '✦'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        <div class="cart-item-price">${(parseFloat(p.price) * item.qty).toFixed(0)} EGP</div>
        <div class="qty-control">
          <button class="qty-btn" data-id="${p.id}" data-d="-1">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" data-id="${p.id}" data-d="1">+</button>
        </div>
      </div>
      <button class="cart-remove" data-id="${p.id}" title="Remove">✕</button>
    </div>`;
  }).join('');

  const subtotal = cartTotal();
  const shipping = subtotal > 0 ? 50 : 0;
  const total    = subtotal + shipping;

  footer.innerHTML = `
    <div class="cart-totals">
      <div class="total-row"><span>Subtotal</span><span>${subtotal.toFixed(0)} EGP</span></div>
      <div class="total-row"><span>Shipping</span><span>${shipping > 0 ? shipping + ' EGP' : 'Free'}</span></div>
      <div class="total-row grand"><span>Total</span><span>${total.toFixed(0)} EGP</span></div>
    </div>
    <button class="btn-gold" id="goCheckoutBtn">Proceed to Checkout →</button>
    <button class="btn-ghost" style="margin-top:8px" id="clearCartBtn">Clear Cart</button>`;

  body.querySelectorAll('.qty-btn').forEach(btn =>
    btn.addEventListener('click', () => changeQty(btn.dataset.id, parseInt(btn.dataset.d))));
  body.querySelectorAll('.cart-remove').forEach(btn =>
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id)));
  footer.querySelector('#goCheckoutBtn')?.addEventListener('click', openCheckout);
  footer.querySelector('#clearCartBtn')?.addEventListener('click', () => {
    cart = []; save(); updateBadges(); renderCart(); renderGrid();
  });
}

/* ══════════════ WISHLIST ══════════════ */
function toggleWishlist(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const idx = wishlist.findIndex(w => w.id === id);
  if (idx >= 0) {
    wishlist.splice(idx, 1);
    toast(`Removed from wishlist`, '♡');
  } else {
    wishlist.push({ id });
    toast(`${product.name} added to wishlist`, '♡');
  }
  save(); updateBadges(); renderGrid(); renderWishlist();
}

function renderWishlist() {
  const body = document.getElementById('wishBody');
  const footer = document.getElementById('wishFooter');
  if (wishlist.length === 0) {
    body.innerHTML = `
      <div class="empty-state" style="padding:60px 0">
        <div class="empty-icon">♡</div>
        <div class="empty-title">No Saved Fragrances</div>
        <div class="empty-sub">Heart a fragrance to save it here</div>
      </div>`;
    footer.innerHTML = ''; return;
  }
  body.innerHTML = wishlist.map(item => {
    const p = products.find(pr => pr.id === item.id);
    if (!p) return '';
    return `
    <div class="wish-item">
      <div class="wish-item-icon">${p.icon || '✦'}</div>
      <div class="wish-item-info">
        <div class="wish-item-name">${p.name}</div>
        <div class="wish-item-price">${p.price} EGP</div>
      </div>
      <div class="wish-actions">
        ${p.inStock ? `<button class="wish-to-cart" data-id="${p.id}">Add</button>` : ''}
        <button class="wish-remove" data-id="${p.id}">✕</button>
      </div>
    </div>`;
  }).join('');
  footer.innerHTML = `<button class="btn-ghost" id="clearWishBtn">Clear Wishlist</button>`;
  body.querySelectorAll('.wish-to-cart').forEach(btn =>
    btn.addEventListener('click', () => { addToCart(btn.dataset.id); }));
  body.querySelectorAll('.wish-remove').forEach(btn =>
    btn.addEventListener('click', () => toggleWishlist(btn.dataset.id)));
  footer.querySelector('#clearWishBtn')?.addEventListener('click', () => {
    wishlist = []; save(); updateBadges(); renderWishlist(); renderGrid();
  });
}

/* ══════════════ CHECKOUT ══════════════ */
function openCheckout() {
  if (cart.length === 0) { toast('Your cart is empty', '⚠'); return; }
  checkoutStep = 1;
  closeAllPanels();
  renderCheckout();
  openPanel('checkoutPanel');
}

function renderCheckout() {
  const body   = document.getElementById('checkoutBody');
  const footer = document.getElementById('checkoutFooter');
  const subtotal = cartTotal();
  const shipping = 50;
  const total    = subtotal + shipping;

  const orderLines = cart.map(c => {
    const p = products.find(pr => pr.id === c.id);
    return p ? `<div class="order-summary-item">
      <span>${p.name} × ${c.qty}</span>
      <span>${(parseFloat(p.price) * c.qty).toFixed(0)} EGP</span>
    </div>` : '';
  }).join('');

  if (checkoutStep === 1) {
    body.innerHTML = `
      <div class="checkout-section">
        <div class="checkout-section-title">Order Summary</div>
        ${orderLines}
        <div class="order-summary-item" style="margin-top:8px; border-top:1px solid rgba(201,168,76,0.1); padding-top:8px">
          <span>Subtotal</span><span>${subtotal.toFixed(0)} EGP</span>
        </div>
        <div class="order-summary-item">
          <span>Shipping</span><span>${shipping} EGP</span>
        </div>
        <div class="order-summary-item" style="color:var(--gold);font-family:'Cinzel',serif">
          <span>Total</span><span>${total.toFixed(0)} EGP</span>
        </div>
      </div>

      <div class="checkout-section">
        <div class="checkout-section-title">Delivery Information</div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Full Name</label>
          <input class="form-input" id="co-name" placeholder="Your full name" />
        </div>
        <div class="form-row" style="margin-bottom:12px">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="co-phone" placeholder="+20 xxx" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" id="co-email" type="email" placeholder="your@email.com" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Address</label>
          <input class="form-input" id="co-address" placeholder="Street address" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">City</label>
            <input class="form-input" id="co-city" placeholder="Cairo" />
          </div>
          <div class="form-group">
            <label class="form-label">Governorate</label>
            <select class="form-select" id="co-gov">
              <option>Cairo</option><option>Giza</option><option>Alexandria</option>
              <option>Luxor</option><option>Aswan</option><option>Other</option>
            </select>
          </div>
        </div>
      </div>

      <div class="checkout-section">
        <div class="checkout-section-title">Payment Method</div>
        <div class="payment-methods">
          <div class="pay-method ${activePayMethod === 'card' ? 'selected' : ''}" data-pay="card">💳 Card</div>
          <div class="pay-method ${activePayMethod === 'cash' ? 'selected' : ''}" data-pay="cash">💵 Cash</div>
          <div class="pay-method ${activePayMethod === 'wallet' ? 'selected' : ''}" data-pay="wallet">📱 Wallet</div>
        </div>
      </div>`;

    body.querySelectorAll('.pay-method').forEach(m =>
      m.addEventListener('click', () => {
        activePayMethod = m.dataset.pay;
        body.querySelectorAll('.pay-method').forEach(x => x.classList.remove('selected'));
        m.classList.add('selected');
      }));

    footer.innerHTML = `<button class="btn-gold" id="placeOrderBtn">Place Order →</button>`;
    footer.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
  }

  if (checkoutStep === 3) {
    body.innerHTML = `
      <div style="text-align:center; padding: 60px 20px; display:flex; flex-direction:column; align-items:center; gap:20px">
        <div style="font-size:3rem">✦</div>
        <div style="font-family:'Cinzel',serif; font-size:1.1rem; letter-spacing:0.15em; color:var(--gold)">
          Order Confirmed
        </div>
        <div style="font-family:'Cormorant Garamond',serif; font-style:italic; color:var(--text-muted); line-height:1.8">
          Thank you for your order.<br>Your fragrances will be prepared with care.
        </div>
        <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent)"></div>
        <div style="font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;color:var(--text-muted)">
          Order Total: ${total.toFixed(0)} EGP
        </div>
      </div>`;
    footer.innerHTML = `<button class="btn-ghost" id="doneShopping">Continue Shopping</button>`;
    footer.querySelector('#doneShopping').addEventListener('click', closeAllPanels);
    cart = []; save(); updateBadges(); renderGrid();
  }
}

function placeOrder() {
  const name = document.getElementById('co-name')?.value.trim();
  const phone = document.getElementById('co-phone')?.value.trim();
  const email = document.getElementById('co-email')?.value.trim();
  const address = document.getElementById('co-address')?.value.trim();
  const city = document.getElementById('co-city')?.value.trim();
  const gov = document.getElementById('co-gov')?.value.trim();
  if (!name || !phone || !address) {
    toast('Please fill in all required fields', '⚠'); return;
  }

  const subtotal = cartTotal();
  const shipping = 50;
  const total = subtotal + shipping;

  const order = {
    id: uid(),
    date: new Date().toISOString(),
    customer: { name, phone, email, address, city, gov },
    items: cart.map(c => {
      const p = products.find(pr => pr.id === c.id);
      const price = p ? parseFloat(p.price) || 0 : 0;
      return { id: c.id, name: p?.name || 'Unknown', qty: c.qty, unitPrice: price, lineTotal: price * c.qty };
    }),
    subtotal,
    shipping,
    total,
    payment: activePayMethod
  };

  orders.push(order);
  save();
  if (firebaseActive) {
    syncOrderToFirebase(order).catch(err => console.warn('firebase order', err));
  }

  checkoutStep = 3;
  renderCheckout();
}


/* ══════════════ ADMIN PANEL ══════════════ */
let pendingNotes = [];

function openAdmin() {
  adminTab = 'dashboard';
  editingId = null;
  pendingNotes = [];
  renderAdmin();
  openPanel('adminPanel');
}

function renderAdmin() {
  const body   = document.getElementById('adminBody');
  const footer = document.getElementById('adminFooter');

  body.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <button class="admin-side-tab ${adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button>
        <button class="admin-side-tab ${adminTab === 'products' ? 'active' : ''}" data-tab="products">Products</button>
        <button class="admin-side-tab ${adminTab === 'add' ? 'active' : ''}" data-tab="add">Add Product</button>
        <button class="admin-side-tab ${adminTab === 'orders' ? 'active' : ''}" data-tab="orders">Orders</button>
      </aside>
      <section class="admin-content">
        ${adminTab === 'dashboard' ? renderAdminDashboard() : adminTab === 'products' ? renderAdminList() : adminTab === 'add' ? renderAdminForm() : adminTab === 'orders' ? renderAdminOrders() : renderAdminList()}
      </section>
    </div>`;

  if (adminTab === 'products' || adminTab === 'add') {
    footer.innerHTML = adminTab === 'products'
      ? `<button class="btn-gold btn-sm" id="adminAddBtn">+ Add New Product</button>`
      : `<div style="display:flex;gap:8px">
          <button class="btn-gold btn-sm" id="adminSaveBtn">${editingId ? 'Save Changes' : 'Add Product'}</button>
          <button class="btn-ghost btn-sm" id="adminCancelBtn">Cancel</button>
         </div>`;
  } else {
    footer.innerHTML = '';
  }

  body.querySelectorAll('.admin-side-tab').forEach(t =>
    t.addEventListener('click', () => {
      adminTab = t.dataset.tab;
      if (adminTab === 'products') {
        editingId = null;
        pendingNotes = [];
      }
      if (adminTab === 'add') {
        editingId = null;
        pendingNotes = [];
      }
      renderAdmin();
    }));

  if (adminTab === 'products') {
    footer.querySelector('#adminAddBtn')?.addEventListener('click', () => {
      adminTab = 'add'; editingId = null; pendingNotes = []; renderAdmin();
    });
    body.querySelectorAll('.admin-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => startEdit(btn.dataset.id)));
    body.querySelectorAll('.admin-del-btn').forEach(btn =>
      btn.addEventListener('click', () => confirmDelete(btn.dataset.id)));
    body.querySelectorAll('.toggle-switch').forEach(sw =>
      sw.addEventListener('click', () => {
        const p = products.find(pr => pr.id === sw.dataset.id);
        if (p) { p.inStock = !p.inStock; save(); renderGrid(); renderAdmin(); }
      }));
  }

  if (adminTab === 'add') {
    footer.querySelector('#adminSaveBtn')?.addEventListener('click', saveProduct);
    footer.querySelector('#adminCancelBtn')?.addEventListener('click', () => {
      adminTab = 'products'; editingId = null; pendingNotes = []; renderAdmin();
    });
  }

  if (adminTab === 'add') {
    if (editingId) {
      const p = products.find(pr => pr.id === editingId);
      if (p) {
        pendingNotes = [...(p.notes || [])];
        renderNotesChips();
        document.getElementById('f-name').value    = p.name    || '';
        document.getElementById('f-desc').value    = p.desc    || '';
        document.getElementById('f-price').value   = p.price   || '';
        document.getElementById('f-oldprice').value= p.oldPrice|| '';
        // Note: File input can't be pre-filled for security, image will be replaced if new file selected
        document.getElementById('f-icon').value    = p.icon    || '';
        document.getElementById('f-cat').value     = p.category|| 'oud';
      }
    }
    document.getElementById('f-note-add')?.addEventListener('click', addNoteChip);
    document.getElementById('f-note-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addNoteChip(); }
    });
    footer.querySelector('#adminSaveBtn')?.addEventListener('click', saveProduct);
    footer.querySelector('#adminCancelBtn')?.addEventListener('click', () => {
      adminTab = 'products'; editingId = null; renderAdmin();
    });
  }

  if (adminTab === 'dashboard') {
    document.getElementById('dashboardPeriod')?.addEventListener('change', e => {
      dashboardPeriod = e.target.value;
      renderAdmin();
    });
  }

  if (adminTab === 'orders') {
    document.getElementById('ordersPaymentFilter')?.addEventListener('change', e => {
      orderFilter.payment = e.target.value;
      renderAdmin();
    });
    document.getElementById('ordersPeriodFilter')?.addEventListener('change', e => {
      orderFilter.period = e.target.value;
      renderAdmin();
    });
    document.getElementById('ordersSearch')?.addEventListener('input', e => {
      orderFilter.query = e.target.value;
      renderAdmin();
    });
  }
}

function renderAdminList() {
  if (products.length === 0) return `
    <div class="empty-state" style="padding:50px 0">
      <div class="empty-icon">🌿</div>
      <div class="empty-title">No Products Yet</div>
      <div class="empty-sub">Use "+ Add New" to create your first fragrance</div>
    </div>`;

  return `<div class="admin-product-list">
    ${products.map(p => `
    <div class="admin-product-row">
      <div class="admin-row-icon">${p.icon || '✦'}</div>
      <div class="admin-row-info">
        <div class="admin-row-name">${p.name}</div>
        <div class="admin-row-meta">${p.price} EGP · ${p.category || '—'}</div>
      </div>
      <div class="admin-stock-toggle">
        <div class="toggle-switch ${p.inStock ? 'on' : ''}" data-id="${p.id}" title="${p.inStock ? 'In Stock' : 'Out of Stock'}"></div>
      </div>
      <div class="admin-row-actions">
        <button class="admin-edit-btn" data-id="${p.id}" title="Edit">✎</button>
        <button class="admin-del-btn"  data-id="${p.id}" title="Delete">✕</button>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderAdminForm() {
  return `
    <div class="admin-form-title">${editingId ? 'Edit Fragrance' : 'New Fragrance'}</div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Name *</label>
      <input class="form-input" id="f-name" placeholder="e.g. NOIR AMBRÉ" />
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label">Description *</label>
      <input class="form-input" id="f-desc" placeholder="Short description of the scent" />
    </div>
    <div class="form-row" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Price (EGP) *</label>
        <input class="form-input" id="f-price" type="number" placeholder="320" />
      </div>
      <div class="form-group">
        <label class="form-label">Old Price (optional)</label>
        <input class="form-input" id="f-oldprice" type="number" placeholder="400" />
      </div>
    </div>
    <div class="form-row" style="margin-bottom:12px">
      <div class="form-group">
        <label class="form-label">Image File</label>
        <input type="file" id="f-image-file" accept="image/*" style="background:rgba(255,255,255,0.03);border:1px solid rgba(201,168,76,0.15);color:#fff;padding:10px 14px;font-family:'Raleway',sans-serif;font-size:0.82rem;outline:none;width:100%;" />
      </div>
      <div class="form-group">
        <label class="form-label">Icon / Emoji</label>
        <input class="form-input" id="f-icon" placeholder="🌙" maxlength="4" />
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="f-cat">
          <option value="oud">Oud</option>
          <option value="floral">Floral</option>
          <option value="fresh">Fresh</option>
          <option value="oriental">Oriental</option>
          <option value="woody">Woody</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:4px">
      <label class="form-label">Scent Notes</label>
      <div class="admin-notes-input">
        <input id="f-note-input" placeholder="e.g. Oud, Rose, Amber…" />
        <button class="btn-gold btn-sm" id="f-note-add" style="padding:7px 14px">+ Add</button>
      </div>
    </div>
    <div class="notes-chips" id="notesChips"></div>`;
}

function renderAdminDashboard() {
  const filteredOrders = getOrdersForPeriod(orders, dashboardPeriod);
  const totalProducts = products.length;
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const inStock = products.filter(p => p.inStock).length;
  const outOfStock = totalProducts - inStock;
  const topProducts = Object.entries(products.reduce((acc, p) => {
    const sold = orders.reduce((qty, o) => {
      const item = o.items.find(i => i.id === p.id);
      return qty + (item ? item.qty : 0);
    }, 0);
    if (sold > 0) acc[p.name] = sold;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div class="dashboard-controls">
      <label>Period</label>
      <select id="dashboardPeriod" class="dashboard-filter">
        <option value="all" ${dashboardPeriod==='all'?'selected':''}>All Time</option>
        <option value="today" ${dashboardPeriod==='today'?'selected':''}>Today</option>
        <option value="week" ${dashboardPeriod==='week'?'selected':''}>7 Days</option>
        <option value="month" ${dashboardPeriod==='month'?'selected':''}>30 Days</option>
      </select>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-card"><div>Products</div><div>${totalProducts}</div></div>
      <div class="dashboard-card"><div>Orders</div><div>${totalOrders}</div></div>
      <div class="dashboard-card"><div>Revenue</div><div>${totalRevenue.toFixed(0)} EGP</div></div>
      <div class="dashboard-card"><div>In Stock</div><div>${inStock}</div></div>
      <div class="dashboard-card"><div>Out of Stock</div><div>${outOfStock}</div></div>
    </div>
    <div class="dashboard-recent">
      <h3>Top Selling Products</h3>
      ${topProducts.length === 0 ? '<p>No sales yet.</p>' : topProducts.map(([name, qty]) =>
        `<div class="order-row">${name} • ${qty} sold</div>`).join('')}
    </div>`;
}

function renderAdminOrders() {
  const filtered = applyOrderFilters(orders);

  return `
    <div class="order-filter-row">
      <input id="ordersSearch" value="${orderFilter.query}" placeholder="Search order ID or customer" class="admin-input" />
      <select id="ordersPaymentFilter" class="admin-select">
        <option value="all" ${orderFilter.payment==='all'?'selected':''}>All payments</option>
        <option value="card" ${orderFilter.payment==='card'?'selected':''}>Card</option>
        <option value="cash" ${orderFilter.payment==='cash'?'selected':''}>Cash</option>
        <option value="wallet" ${orderFilter.payment==='wallet'?'selected':''}>Wallet</option>
      </select>
      <select id="ordersPeriodFilter" class="admin-select">
        <option value="all" ${orderFilter.period==='all'?'selected':''}>All time</option>
        <option value="today" ${orderFilter.period==='today'?'selected':''}>Today</option>
        <option value="week" ${orderFilter.period==='week'?'selected':''}>7 days</option>
        <option value="month" ${orderFilter.period==='month'?'selected':''}>30 days</option>
      </select>
    </div>
    <div class="orders-list">
      ${filtered.length === 0 ? '<div class="empty-state" style="padding:40px 0"><div class="empty-icon">🛍</div><div class="empty-title">No matching orders</div><div class="empty-sub">Adjust filters</div></div>' : ''}
      ${filtered.map(o =>
        `<div class="order-card">
          <div><strong>Order</strong> ${o.id}</div>
          <div>${o.date}</div>
          <div>Customer: ${o.customer.name} (${o.customer.phone})</div>
          <div>Address: ${o.customer.address}, ${o.customer.city} (${o.customer.gov})</div>
          <div>Total: ${o.total.toFixed(0)} EGP (Shipping ${o.shipping} EGP) • Payment: ${o.payment}</div>
          <ul>${o.items.map(i => `<li>${i.name} x${i.qty} = ${i.lineTotal.toFixed(0)} EGP</li>`).join('')}</ul>
        </div>`).join('')}
    </div>`;
}

function addNoteChip() {
  const input = document.getElementById('f-note-input');
  const val = input.value.trim();
  if (!val || pendingNotes.includes(val)) { input.value = ''; return; }
  pendingNotes.push(val);
  input.value = '';
  renderNotesChips();
}

function removeNoteChip(note) {
  pendingNotes = pendingNotes.filter(n => n !== note);
  renderNotesChips();
}

function renderNotesChips() {
  const container = document.getElementById('notesChips');
  if (!container) return;
  container.innerHTML = pendingNotes.map(n =>
    `<span class="note-chip">${n} <button onclick="removeNoteChip('${n}')">×</button></span>`
  ).join('');
}

function startEdit(id) {
  editingId = id;
  pendingNotes = [];
  adminTab = 'add';
  renderAdmin();
}

function saveProduct() {
  const name  = document.getElementById('f-name')?.value.trim();
  const desc  = document.getElementById('f-desc')?.value.trim();
  const price = document.getElementById('f-price')?.value.trim();
  if (!name || !desc || !price) { toast('Name, description and price are required', '⚠'); return; }

  const fileInput = document.getElementById('f-image-file');
  let imageUrl = '';

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      imageUrl = e.target.result;
      finalizeSaveProduct(name, desc, price, imageUrl);
    };
    reader.readAsDataURL(file);
  } else {
    finalizeSaveProduct(name, desc, price, imageUrl);
  }
}

function finalizeSaveProduct(name, desc, price, imageUrl) {
  const data = {
    name,
    desc,
    price,
    oldPrice:  document.getElementById('f-oldprice')?.value.trim() || '',
    image:     imageUrl,
    icon:      document.getElementById('f-icon')?.value.trim()     || '✦',
    category:  document.getElementById('f-cat')?.value             || 'oud',
    notes:     [...pendingNotes],
    inStock:   true,
  };

  let savedProduct;
  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    if (idx >= 0) {
      products[idx] = { ...products[idx], ...data };
      savedProduct = products[idx];
    }
    toast(`"${name}" updated`, '✎');
  } else {
    savedProduct = { id: uid(), ...data };
    products.push(savedProduct);
    toast(`"${name}" added to collection`, '✦');
  }

  save();
  if (firebaseActive && savedProduct) {
    syncProductToFirebase(savedProduct).catch(err => console.warn('firebase save', err));
  }
  renderGrid(); editingId = null; pendingNotes = []; adminTab = 'list'; renderAdmin();
}

function confirmDelete(id) {
  pendingDeleteId = id;
  const dialog = document.getElementById('confirmDialog');
  const p = products.find(pr => pr.id === id);
  document.getElementById('confirmMsg').textContent = `Delete "${p?.name || 'this product'}"? This cannot be undone.`;
  dialog.classList.add('open');
}

document.getElementById('confirmYes')?.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const deletedId = pendingDeleteId;
  products = products.filter(p => p.id !== deletedId);
  cart     = cart.filter(c => c.id !== deletedId);
  wishlist = wishlist.filter(w => w.id !== deletedId);
  save();
  if (firebaseActive) {
    deleteProductFromFirebase(deletedId).catch(err => console.warn('firebase delete', err));
  }
  updateBadges(); renderGrid(); renderCart(); renderWishlist(); renderAdmin();
  toast('Product deleted', '✕');
  document.getElementById('confirmDialog').classList.remove('open');
  pendingDeleteId = null;
});
document.getElementById('confirmNo')?.addEventListener('click', () => {
  document.getElementById('confirmDialog').classList.remove('open');
  pendingDeleteId = null;
});

/* ══════════════ NAV BUTTON WIRING ══════════════ */
document.getElementById('cartNavBtn')?.addEventListener('click', () => {
  renderCart(); openPanel('cartPanel');
});
document.getElementById('wishNavBtn')?.addEventListener('click', () => {
  renderWishlist(); openPanel('wishPanel');
});
document.getElementById('adminNavBtn')?.addEventListener('click', openAdmin);
document.querySelectorAll('.panel-close').forEach(btn =>
  btn.addEventListener('click', closeAllPanels));

if (isAdminPage) {
  document.getElementById('bulkUploadBtn')?.addEventListener('click', bulkUploadProducts);
}

/* ══════════════ SMOOTH NAV LINKS ══════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ══════════════ INIT ══════════════ */
(async () => {
  if (firebaseActive) {
    await loadFromFirebase();
  }
  if (isShopPage) {
    renderGrid();
    updateBadges();
  }
  if (isAdminPage) {
    renderAdmin();
    updateBadges();
  }
})();

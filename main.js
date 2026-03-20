/* ══════════════════════════════════════════
   ZADA PERFUMES — main.js
   Glassmorphism Luxury Fragrance Website
══════════════════════════════════════════ */

/* ── Page Loader ── */
function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
  }
}
// Hide shortly after load event fires
window.addEventListener('load', () => setTimeout(hideLoader, 800));
// Hard fallback: always hide after 3s regardless of image loading
setTimeout(hideLoader, 3000);

/* ── Custom Cursor ── */
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top  = my + 'px';
});

(function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';
  requestAnimationFrame(animRing);
})();

document.querySelectorAll('button, a, input, textarea').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.transform    = 'translate(-50%,-50%) scale(2.5)';
    cursorRing.style.transform  = 'translate(-50%,-50%) scale(1.4)';
    cursorRing.style.borderColor = 'rgba(201,168,76,0.8)';
  });
  el.addEventListener('mouseleave', () => {
    cursor.style.transform    = 'translate(-50%,-50%) scale(1)';
    cursorRing.style.transform  = 'translate(-50%,-50%) scale(1)';
    cursorRing.style.borderColor = '';
  });
});

/* ── Scroll Progress Bar & Nav shrink ── */
const scrollProgress = document.getElementById('scrollProgress');
const nav = document.getElementById('mainNav');

window.addEventListener('scroll', () => {
  const scrolled  = window.scrollY;
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  scrollProgress.style.width = (scrolled / maxScroll * 100) + '%';
  nav.classList.toggle('scrolled', scrolled > 60);
});

/* ── Reveal on Scroll (IntersectionObserver) ── */
const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

revealEls.forEach(el => revealObserver.observe(el));

/* ── Products Data & Marquee Builder (defaults removed) ── */
const products = [];

function buildCard(p) {
  return `
    <div class="product-card">
      <div class="product-shimmer"></div>
      <span class="product-number">— ${p.num}</span>
      <div class="product-scent-icon">${p.icon}</div>
      <div class="product-name">${p.name}</div>
      <p class="product-desc">${p.desc}</p>
      <div class="product-note-tags">
        ${p.notes.map(n => `<span class="note-tag">${n}</span>`).join('')}
      </div>
      <div class="product-price">
        <span>${p.price}</span>
        <button class="add-btn">Add ✦</button>
      </div>
    </div>
  `;
}

const track = document.getElementById('marqueeTrack');
if (products.length === 0 && track) {
  track.innerHTML = `<div class="empty-marquee">No products are currently available. Visit Shop to add your collection.</div>`;
} else if (track) {
  track.innerHTML = [...products, ...products].map(buildCard).join('');
}

/* ── Gold Particle System ── */
const canvas = document.getElementById('particlesCanvas');
const ctx    = canvas.getContext('2d');
let W, H;
const particles = [];

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function Particle() {
  this.reset = function () {
    this.x       = Math.random() * W;
    this.y       = Math.random() * H;
    this.r       = Math.random() * 1.2 + 0.2;
    this.vx      = (Math.random() - 0.5) * 0.3;
    this.vy      = -Math.random() * 0.5 - 0.2;
    this.alpha   = Math.random() * 0.4 + 0.05;
    this.life    = 0;
    this.maxLife = Math.random() * 200 + 100;
  };
  this.reset();
  this.life = Math.random() * this.maxLife; // stagger initial lifetimes
}

for (let i = 0; i < 80; i++) particles.push(new Particle());

function animParticles() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => {
    p.life++;
    if (p.life > p.maxLife) p.reset();
    const progress = p.life / p.maxLife;
    const alpha    = p.alpha * Math.sin(progress * Math.PI);
    ctx.beginPath();
    ctx.arc(p.x + p.vx * p.life, p.y + p.vy * p.life, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(201,168,76,${alpha})`;
    ctx.fill();
  });
  requestAnimationFrame(animParticles);
}
animParticles();

/* ── Hero Orb Parallax on Mouse Move ── */
const orb1 = document.querySelector('.orb-1');
const orb2 = document.querySelector('.orb-2');

document.addEventListener('mousemove', e => {
  const x = (e.clientX / window.innerWidth  - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  if (orb1) orb1.style.transform = `translate(${x}px, ${y}px)`;
  if (orb2) orb2.style.transform = `translate(${-x * 0.6}px, ${-y * 0.6}px)`;
});

/* ── Smooth Scroll for Anchor Links ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ── Contact Form Submit Feedback ── */
document.querySelector('.form-submit').addEventListener('click', function () {
  const name = document.querySelector('.form-input').value.trim();
  this.textContent = name
    ? `Thank you, ${name.split(' ')[0]} ✦`
    : 'Message Sent ✦';
  this.style.background = 'linear-gradient(135deg, #2a5a3a, #3d8b5e)';
  setTimeout(() => {
    this.textContent   = 'Send Message →';
    this.style.background = '';
  }, 3000);
});

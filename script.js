/* nav */
const nav = document.getElementById('nav'), menu = document.getElementById('menu'), bt = document.getElementById('bt');
addEventListener('scroll', () => nav.classList.toggle('s', scrollY > innerHeight * .6), { passive: true });
bt.onclick = () => { const o = menu.classList.toggle('o'); bt.setAttribute('aria-expanded', o); bt.textContent = o ? '✕' : '☰' };
menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.classList.remove('o'); bt.textContent = '☰' } });

/* head-follow hero */
const FRAMES = 240, DEAD = .15, SMOOTH = .35, FLIP = false, FACE_X = .5, FACE_Y = .4;
const CAL = [
  [0.000, 29],
  [0.083, 53],
  [0.167, 80],
  [0.250, 92],
  [0.292, 96],
  [0.333, 98],
  [0.417, 112],
  [0.500, 125],
  [0.583, 135],
  [0.667, 149],
  [0.750, 157],
  [0.833, 182],
  [0.917, 185],
  [0.958, 193],
  [1.000, 203]
];
function calFrame(a) {
  for (let i = 1; i < CAL.length; i++) if (a <= CAL[i][0]) {
    const [a0, f0] = CAL[i - 1], [a1, f1] = CAL[i];
    return f0 + (f1 - f0) * (a - a0) / (a1 - a0);
  }
  return CAL[CAL.length - 1][1];
}

const hero = document.getElementById('hero'), c = document.getElementById('c'), ctx = c.getContext('2d');
let dirty = true, lastImg = null;
let W, H, iw = 0, ih = 0, ox = 0, oy = 0, dw = 0, dh = 0, visible = true;

function layout() {
  if (!iw) return;
  const s = Math.max(W / iw, H / ih);
  dw = iw * s; dh = ih * s; ox = (W - dw) / 2; oy = (H - dh) / 2;
  placeBot();
}

function size() {
  const d = Math.min(devicePixelRatio || 1, 2);
  W = hero.clientWidth; H = hero.clientHeight;
  c.width = W * d; c.height = H * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  dirty = true; lastImg = null;
  layout();
}
addEventListener('resize', size);
size();

/* --- performance: load only what the hero can actually show, progressively --- */
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const LO = Math.floor(calFrame(0)), HI = Math.ceil(calFrame(1));   // frames outside LO..HI are never displayed
const conn = navigator.connection || {}, narrow = matchMedia('(max-width:700px)').matches;
const imgs = new Array(FRAMES), ok = new Uint8Array(FRAMES);

function load(i, done) {
  const im = imgs[i] = new Image();
  im.decoding = 'async';
  im.onload = () => {
    ok[i] = 1; dirty = true;
    if (i === 0) { iw = im.naturalWidth; ih = im.naturalHeight; layout(); }
    done && done();
  };
  im.onerror = () => done && done();
  im.src = 'frames/f_' + String(i + 1).padStart(4, '0') + '.webp';
}
load(0);   // first frame only: this is what paints the hero

function buildQueue() {
  const slow = conn.saveData || /2g|3g/.test(conn.effectiveType || '');
  const strides = slow ? [8] : narrow ? [8, 4] : [8, 4, 2];   // coarse pass first, then fill gaps
  const seen = new Set([0]), q = [];
  const add = i => { if (!seen.has(i)) { seen.add(i); q.push(i); } };
  add(LO); add(HI);
  strides.forEach(s => { for (let i = LO; i <= HI; i++) if (i % s === 0) add(i); });
  return q;
}
let started = false;
function startFill() {
  if (started || RM.matches) return;
  started = true;
  const q = buildQueue(); let n = 0;
  const pump = () => { if (n < q.length) load(q[n++], pump); };
  for (let k = 0; k < (narrow ? 2 : 4); k++) pump();   // small pool so it never fights the page
}
const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
if (document.readyState === 'complete') idle(startFill);
else addEventListener('load', () => idle(startFill), { once: true });   // after the page has finished loading
RM.addEventListener('change', () => { dirty = true; lastImg = null; if (!RM.matches) idle(startFill); });

/* nearest loaded frame, so partially loaded sets still look smooth */
function pick(k) {
  if (ok[k]) return imgs[k];
  for (let r = 1; r <= 8; r++) {
    if (k - r >= LO && ok[k - r]) return imgs[k - r];
    if (k + r <= HI && ok[k + r]) return imgs[k + r];
  }
  return imgs[0];
}

let tgtF = 0, curF = 0, tgtIn = 0, curIn = 0;

function aim(x, y) {
  if (RM.matches) return;   // reduced motion: head stays still
  const r = c.getBoundingClientRect();
  const dx = x - (r.left + ox + dw * FACE_X), dy = y - (r.top + oy + dh * FACE_Y);
  tgtIn = Math.min(Math.hypot(dx, dy) / (W * DEAD), 1);
  const f = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
  tgtF = FLIP ? (1 - f) % 1 : f;
}
addEventListener('mousemove', e => aim(e.clientX, e.clientY));
addEventListener('touchmove', e => aim(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
addEventListener('touchstart', e => aim(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

new IntersectionObserver(e => visible = e[0].isIntersecting).observe(hero);

(function loop() {
  const a = imgs[0], ready = ok[0] && iw;
  if (visible && ready) {
    let img = a;
    if (!RM.matches) {
      let d = tgtF - (((curF % 1) + 1) % 1);
      if (d > .5) d -= 1;
      if (d < -.5) d += 1;
      curF += d * SMOOTH;
      curIn += (tgtIn - curIn) * SMOOTH;
      const fm = ((curF % 1) + 1) % 1;
      if (curIn > .5) img = pick(Math.round(calFrame(fm)));
    }
    if (img !== lastImg || dirty) {   // redraw only when something changed
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.drawImage(img, ox, oy, dw, dh);
      lastImg = img; dirty = false;
    }
  }
  requestAnimationFrame(loop);
})();
/* dropdown hover-intent + aria-expanded sync (desktop) */
document.querySelectorAll('.dd').forEach(dd => {
  const trigger = dd.querySelector('a');
  let t;
  dd.addEventListener('mouseenter', () => { clearTimeout(t); t = setTimeout(() => trigger.setAttribute('aria-expanded', 'true'), 150); });
  dd.addEventListener('mouseleave', () => { clearTimeout(t); trigger.setAttribute('aria-expanded', 'false'); });
});

/* review marquee: clone at runtime so the HTML carries each review once */
document.querySelectorAll('.marq .track').forEach(t => {
  [...t.children].forEach(n => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); t.appendChild(c); });
});

/* lead tracking: fires only if GA4/GTM is on the page */
document.addEventListener('click', e => {
  const a = e.target.closest('a'); if (!a) return;
  const h = a.getAttribute('href') || '';
  const m = h.includes('wa.me') ? 'whatsapp' : h.startsWith('tel:') ? 'call' : h.startsWith('mailto:') ? 'email' : h.startsWith('/free-audit') ? 'audit' : null;
  if (m && window.gtag) gtag('event', 'generate_lead', { method: m });
});
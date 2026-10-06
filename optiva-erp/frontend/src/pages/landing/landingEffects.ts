// @ts-nocheck
/* Imperative landing-page animation: 3D coin physics on the ramp, scroll reveal, header state.
   Ported from the original static page; returns a cleanup function for React. */
export function initLanding(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = []
  let alive = true
  const raf = (fn: FrameRequestCallback) => (alive ? requestAnimationFrame(fn) : 0)
  const on = (target: any, type: string, fn: any, opts?: any) => {
    target.addEventListener(type, fn, opts)
    cleanups.push(() => target.removeEventListener(type, fn, opts))
  }
  class IO extends IntersectionObserver {
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      super(cb, opts)
      cleanups.push(() => this.disconnect())
    }
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- build 3D coins: front face, back face and stacked edge slices ---- */
  root.querySelectorAll('.coin').forEach(coin => {
    const t = +coin.dataset.t || 18, n = 14, icon = coin.dataset.icon;
    let html = '';
    for (let i = 0; i < n; i++) {
      const z = (-t / 2 + (t * i) / (n - 1)).toFixed(2);
      html += `<div class="slice" style="transform:translateZ(${z}px)"></div>`;
    }
    html += `<div class="face front" style="transform:translateZ(${t / 2 + .5}px)">${icon ? `<svg><use href="#${icon}"/></svg>` : ''}</div>`;
    html += `<div class="face back" style="transform:rotateY(180deg) translateZ(${t / 2 + .5}px)"></div>`;
    coin.innerHTML = html;
  });

  /* ---- coin motion: float + wobble + mouse parallax + scroll parallax ---- */
  const wraps = [...root.querySelectorAll('.coin-wrap')].filter(w => reduce || !w.hasAttribute('data-phys')).map((w, i) => ({
    w, coin: w.querySelector('.coin'),
    amp: +w.dataset.amp || 10, tilt: +w.dataset.tilt || 0,
    depth: +w.dataset.depth || 0, phase: i * 1.7, speed: .55 + (i % 3) * .15,
    inHero: !!w.closest('.hero')
  }));
  let mx = 0, my = 0, tx = 0, ty = 0;
  on(window, 'pointermove', e => {
    tx = (e.clientX / innerWidth - .5) * 2;
    ty = (e.clientY / innerHeight - .5) * 2;
  });
  const hero = root.querySelector('#hero');

  function frame(ms) {
    const t = ms / 1000;
    mx += (tx - mx) * .06; my += (ty - my) * .06;
    const sy = Math.min(scrollY, hero.offsetHeight);
    for (const c of wraps) {
      const bob = reduce ? 0 : Math.sin(t * c.speed + c.phase) * c.amp;
      const px = mx * c.depth * 120, py = my * c.depth * 80;
      const par = c.inHero ? -sy * c.depth * 1.4 : 0;
      c.w.style.transform = `translate3d(${px}px,${bob + py + par}px,0)`;
      const ry = reduce ? 0 : Math.sin(t * c.speed * .8 + c.phase) * 28 + mx * 14;
      const rx = reduce ? 0 : Math.cos(t * c.speed * .7 + c.phase) * 14 - my * 10;
      const spin = c.inHero ? sy * .08 * (c.depth * 10) : 0;
      c.coin.style.transform = `rotateX(${c.tilt + rx}deg) rotateY(${ry + spin}deg) rotateZ(${c.tilt * -.25}deg)`;
    }
    raf(frame);
  }
  raf(frame);


  /* ---- physics coins: fall, land, roll the ramp, launch, jump, repeat ---- */
  if (!reduce) (() => {
    const ribbon = hero.querySelector('.ribbon');
    const STEP = 1 / 180;
    const coins = [...root.querySelectorAll('.coin-wrap[data-phys]')].map((w, i) => {
      w.classList.add('phys');
      return {
        w, coin: w.querySelector('.coin'), r: 0, state: 'wait', timer: .35 + i * 1.05 + Math.random() * .5,
        x: 0, y: 0, vx: 0, vy: 0, s: 0, v: 0, roll: 0, om: 0, age: 0, q: 0, qv: 0, na: 0,
        tx: 0, ty: 0, ph: Math.random() * 6.28, seam: [false, false], launched: false
      };
    });
    if (!coins.length) return;

    let W, H, SG, SR, N, X, Y, L, A, K, total, crestX, sValley, sLaunch, seamS, T = 0, lastSpawn = -9;
    let cx, cy, ca, ck, ps, textL = 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    /* sample the ramp's top edge in screen pixels */
    function build() {
      const hr = hero.getBoundingClientRect(), rr = ribbon.getBoundingClientRect();
      W = hr.width; H = hr.height;
      SG = clamp(H / 900, .6, 1.2); SR = clamp(W / 1440, .4, 1);
      const fx = rr.width / 1440, fy = rr.height / 640, ox = rr.left - hr.left, oy = rr.top - hr.top;
      const segs = [[[0, 250], [260, 190], [470, 460], [760, 500]], [[760, 500], [1040, 540], [1220, 300], [1440, 70]]];
      const px = [], py = [];
      segs.forEach((g, si) => {
        for (let i = si ? 1 : 0; i <= 200; i++) {
          const t = i / 200, u = 1 - t;
          const b = (k) => u * u * u * g[0][k] + 3 * u * u * t * g[1][k] + 3 * u * t * t * g[2][k] + t * t * t * g[3][k];
          px.push(ox + b(0) * fx); py.push(oy + b(1) * fy);
        }
      });
      N = px.length; X = Float64Array.from(px); Y = Float64Array.from(py);
      L = new Float64Array(N); A = new Float64Array(N); K = new Float64Array(N);
      for (let i = 1; i < N; i++) L[i] = L[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
      for (let i = 0; i < N; i++) {
        const a0 = Math.max(0, i - 4), a1 = Math.min(N - 1, i + 4);
        A[i] = Math.atan2(Y[a1] - Y[a0], X[a1] - X[a0]);
      }
      for (let i = 0; i < N; i++) {
        const a0 = Math.max(0, i - 10), a1 = Math.min(N - 1, i + 10);
        K[i] = -(A[a1] - A[a0]) / (L[a1] - L[a0]);   // > 0 in a valley (concave side up)
      }
      total = L[N - 1];
      let m = 0;
      for (let i = 0; i < N && X[i] < W * .35; i++) if (Y[i] < Y[m]) m = i;
      crestX = X[m];
      sValley = sOfX(760 * fx + ox);
      seamS = [sOfX(600 * fx + ox), sOfX(960 * fx + ox)];
      sLaunch = sOfX(1120 * fx + ox);
      const rg = document.createRange(); rg.selectNodeContents(hero.querySelector('h1'));
      textL = rg.getBoundingClientRect().left - hr.left;
      coins.forEach(c => c.r = c.w.offsetWidth / 2);
    }
    function at(s) {
      s = clamp(s, 0, total);
      let lo = 0, hi = N - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
      const f = (s - L[lo]) / ((L[hi] - L[lo]) || 1);
      cx = X[lo] + (X[hi] - X[lo]) * f; cy = Y[lo] + (Y[hi] - Y[lo]) * f;
      ca = A[lo] + (A[hi] - A[lo]) * f; ck = K[lo] + (K[hi] - K[lo]) * f;
    }
    function sOfX(x) {
      if (x <= X[0]) return 0;
      let lo = 0, hi = N - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; }
      return L[lo] + (L[hi] - L[lo]) * ((x - X[lo]) / ((X[hi] - X[lo]) || 1));
    }
    /* signed distance of a point above the ramp (nearest-point projection) */
    function project(px, py) {
      let s = sOfX(px);
      for (let k = 0; k < 3; k++) {
        at(s);
        s = clamp(s + (px - cx) * Math.cos(ca) + (py - cy) * Math.sin(ca), 0, total);
      }
      at(s); ps = s;
      return (px - cx) * Math.sin(ca) - (py - cy) * Math.cos(ca);
    }

    const G = () => 2300 * SG;

    function trySpawn(c) {
      if (T - lastSpawn < 1 + (1 - SR) * 1.2) return;
      const xmin = Math.max(crestX + c.r * .9 + 20, W * .12);
      const xmax = Math.max(xmin + 40, Math.min(W * .4, textL - c.r - 12));   // keep falling coins clear of the headline
      for (let k = 0; k < 8; k++) {
        const x = xmin + Math.random() * (xmax - xmin), sl = sOfX(x);
        let ok = true;
        for (const o of coins) {
          if (o === c || o.state === 'wait') continue;
          const gap = (c.r + o.r) * 1.7;
          if (o.state === 'rail' && Math.abs(o.s - sl) < gap) ok = false;
          if (o.state === 'air' && !o.launched && o.age < 1.2 && Math.abs(o.x - x) < gap) ok = false;
        }
        if (!ok) continue;
        c.state = 'air'; c.x = x; c.y = -c.r * 1.3;
        c.vx = (Math.random() - .5) * 50; c.vy = 60 + Math.random() * 120;
        c.age = 0; c.launched = false; c.free = false; c.seam = [false, false]; c.q = c.qv = 0;
        c.om = (Math.random() - .5) * 5;
        c.tx = (Math.random() < .5 ? -1 : 1) * (40 + Math.random() * 30);
        c.ty = (Math.random() < .5 ? -1 : 1) * (35 + Math.random() * 30);
        lastSpawn = T;
        return;
      }
    }

    function toAir(c, v, lift) {
      at(c.s);
      const sa = Math.sin(ca), co = Math.cos(ca);
      c.x = cx + sa * c.r; c.y = cy - co * c.r;
      c.vx = co * v + sa * lift; c.vy = sa * v - co * lift;
      c.na = ca; c.state = 'air';
    }

    function air(c, dt) {
      c.vy += G() * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      c.roll += c.om * dt; c.om *= 1 - .1 * dt;
      if (!c.free && c.x > X[0] && c.x < X[N - 1]) {
        const d = project(c.x, c.y);
        if (d < c.r && d > -c.r * 1.2) {
          const sa = Math.sin(ca), co = Math.cos(ca);
          let vn = c.vx * sa - c.vy * co, vt = c.vx * co + c.vy * sa;
          if (vn < 0) {
            c.x = cx + sa * c.r; c.y = cy - co * c.r; c.na = ca;
            if (-vn > 70 * SG) {                                   // bounce with a squash
              c.qv += 20 * Math.min(-vn / (1100 * SG), 1.1);
              vn = -vn * .28;
              vt += (c.om * c.r - vt) * .75;                       // contact friction: slide speed is pulled toward the spin
              c.om += (vt / c.r - c.om) * .6;
              c.vx = vt * co + vn * sa; c.vy = vt * sa - vn * co;
            } else {                                               // settles onto the ramp and starts rolling
              vt += (c.om * c.r - vt) * .75;
              c.s = ps; c.v = vt; c.state = 'rail';
            }
          }
        }
      }
      if (c.x > W + c.r * 1.5 || c.x < -c.r * 3 || c.y > H + c.r * 2 || c.age > 14) {
        c.state = 'wait'; c.timer = .6 + Math.random() * 1.2;
      }
    }

    function rail(c, dt) {
      at(c.s);
      let a = .66 * 1500 * SR * Math.sin(ca) - .8 * c.v;
      if (c.s > sValley) { const u = clamp((c.s - sValley) / (180 * SR), 0, 1); a += 1250 * SR * u * u * (3 - 2 * u); }
      c.v = clamp(c.v + a * dt, -1100 * SR, 1100 * SR);
      c.s += c.v * dt;
      c.om += (c.v / c.r - c.om) * Math.min(1, 10 * dt);
      c.roll += c.om * dt;
      if (c.s >= total) { toAir(c, Math.max(c.v, 380 * SR), 0); c.free = true; return; }   // rolls off the top of the ramp
      at(c.s); c.na = ca;
      if (G() * Math.cos(ca) + c.v * c.v * ck < 0) { toAir(c, c.v, 0); return; }   // crest: leaves the surface
      for (let i = 0; i < 2; i++) {
        if (!c.seam[i] && c.s >= seamS[i]) {
          c.seam[i] = true;
          if (c.v > 120 * SR) { toAir(c, c.v, clamp(.35 * c.v, 80 * SR, 200 * SR)); return; }   // small hop at the curvature change
        }
      }
      if (!c.launched && c.s >= sLaunch && c.v > 150 * SR) {
        c.launched = true;
        const v = c.v;
        toAir(c, 0, 0);
        c.vx = Math.min(.35 * v, 200 * SR); c.vy = -(.5 * v + 650 * SG);
        c.tx = (Math.random() < .5 ? -1 : 1) * 28; c.ty = 22; c.age = 0;
      }
    }

    function simulate(dt) {
      T += dt;
      for (const c of coins) {
        if (c.state === 'wait') { c.timer -= dt; if (c.timer <= 0) trySpawn(c); }
        else if (c.state === 'air') air(c, dt);
        else rail(c, dt);
        c.qv += (-420 * c.q - 22 * c.qv) * dt; c.q += c.qv * dt;
        c.age += dt;
      }
      /* rail coins can't pass through each other */
      const rails = coins.filter(c => c.state === 'rail').sort((a, b) => a.s - b.s);
      for (let i = rails.length - 2; i >= 0; i--) {
        const back = rails[i], front = rails[i + 1], min = (back.r + front.r) * 1.03;
        if (front.s - back.s < min) { back.s = front.s - min; if (back.v > front.v) back.v = front.v; }
      }
    }

    function render() {
      for (const c of coins) {
        if (c.state === 'wait') { c.w.style.transform = 'translate3d(-9999px,0,0)'; continue; }
        let x = c.x, y = c.y;
        if (c.state === 'rail') { at(c.s); x = cx + Math.sin(ca) * c.r; y = cy - Math.cos(ca) * c.r; }
        const sq = clamp(c.q, -.5, 1.1), sx = 1 + .08 * sq, sy = 1 - .16 * sq;
        c.w.style.transform = `translate3d(${(x - c.r).toFixed(1)}px,${(y - c.r).toFixed(1)}px,0) rotate(${c.na}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)}) rotate(${-c.na}rad)`;
        const tum = Math.exp(-c.age / .55);
        const rx = 12 + c.tx * tum + Math.sin(c.age * 2.1 + c.ph) * 2.5;
        const ry = -22 + c.ty * tum + Math.cos(c.age * 1.7 + c.ph) * 3;
        c.coin.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
        c.coin.style.setProperty('--roll', (c.roll * 57.2958).toFixed(1) + 'deg');
      }
    }

    build();
    on(window, 'resize', build);
    on(window, 'load', build);
    /*FF*/
    let visible = true, acc = 0, last = performance.now();
    new IO(es => { visible = es[0].isIntersecting; last = performance.now(); }).observe(hero);
    (function loop(now) {
      raf(loop);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      if (!visible) return;
      acc += dt;
      while (acc >= STEP) { simulate(STEP); acc -= STEP; }
      render();
    })(performance.now());
  })();

  /* ---- sticky header style ---- */
  const header = root.querySelector('header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 20);
  on(window, 'scroll', onScroll, { passive: true }); onScroll();

  /* ---- scroll reveal (staggered inside grids) ---- */
  root.querySelectorAll('.mod-grid, .pillars').forEach(g =>
    [...g.children].forEach((el, i) => el.style.transitionDelay = (i % 4) * 90 + 'ms'));
  const io = new IO(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15 });
  root.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---- industry pillars: hover / focus / tap to highlight ---- */
  const pillars = [...root.querySelectorAll('.pillar')];
  const pick = el => pillars.forEach(p => p.classList.toggle('active', p === el));
  pillars.forEach(p => {
    on(p, 'mouseenter', () => pick(p));
    on(p, 'focus', () => pick(p));
    on(p, 'click', () => pick(p));
  });

  return () => {
    alive = false
    cleanups.forEach(fn => fn())
  }
}

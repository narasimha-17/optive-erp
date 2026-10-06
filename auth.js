(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 3D coins: stacked slices give the edge thickness ---- */
  const wraps = [...document.querySelectorAll('.coin-wrap')];
  wraps.forEach(w => {
    const coin = w.querySelector('.coin'), t = +coin.dataset.t || 18, n = 14, icon = coin.dataset.icon;
    let html = '';
    for (let i = 0; i < n; i++) html += `<div class="slice" style="transform:translateZ(${(-t / 2 + (t * i) / (n - 1)).toFixed(2)}px)"></div>`;
    html += `<div class="face" style="transform:translateZ(${t / 2 + .5}px)">${icon ? `<svg><use href="#${icon}"/></svg>` : ''}</div>`;
    html += `<div class="face" style="transform:rotateY(180deg) translateZ(${t / 2 + .5}px)"></div>`;
    coin.innerHTML = html;
  });
  const items = wraps.map((w, i) => ({ w, coin: w.querySelector('.coin'), ph: i * 1.9, sp: .5 + i * .12, amp: 10 + i * 3 }));
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; });
  (function loop(ms) {
    requestAnimationFrame(loop);
    const t = ms / 1000; mx += (tx - mx) * .06; my += (ty - my) * .06;
    items.forEach((c, i) => {
      const bob = reduce ? 0 : Math.sin(t * c.sp + c.ph) * c.amp;
      c.w.style.transform = `translate3d(${(mx * (14 + i * 6)).toFixed(1)}px,${(bob + my * (10 + i * 5)).toFixed(1)}px,0)`;
      const ry = reduce ? -22 : -22 + Math.sin(t * c.sp * .8 + c.ph) * 26 + mx * 14;
      const rx = reduce ? 12 : 12 + Math.cos(t * c.sp * .7 + c.ph) * 12 - my * 8;
      c.coin.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    });
  })(performance.now());

  /* ---- password show / hide ---- */
  document.querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input'), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    b.classList.toggle('on', show);
  }));

  /* ---- password strength (sign up) ---- */
  const strength = pw => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
    return pw ? Math.max(1, s) : 0;
  };
  const meter = document.getElementById('meter'), meterLabel = document.getElementById('meterLabel');
  const levels = [['', '#ececf4'], ['Weak', '#ff5a5f'], ['Fair', '#ff9a2f'], ['Good', '#ffd23f'], ['Strong', '#2fd0c0']];
  const paintMeter = pw => {
    if (!meter) return;
    const s = strength(pw);
    [...meter.children].forEach((seg, i) => seg.style.background = i < s ? levels[s][1] : levels[0][1]);
    meterLabel.textContent = s ? 'Password strength: ' + levels[s][0] : 'Use 8+ characters with letters, numbers and a symbol.';
  };
  const pwInput = document.getElementById('password');
  if (meter && pwInput) { paintMeter(''); pwInput.addEventListener('input', () => paintMeter(pwInput.value)); }

  /* ---- validation + demo submit (front end only) ---- */
  const form = document.querySelector('form[data-auth]');
  if (!form) return;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const rules = {
    name: v => v.trim().length >= 2 || 'Please enter your full name.',
    email: v => emailRe.test(v.trim()) || 'Enter a valid work email address.',
    company: v => v.trim().length >= 2 || 'Please enter your company name.',
    password: v => form.dataset.auth === 'login'
      ? (v.length >= 1 || 'Enter your password.')
      : (v.length >= 8 && strength(v) >= 2 || 'Use at least 8 characters with a mix of letters and numbers.'),
    terms: (v, el) => el.checked || 'Please accept the terms to continue.'
  };
  const check = el => {
    const rule = rules[el.name]; if (!rule) return true;
    const res = rule(el.value, el), field = el.closest('.field'), msg = field.querySelector('.msg');
    const ok = res === true;
    field.classList.toggle('err', !ok);
    if (msg) msg.textContent = ok ? '' : res;
    return ok;
  };
  const inputs = [...form.querySelectorAll('input[name]')].filter(i => rules[i.name]);
  inputs.forEach(i => {
    i.addEventListener('blur', () => { if (i.value || i.type === 'checkbox') check(i); });
    i.addEventListener('input', () => { if (i.closest('.field').classList.contains('err')) check(i); });
    i.addEventListener('change', () => { if (i.type === 'checkbox') check(i); });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const results = inputs.map(check);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) { firstBad.focus(); return; }
    const btn = form.querySelector('.submit');
    btn.classList.add('loading');
    setTimeout(() => {
      btn.classList.remove('loading');
      const name = (form.querySelector('[name=name]') || {}).value;
      const who = document.getElementById('doneName');
      if (who && name) who.textContent = name.trim().split(' ')[0];
      document.querySelector('.auth-card').classList.add('ok');
    }, 1000);
  });
  document.querySelectorAll('.social').forEach(b => b.addEventListener('click', () => {
    const n = document.getElementById('note');
    if (n) n.textContent = 'Single sign-on is a placeholder in this demo. Connect your identity provider to enable it.';
  }));
})();

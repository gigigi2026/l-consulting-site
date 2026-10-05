window.addEventListener('load', () => {
  document.body.classList.add('is-loaded');
});

// モーション方針: 既定は全員フル演出。標準UIに追加の制御ボタンは出さない。
const motionOff = () => false;

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });
// threshold注意(F-88): data-reveal="clip" は自身を88%クリップするため交差率が最大12%。
// 0.14だと永遠に発火せず、clip要素が全ブラウザで不可視のままになる。0.05から上げないこと。

// 親に data-reveal-stagger を付けると、子の [data-reveal] へ階段状の遅延を自動付与する。
// 個別の data-reveal-delay が優先。刻み幅は data-reveal-stagger="0.12" のように指定できる(既定0.08s)。
document.querySelectorAll('[data-reveal-stagger]').forEach((parent) => {
  const step = parseFloat(parent.dataset.revealStagger) || 0.08;
  parent.querySelectorAll(':scope > [data-reveal], :scope > * > [data-reveal]').forEach((child, i) => {
    if (!child.dataset.revealDelay) child.style.setProperty('--reveal-delay', `${(i * step).toFixed(2)}s`);
  });
});

document.querySelectorAll('[data-reveal]').forEach((element) => {
  const delay = element.dataset.revealDelay;
  if (delay) element.style.setProperty('--reveal-delay', `${delay}s`);
  observer.observe(element);
});

// 取りこぼし防止: IntersectionObserverが発火しない文脈(描画が抑制されたタブ・埋め込み・
// フルページキャプチャ等)でも、画面内に入った要素は必ず現す。
// 450ms後・スクロール・リサイズの3経路で拾う(F-88: reveal取り残し=白帯の恒久防止)。
const revealInView = () => {
  document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) element.classList.add('is-visible');
  });
};
setTimeout(revealInView, 450);
let revealTick = false;
window.addEventListener('scroll', () => {
  if (revealTick) return;
  revealTick = true;
  setTimeout(() => { revealTick = false; revealInView(); }, 300);
}, { passive: true });
window.addEventListener('resize', revealInView);

const counters = document.querySelectorAll('[data-count]');
if (counters.length) {
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countObserver.unobserve(entry.target);
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      if (motionOff()) {
        el.textContent = target.toFixed(decimals);
        return;
      }
      const duration = 1400;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => countObserver.observe(el));
}

// ヒーロー環境モーション: 金色の光の粒 + 写真のポインター視差
const heroStage = document.querySelector('.hero__stage');
const ambient = document.querySelector('.hero__ambient');
const photoWrap = document.querySelector('.hero__photo-wrap');
let startAmbient = () => {};
let stopAmbient = () => {};

if (heroStage && ambient) {
  const ctx = ambient.getContext('2d');
  let width = 0;
  let height = 0;
  let specks = [];
  let running = false;
  let heroVisible = true;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  const resize = () => {
    const rect = heroStage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    ambient.width = width * dpr;
    ambient.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spawn = () => {
    const count = width < 700 ? 10 : 20;
    specks = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.8 + Math.random() * 1.8,
      alpha: 0.06 + Math.random() * 0.14,
      vx: -0.05 + Math.random() * 0.1,
      vy: -0.16 - Math.random() * 0.1,
      wobble: Math.random() * 6.28,
    }));
  };

  const frame = (now) => {
    if (!running || motionOff()) { running = false; return; }
    ctx.clearRect(0, 0, width, height);
    pointerX += (targetX - pointerX) * 0.05;
    pointerY += (targetY - pointerY) * 0.05;
    specks.forEach((s) => {
      s.x += s.vx + Math.sin(now / 1600 + s.wobble) * 0.08;
      s.y += s.vy;
      if (s.y < -6) { s.y = height + 6; s.x = Math.random() * width; }
      if (s.x < -6) s.x = width + 6;
      if (s.x > width + 6) s.x = -6;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#c9a97e';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.28);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (photoWrap) {
      photoWrap.style.transform = `translate(${pointerX * 5}px, ${pointerY * 4}px)`;
    }
    requestAnimationFrame(frame);
  };

  startAmbient = () => {
    if (!running && heroVisible && !motionOff()) {
      running = true;
      requestAnimationFrame(frame);
    }
  };
  stopAmbient = () => { running = false; };

  resize();
  spawn();
  window.addEventListener('resize', () => { resize(); spawn(); });

  heroStage.addEventListener('pointermove', (event) => {
    const rect = heroStage.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  }, { passive: true });
  heroStage.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; }, { passive: true });

  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      heroVisible = entry.isIntersecting;
      if (heroVisible) startAmbient(); else stopAmbient();
    });
  }, { threshold: 0.02 });
  heroObserver.observe(heroStage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAmbient(); else startAmbient();
  });
  startAmbient();
}

// モバイル追従CTA: ヒーロー通過後に表示、Contact表示中は隠す
const stickyCta = document.querySelector('.sticky-cta');
const heroSection = document.querySelector('.hero');
const contactSection = document.querySelector('#contact');

if (stickyCta && heroSection) {
  let pastHero = false;
  let contactVisible = false;
  const update = () => {
    stickyCta.classList.toggle('is-shown', pastHero && !contactVisible);
  };
  new IntersectionObserver((entries) => {
    entries.forEach((entry) => { pastHero = !entry.isIntersecting; update(); });
  }, { threshold: 0 }).observe(heroSection);
  if (contactSection) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => { contactVisible = entry.isIntersecting; update(); });
    }, { threshold: 0.2 }).observe(contactSection);
  }
}

// モバイルナビ
const navToggle = document.querySelector('.nav-toggle');
const navOverlay = document.querySelector('.nav-overlay');
if (navToggle && navOverlay) {
  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    navOverlay.setAttribute('aria-hidden', String(!open));
  };
  navToggle.addEventListener('click', () => {
    setNav(!document.body.classList.contains('nav-open'));
  });
  navOverlay.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNav(false));
  });
}

document.querySelector('.contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  if (!button) return;
  button.textContent = '仮送信を確認しました';
  window.setTimeout(() => {
    button.textContent = '送信内容を確認';
  }, 2200);
});

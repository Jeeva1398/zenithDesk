import './chat.css';

// The Chat landing page's motion: the hero conversation, pointer tilt, number
// counters, the snippet typing itself and the scroll progress bar. main.js
// still does the shared parts (theme, menu, reveals, the live widget).

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

// Runs fn once el has scrolled into view, or straight away without an observer.
function whenVisible(el, fn, threshold = 0.3) {
  if (!('IntersectionObserver' in window)) return fn();
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        fn();
      }
    },
    { threshold },
  );
  observer.observe(el);
}

// Stagger groups: each child gets its place in the order, read by the CSS.
document.querySelectorAll('[data-stagger]').forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty('--i', String(i)));
  if (reduceMotion) return;
  whenVisible(group, () => group.classList.add('is-visible'), 0.15);
});

// Scroll progress along the top.
const progress = document.querySelector('[data-scroll-progress]');
if (progress) {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--progress', String(max > 0 ? window.scrollY / max : 0));
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

// The hero widget leans toward the pointer across the whole hero.
const stage = document.querySelector('[data-stage]');
const hero = document.querySelector('[data-hero]');
if (stage && hero && finePointer && !reduceMotion) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    stage.style.setProperty('--ry', `${-14 + x * 18}deg`);
    stage.style.setProperty('--rx', `${6 - y * 12}deg`);
  });
  hero.addEventListener('pointerleave', () => {
    stage.style.removeProperty('--ry');
    stage.style.removeProperty('--rx');
  });
}

// Cards that tilt under the pointer, with a light that follows it.
if (finePointer && !reduceMotion) {
  document.querySelectorAll('.tilt-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--ry');
      card.style.removeProperty('--rx');
    });
  });
}

// The hero conversation, a line at a time: each step's data-step is its order,
// data-wait how long (ms) to hold before the next, and a data-typing step is
// a "typing" bubble that goes once the reply after it arrives. Then it starts
// over, so a visitor who scrolls back sees it again.
const convo = document.querySelector('[data-convo]');
if (convo) {
  const steps = [...convo.querySelectorAll('[data-step]')].sort((a, b) => a.dataset.step - b.dataset.step);
  if (reduceMotion) {
    steps.forEach((s) => s.classList.add(s.hasAttribute('data-typing') ? 'is-gone' : 'is-shown'));
  } else {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const play = async () => {
      for (;;) {
        steps.forEach((s) => s.classList.remove('is-shown', 'is-gone'));
        await sleep(700);
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i];
          const previous = steps[i - 1];
          if (previous?.hasAttribute('data-typing')) previous.classList.add('is-gone');
          step.classList.add('is-shown');
          await sleep(Number(step.dataset.wait) || 900);
        }
        await sleep(4500);
        steps.forEach((s) => s.classList.remove('is-shown'));
        await sleep(600);
      }
    };
    whenVisible(convo, play, 0.2);
  }
}

// Numbers that count up when they come into view.
document.querySelectorAll('[data-count]').forEach((el) => {
  const target = Number(el.dataset.count);
  if (reduceMotion) {
    el.textContent = String(target);
    return;
  }
  el.textContent = '0';
  whenVisible(el, () => {
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});

// The snippet, typed out as it comes into view.
document.querySelectorAll('[data-type]').forEach((el) => {
  const text = el.dataset.type;
  if (reduceMotion) {
    el.textContent = text;
    return;
  }
  el.textContent = '';
  el.classList.add('caret');
  whenVisible(el, () => {
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(timer);
    }, 28);
  });
});

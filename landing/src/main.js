import './style.css';

const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL || 'https://portal.zenithdesk.site').replace(/\/$/, '');

// Every portal link is written as data-portal="/path" so the address lives in
// one env var rather than in the markup.
document.querySelectorAll('[data-portal]').forEach((link) => {
  link.href = `${PORTAL_URL}${link.dataset.portal}`;
});

document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

// Theme: the portal's rule - a saved choice wins, otherwise follow the OS. The
// inline script in index.html has already applied it before first paint.
const THEME_KEY = 'zenithdesk_theme';
document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  const sync = () => {
    const dark = document.documentElement.classList.contains('dark');
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.querySelector('[data-icon="sun"]').classList.toggle('hidden', !dark);
    button.querySelector('[data-icon="moon"]').classList.toggle('hidden', dark);
  };
  sync();
  button.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      // Storage blocked: the switch still holds for this page view.
    }
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.dispatchEvent(new Event('theme-sync')));
  });
  button.addEventListener('theme-sync', sync);
});

// Mobile menu.
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
if (menuButton && menu) {
  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => setOpen(menu.classList.contains('hidden')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
}

// Header gains a border once the page has scrolled.
const header = document.querySelector('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('shadow-sm', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Bot purpose presets: a small live demo of the Settings > Chatbot presets.
const PRESETS = {
  enquiry: { enquiry: true, support: false, knowledge: true, status: false },
  support: { enquiry: false, support: true, knowledge: true, status: true },
  both: { enquiry: true, support: true, knowledge: true, status: true },
};
const presetButtons = document.querySelectorAll('[data-preset]');
presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const purposes = PRESETS[button.dataset.preset];
    presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    Object.entries(purposes).forEach(([key, on]) => {
      document.querySelectorAll(`[data-purpose="${key}"]`).forEach((row) => row.toggleAttribute('data-on', on));
    });
    document.querySelectorAll('[data-chip]').forEach((chip) => {
      chip.classList.toggle('hidden', !purposes[chip.dataset.chip]);
    });
  });
});

// Scroll reveal, only where it can be undone: without IntersectionObserver or
// with reduced motion, content simply stays visible.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('IntersectionObserver' in window && !reduceMotion) {
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
}

// The live chat widget, when this deployment has one to show.
const chatbotUrl = import.meta.env.VITE_CHATBOT_URL;
const widgetKey = import.meta.env.VITE_CHAT_WIDGET_KEY;
if (chatbotUrl && widgetKey) {
  const script = document.createElement('script');
  script.src = `${chatbotUrl.replace(/\/$/, '')}/widget.js`;
  script.dataset.key = widgetKey;
  script.defer = true;
  document.body.appendChild(script);
}

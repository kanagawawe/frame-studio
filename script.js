/* FRAME Studio — pure JavaScript, no frameworks or backend. */
(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.scroll-progress');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-nav');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let scrollScheduled = false;
  function updateScrollUI() {
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0}%`;
    header.classList.toggle('scrolled', scrollY > 24);
    scrollScheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      requestAnimationFrame(updateScrollUI);
    }
  }, { passive: true });
  updateScrollUI();

  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    mobileMenu.inert = !open;
  }
  menuButton.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  window.addEventListener('resize', () => { if (innerWidth > 900) setMenu(false); });

  const observed = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    observed.forEach(el => el.classList.add('visible'));
  } else {
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          reveals.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.08 });
    observed.forEach(el => reveals.observe(el));
  }

  // On offline connections show a locally bundled editorial illustration instead of a broken photo.
  const fallbackFor = (num) => window.FRAME_FALLBACKS?.[num] || `assets/editorial-${num}.svg`;
  document.querySelectorAll('img[src^="https://images.unsplash.com/"]').forEach((img, index) => {
    const swapToFallback = () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = 'true';
      img.src = fallbackFor((index % 8) + 1);
    };
    img.addEventListener('error', swapToFallback, { once: true });
    if (img.complete && img.naturalWidth === 0) swapToFallback();
  });

  // Filter grid without breaking keyboard accessibility or the lightbox order.
  const cards = Array.from(document.querySelectorAll('.work-card'));
  const filterButtons = document.querySelectorAll('.filter-btn');
  let activeFilter = 'all';
  filterButtons.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach(btn => {
      const selected = btn === button;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
    cards.forEach(card => {
      const visible = activeFilter === 'all' || card.dataset.category === activeFilter;
      card.classList.toggle('is-hidden', !visible);
      card.tabIndex = visible ? 0 : -1;
    });
  }));

  // Image viewer: only filtered-in projects are navigable.
  const lightbox = document.getElementById('lightbox');
  const photo = document.getElementById('lightbox-image');
  const photoTitle = document.getElementById('lightbox-title');
  const photoType = document.getElementById('lightbox-type');
  const photoCounter = document.getElementById('lightbox-counter');
  let selectedIndex = 0;
  let previouslyFocused = null;
  const shownCards = () => cards.filter(card => !card.classList.contains('is-hidden'));
  function renderPhoto() {
    const visible = shownCards();
    const card = visible[selectedIndex];
    if (!card) return;
    photo.src = card.dataset.image;
    photo.alt = card.querySelector('img').alt;
    photoTitle.textContent = card.dataset.title;
    photoType.textContent = card.dataset.type.toUpperCase();
    photoCounter.textContent = `${String(selectedIndex + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
  }
  function openPhoto(card) {
    selectedIndex = shownCards().indexOf(card);
    previouslyFocused = document.activeElement;
    lightbox.inert = false;
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.classList.add('open');
    document.body.classList.add('modal-open');
    renderPhoto();
    lightbox.querySelector('.lightbox-close').focus();
  }
  function closePhoto() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.inert = true;
    document.body.classList.remove('modal-open');
    photo.removeAttribute('src');
    if (previouslyFocused) previouslyFocused.focus();
  }
  function movePhoto(direction) {
    const length = shownCards().length;
    if (!length) return;
    selectedIndex = (selectedIndex + direction + length) % length;
    renderPhoto();
  }
  cards.forEach(card => card.addEventListener('click', () => openPhoto(card)));
  lightbox.querySelector('.lightbox-close').addEventListener('click', closePhoto);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => movePhoto(-1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => movePhoto(1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closePhoto(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (lightbox.classList.contains('open')) closePhoto();
      else if (header.classList.contains('menu-open')) setMenu(false);
    }
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'ArrowRight') movePhoto(1);
    if (event.key === 'ArrowLeft') movePhoto(-1);
    if (event.key === 'Tab') {
      const focusable = Array.from(lightbox.querySelectorAll('button'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  photo.addEventListener('error', () => {
    if (!photo.src.includes('unsplash.com')) return;
    const card = shownCards()[selectedIndex];
    const fallback = card?.querySelector('img')?.getAttribute('src');
    if (fallback && !fallback.includes('unsplash.com')) photo.src = fallback;
    else photo.src = fallbackFor(1);
  });

  // Demonstration-only contact form: creates a prepared mailto message.
  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');
  const inbox = 'hello@example.com'; // REPLACE with your own address before going live.
  form.addEventListener('submit', event => {
    event.preventDefault();
    feedback.textContent = '';
    const fields = Array.from(form.querySelectorAll('[required]'));
    fields.forEach(field => field.classList.remove('invalid'));
    const invalid = fields.find(field => !field.value.trim() || !field.checkValidity());
    if (invalid) {
      invalid.classList.add('invalid');
      invalid.focus();
      feedback.textContent = 'Заповни обов’язкові поля та перевір правильність email.';
      return;
    }
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    const service = String(data.get('service')).trim();
    const message = String(data.get('message') || '').trim();
    const subject = `Запит на зйомку — ${service}`;
    const body = `Привіт!\n\nМене звати ${name}.\nМій email: ${email}\nПослуга: ${service}\n\nІдея проєкту:\n${message || 'Хочу обговорити деталі.'}\n\nНадіслано з демосайту FRAME.`;
    feedback.textContent = 'Готово! Відкриваємо поштовий застосунок з підготовленим листом.';
    window.location.href = `mailto:${inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  document.getElementById('copyright-year').textContent = String(new Date().getFullYear());
})();

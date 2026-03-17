/* ── Router ───────────────────────────────────────────────── */
(() => {
  'use strict';

  const content = document.getElementById('content');
  const routeNavLinks = document.querySelectorAll('nav a[data-route]');
  const hashNavLinks = document.querySelectorAll('nav .navbar-nav a[href^="#"]');
  const cache = new Map();

  /* Map URL path → file inside /files/ */
  function pathToFile(path) {
    return '/files/home.html';
  }

  /* Highlight the active nav link */
  function setActiveNav(path) {
    const normalised = path.replace(/\/$/, '') || '/';
    routeNavLinks.forEach(a => {
      const route = a.dataset.route.replace(/\/$/, '') || '/';
      a.classList.toggle('active', route === normalised);
    });

    hashNavLinks.forEach(a => a.classList.remove('active'));

    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const hasActiveChild = !!dropdown.querySelector('.nav-dropdown__menu a.active');
      dropdown.classList.toggle('active', hasActiveChild);
    });
  }

  function setActiveHash(hash) {
    const normalised = (hash || '').trim();
    routeNavLinks.forEach(a => a.classList.remove('active'));
    hashNavLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === normalised);
    });

    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
      const hasActiveChild = !!dropdown.querySelector('.nav-dropdown__menu a.active');
      dropdown.classList.toggle('active', hasActiveChild);
    });
  }

  function updateActiveSectionFromScroll() {
    if (!hashNavLinks.length) return;

    const navbar = document.querySelector('.navbar');
    const offset = (navbar ? navbar.offsetHeight : 0) + 24;

    const sections = Array.from(hashNavLinks)
      .map(a => a.getAttribute('href'))
      .filter(Boolean)
      .map(hash => ({ hash, el: document.getElementById(hash.slice(1)) }))
      .filter(item => !!item.el)
      .sort((a, b) => a.el.offsetTop - b.el.offsetTop);

    if (!sections.length) return;

    let activeHash = '';
    const y = window.scrollY + offset;

    sections.forEach(({ hash, el }) => {
      if (y >= el.offsetTop) {
        activeHash = hash;
      }
    });

    if (activeHash) {
      setActiveHash(activeHash);
    } else {
      setActiveNav('/');
    }
  }

  /* Render HTML into #content with a fade */
  function render(html) {
    content.innerHTML = html;

    content.classList.remove('fade-in');
    // Force reflow to restart animation
    void content.offsetWidth;
    content.classList.add('fade-in');

    /* Re-intercept any links inside the loaded page */
    interceptLinks(content);
    initPageBehavior();
  }

  function initPageBehavior() {
    const heroCarousel = document.getElementById('heroCarousel');
    if (
      heroCarousel &&
      heroCarousel.classList.contains('carousel') &&
      window.bootstrap &&
      window.bootstrap.Carousel
    ) {
      const carousel = window.bootstrap.Carousel.getOrCreateInstance(heroCarousel);

      const prevBtn = heroCarousel.querySelector('.carousel-control-prev');
      const nextBtn = heroCarousel.querySelector('.carousel-control-next');

      if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.addEventListener('click', e => {
          e.preventDefault();
          carousel.prev();
        });
        prevBtn.dataset.bound = 'true';
      }

      if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.addEventListener('click', e => {
          e.preventDefault();
          carousel.next();
        });
        nextBtn.dataset.bound = 'true';
      }

      heroCarousel.querySelectorAll('.carousel-indicators [data-bs-slide-to]').forEach(indicator => {
        if (indicator.dataset.bound) return;
        indicator.addEventListener('click', e => {
          e.preventDefault();
          const slideIndex = Number.parseInt(indicator.getAttribute('data-bs-slide-to') || '0', 10);
          carousel.to(slideIndex);
        });
        indicator.dataset.bound = 'true';
      });
    }

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', e => {
        e.preventDefault();
        const feedback = document.getElementById('formFeedback');
        if (feedback) {
          feedback.textContent = '✓ Lorem ipsum dolor sit amet (placeholder only).';
          feedback.focus();
        }
        contactForm.reset();
      }, { once: true });
    }

    /* Server IP click-to-copy */
    const serverIpElement = document.getElementById('serverIpCopyable');
    if (serverIpElement && !serverIpElement.dataset.bound) {
      serverIpElement.addEventListener('click', async () => {
        const ipText = (serverIpElement.textContent || '').trim();
        if (!ipText) return;

        let copied = false;

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(ipText);
            copied = true;
          }
        } catch (err) {
          copied = false;
        }

        if (!copied) {
          const textArea = document.createElement('textarea');
          textArea.value = ipText;
          textArea.setAttribute('readonly', '');
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          copied = document.execCommand('copy');
          document.body.removeChild(textArea);
        }

        const originalText = ipText;
        serverIpElement.textContent = copied ? 'Copied!' : 'Copy failed';
        setTimeout(() => {
          serverIpElement.textContent = originalText;
        }, 1800);
      });

      serverIpElement.dataset.bound = 'true';
    }

    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView();
        setActiveHash(location.hash);
      }
    } else {
      updateActiveSectionFromScroll();
    }
  }

  function closeNavbarCollapse() {
    const mainNav = document.getElementById('mainNav');
    if (!mainNav || !window.bootstrap || !window.bootstrap.Collapse) return;

    const isExpanded = mainNav.classList.contains('show');
    if (!isExpanded) return;

    window.bootstrap.Collapse.getOrCreateInstance(mainNav).hide();
  }

  /* Load a page by URL path */
  async function navigate(path, push = true) {
    const targetPath = '/';
    setActiveNav(targetPath);

    if (push && location.pathname !== targetPath) {
      history.pushState({ path: targetPath }, '', targetPath);
    }

    /* Serve from cache if available */
    if (cache.has(targetPath)) {
      render(cache.get(targetPath));
      return;
    }

    /* Show spinner while loading */
    content.innerHTML = '<div class="loader"></div>';

    const file = pathToFile(targetPath);
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      cache.set(targetPath, html);
      render(html);
    } catch (err) {
      console.warn('Failed to load page:', targetPath, err);
      const notFound = `
        <section class="not-found">
          <h1 class="not-found__code">404</h1>
          <p class="not-found__title">
            Page not found :(
          </p>
          <p class="not-found__text">
            We couldn't find <code class="not-found__path">${path}</code>
             Please contact us if you think this is a mistake.
          </p>
          <a href="/" data-route="/" class="btn btn-primary">
            Go Home
          </a>
        </section>`;
      cache.set(targetPath, notFound);
      render(notFound);
    }
  }

  /* Returns true for links that should NOT be handled by the router */
  function isExternalLink(href) {
    return (
      !href ||
      href.startsWith('//') ||
      href.startsWith('#') ||
      /^[a-z][a-z\d+.-]*:/i.test(href)
    );
  }

  /* Intercept clicks on internal links */
  function interceptLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      if (isExternalLink(a.getAttribute('href'))) return;
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(new URL(a.href, location.origin).pathname);
      });
    });
  }

  /* Handle browser back / forward */
  window.addEventListener('popstate', e => {
    const path = (e.state && e.state.path) || location.pathname;
    navigate(path, false);
  });

  /* Intercept nav links */
  routeNavLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.route);
      closeNavbarCollapse();
    });
  });

  hashNavLinks.forEach(a => {
    a.addEventListener('click', () => {
      const hash = a.getAttribute('href');
      if (hash) {
        setActiveHash(hash);
      }
      closeNavbarCollapse();
    });
  });

  window.addEventListener('scroll', updateActiveSectionFromScroll, { passive: true });
  window.addEventListener('hashchange', () => {
    if (location.hash) {
      setActiveHash(location.hash);
    } else {
      updateActiveSectionFromScroll();
    }
  });

  /* My Work nav dropdown (click to open) */
  const navDropdown = document.querySelector('.nav-dropdown');
  const navDropdownToggle = navDropdown && navDropdown.querySelector('.nav-dropdown__toggle');

  if (navDropdown && navDropdownToggle) {
    navDropdownToggle.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = navDropdown.classList.toggle('open');
      navDropdownToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navDropdown.querySelectorAll('.nav-dropdown__menu a').forEach(link => {
      link.addEventListener('click', () => {
        navDropdown.classList.remove('open');
        navDropdownToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', e => {
      if (!navDropdown.contains(e.target)) {
        navDropdown.classList.remove('open');
        navDropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        navDropdown.classList.remove('open');
        navDropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Initial load — honour GitHub Pages 404.html redirect */
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
  const redirectPath = sessionStorage.getItem('spa:redirect');
  if (redirectPath) {
    sessionStorage.removeItem('spa:redirect');

    /* External redirects */
    const externalRoutes = {
      '/discord': 'https://discord.gg/e3MMfgQJWT',
    };
    if (Object.prototype.hasOwnProperty.call(externalRoutes, redirectPath)) {
      location.replace(externalRoutes[redirectPath]);
      return;
    }
  }

  if (location.pathname !== '/') {
    history.replaceState({ path: '/' }, '', `/${location.hash}`);
  }

  navigate('/', false);
})();
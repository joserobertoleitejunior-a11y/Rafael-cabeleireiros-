/* Menu hambúrguer — abrir, fechar, Esc, clique fora, foco acessível. */
(function () {
  var openBtn = document.getElementById('menuOpenBtn');
  var closeBtn = document.getElementById('menuCloseBtn');
  var menu = document.getElementById('siteMenu');
  if (!openBtn || !menu) return;

  var lastFocused = null;
  var lockedScrollY = 0;

  // Trava o scroll do fundo. overflow:hidden sozinho não segura o iOS
  // Safari (a página ainda "arrasta" por baixo do overlay) — por isso
  // fixamos o body na posição atual e devolvemos o scroll ao fechar.
  function lockScroll() {
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.top = '-' + lockedScrollY + 'px';
    document.body.classList.add('scroll-locked');
  }
  function unlockScroll() {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    // scrollTo instantâneo — sem isso o scroll-behavior:smooth global anima
    // a volta e o usuário vê a página "piscar" pro topo antes de descer de novo.
    window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
  }

  function openMenu() {
    lastFocused = document.activeElement;
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    lockScroll();
    if (closeBtn) closeBtn.focus();
  }

  function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    unlockScroll();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  openBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  menu.addEventListener('click', function (e) {
    if (e.target === menu) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });

  // Fecha o menu ao navegar por um link comum dentro dele.
  menu.querySelectorAll('a[href]').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  window.RafaelMenu = { open: openMenu, close: closeMenu };
})();

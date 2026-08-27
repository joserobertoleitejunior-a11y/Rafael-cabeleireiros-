/* Menu hambúrguer — abrir, fechar, Esc, clique fora, foco acessível. */
(function () {
  var openBtn = document.getElementById('menuOpenBtn');
  var closeBtn = document.getElementById('menuCloseBtn');
  var menu = document.getElementById('siteMenu');
  if (!openBtn || !menu) return;

  var lastFocused = null;

  function openMenu() {
    lastFocused = document.activeElement;
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function closeMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
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

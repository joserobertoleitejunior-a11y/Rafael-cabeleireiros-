/* Catálogo de produtos — abre num modal simples ao tocar em "Produtos
   Premium". Leitura pública direto do Supabase (mesma tabela que o
   painel usa pra cadastrar); sem carrinho/checkout, é só vitrine com um
   link pro WhatsApp pra perguntar/comprar. */
(function () {
  var overlay = document.getElementById('catalogOverlay');
  if (!overlay) return;

  var WHATSAPP_NUMBER = '5515996507174';
  var closeBtn = document.getElementById('catalogClose');
  var grid = document.getElementById('catalogGrid');
  var carregado = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtBRL(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function carregarProdutos() {
    grid.innerHTML = '<p class="catalog-empty">Carregando…</p>';
    if (!window.db) { grid.innerHTML = '<p class="catalog-empty">Não deu pra carregar agora — tenta de novo daqui a pouco, ou pergunta pelo WhatsApp.</p>'; return; }
    window.db.from('products').select('id,nome,descricao,preco,foto_url').eq('ativo', true).order('created_at').then(function (res) {
      if (res.error || !res.data || !res.data.length) { grid.innerHTML = '<p class="catalog-empty">Nenhum produto por aqui ainda.</p>'; return; }
      grid.innerHTML = res.data.map(function (p) {
        var msg = encodeURIComponent('Olá! Vi o produto "' + p.nome + '" no site e queria saber mais.');
        return '<div class="catalog-card">' +
          (p.foto_url ? '<img src="' + esc(p.foto_url) + '" alt="">' : '<img src="assets/img/placeholder-square.svg" class="tone-bw" alt="">') +
          '<h3>' + esc(p.nome) + '</h3>' +
          (p.descricao ? '<p>' + esc(p.descricao) + '</p>' : '') +
          '<span class="price">' + fmtBRL(p.preco) + '</span>' +
          '<a class="btn btn-sm" style="margin-top:0.9rem;" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP_NUMBER + '?text=' + msg + '">Perguntar no WhatsApp</a>' +
          '</div>';
      }).join('');
    }).catch(function () {
      grid.innerHTML = '<p class="catalog-empty">Não deu pra carregar agora — tenta de novo daqui a pouco, ou pergunta pelo WhatsApp.</p>';
    });
  }

  function open() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('scroll-locked');
    if (!carregado) { carregarProdutos(); carregado = true; }
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('scroll-locked');
  }

  document.querySelectorAll('[data-open-catalog]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      open();
      if (window.RafaelMenu) window.RafaelMenu.close();
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();

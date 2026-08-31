/* Gera os cartões de profissional das páginas institucionais direto do
   banco de verdade — nome, foto e especialidade só existem aqui, nunca
   escritos à mão no HTML. Antes, cada página tinha um card fixo por
   profissional (bio, "X anos de casa", estatísticas inventadas, tags) e um
   script separado só corrigia foto/remoção depois — daí vinham as telas
   dessincronizadas: trocar ou remover alguém no admin não alcançava esses
   cards escritos à mão, e cada correção só resolvia um sintoma de cada vez.
   Agora não existe mais conteúdo fixo pra ficar desatualizado: a página só
   tem um contêiner vazio (#teamGrid) e este script constrói tudo a partir
   de staff_public sempre que a página carrega.

   Além disso, clicar na foto de um profissional abre um mural só com as
   fotos da galeria marcadas pra essa pessoa (reaproveita o staff_id que o
   admin já usa pra marcar fotos). */
(function () {
  var container = document.getElementById('teamGrid');
  if (!container) return;
  var variant = container.getAttribute('data-team-variant'); // 'full' (profissionais.html) | 'preview' (institucional.html)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderVazio(msg) {
    container.innerHTML = '<p class="team-empty">' + msg + '</p>';
  }

  if (!window.db) {
    renderVazio('Não conseguimos carregar a equipe agora. Recarregue a página em instantes ou ligue pra gente: <a href="tel:+5515996507174">(15) 99650-7174</a>.');
    return;
  }

  // -------- mural de fotos por profissional (clique na foto) --------
  var overlay = document.createElement('div');
  overlay.className = 'staff-gallery-overlay';
  overlay.innerHTML =
    '<div class="staff-gallery-box">' +
    '<div class="staff-gallery-head"><h3 id="staffGalleryNome"></h3><button type="button" class="staff-gallery-close" aria-label="Fechar">×</button></div>' +
    '<div class="staff-gallery-grid" id="staffGalleryGrid"></div>' +
    '</div>';

  var overlayPronto = false;
  function garantirOverlay() {
    if (overlayPronto) return;
    overlayPronto = true;
    document.body.appendChild(overlay);
    var fechar = function () { overlay.classList.remove('open'); };
    overlay.querySelector('.staff-gallery-close').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
  }

  function abrirGaleriaDoProfissional(staffId, nome) {
    garantirOverlay();
    overlay.classList.add('open');
    overlay.querySelector('#staffGalleryNome').textContent = nome;
    var grid = overlay.querySelector('#staffGalleryGrid');
    grid.innerHTML = '<p class="staff-gallery-msg">Carregando…</p>';
    window.db.from('gallery').select('foto_url').eq('staff_id', staffId).order('created_at', { ascending: false }).then(function (res) {
      if (res.error || !res.data || !res.data.length) {
        grid.innerHTML = '<p class="staff-gallery-msg">Nenhuma foto marcada com esse profissional ainda.</p>';
        return;
      }
      grid.innerHTML = res.data.map(function (p) {
        return '<figure><img src="' + String(p.foto_url).replace(/"/g, '&quot;') + '" alt=""></figure>';
      }).join('');
    }).catch(function () {
      grid.innerHTML = '<p class="staff-gallery-msg">Não deu pra carregar agora. Tenta de novo em instantes.</p>';
    });
  }

  // -------- cartões --------
  function foto(p) {
    return p.foto_url ? esc(p.foto_url) : 'assets/img/placeholder-portrait.svg';
  }

  function cardFull(p, i) {
    var reverse = i % 2 === 1 ? ' reverse' : '';
    return '<article class="pro-card' + reverse + ' boiserie" data-staff-id="' + p.id + '">' +
      '<div class="pro-photo"><img src="' + foto(p) + '" class="tone-bw staff-photo-clicavel" alt="' + esc(p.nome) + '"></div>' +
      '<div class="pro-body">' +
      (p.especialidade ? '<p class="eyebrow">' + esc(p.especialidade) + '</p>' : '') +
      '<h3>' + esc(p.nome) + '</h3>' +
      '<button class="btn btn-sm" type="button" data-open-widget data-preselect-prof="' + esc(p.nome) + '">Agendar com ' + esc(p.nome.split(' ')[0]) + ' →</button>' +
      '</div></article>';
  }

  function cardPreview(p) {
    return '<div class="team-preview-card boiserie" data-staff-id="' + p.id + '">' +
      '<img src="' + foto(p) + '" class="tone-bw staff-photo-clicavel" alt="' + esc(p.nome) + '">' +
      '<h3>' + esc(p.nome) + '</h3>' +
      (p.especialidade ? '<p class="eyebrow">' + esc(p.especialidade) + '</p>' : '') +
      '<button class="btn btn-sm" type="button" data-open-widget data-preselect-prof="' + esc(p.nome) + '">Agendar com ' + esc(p.nome.split(' ')[0]) + ' →</button>' +
      '</div>';
  }

  window.db.from('staff_public').select('id,nome,especialidade,foto_url').then(function (res) {
    if (res.error) { renderVazio('Não conseguimos carregar a equipe agora. Tenta de novo em instantes.'); return; }
    var lista = res.data || [];
    if (!lista.length) { renderVazio('Nenhum profissional cadastrado no momento.'); return; }

    container.innerHTML = lista.map(function (p, i) {
      return variant === 'full' ? cardFull(p, i) : cardPreview(p);
    }).join('');

    container.querySelectorAll('.staff-photo-clicavel').forEach(function (img) {
      var card = img.closest('[data-staff-id]');
      var staffId = card.getAttribute('data-staff-id');
      var nome = card.querySelector('h3').textContent;
      img.title = 'Ver fotos de trabalhos de ' + nome;
      img.addEventListener('click', function () { abrirGaleriaDoProfissional(staffId, nome); });
    });
  }).catch(function () {
    renderVazio('Não conseguimos carregar a equipe agora. Tenta de novo em instantes.');
  });
})();

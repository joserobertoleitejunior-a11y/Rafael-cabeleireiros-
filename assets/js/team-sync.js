/* Sincroniza os cartões de profissional das páginas institucionais
   (profissionais.html, institucional.html e as versões femininas) com
   o banco de verdade — sem isso, foto trocada ou funcionário removido
   no admin nunca aparecia fora do próprio admin, porque esses cartões
   eram HTML fixo com bio/estatísticas escritas à mão.
   Cada cartão marcado com data-staff="Nome Exato" recebe a foto
   atualizada do banco; se o profissional foi removido (ou nunca
   existiu ativo), o cartão inteiro some da página. Além disso, clicar
   na foto abre um mural só com as fotos da galeria marcadas pra essa
   pessoa (reaproveita o staff_id que o admin já usa pra marcar fotos). */
(function () {
  if (!window.db) return;

  var overlay = document.createElement('div');
  overlay.className = 'staff-gallery-overlay';
  overlay.innerHTML =
    '<div class="staff-gallery-box">' +
    '<div class="staff-gallery-head"><h3 id="staffGalleryNome"></h3><button type="button" class="staff-gallery-close" aria-label="Fechar">×</button></div>' +
    '<div class="staff-gallery-grid" id="staffGalleryGrid"></div>' +
    '</div>';

  var closeBtn, fechar;
  function garantirOverlay() {
    if (overlay.parentNode) return;
    document.body.appendChild(overlay);
    closeBtn = overlay.querySelector('.staff-gallery-close');
    fechar = function () { overlay.classList.remove('open'); };
    closeBtn.addEventListener('click', fechar);
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

  window.db.from('staff_public').select('id,nome,especialidade,foto_url').then(function (res) {
    // Lista vazia quase sempre é falha de rede/conexão a meio caminho, não
    // "todo mundo foi removido" (o dono nunca fica inativo) — nesse caso
    // é mais seguro manter o HTML fixo do que apagar a equipe inteira da
    // tela.
    if (res.error || !res.data || !res.data.length) return;

    var porNome = {};
    res.data.forEach(function (s) { porNome[s.nome] = s; });

    document.querySelectorAll('[data-staff]').forEach(function (card) {
      var nome = card.getAttribute('data-staff');
      var staff = porNome[nome];
      if (!staff) { card.remove(); return; }

      card.setAttribute('data-staff-id', staff.id);
      var img = card.querySelector('img');
      if (staff.foto_url && img) img.src = staff.foto_url;
      if (img) {
        img.classList.add('staff-photo-clicavel');
        img.title = 'Ver fotos de trabalhos de ' + nome;
        img.addEventListener('click', function () { abrirGaleriaDoProfissional(staff.id, nome); });
      }
    });
  }).catch(function () { /* offline: mantém o que já está fixo no HTML */ });
})();

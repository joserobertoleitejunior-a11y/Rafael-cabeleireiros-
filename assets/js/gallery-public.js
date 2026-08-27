/* Galeria pública (institucional.html) — carrega as fotos reais do
   Supabase (leitura pública, só visualização, sem gerenciar nada aqui).
   Sem rede/CDN, mantém as imagens de referência que já estão no HTML. */
(function () {
  var grid = document.getElementById('galeriaPublica');
  if (!grid || !window.db) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.db.from('gallery').select('id,foto_url').order('created_at', { ascending: false }).then(function (res) {
    if (res.error || !res.data || !res.data.length) return;
    grid.innerHTML = res.data.map(function (p) {
      return '<figure><img src="' + esc(p.foto_url) + '" class="tone-bw" alt="Corte feito no Rafael Cabeleireiros"></figure>';
    }).join('');
  }).catch(function () { /* offline: mantém as fotos de referência do HTML */ });
})();

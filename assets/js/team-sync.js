/* Sincroniza os cartões de profissional das páginas institucionais
   (profissionais.html, institucional.html e as versões femininas) com
   o banco de verdade — sem isso, foto trocada ou funcionário removido
   no admin nunca aparecia fora do próprio admin, porque esses cartões
   eram HTML fixo com bio/estatísticas escritas à mão.
   Cada cartão marcado com data-staff="Nome Exato" recebe a foto
   atualizada do banco; se o profissional foi removido (ou nunca
   existiu ativo), o cartão inteiro some da página. */
(function () {
  if (!window.db) return;

  window.db.from('staff_public').select('id,nome,especialidade,foto_url').then(function (res) {
    if (res.error || !res.data) return; // offline: mantém o que já está fixo no HTML

    var porNome = {};
    res.data.forEach(function (s) { porNome[s.nome] = s; });

    document.querySelectorAll('[data-staff]').forEach(function (card) {
      var nome = card.getAttribute('data-staff');
      var staff = porNome[nome];
      if (!staff) { card.remove(); return; }
      if (staff.foto_url) {
        var img = card.querySelector('img');
        if (img) img.src = staff.foto_url;
      }
    });
  }).catch(function () { /* offline: mantém o que já está fixo no HTML */ });
})();

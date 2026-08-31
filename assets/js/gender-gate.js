/* Alternância Masculino/Feminino — um clique muda de trilha a qualquer
   momento (o pill do topo), e perguntamos qual trilha a pessoa quer só
   na PRIMEIRA vez que ela abre o site em cada sessão do navegador (aba
   aberta). Depois de responder — ou de clicar direto no pill — ela
   navega livre pelo site inteiro sem ser interrompida de novo; a
   pergunta só volta a aparecer quando ela sai do site (fecha a aba/
   navegador) e entra de novo depois. Guardamos isso em sessionStorage
   (baixo consumo, some sozinho ao sair). */
(function () {
  var SESSION_KEY = 'rafaelGeneroSessao';
  var thisPage = document.body.getAttribute('data-genero'); // 'masculino' | 'feminino'

  function salvar(escolha) {
    try { sessionStorage.setItem(SESSION_KEY, escolha); } catch (e) { /* segue sem marcar a sessão */ }
  }
  function escolhidoNestaSessao() {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }

  // pill do topo: sempre disponível, em toda página — clicar nele já
  // marca a sessão, então a página de destino não pergunta de novo.
  document.querySelectorAll('[data-gender-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      salvar(link.getAttribute('data-gender-link'));
    });
  });

  // tela de escolha inicial: só existe em index.html e feminino.html.
  var gate = document.getElementById('genderGate');
  if (!gate) return;

  // já respondeu (ou navegou pelo pill) nesta sessão — não pergunta de novo.
  if (escolhidoNestaSessao()) { gate.remove(); return; }

  gate.classList.add('open');
  document.body.classList.add('scroll-locked');

  gate.querySelectorAll('[data-gender-escolha]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var escolha = btn.getAttribute('data-gender-escolha');
      salvar(escolha);
      document.body.classList.remove('scroll-locked');
      if (escolha === thisPage) { gate.remove(); return; }
      window.location.href = escolha === 'feminino' ? 'feminino.html' : 'index.html';
    });
  });
})();

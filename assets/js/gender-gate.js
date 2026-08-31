/* Alternância Masculino/Feminino — um clique muda de trilha a qualquer
   momento (o pill do topo), e TODA vez que a pessoa entra pelo site
   (index.html ou feminino.html) mostramos a telinha perguntando qual
   das duas trilhas ela quer — de propósito, sem pular mesmo que já
   tenha escolhido antes. A última escolha (guardada no localStorage)
   só serve pra vir pré-marcada como sugestão, não pra pular a pergunta. */
(function () {
  var KEY = 'rafaelGenero';
  var thisPage = document.body.getAttribute('data-genero'); // 'masculino' | 'feminino'

  function salvar(escolha) {
    try { localStorage.setItem(KEY, escolha); } catch (e) { /* modo privado — segue sem lembrar */ }
  }
  function salvo() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  // pill do topo: sempre disponível, em toda página
  document.querySelectorAll('[data-gender-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      salvar(link.getAttribute('data-gender-link'));
    });
  });

  // tela de escolha inicial: só existe em index.html e feminino.html, e
  // aparece sempre — a escolha anterior só pré-marca um dos botões.
  var gate = document.getElementById('genderGate');
  if (!gate) return;

  var escolhaAnterior = salvo();
  if (escolhaAnterior) {
    var btnAnterior = gate.querySelector('[data-gender-escolha="' + escolhaAnterior + '"]');
    if (btnAnterior) btnAnterior.classList.add('gender-gate-option-padrao');
  }

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

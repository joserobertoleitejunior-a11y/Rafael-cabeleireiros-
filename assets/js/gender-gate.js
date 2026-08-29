/* Alternância Masculino/Feminino — um clique muda de trilha a qualquer
   momento (o pill do topo), e na primeira visita mostramos uma telinha
   perguntando qual das duas o visitante quer, só uma vez (guardado no
   localStorage). Depois disso nunca mais interrompe — só o pill fica ali
   disponível o tempo todo. */
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

  // tela de escolha inicial: só existe em index.html e feminino.html, e só
  // aparece se a pessoa nunca escolheu antes
  var gate = document.getElementById('genderGate');
  if (!gate) return;
  if (salvo()) { gate.remove(); return; }

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

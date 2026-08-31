/* Contagem simples de acesso por área do site — só um INSERT silencioso
   por carregamento de página (sem cookie de rastreamento, sem IP, sem
   nada que dependa do visitante aceitar algo). Nunca trava nem atrasa a
   página: qualquer erro (rede fora, CDN bloqueada) é ignorado. A página
   é identificada pelo próprio nome do arquivo + o data-genero que já
   existe no <body> (index.html e feminino.html contam como "home"). */
(function () {
  function paginaAtual() {
    var arquivo = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    // "institucional-feminino.html" etc já carrega o gênero no nome do
    // arquivo — tira esse sufixo daqui pra não duplicar (o genero real
    // é sempre lido do data-genero do <body> logo abaixo).
    var nome = arquivo.replace(/-feminino$/, '');
    if (nome === 'index' || nome === 'feminino') nome = 'home';
    var genero = document.body.getAttribute('data-genero');
    return genero ? nome + '-' + genero : nome;
  }

  function registrar(pagina) {
    if (!pagina || !window.db) return;
    try {
      window.db.rpc('registrar_visita', { p_pagina: pagina }).catch(function () { /* offline: sem problema */ });
    } catch (e) { /* sem problema */ }
  }

  var pagina = paginaAtual();
  registrar(pagina);

  window.RafaelAnalytics = {
    registrar: registrar,
    genero: function () { return document.body.getAttribute('data-genero') || 'masculino'; }
  };
})();

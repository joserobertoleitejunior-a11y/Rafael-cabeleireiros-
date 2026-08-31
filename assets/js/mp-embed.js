/* Checkout do Mercado Pago embutido na própria página (Payment Brick) —
   nada de redirecionar pro site do Mercado Pago. Usa a Public Key (essa
   sim pode rodar no navegador) só pra desenhar o formulário e tokenizar
   o cartão; o valor cobrado e o Access Token continuam só no servidor
   (ver mp-processar-pagamento e mp-criar-assinatura). */
(function (global) {
  var sdkPromise = null;
  function carregarSDK() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      if (global.MercadoPago) { resolve(); return; }
      var s = document.createElement('script');
      s.src = 'https://sdk.mercadopago.com/js/v2';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Não deu pra carregar o Mercado Pago agora. Tenta de novo em instantes.')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  // Cada container só pode ter UM Brick vivo por vez — trocar de forma
  // de pagamento (Pix -> cartão, por exemplo) sem desmontar o anterior
  // direito é o que causava a tela "Ocorreu um erro" e a exceção
  // removeChild: o Brick guarda referências internas do DOM, e limpar o
  // container na marra (innerHTML = '') por baixo dele quebra essas
  // referências. Por isso guardamos o controller de cada container e
  // sempre chamamos unmount() nele antes de criar um novo, ou antes de
  // desenhar qualquer coisa nossa (como o QR code do Pix) por cima.
  var bricksAtivos = {};

  function desmontar(containerId) {
    var atual = bricksAtivos[containerId];
    delete bricksAtivos[containerId];
    if (!atual) return Promise.resolve();
    try {
      var resultado = atual.unmount();
      return resultado && resultado.then ? resultado.catch(function () {}) : Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  }

  // Transforma o objeto de erro do Brick (formato varia — às vezes tem
  // .message, às vezes uma lista em .cause) numa frase legível, pra
  // aparecer escrita na tela mesmo sem abrir o console do navegador.
  function descreverErroBrick(error) {
    if (!error) return 'Erro desconhecido no formulário de pagamento.';
    if (typeof error === 'string') return error;
    if (Array.isArray(error.cause) && error.cause.length) {
      var partes = error.cause.map(function (c) {
        if (!c) return '';
        if (typeof c === 'string') return c;
        return c.description || c.message || c.code || '';
      }).filter(Boolean);
      if (partes.length) return partes.join(' · ');
    }
    if (error.message) return error.message;
    try { return JSON.stringify(error).slice(0, 300); } catch (e) { return 'Erro no formulário de pagamento (sem detalhes).'; }
  }

  // Monta um Payment Brick pra cobrar um valor único agora (taxa de
  // criação, ou Pix avulso da mensalidade). opts: {publicKey, amount,
  // telefone, email, tipo, forma, edgeUrl, containerId, onResult}
  function montarPagamento(opts) {
    return carregarSDK().then(function () { return desmontar(opts.containerId); }).then(function () {
      var mp = new global.MercadoPago(opts.publicKey, { locale: 'pt-BR' });
      return mp.bricks().create('payment', opts.containerId, {
        // Manda o e-mail já preenchido — sem isso, o Pix (bank_transfer)
        // sempre pede pro cliente digitar o e-mail dentro do próprio
        // formulário do Brick antes de gerar o código.
        initialization: { amount: opts.amount, payer: { email: opts.email || undefined } },
        // Esse Brick não aceita "excluded" em NENHUM método (testado com
        // debitCard, ticket, bankTransfer e creditCard — todos recusam,
        // só "all" é aceito). Então só informamos a opção que queremos
        // mostrar, sem tentar excluir as outras.
        customization: {
          paymentMethods: opts.forma === 'pix'
            ? { bankTransfer: 'all' }
            : { creditCard: 'all', debitCard: 'all' }
        },
        callbacks: {
          onSubmit: function (formData) {
            return fetch(opts.edgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telefone: opts.telefone, email: opts.email || '', tipo: opts.tipo, forma: opts.forma, mpFormData: formData })
            }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
              .then(function (result) {
                if (!result.ok) throw new Error((result.data && result.data.error) || 'Pagamento recusado.');
                return desmontar(opts.containerId).then(function () { opts.onResult(result.data); });
              }).catch(function (e) {
                opts.onResult({ error: e.message });
                throw e;
              });
          },
          onError: function (error) {
            console.error('Erro no Payment Brick:', error);
            // Mostra o erro escrito na tela (não só no console) — quem
            // está testando pelo celular não tem como abrir o F12 fácil,
            // e sem isso o "Ocorreu um erro" do próprio Brick não dizia
            // nada sobre a causa real.
            opts.onResult({ error: descreverErroBrick(error) });
          },
          onReady: function () {}
        }
      }).then(function (controller) {
        bricksAtivos[opts.containerId] = controller;
        return controller;
      });
    });
  }

  // Monta um Payment Brick só pra TOKENIZAR o cartão (sem cobrar agora)
  // e cadastrar a assinatura recorrente autorizada direto, sem
  // redirecionar. opts: {publicKey, telefone, plano, email, valor,
  // edgeUrl, containerId, onResult}
  function montarCartaoAssinatura(opts) {
    return carregarSDK().then(function () { return desmontar(opts.containerId); }).then(function () {
      var mp = new global.MercadoPago(opts.publicKey, { locale: 'pt-BR' });
      return mp.bricks().create('payment', opts.containerId, {
        initialization: { amount: opts.valor, payer: { email: opts.email || undefined } },
        customization: {
          paymentMethods: { creditCard: 'all', debitCard: 'all', maxInstallments: 1 }
        },
        callbacks: {
          onSubmit: function (formData) {
            return fetch(opts.edgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telefone: opts.telefone, email: opts.email || (formData.payer && formData.payer.email) || '', plano: opts.plano, cardTokenId: formData.token })
            }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
              .then(function (result) {
                if (!result.ok) throw new Error((result.data && result.data.error) || 'Não deu pra cadastrar o cartão.');
                return desmontar(opts.containerId).then(function () { opts.onResult(result.data); });
              }).catch(function (e) {
                opts.onResult({ error: e.message });
                throw e;
              });
          },
          onError: function (error) {
            console.error('Erro no Payment Brick:', error);
            // Mostra o erro escrito na tela (não só no console) — quem
            // está testando pelo celular não tem como abrir o F12 fácil,
            // e sem isso o "Ocorreu um erro" do próprio Brick não dizia
            // nada sobre a causa real.
            opts.onResult({ error: descreverErroBrick(error) });
          },
          onReady: function () {}
        }
      }).then(function (controller) {
        bricksAtivos[opts.containerId] = controller;
        return controller;
      });
    });
  }

  global.RafaelMP = { montarPagamento: montarPagamento, montarCartaoAssinatura: montarCartaoAssinatura, desmontar: desmontar };
})(window);

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

  // Monta um Payment Brick pra cobrar um valor único agora (taxa de
  // criação, ou Pix avulso da mensalidade). opts: {publicKey, amount,
  // telefone, tipo, forma, edgeUrl, containerId, onResult}
  function montarPagamento(opts) {
    return carregarSDK().then(function () {
      var mp = new global.MercadoPago(opts.publicKey, { locale: 'pt-BR' });
      return mp.bricks().create('payment', opts.containerId, {
        initialization: { amount: opts.amount },
        customization: {
          paymentMethods: opts.forma === 'pix'
            ? { bankTransfer: 'all', creditCard: 'excluded', debitCard: 'excluded', ticket: 'excluded' }
            : { creditCard: 'all', bankTransfer: 'excluded', debitCard: 'excluded', ticket: 'excluded' }
        },
        callbacks: {
          onSubmit: function (formData) {
            return fetch(opts.edgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telefone: opts.telefone, tipo: opts.tipo, forma: opts.forma, mpFormData: formData })
            }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
              .then(function (result) {
                if (!result.ok) throw new Error((result.data && result.data.error) || 'Pagamento recusado.');
                opts.onResult(result.data);
              }).catch(function (e) {
                opts.onResult({ error: e.message });
                throw e;
              });
          },
          onError: function (error) {
            console.error('Erro no Payment Brick:', error);
          },
          onReady: function () {}
        }
      });
    });
  }

  // Monta um Payment Brick só pra TOKENIZAR o cartão (sem cobrar agora)
  // e cadastrar a assinatura recorrente autorizada direto, sem
  // redirecionar. opts: {publicKey, telefone, plano, email, valor,
  // edgeUrl, containerId, onResult}
  function montarCartaoAssinatura(opts) {
    return carregarSDK().then(function () {
      var mp = new global.MercadoPago(opts.publicKey, { locale: 'pt-BR' });
      return mp.bricks().create('payment', opts.containerId, {
        initialization: { amount: opts.valor, payer: { email: opts.email || undefined } },
        customization: {
          paymentMethods: { creditCard: 'all', bankTransfer: 'excluded', debitCard: 'excluded', ticket: 'excluded', maxInstallments: 1 }
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
                opts.onResult(result.data);
              }).catch(function (e) {
                opts.onResult({ error: e.message });
                throw e;
              });
          },
          onError: function (error) {
            console.error('Erro no Payment Brick:', error);
          },
          onReady: function () {}
        }
      });
    });
  }

  global.RafaelMP = { montarPagamento: montarPagamento, montarCartaoAssinatura: montarCartaoAssinatura };
})(window);

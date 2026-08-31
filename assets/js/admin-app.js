/* App do admin — login por PIN (via Supabase), abas com acesso por papel
   (dono vê tudo; equipe só PDV, Clientes e Galeria-pra-adicionar) e as 5
   telas. Todo dado real vem do Supabase (RafaelAdminStore). */
(function () {
  var Store = window.RafaelAdminStore;
  if (!Store) return;

  // ---------------------------------------------------------------- utils
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
  function waLink(tel) {
    var d = digitsOnly(tel);
    if (d.length && d.slice(0, 2) !== '55') d = '55' + d;
    return 'https://wa.me/' + d;
  }
  function fmtBRL(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDateBR(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDayBR(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function loading(container, msg) {
    container.innerHTML = '<p style="color:var(--adm-text-faint); padding:2rem 0; text-align:center;">' + esc(msg || 'Carregando…') + '</p>';
  }
  function erro(container, e) {
    container.innerHTML = '<p style="color:var(--adm-danger); padding:2rem 0; text-align:center;">Não deu pra carregar: ' + esc(e && e.message ? e.message : 'erro desconhecido') + '</p>';
  }
  var WHATSAPP_ICON = '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.3 2 2 8.3 2 16c0 2.5.7 4.9 1.9 7L2 30l7.2-1.9c2 1.1 4.3 1.7 6.8 1.7 7.7 0 14-6.3 14-14S23.7 2 16 2zm0 25.5c-2.2 0-4.4-.6-6.2-1.7l-.4-.3-4.3 1.1 1.1-4.2-.3-.4C4.6 20.2 4 18.1 4 16 4 9.4 9.4 4 16 4s12 5.4 12 12-5.4 11.5-12 11.5zm6.5-8.8c-.4-.2-2.1-1-2.4-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.6.2-.2.2-.4.3-.6.1-.2 0-.5 0-.7-.1-.2-.8-2-1.1-2.7-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.5-.3.4-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.7-.5z"/></svg>';
  var INSTAGRAM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>';

  // ------------------------------------------------------------ sessão
  var session = null; // {token, staffId, nome, role}

  var pinScreen = $('#pinScreen');
  var pinInput = $('#pinInput');
  var pinSubmit = $('#pinSubmit');
  var pinError = $('#pinError');
  var appRoot = $('#adminApp');

  function showPinScreen() {
    session = null;
    Store.clearSession();
    pinInput.value = '';
    pinError.textContent = '';
    pinScreen.style.display = 'flex';
    appRoot.style.display = 'none';
    setTimeout(function () { pinInput.focus(); }, 50);
  }

  function applyRoleVisibility() {
    var ownerOnly = ['dashboard', 'servicos', 'contrato'];
    $all('.admin-tab').forEach(function (tab) {
      var restrito = ownerOnly.indexOf(tab.dataset.view) !== -1;
      tab.style.display = (restrito && session.role !== 'owner') ? 'none' : '';
    });
  }

  function unlock(newSession) {
    session = newSession;
    pinScreen.style.display = 'none';
    appRoot.style.display = '';
    applyRoleVisibility();
    // se a aba ativa não é permitida pro papel, volta pro Caixa PDV
    var active = $('.admin-tab.active');
    if (active && active.style.display === 'none') {
      $all('.admin-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === 'pdv'); });
      $all('.admin-view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-pdv'); });
    }
    initApp();
    renderTaxaBanner();
    renderNotificacoes();
  }

  // ---------------------------------------------------- taxa de criação
  // Mostra sempre, em qualquer aba do admin (só pro dono) — pagamento
  // único obrigatório após 10 dias de uso, com 10% de desconto se pago
  // antes do prazo em qualquer forma de pagamento. Separado da
  // mensalidade de manutenção (R$149, sem desconto), que fica só no
  // painel do operador.
  var MP_TAXA_URL = 'https://fwxwhndjgzwipgpzbnzr.supabase.co/functions/v1/mp-processar-pagamento';
  var taxaExpandida = false;
  function renderTaxaBanner() {
    var el = $('#taxaBanner');
    if (!el) return;
    if (session.role !== 'owner') { el.innerHTML = ''; return; }

    Store.minhaTaxaCriacao(session.token).then(function (info) {
      if (info.status === 'pago') {
        el.innerHTML = '<button type="button" class="taxa-strip taxa-strip-ok">✓ Taxa de criação do site paga</button>';
        return;
      }

      var prazoTxt = fmtDayBR(info.prazo_desconto);
      var valorPix = info.dentro_do_prazo ? info.valor_pix_desconto : info.valor_pix;
      var valorCredito = info.dentro_do_prazo ? info.valor_credito_desconto : info.valor_credito;

      var stripHtml = '<button type="button" class="taxa-strip" id="taxaToggle">Taxa de criação pendente — ' +
        (info.dentro_do_prazo ? 'desconto até ' + prazoTxt : 'valor cheio, prazo do desconto passou') +
        ' · toque pra ver</button>';

      if (!taxaExpandida) {
        el.innerHTML = stripHtml;
        $('#taxaToggle').addEventListener('click', function () { taxaExpandida = true; renderTaxaBanner(); });
        return;
      }

      var html = stripHtml + '<div class="taxa-banner">' +
        '<h3>Taxa de criação do site</h3>' +
        '<p>Pagamento único e obrigatório pela criação do sistema. Pague até <strong>' + prazoTxt + '</strong> e garanta 10% de desconto em qualquer forma de pagamento. Depois desse prazo, vale o valor cheio.</p>' +
        '<div class="taxa-precos">' +
        '<div class="taxa-preco-item"><span>No cartão em até 5x</span><strong>' +
        (info.dentro_do_prazo ? '<span class="taxa-de">' + fmtBRL(info.valor_credito) + '</span> ' + fmtBRL(info.valor_credito_desconto) : fmtBRL(info.valor_credito)) +
        '</strong></div>' +
        '<div class="taxa-preco-item"><span>No Pix à vista</span><strong>' +
        (info.dentro_do_prazo ? '<span class="taxa-de">' + fmtBRL(info.valor_pix) + '</span> ' + fmtBRL(info.valor_pix_desconto) : fmtBRL(info.valor_pix)) +
        '</strong></div>' +
        '</div>' +
        '<div class="taxa-acoes">' +
        '<button type="button" class="adm-btn adm-btn-sm" id="taxaPagarPix">Pagar no Pix</button>' +
        '<button type="button" class="adm-btn adm-btn-sm adm-btn-ghost" id="taxaPagarCredito">Pagar no cartão 5x</button>' +
        '</div>' +
        '<div id="taxaBrickContainer" style="margin-top:1rem;"></div>' +
        '<p class="taxa-msg" id="taxaMsg"></p>' +
        '</div>';
      el.innerHTML = html;
      $('#taxaToggle').addEventListener('click', function () { taxaExpandida = false; renderTaxaBanner(); });

      function abrirBrick(forma) {
        var msgEl = $('#taxaMsg');
        var brickEl = $('#taxaBrickContainer');
        msgEl.textContent = 'Carregando o pagamento…';
        msgEl.className = 'taxa-msg';
        Store.mpPublicKey().then(function (publicKey) {
          return RafaelMP.montarPagamento({
            publicKey: publicKey,
            containerId: 'taxaBrickContainer',
            amount: forma === 'pix' ? valorPix : valorCredito,
            telefone: info.telefone,
            tipo: 'taxa',
            forma: forma,
            edgeUrl: MP_TAXA_URL,
            onResult: function (result) {
              if (result.error) {
                msgEl.textContent = result.error;
                msgEl.className = 'taxa-msg erro';
                return;
              }
              if (result.status === 'approved') {
                msgEl.textContent = 'Pagamento aprovado!';
                msgEl.className = 'taxa-msg ok';
                setTimeout(renderTaxaBanner, 1200);
              } else if (result.qr_code_base64) {
                brickEl.innerHTML = '<p style="margin-bottom:0.6rem;">Escaneie o QR Code ou copie o código Pix:</p>' +
                  '<img src="data:image/png;base64,' + result.qr_code_base64 + '" style="max-width:220px; border-radius:8px;">' +
                  '<textarea class="field-input" readonly style="margin-top:0.6rem; font-size:0.75rem;" rows="3">' + esc(result.qr_code) + '</textarea>';
                msgEl.textContent = 'Assim que o Pix cair, essa cobrança é confirmada sozinha.';
                msgEl.className = 'taxa-msg';
              } else {
                msgEl.textContent = 'Status: ' + (result.status_detail || result.status || 'processando…');
                msgEl.className = 'taxa-msg';
              }
            }
          });
        }).catch(function (e) {
          msgEl.textContent = e.message || 'Erro ao carregar o pagamento.';
          msgEl.className = 'taxa-msg erro';
        });
      }

      $('#taxaPagarPix').addEventListener('click', function () { abrirBrick('pix'); });
      $('#taxaPagarCredito').addEventListener('click', function () { abrirBrick('credito'); });
    }).catch(function () { el.innerHTML = ''; });
  }

  // -------------------------------------------------- sininho de avisos
  // Fica num cantinho fixo, discreto, em qualquer aba — clica pra abrir.
  // Junta agendamentos recentes (todo mundo vê) com avisos de vencimento
  // de pagamento (só o dono). "Visto" fica salvo no navegador, não no
  // banco — é só uma conveniência local, não precisa sincronizar.
  var NOTIF_SEEN_KEY = 'rafaelNotifSeen';
  function pegarVistos() {
    try { return JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]'); } catch (e) { return []; }
  }
  function marcarComoVistos(ids) {
    try {
      var vistos = pegarVistos();
      ids.forEach(function (id) { if (vistos.indexOf(id) === -1) vistos.push(id); });
      if (vistos.length > 200) vistos = vistos.slice(vistos.length - 200);
      localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify(vistos));
    } catch (e) { /* localStorage indisponível — segue sem lembrar */ }
  }

  function garantirNotifBell() {
    if ($('#notifBell')) return;
    var el = document.createElement('div');
    el.id = 'notifBell';
    el.className = 'notif-bell';
    el.innerHTML =
      '<button type="button" class="notif-btn" id="notifBtn" aria-label="Notificações">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a5 5 0 0 0-5 5v3.5c0 .7-.3 1.4-.8 1.9L5 15h14l-1.2-1.6c-.5-.5-.8-1.2-.8-1.9V8a5 5 0 0 0-5-5z"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0"/></svg>' +
      '<span class="notif-badge" id="notifBadge" hidden>0</span>' +
      '</button>' +
      '<div class="notif-panel" id="notifPanel" hidden></div>';
    document.body.appendChild(el);

    $('#notifBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var panel = $('#notifPanel');
      var estaFechado = panel.hasAttribute('hidden');
      if (estaFechado) { panel.removeAttribute('hidden'); marcarNotificacoesVistas(); }
      else panel.setAttribute('hidden', '');
    });
    document.addEventListener('click', function (e) {
      var bell = $('#notifBell');
      if (bell && !bell.contains(e.target)) bell.querySelector('.notif-panel').setAttribute('hidden', '');
    });
  }

  var ultimaNotifData = null;
  function renderNotificacoes() {
    if (!session) return;
    garantirNotifBell();
    Store.adminNotificacoes(session.token).then(function (data) {
      ultimaNotifData = data;
      var vistos = pegarVistos();
      var naoVistos = data.agendamentos.filter(function (a) { return vistos.indexOf(a.id) === -1; });
      var badgeCount = naoVistos.length + (data.avisos_pagamento ? data.avisos_pagamento.length : 0);
      var badge = $('#notifBadge');
      if (badgeCount > 0) { badge.textContent = badgeCount > 9 ? '9+' : String(badgeCount); badge.removeAttribute('hidden'); }
      else badge.setAttribute('hidden', '');

      var html = '<h4>Notificações</h4>';
      (data.avisos_pagamento || []).forEach(function (aviso) {
        html += '<div class="notif-aviso">' + esc(aviso) + '</div>';
      });
      if (!data.agendamentos.length) {
        html += '<p class="notif-empty">Nenhum agendamento novo nos últimos dias.</p>';
      } else {
        html += data.agendamentos.map(function (a) {
          return '<div class="notif-item"><strong>' + esc(a.cliente_nome) + '</strong>' +
            esc(a.servico || '') + (a.staff_nome ? ' com ' + esc(a.staff_nome) : '') + '<br>' +
            esc(a.dia_label || '') + ' às ' + esc(a.horario || '') + '</div>';
        }).join('');
      }
      $('#notifPanel').innerHTML = html;
    }).catch(function () { /* silencioso — sininho não é crítico */ });
  }

  function marcarNotificacoesVistas() {
    if (ultimaNotifData && ultimaNotifData.agendamentos) {
      marcarComoVistos(ultimaNotifData.agendamentos.map(function (a) { return a.id; }));
    }
    renderNotificacoes();
  }

  setInterval(function () { renderNotificacoes(); }, 60000);

  pinSubmit.addEventListener('click', function () {
    var val = pinInput.value.trim();
    if (val.length < 4) {
      pinError.textContent = 'Use pelo menos 4 números.';
      return;
    }
    pinSubmit.disabled = true;
    pinError.textContent = '';
    Store.login(val)
      .then(function (novaSessao) { pinSubmit.disabled = false; unlock(novaSessao); })
      .catch(function (e) {
        pinSubmit.disabled = false;
        pinError.textContent = e && e.message ? e.message : 'PIN incorreto.';
        pinInput.value = '';
        pinInput.focus();
      });
  });
  pinInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') pinSubmit.click();
  });

  // tenta restaurar sessão salva (F5 não derruba o login)
  (function tentarRestaurarSessao() {
    var salva = Store.loadSession();
    if (!salva || !salva.token) { showPinScreen(); return; }
    Store.checkSession(salva.token).then(function (valida) {
      if (valida) unlock(valida);
      else showPinScreen();
    }).catch(showPinScreen);
  })();

  // ------------------------------------------------------------- router
  var appInitialized = false;
  function initApp() {
    if (appInitialized) { renderCurrentView(); return; }
    appInitialized = true;

    $all('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $all('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
        $all('.admin-view').forEach(function (v) { v.classList.remove('active'); });
        tab.classList.add('active');
        $('#view-' + tab.dataset.view).classList.add('active');
        renderCurrentView();
      });
    });

    var lockBtn = $('#lockBtn');
    if (lockBtn) lockBtn.addEventListener('click', function () {
      var sairPraHome = function () { window.location.href = 'index.html'; };
      Store.logout(session ? session.token : null).then(sairPraHome).catch(sairPraHome);
    });

    renderCurrentView();
  }

  function activeViewName() {
    var active = $('.admin-tab.active');
    return active ? active.dataset.view : 'pdv';
  }
  function renderCurrentView() {
    var view = activeViewName();
    if (view === 'pdv') renderPDV();
    else if (view === 'agenda') renderAgenda();
    else if (view === 'dashboard') renderDashboard();
    else if (view === 'clientes') renderClientes();
    else if (view === 'servicos') renderServicos();
    else if (view === 'galeria') renderGaleria();
    else if (view === 'contrato') renderContrato();
  }

  // ----------------------------------------------------------------- PDV
  var pdvState = { barbeiroId: null, servicoId: null, modo: null, pagamentos: [], metodoAtivo: null, valorAtivo: '', clienteNome: '', clienteTelefone: '' };
  function pdvReset() {
    pdvState = { barbeiroId: null, servicoId: null, modo: null, pagamentos: [], metodoAtivo: null, valorAtivo: '', clienteNome: '', clienteTelefone: '' };
  }

  function renderPDV() {
    var container = $('#view-pdv');
    loading(container, 'Carregando profissionais e serviços…');
    Promise.all([Store.listStaff(session.token), Store.listServices()]).then(function (results) {
      pdvRenderComDados(container, results[0], results[1]);
    }).catch(function (e) { erro(container, e); });
  }

  function pdvRenderComDados(container, team, services) {
    var barbeiro = team.filter(function (t) { return t.id === pdvState.barbeiroId; })[0];
    var servico = services.filter(function (s) { return s.id === pdvState.servicoId; })[0];
    var total = servico ? Number(servico.preco) : 0;
    var pago = pdvState.pagamentos.reduce(function (s, p) { return s + p.valor; }, 0);
    var restante = Math.max(0, total - pago);

    var html = '';
    html += '<div class="admin-view-head"><p class="eyebrow">Atendimento</p><h2>Caixa PDV</h2><p>Escolha o profissional, o serviço e feche o pagamento.</p></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">1. Profissional</h3><div class="adm-pick-grid" id="pdvBarbeiros">';
    team.forEach(function (t) {
      html += '<button type="button" class="adm-pick-card' + (t.id === pdvState.barbeiroId ? ' selected' : '') + '" data-id="' + t.id + '">' +
        (t.foto_url ? '<img src="' + esc(t.foto_url) + '" alt="">' : '<span class="avatar-fallback">' + esc(t.nome.charAt(0)) + '</span>') +
        '<span>' + esc(t.nome) + '</span></button>';
    });
    html += '</div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">2. Serviço</h3><div class="adm-pick-grid" id="pdvServicos">';
    services.forEach(function (s) {
      html += '<button type="button" class="adm-pick-card' + (s.id === pdvState.servicoId ? ' selected' : '') + '" data-id="' + s.id + '">' +
        '<span>' + esc(s.nome) + '</span><span class="price">' + fmtBRL(s.preco) + '</span></button>';
    });
    html += '</div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">3. Agora ou agendado?</h3>' +
      '<div class="adm-toggle-row">' +
      '<button type="button" class="adm-toggle-btn' + (pdvState.modo === 'agora' ? ' selected' : '') + '" data-modo="agora">Já foi cortado agora</button>' +
      '<button type="button" class="adm-toggle-btn' + (pdvState.modo === 'agendar' ? ' selected' : '') + '" data-modo="agendar">Agendar pra depois</button>' +
      '</div>';
    if (pdvState.modo === 'agendar') {
      html += '<button type="button" class="adm-btn adm-btn-block" style="margin-top:1rem;" id="pdvAbrirAgenda">Abrir agenda →</button>' +
        '<p style="color:var(--adm-text-faint); font-size:0.8rem; margin-top:0.6rem;">Isso abre a mesma agenda do site — o horário fica salvo no banco pro dia certo, sem passar pelo caixa agora.</p>';
    }
    html += '</div>';

    if (pdvState.modo === 'agora') {
      html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">4. Cliente</h3>' +
        '<div class="adm-field-row"><div class="adm-field"><label for="pdvNome">Nome</label><input id="pdvNome" type="text" placeholder="Nome do cliente" value="' + esc(pdvState.clienteNome) + '"></div>' +
        '<div class="adm-field"><label for="pdvTelefone">WhatsApp</label><input id="pdvTelefone" type="tel" inputmode="tel" placeholder="(15) 90000-0000" value="' + esc(pdvState.clienteTelefone) + '"></div></div></div>';

      html += '<div class="adm-panel"><h3 style="margin-bottom:0.4rem;font-size:1.1rem;">5. Pagamento</h3>';
      if (!servico) {
        html += '<p style="color:var(--adm-text-faint); font-size:0.88rem;">Escolha um serviço acima pra liberar o pagamento.</p>';
      } else {
        html += '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin-bottom:0.8rem;">Total: <strong style="color:var(--adm-gold);">' + fmtBRL(total) + '</strong>' +
          (pago > 0 ? ' · Falta: <strong style="color:var(--adm-gold);">' + fmtBRL(restante) + '</strong>' : '') + '</p>';
        html += '<div class="adm-pay-grid">' +
          ['Crédito', 'Débito', 'Pix', 'Dinheiro'].map(function (m) {
            return '<button type="button" class="adm-pay-btn' + (pdvState.metodoAtivo === m ? ' selected' : '') + '" data-metodo="' + m + '">' + m + '</button>';
          }).join('') + '</div>';

        if (pdvState.metodoAtivo && restante > 0) {
          html += '<div class="adm-field" style="margin-top:1rem;"><label for="pdvValorPagamento">Valor recebido em ' + pdvState.metodoAtivo + '</label>' +
            '<input id="pdvValorPagamento" type="number" step="0.01" min="0" value="' + (pdvState.valorAtivo || restante.toFixed(2)) + '"></div>';
          html += '<button type="button" class="adm-btn adm-btn-block" id="pdvAddPagamento">Adicionar pagamento</button>';
        }

        if (pdvState.pagamentos.length) {
          html += '<div class="adm-split-list">';
          pdvState.pagamentos.forEach(function (p, i) {
            html += '<div class="adm-split-row"><span>' + p.metodo + '</span><span>' + fmtBRL(p.valor) + '</span><button type="button" data-remove-pag="' + i + '">×</button></div>';
          });
          html += '</div>';
        }

        if (restante <= 0 && pago > 0) {
          html += '<button type="button" class="adm-btn adm-btn-block" style="margin-top:1.2rem;" id="pdvFinalizar">Finalizar venda</button>';
        }
      }
      html += '</div>';
    }

    container.innerHTML = html;
    wirePDV(container, barbeiro, servico, total, restante);
  }

  function wirePDV(container, barbeiro, servico, total, restante) {
    $all('#pdvBarbeiros [data-id]', container).forEach(function (btn) {
      btn.addEventListener('click', function () { pdvState.barbeiroId = btn.dataset.id; renderPDV(); });
    });
    $all('#pdvServicos [data-id]', container).forEach(function (btn) {
      btn.addEventListener('click', function () { pdvState.servicoId = btn.dataset.id; renderPDV(); });
    });
    $all('.adm-toggle-btn', container).forEach(function (btn) {
      btn.addEventListener('click', function () { pdvState.modo = btn.dataset.modo; renderPDV(); });
    });
    var nomeInput = $('#pdvNome', container);
    if (nomeInput) nomeInput.addEventListener('input', function () { pdvState.clienteNome = nomeInput.value; });
    var telInput = $('#pdvTelefone', container);
    if (telInput) telInput.addEventListener('input', function () { pdvState.clienteTelefone = telInput.value; });
    var abrirAgenda = $('#pdvAbrirAgenda', container);
    if (abrirAgenda) {
      abrirAgenda.addEventListener('click', function () {
        if (window.RafaelWidget) window.RafaelWidget.open(barbeiro ? barbeiro.nome : undefined);
      });
    }
    $all('.adm-pay-btn', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        pdvState.metodoAtivo = btn.dataset.metodo;
        pdvState.valorAtivo = restante.toFixed(2);
        renderPDV();
      });
    });
    var valorInput = $('#pdvValorPagamento', container);
    if (valorInput) valorInput.addEventListener('input', function () { pdvState.valorAtivo = valorInput.value; });
    var addPag = $('#pdvAddPagamento', container);
    if (addPag) {
      addPag.addEventListener('click', function () {
        var valor = parseFloat(($('#pdvValorPagamento', container) || {}).value || '0') || 0;
        if (valor <= 0) return;
        var metodo = pdvState.metodoAtivo;
        var aplicar = Math.min(valor, restante);
        pdvState.pagamentos.push({ metodo: metodo, valor: aplicar });
        if (metodo === 'Dinheiro' && valor > restante) {
          window.setTimeout(function () { alert('Troco pra dar: ' + fmtBRL(valor - restante)); }, 10);
        }
        pdvState.metodoAtivo = null;
        pdvState.valorAtivo = '';
        renderPDV();
      });
    }
    $all('[data-remove-pag]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        pdvState.pagamentos.splice(Number(btn.dataset.removePag), 1);
        renderPDV();
      });
    });
    var finalizar = $('#pdvFinalizar', container);
    if (finalizar) {
      finalizar.addEventListener('click', function () {
        finalizar.disabled = true;
        finalizar.textContent = 'Salvando…';
        Store.addSale(session.token, {
          staffId: pdvState.barbeiroId,
          staffNome: barbeiro ? barbeiro.nome : 'Sem profissional',
          serviceId: pdvState.servicoId,
          serviceNome: servico.nome,
          valor: total,
          pagamentos: pdvState.pagamentos,
          clienteNome: pdvState.clienteNome || '',
          clienteTelefone: digitsOnly(pdvState.clienteTelefone)
        }).then(function () {
          pdvReset();
          $all('.admin-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === 'dashboard'); });
          $all('.admin-view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-dashboard'); });
          renderDashboard();
        }).catch(function (e) {
          alert('Não deu pra salvar a venda: ' + e.message);
          finalizar.disabled = false;
          finalizar.textContent = 'Finalizar venda';
        });
      });
    }
  }

  // --------------------------------------------------------------- Agenda
  // Visível pra qualquer pessoa logada (dono ou equipe) — todo mundo marca
  // e desmarca. O horário de funcionamento e o conflito de horário são
  // travados no banco (trigger), então mesmo um horário inválido escolhido
  // aqui seria recusado — isto aqui só evita o vaivém.
  function renderAgenda() {
    var container = $('#view-agenda');
    loading(container, 'Carregando a agenda…');
    Promise.all([
      Store.listAppointments(session.token),
      Store.listStaff(session.token),
      Store.listServices()
    ]).then(function (results) {
      agendaRenderComDados(container, results[0], results[1], results[2]);
    }).catch(function (e) { erro(container, e); });
  }

  function agendaRenderComDados(container, appointments, team, services) {
    var hojeIso = new Date().toISOString().slice(0, 10);
    var futuros = appointments
      .filter(function (a) { return a.status !== 'cancelado' && a.dia >= hojeIso; })
      .sort(function (a, b) { return (a.dia + a.horario).localeCompare(b.dia + b.horario); });

    // Estado local do formulário "+ Novo agendamento" — refeito do zero toda
    // vez que a Agenda é renderizada (mesma vida útil que os <select> tinham
    // antes), só que agora com caixinhas clicáveis em vez de <select>, pra
    // combinar com o resto do admin (Caixa PDV já usa esse padrão).
    var agFormState = { staffId: null, staffNome: '', servico: null, dia: '', horario: null, cliNome: '', cliTel: '', slots: [], slotsLoading: false };

    var html = '<div class="admin-view-head"><p class="eyebrow">Marcações</p><h2>Agenda</h2><p>Agendamentos feitos pelo site e marcados no balcão — qualquer pessoa da equipe pode marcar ou desmarcar.</p></div>';

    html += '<div class="adm-panel" id="agNovoPanel"></div>';

    html += '<div class="adm-panel" style="margin-top:1.2rem;"><h3 style="margin-bottom:0.6rem;font-size:1.1rem;">Próximos agendamentos</h3>';
    if (!futuros.length) {
      html += '<p style="color:var(--adm-text-faint); font-size:0.88rem;">Nenhum agendamento futuro ainda.</p></div>';
    } else {
      html += '<div class="adm-hist-list">';
      futuros.forEach(function (a) {
        html += '<div class="adm-hist-row"><div><div class="adm-hist-main">' +
          esc(a.dia_label || a.dia) + ' às ' + esc(a.horario) + ' — ' + esc(a.cliente_nome) + '</div>' +
          '<div class="adm-hist-sub">' + esc(a.servico || '') + ' · ' + esc(a.staff_nome || 'sem profissional') + ' · <span style="color:var(--adm-gold);">' + esc(a.status) + '</span></div></div>' +
          '<div style="display:flex; gap:0.4rem;">' +
          (a.status === 'pendente' ? '<button type="button" class="adm-btn adm-btn-sm" data-confirm-appt="' + a.id + '">Confirmar</button>' : '') +
          '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-cancel-appt="' + a.id + '">Desmarcar</button>' +
          '</div></div>';
      });
      html += '</div></div>';
    }

    container.innerHTML = html;

    $all('[data-confirm-appt]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.updateAppointmentStatus(session.token, btn.dataset.confirmAppt, 'confirmado').then(renderAgenda).catch(function (e) { alert(e.message); });
      });
    });
    $all('[data-cancel-appt]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Desmarcar esse agendamento?')) {
          Store.updateAppointmentStatus(session.token, btn.dataset.cancelAppt, 'cancelado').then(renderAgenda).catch(function (e) { alert(e.message); });
        }
      });
    });

    renderAgNovoPanel();

    function renderAgNovoPanel() {
      var panel = $('#agNovoPanel', container);

      var novoHtml = '<h3 style="margin-bottom:0.8rem;font-size:1.1rem;">+ Novo agendamento</h3>' +
        '<div class="adm-field-row"><div class="adm-field"><label>Nome do cliente</label><input id="agCliNome" type="text" placeholder="Nome do cliente" value="' + esc(agFormState.cliNome) + '"></div>' +
        '<div class="adm-field"><label>WhatsApp</label><input id="agCliTel" type="tel" inputmode="tel" placeholder="(15) 90000-0000" value="' + esc(agFormState.cliTel) + '"></div></div>';

      novoHtml += '<div class="adm-field"><label>Profissional</label><div class="adm-pick-grid">' +
        '<button type="button" class="adm-pick-card' + (!agFormState.staffId ? ' selected' : '') + '" data-staff-pick="">' +
        '<span class="avatar-fallback">—</span><span>Sem preferência</span></button>' +
        team.map(function (t) {
          return '<button type="button" class="adm-pick-card' + (agFormState.staffId === t.id ? ' selected' : '') + '" data-staff-pick="' + t.id + '" data-staff-nome="' + esc(t.nome) + '">' +
            (t.foto_url ? '<img src="' + esc(t.foto_url) + '" alt="">' : '<span class="avatar-fallback">' + esc(t.nome.charAt(0)) + '</span>') +
            '<span>' + esc(t.nome) + '</span></button>';
        }).join('') +
        '</div></div>';

      novoHtml += '<div class="adm-field"><label>Serviço <span style="text-transform:none; opacity:0.7;">(opcional)</span></label><div class="adm-pick-grid">' +
        services.map(function (s) {
          return '<button type="button" class="adm-pick-card' + (agFormState.servico === s.nome ? ' selected' : '') + '" data-servico-pick="' + esc(s.nome) + '">' +
            '<span>' + esc(s.nome) + '</span><span class="price">' + fmtBRL(s.preco) + '</span></button>';
        }).join('') +
        '</div></div>';

      novoHtml += '<div class="adm-field"><label>Dia</label><input id="agDia" type="date" min="' + hojeIso + '" value="' + esc(agFormState.dia) + '"></div>';

      novoHtml += '<div class="adm-field"><label>Horário</label>';
      if (!agFormState.dia) {
        novoHtml += '<p style="color:var(--adm-text-faint); font-size:0.85rem; margin:0;">Escolha o dia primeiro.</p>';
      } else if (agFormState.slotsLoading) {
        novoHtml += '<p style="color:var(--adm-text-faint); font-size:0.85rem; margin:0;">Carregando horários…</p>';
      } else if (!agFormState.slots.length) {
        novoHtml += '<p style="color:var(--adm-text-faint); font-size:0.85rem; margin:0;">Fechado nesse dia.</p>';
      } else {
        novoHtml += '<div class="adm-slot-grid">' + agFormState.slots.map(function (s) {
          return '<button type="button" class="adm-slot-btn' + (agFormState.horario === s.horario ? ' selected' : '') + (s.disponivel ? '' : ' disabled') + '"' +
            (s.disponivel ? ' data-slot-pick="' + s.horario + '"' : ' disabled title="Já ocupado"') + '>' + s.horario + '</button>';
        }).join('') + '</div>';
      }
      novoHtml += '</div>';

      novoHtml += '<button type="button" class="adm-btn adm-btn-block" id="agSalvar">Marcar</button>' +
        '<p id="agMsg" style="margin-top:0.6rem;font-size:0.82rem;"></p>';

      panel.innerHTML = novoHtml;

      $('#agCliNome', panel).addEventListener('input', function (e) { agFormState.cliNome = e.target.value; });
      $('#agCliTel', panel).addEventListener('input', function (e) { agFormState.cliTel = e.target.value; });

      $all('[data-staff-pick]', panel).forEach(function (btn) {
        btn.addEventListener('click', function () {
          agFormState.staffId = btn.dataset.staffPick || null;
          agFormState.staffNome = btn.dataset.staffNome || '';
          agFormState.horario = null;
          if (agFormState.dia) carregarSlots(); else renderAgNovoPanel();
        });
      });

      $all('[data-servico-pick]', panel).forEach(function (btn) {
        btn.addEventListener('click', function () {
          agFormState.servico = agFormState.servico === btn.dataset.servicoPick ? null : btn.dataset.servicoPick;
          renderAgNovoPanel();
        });
      });

      var diaInput = $('#agDia', panel);
      diaInput.addEventListener('change', function () {
        agFormState.dia = diaInput.value;
        agFormState.horario = null;
        if (agFormState.dia) carregarSlots(); else { agFormState.slots = []; renderAgNovoPanel(); }
      });

      $all('[data-slot-pick]', panel).forEach(function (btn) {
        btn.addEventListener('click', function () { agFormState.horario = btn.dataset.slotPick; renderAgNovoPanel(); });
      });

      $('#agSalvar', panel).addEventListener('click', function () {
        var msg = $('#agMsg', panel);
        var cliNome = agFormState.cliNome.trim();
        var cliTel = agFormState.cliTel.trim();
        if (!cliNome || !cliTel || !agFormState.dia || !agFormState.horario) {
          msg.style.color = 'var(--adm-danger)';
          msg.textContent = 'Preencha nome, WhatsApp, dia e horário.';
          return;
        }
        msg.textContent = '';
        Store.createAppointment({
          clienteNome: cliNome, clienteTelefone: cliTel,
          staffId: agFormState.staffId || null,
          staffNome: agFormState.staffId ? agFormState.staffNome : null,
          servico: agFormState.servico || null,
          dia: agFormState.dia, diaLabel: fmtDayBR(agFormState.dia), horario: agFormState.horario
        }).then(renderAgenda).catch(function (e) {
          msg.style.color = 'var(--adm-danger)';
          msg.textContent = e.message;
        });
      });
    }

    function carregarSlots() {
      agFormState.slotsLoading = true;
      renderAgNovoPanel();
      Store.agendaSlots(agFormState.dia, agFormState.staffId || null).then(function (slots) {
        agFormState.slots = slots;
        agFormState.slotsLoading = false;
        renderAgNovoPanel();
      }).catch(function () {
        agFormState.slots = [];
        agFormState.slotsLoading = false;
        renderAgNovoPanel();
      });
    }
  }

  // ----------------------------------------------------------- Dashboard
  function renderDashboard() {
    var container = $('#view-dashboard');
    loading(container, 'Calculando o mês…');
    Promise.all([
      Store.dashboardStats(session.token),
      Store.listClients(session.token).catch(function () { return []; })
    ]).then(function (results) {
      dashboardRenderComDados(container, results[0], results[1]);
    }).catch(function (e) { erro(container, e); });
  }

  function dashboardRenderComDados(container, stats, clientes) {
    var html = '';
    html += '<div class="admin-view-head"><p class="eyebrow">Visão geral</p><h2>Dashboard</h2><p>Números deste mês, direto do que passou pelo Caixa PDV.</p></div>';

    html += '<div class="adm-stat-grid">' +
      '<div class="adm-stat-tile"><div class="label">Cortes no mês</div><div class="value">' + stats.cortesMes + '</div></div>' +
      '<div class="adm-stat-tile"><div class="label">Ganhos no mês</div><div class="value">' + fmtBRL(stats.ganhosMes) + '</div></div>' +
      '<div class="adm-stat-tile"><div class="label">Ticket médio</div><div class="value">' + fmtBRL(stats.ticketMedio) + '</div></div>' +
      '</div>';

    html += '<div class="adm-panel" style="margin-top:1.2rem;"><h3 style="margin-bottom:0.6rem;font-size:1.1rem;">Quem cortou este mês</h3><div id="chartBarbeiro"></div></div>';
    html += '<div class="adm-panel"><h3 style="margin-bottom:0.6rem;font-size:1.1rem;">Ganhos por dia</h3><div id="chartGanhos"></div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.4rem;font-size:1.1rem;">Histórico de cortes</h3>';
    if (!stats.historico.length) {
      html += '<p style="color:var(--adm-text-faint); font-size:0.88rem;">Nenhuma venda registrada ainda.</p>';
    } else {
      html += '<div class="adm-hist-list">';
      stats.historico.forEach(function (s) {
        html += '<div class="adm-hist-row"><div><div class="adm-hist-main">' + esc(s.service_nome) + (s.cliente_nome ? ' — ' + esc(s.cliente_nome) : '') + '</div>' +
          '<div class="adm-hist-sub">' + esc(s.staff_nome) + ' · ' + fmtDateBR(s.created_at) + '</div></div>' +
          '<div class="adm-hist-value">' + fmtBRL(s.valor) + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.4rem;font-size:1.1rem;">Clientes</h3>';
    if (!clientes || !clientes.length) {
      html += '<p style="color:var(--adm-text-faint); font-size:0.88rem;">Nenhum cliente ainda.</p>';
    } else {
      html += '<div class="adm-hist-list">';
      clientes.slice(0, 12).forEach(function (c) {
        html += '<button type="button" class="adm-hist-row" style="width:100%; text-align:left; background:none; border:none; cursor:pointer; font-family:inherit;" data-ver-perfil-dash="' + esc(c.telefone) + '">' +
          '<div><div class="adm-hist-main">' + esc(c.nome || c.telefone) + '</div>' +
          '<div class="adm-hist-sub">' + c.total_cortes + ' corte(s)' + (c.tem_agendamento ? ' · <span style="color:var(--adm-gold);">tem agendamento</span>' : '') + '</div></div>' +
          '<div class="adm-hist-value" style="color:var(--adm-text-faint); font-size:0.8rem;">Ver perfil →</div>' +
          '</button>';
      });
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    $all('[data-ver-perfil-dash]', container).forEach(function (btn) {
      btn.addEventListener('click', function () { abrirPerfilCliente(btn.dataset.verPerfilDash); });
    });

    var porBarbeiroData = Object.keys(stats.porBarbeiro || {}).map(function (k) { return { label: k, value: stats.porBarbeiro[k] }; });
    window.RafaelCharts.barChart($('#chartBarbeiro'), {
      data: porBarbeiroData, height: 130, ariaLabel: 'Cortes por profissional este mês',
      labelHeader: 'Profissional', valueHeader: 'Cortes', valueFormatter: function (v) { return v + (v === 1 ? ' corte' : ' cortes'); }
    });

    var porDiaKeys = Object.keys(stats.porDia || {}).sort();
    var porDiaData = porDiaKeys.map(function (k) { return { label: fmtDayBR(k), value: stats.porDia[k], color: '#B08D2F' }; });
    window.RafaelCharts.barChart($('#chartGanhos'), {
      data: porDiaData, height: 130, ariaLabel: 'Ganhos por dia este mês',
      labelHeader: 'Dia', valueHeader: 'Ganhos', valueFormatter: fmtBRL
    });
  }

  // ------------------------------------------------------------ Clientes
  function renderClientes() {
    var container = $('#view-clientes');
    loading(container, 'Montando a base de clientes…');
    Store.listClients(session.token).then(function (clientes) {
      if (!clientes.length) {
        container.innerHTML = '<div class="admin-view-head"><p class="eyebrow">Base de clientes</p><h2>Clientes</h2><p>Captado assim que a pessoa preenche o telefone na agenda do site, ou registra uma venda no Caixa.</p></div>' +
          '<div class="adm-panel"><p style="color:var(--adm-text-faint); font-size:0.9rem;">Nenhum cliente ainda.</p></div>';
        return;
      }
      Promise.all(clientes.map(function (c) { return Store.listClientFeedback(session.token, c.telefone).catch(function () { return []; }); }))
        .then(function (feedbacks) {
          clientesRenderComDados(container, clientes, feedbacks);
        });
    }).catch(function (e) { erro(container, e); });
  }

  function clientesRenderComDados(container, clientes, feedbacks) {
    var html = '<div class="admin-view-head"><p class="eyebrow">Base de clientes</p><h2>Clientes</h2><p>Captado assim que a pessoa preenche o telefone na agenda do site, ou registra uma venda no Caixa.</p></div>';
    html += '<div class="adm-client-grid">';
    clientes.forEach(function (c, i) {
      var fb = feedbacks[i] || [];
      var ultimoFeedback = fb.length ? fb[fb.length - 1] : null;
      html += '<div class="adm-client-card">' +
        '<div class="adm-client-head">' +
        '<div><div class="adm-client-name">' + esc(c.nome || 'Sem nome') + '</div><div class="adm-client-phone">' + esc(c.telefone) + '</div></div>' +
        '<a class="adm-whatsapp-btn" target="_blank" rel="noopener" href="' + waLink(c.telefone) + '" aria-label="Abrir WhatsApp com ' + esc(c.nome || c.telefone) + '">' + WHATSAPP_ICON + '</a>' +
        '</div>' +
        (c.tem_agendamento ? '<p style="color:var(--adm-gold); font-size:0.78rem; margin-top:0.3rem;">● Tem agendamento marcado</p>' : '') +
        '<div class="adm-client-stats">' +
        '<div><strong>' + c.total_cortes + '</strong><span>Total de cortes</span></div>' +
        '<div><strong>' + c.cortes_este_mes + '</strong><span>Este mês</span></div>' +
        '<div><strong>' + (c.acessos || 0) + '</strong><span>Acessos à agenda</span></div>' +
        '</div>' +
        (c.profissional_preferido ? '<p style="color:var(--adm-text-soft); font-size:0.82rem; margin-top:0.5rem;">Prefere: <strong style="color:var(--adm-off-white);">' + esc(c.profissional_preferido) + '</strong></p>' : '') +
        (ultimoFeedback ? '<p class="adm-client-feedback">"' + esc(ultimoFeedback.comentario) + '"</p>' : '<p class="adm-client-feedback-empty">Sem feedback do cliente ainda.</p>') +
        '<form class="adm-feedback-form" data-telefone="' + esc(c.telefone) + '">' +
        '<input type="text" placeholder="Anotar feedback (opcional)">' +
        '<button type="submit" class="adm-btn adm-btn-sm">+</button>' +
        '</form>' +
        '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" style="margin-top:0.8rem; width:100%;" data-ver-perfil="' + esc(c.telefone) + '">Ver perfil completo →</button>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    $all('.adm-feedback-form', container).forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input');
        if (!input.value.trim()) return;
        Store.addStaffFeedback(session.token, form.dataset.telefone, input.value.trim())
          .then(renderClientes)
          .catch(function (err) { alert('Não deu pra salvar: ' + err.message); });
      });
    });
    $all('[data-ver-perfil]', container).forEach(function (btn) {
      btn.addEventListener('click', function () { abrirPerfilCliente(btn.dataset.verPerfil); });
    });
  }

  function abrirPerfilCliente(telefone) {
    Store.clientProfile(session.token, telefone).then(function (perfil) {
      openModal(renderClientProfile(perfil));
    }).catch(function (e) { alert('Não deu pra carregar o perfil: ' + e.message); });
  }

  function renderClientProfile(perfil) {
    var wrap = document.createElement('div');
    var porProfissional = {};
    (perfil.vendas || []).forEach(function (v) {
      var nome = v.profissional || 'Sem profissional';
      porProfissional[nome] = (porProfissional[nome] || 0) + 1;
    });
    var linhasProfissional = Object.keys(porProfissional).map(function (nome) {
      return '<div class="adm-hist-row"><div class="adm-hist-main">' + esc(nome) + '</div><div class="adm-hist-value">' + porProfissional[nome] + ' corte(s)</div></div>';
    }).join('') || '<p style="color:var(--adm-text-faint); font-size:0.85rem;">Nenhum corte registrado ainda.</p>';

    var agendamentosFuturos = (perfil.agendamentos || []).filter(function (a) { return a.status !== 'cancelado' && a.dia >= new Date().toISOString().slice(0, 10); });
    var linhasAgendamentos = (perfil.agendamentos || []).map(function (a) {
      return '<div class="adm-hist-row"><div><div class="adm-hist-main">' + esc(a.dia) + ' às ' + esc(a.horario) + '</div>' +
        '<div class="adm-hist-sub">' + esc(a.servico || '') + ' · ' + esc(a.profissional || 'sem profissional') + ' · <span style="color:var(--adm-gold);">' + esc(a.status) + '</span></div></div></div>';
    }).join('') || '<p style="color:var(--adm-text-faint); font-size:0.85rem;">Nenhum agendamento ainda.</p>';

    var linhasVendas = (perfil.vendas || []).map(function (v) {
      return '<div class="adm-hist-row"><div><div class="adm-hist-main">' + esc(v.servico || '') + '</div>' +
        '<div class="adm-hist-sub">' + esc(v.profissional || '') + ' · ' + fmtDateBR(v.data) + '</div></div>' +
        '<div class="adm-hist-value">' + fmtBRL(v.valor) + '</div></div>';
    }).join('') || '<p style="color:var(--adm-text-faint); font-size:0.85rem;">Nenhuma venda registrada ainda.</p>';

    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>' + esc(perfil.nome || 'Sem nome') + '</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin-bottom:1rem;">' + esc(perfil.telefone) +
      (agendamentosFuturos.length ? ' · <span style="color:var(--adm-gold);">tem agendamento marcado</span>' : '') + '</p>' +
      '<h4 style="font-size:0.95rem; margin-bottom:0.5rem;">Cortes por profissional</h4><div class="adm-hist-list">' + linhasProfissional + '</div>' +
      '<h4 style="font-size:0.95rem; margin:1.2rem 0 0.5rem;">Agendamentos</h4><div class="adm-hist-list">' + linhasAgendamentos + '</div>' +
      '<h4 style="font-size:0.95rem; margin:1.2rem 0 0.5rem;">Histórico de vendas</h4><div class="adm-hist-list">' + linhasVendas + '</div>';
    return wrap;
  }

  // ----------------------------------------------------- Serviços e Valores
  function renderServicos() {
    var container = $('#view-servicos');
    loading(container, 'Carregando serviços e equipe…');
    Promise.all([Store.listServices(), Store.listStaff(session.token), Store.listProducts()]).then(function (results) {
      servicosRenderComDados(container, results[0], results[1], results[2]);
    }).catch(function (e) { erro(container, e); });
  }

  function servicosRenderComDados(container, services, team, products) {
    var html = '<div class="admin-view-head"><p class="eyebrow">Gestão</p><h2>Serviços e Valores</h2><p>Preços da casa e quem faz parte da equipe.</p></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.6rem;font-size:1.15rem;">Serviços</h3>';
    var CATEGORIA_LABEL = { masculino: 'Masculino', feminino: 'Feminino', unissex: 'Unissex' };
    services.forEach(function (s) {
      html += '<div class="adm-service-row"><span class="adm-service-name">' + esc(s.nome) +
        ' <span style="color:var(--adm-text-faint); font-size:0.72rem;">· ' + (CATEGORIA_LABEL[s.categoria] || 'Unissex') + '</span></span>' +
        '<span class="adm-service-price">' + fmtBRL(s.preco) + '</span>' +
        '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-edit-service="' + s.id + '">Editar</button>' +
        '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-remove-service="' + s.id + '">Remover</button></div>';
    });
    html += '<button type="button" class="adm-btn" style="margin-top:1rem;" id="addServiceBtn">+ Adicionar serviço</button></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.6rem;font-size:1.15rem;">Produtos (catálogo do site)</h3>';
    products.forEach(function (p) {
      html += '<div class="adm-service-row"><span class="adm-service-name">' + esc(p.nome) + '</span>' +
        '<span class="adm-service-price">' + fmtBRL(p.preco) + '</span>' +
        '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-edit-product="' + p.id + '">Editar</button>' +
        '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-remove-product="' + p.id + '">Remover</button></div>';
    });
    html += '<button type="button" class="adm-btn" style="margin-top:1rem;" id="addProductBtn">+ Adicionar produto</button></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.15rem;">Equipe</h3><div class="adm-team-grid">';
    team.forEach(function (t) {
      html += '<div class="adm-team-card">' +
        (t.foto_url ? '<img class="adm-team-photo" src="' + esc(t.foto_url) + '" alt="">' : '<div class="adm-team-photo-fallback">' + esc(t.nome.charAt(0)) + '</div>') +
        '<div class="adm-team-name">' + esc(t.nome) + (t.role === 'owner' ? ' <span style="color:var(--adm-gold); font-size:0.7rem;">· DONO</span>' : '') + '</div>' +
        '<div class="adm-team-role">' + esc(t.especialidade || '') + '</div>' +
        '<div class="adm-photo-actions">' +
        '<label class="adm-photo-upload" title="Trocar foto">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' +
        '<input type="file" accept="image/*" data-team-photo="' + t.id + '"></label>' +
        (t.foto_url ? '<button type="button" class="adm-photo-remove" data-remove-team-photo="' + t.id + '" title="Remover foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' : '') +
        '</div>' +
        '<div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap; justify-content:center;">' +
        '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-edit-team="' + t.id + '">Editar especialidade</button>' +
        (t.role === 'owner' ? '' : '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-remove-team="' + t.id + '">Remover</button>') +
        '</div>' +
        '</div>';
    });
    html += '</div><button type="button" class="adm-btn" style="margin-top:1rem;" id="addTeamBtn">+ Adicionar profissional</button>' +
      '<p style="color:var(--adm-text-faint); font-size:0.8rem; margin-top:0.6rem;">Você (dono) escolhe o PIN de cada pessoa aqui. A equipe usa esse PIN pra abrir o Caixa PDV, Clientes e Galeria — sem acesso ao Dashboard nem aqui em Serviços e Valores.</p>' +
      '</div>';

    container.innerHTML = html;
    wireServicos(container, team);
  }

  function wireServicos(container, team) {
    $all('[data-remove-service]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover este serviço?')) {
          Store.removeService(session.token, btn.dataset.removeService).then(renderServicos).catch(function (e) { alert(e.message); });
        }
      });
    });
    $all('[data-edit-service]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var svc = null;
        Store.listServices().then(function (services) {
          svc = services.filter(function (s) { return s.id === btn.dataset.editService; })[0];
          openModal(renderServiceForm(svc));
        });
      });
    });
    $('#addServiceBtn', container).addEventListener('click', function () { openModal(renderServiceForm(null)); });

    $all('[data-remove-product]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover este produto do catálogo?')) {
          Store.removeProduct(session.token, btn.dataset.removeProduct).then(renderServicos).catch(function (e) { alert(e.message); });
        }
      });
    });
    $all('[data-edit-product]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        Store.listProducts().then(function (products) {
          var prod = products.filter(function (p) { return p.id === btn.dataset.editProduct; })[0];
          openModal(renderProductForm(prod));
        });
      });
    });
    $('#addProductBtn', container).addEventListener('click', function () { openModal(renderProductForm(null)); });

    $all('[data-remove-team]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover este profissional da equipe? O PIN dele para de funcionar.')) {
          Store.removeStaff(session.token, btn.dataset.removeTeam).then(renderServicos).catch(function (e) { alert(e.message); });
        }
      });
    });
    $all('[data-edit-team]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = team.filter(function (x) { return x.id === btn.dataset.editTeam; })[0];
        if (t) openModal(renderTeamEspecialidadeForm(t));
      });
    });
    $('#addTeamBtn', container).addEventListener('click', function () { openModal(renderTeamForm()); });
    $all('[data-team-photo]', container).forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        Store.uploadPhoto(file, 'equipe', 400, 0.85)
          .then(function (url) { return Store.updateStaffPhoto(session.token, input.dataset.teamPhoto, url); })
          .then(renderServicos)
          .catch(function (e) { alert('Não deu pra trocar a foto: ' + e.message); });
      });
    });
    $all('[data-remove-team-photo]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover a foto de perfil desse profissional?')) {
          Store.updateStaffPhoto(session.token, btn.dataset.removeTeamPhoto, null).then(renderServicos).catch(function (e) { alert(e.message); });
        }
      });
    });
  }

  function renderServiceForm(service) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>' + (service ? 'Editar serviço' : 'Novo serviço') + '</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>Nome</label><input id="svcNome" type="text" value="' + (service ? esc(service.nome) : '') + '"></div>' +
      '<div class="adm-field"><label>Preço (R$)</label><input id="svcPreco" type="number" step="0.01" min="0" value="' + (service ? service.preco : '') + '"></div>' +
      '<div class="adm-field"><label>Aparece na agenda de</label><select id="svcCategoria">' +
      '<option value="unissex"' + (!service || service.categoria === 'unissex' ? ' selected' : '') + '>Unissex (as duas)</option>' +
      '<option value="masculino"' + (service && service.categoria === 'masculino' ? ' selected' : '') + '>Só masculino</option>' +
      '<option value="feminino"' + (service && service.categoria === 'feminino' ? ' selected' : '') + '>Só feminino</option>' +
      '</select></div>' +
      '<button type="button" class="adm-btn adm-btn-block" id="svcSalvar">Salvar</button>';
    wrap.querySelector('#svcSalvar').addEventListener('click', function () {
      var nome = wrap.querySelector('#svcNome').value.trim();
      var preco = parseFloat(wrap.querySelector('#svcPreco').value) || 0;
      var categoria = wrap.querySelector('#svcCategoria').value;
      if (!nome) return;
      var acao = service ? Store.updateService(session.token, service.id, nome, preco, categoria) : Store.addService(session.token, nome, preco, categoria);
      acao.then(function () { closeModal(); renderServicos(); }).catch(function (e) { alert(e.message); });
    });
    return wrap;
  }

  function renderProductForm(product) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>' + (product ? 'Editar produto' : 'Novo produto') + '</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>Nome</label><input id="prdNome" type="text" value="' + (product ? esc(product.nome) : '') + '"></div>' +
      '<div class="adm-field"><label>Descrição (opcional)</label><input id="prdDescricao" type="text" value="' + (product ? esc(product.descricao || '') : '') + '"></div>' +
      '<div class="adm-field"><label>Preço (R$)</label><input id="prdPreco" type="number" step="0.01" min="0" value="' + (product ? product.preco : '') + '"></div>' +
      '<div class="adm-field"><label>Foto (opcional)</label>' +
      '<label class="adm-photo-picker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' +
      '<span id="prdFotoNome">Escolher foto</span><input id="prdFoto" type="file" accept="image/*"></label></div>' +
      '<button type="button" class="adm-btn adm-btn-block" id="prdSalvar">Salvar</button>';
    wrap.querySelector('#prdFoto').addEventListener('change', function (e) {
      wrap.querySelector('#prdFotoNome').textContent = e.target.files[0] ? e.target.files[0].name : 'Escolher foto';
    });
    wrap.querySelector('#prdSalvar').addEventListener('click', function () {
      var nome = wrap.querySelector('#prdNome').value.trim();
      var descricao = wrap.querySelector('#prdDescricao').value.trim();
      var preco = parseFloat(wrap.querySelector('#prdPreco').value) || 0;
      var file = wrap.querySelector('#prdFoto').files[0];
      if (!nome) return;
      var salvar = function (fotoUrl) {
        var acao = product
          ? Store.updateProduct(session.token, product.id, nome, descricao, preco, fotoUrl)
          : Store.addProduct(session.token, nome, descricao, preco, fotoUrl);
        acao.then(function () { closeModal(); renderServicos(); }).catch(function (e) { alert(e.message); });
      };
      if (file) {
        Store.uploadPhoto(file, 'produtos', 700, 0.82).then(salvar).catch(function (e) { alert('Não deu pra subir a foto: ' + e.message); });
      } else {
        salvar(null);
      }
    });
    return wrap;
  }

  function renderTeamForm() {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>Novo profissional</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>Nome</label><input id="teamNome" type="text"></div>' +
      '<div class="adm-field"><label>Especialidade</label><input id="teamEsp" type="text" placeholder="Ex: Barbeiro · Colorista"></div>' +
      '<div class="adm-field"><label>PIN de acesso (mínimo 4 números)</label><input id="teamPin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Ex: 1234"></div>' +
      '<div class="adm-field"><label>Foto (opcional)</label>' +
      '<label class="adm-photo-picker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' +
      '<span id="teamFotoNome">Escolher foto</span><input id="teamFoto" type="file" accept="image/*"></label></div>' +
      '<p style="color:var(--adm-text-faint); font-size:0.8rem; margin:-0.4rem 0 1rem;">Esse PIN abre o Caixa PDV, Clientes e Galeria pra essa pessoa — sem acesso ao Dashboard nem a Serviços e Valores.</p>' +
      '<button type="button" class="adm-btn adm-btn-block" id="teamSalvar">Salvar</button>' +
      '<p class="admin-pin-error" id="teamFormError" style="margin-top:0.8rem;"></p>';
    wrap.querySelector('#teamFoto').addEventListener('change', function (e) {
      wrap.querySelector('#teamFotoNome').textContent = e.target.files[0] ? e.target.files[0].name : 'Escolher foto';
    });
    wrap.querySelector('#teamSalvar').addEventListener('click', function () {
      var nome = wrap.querySelector('#teamNome').value.trim();
      var esp = wrap.querySelector('#teamEsp').value.trim();
      var pin = wrap.querySelector('#teamPin').value.trim();
      var errBox = wrap.querySelector('#teamFormError');
      if (!nome || !pin) { errBox.textContent = 'Preencha nome e PIN.'; return; }
      var file = wrap.querySelector('#teamFoto').files[0];
      var salvarBtn = wrap.querySelector('#teamSalvar');
      salvarBtn.disabled = true;
      function salvar(fotoUrl) {
        Store.addStaff(session.token, nome, esp, pin, 'staff', fotoUrl || null)
          .then(function () { closeModal(); renderServicos(); })
          .catch(function (e) { errBox.textContent = e.message; salvarBtn.disabled = false; });
      }
      if (file) Store.uploadPhoto(file, 'equipe', 400, 0.85).then(salvar).catch(function (e) { errBox.textContent = e.message; salvarBtn.disabled = false; });
      else salvar(null);
    });
    return wrap;
  }

  // Edição fica só nesse campo mesmo — trocar nome ou PIN exigiria
  // reabrir o painel pra pessoa de novo, então não vale a complexidade.
  function renderTeamEspecialidadeForm(t) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>Editar especialidade</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>' + esc(t.nome) + '</label><input id="teamEspEdit" type="text" value="' + esc(t.especialidade || '') + '" placeholder="Ex: Barbeiro · Colorista"></div>' +
      '<button type="button" class="adm-btn adm-btn-block" id="teamEspSalvar">Salvar</button>' +
      '<p class="admin-pin-error" id="teamEspFormError" style="margin-top:0.8rem;"></p>';
    wrap.querySelector('#teamEspSalvar').addEventListener('click', function () {
      var esp = wrap.querySelector('#teamEspEdit').value.trim();
      var errBox = wrap.querySelector('#teamEspFormError');
      var salvarBtn = wrap.querySelector('#teamEspSalvar');
      salvarBtn.disabled = true;
      Store.updateStaffEspecialidade(session.token, t.id, esp)
        .then(function () { closeModal(); renderServicos(); })
        .catch(function (e) { errBox.textContent = e.message; salvarBtn.disabled = false; });
    });
    return wrap;
  }

  // ------------------------------------------------------------- Galeria
  var IG_HANDLE = '@rafael_cabeleireiros';
  var IG_URL = 'https://www.instagram.com/rafael_cabeleireiros';

  // -------------------------------------------------------------- Contrato
  var MP_ASSINATURA_URL = 'https://fwxwhndjgzwipgpzbnzr.supabase.co/functions/v1/mp-criar-assinatura';
  var MP_PAGAMENTO_URL = 'https://fwxwhndjgzwipgpzbnzr.supabase.co/functions/v1/mp-processar-pagamento';
  function renderContrato() {
    var container = $('#view-contrato');
    loading(container, 'Carregando o contrato…');
    Store.minhaAssinatura(session.token).then(function (info) {
      contratoRenderComDados(container, info);
    }).catch(function (e) { erro(container, e); });
  }

  function contratoRenderComDados(container, info) {
    var corStatus = info.status === 'em_dia' ? 'var(--adm-gold)' : info.status === 'atrasado' ? '#E0A84A' : 'var(--adm-danger)';
    var html = '<div class="admin-view-head"><p class="eyebrow">Contrato</p><h2>Assinatura do sistema</h2>' +
      '<p>Mensalidade de manutenção — cadastre um cartão pra cobrança automática todo ciclo, ou gere um Pix avulso quando preferir. Tudo sem sair dessa tela.</p></div>' +
      '<div class="adm-panel">' +
      '<h3 style="font-size:1.2rem;">Situação atual</h3>' +
      '<p style="color:var(--adm-text-soft); margin-top:0.4rem;">Plano ' + esc(info.plano) + ' · ' + fmtBRL(info.valor) + ' · vencimento ' + fmtDayBR(info.vencimento) + '</p>' +
      '<p style="margin-top:0.3rem; color:' + corStatus + ';">● ' + esc(info.status).toUpperCase() + '</p>' +
      (info.mp_last_status ? '<p style="font-size:0.82rem; margin-top:0.3rem; color:var(--adm-text-faint);">Mercado Pago: ' + esc(info.mp_last_status) + '</p>' : '') +
      '</div>' +
      '<div class="adm-panel">' +
      '<h3 style="font-size:1.2rem;">Cadastrar cartão (cobrança automática)</h3>' +
      '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin:0.4rem 0 0.9rem;">O cartão fica registrado no Mercado Pago e a mensalidade é cobrada sozinha todo ciclo, sem precisar fazer nada.</p>' +
      '<div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.9rem;">' +
      '<button type="button" class="adm-btn adm-btn-sm" data-contrato-plano="mensal">Mensal — R$ 149</button>' +
      '<button type="button" class="adm-btn adm-btn-sm adm-btn-ghost" data-contrato-plano="anual">Anual — R$ 1.390</button>' +
      '</div>' +
      '<div id="contratoCartaoBrick"></div>' +
      '<p class="taxa-msg" id="contratoMsg"></p>' +
      '</div>' +
      '<div class="adm-panel">' +
      '<h3 style="font-size:1.2rem;">Ou gerar Pix desse ciclo</h3>' +
      '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin:0.4rem 0 0.9rem;">Cobrança avulsa de ' + fmtBRL(info.valor) + ' — não fica cartão cadastrado, precisa gerar de novo no próximo ciclo.</p>' +
      '<button type="button" class="adm-btn adm-btn-sm adm-btn-ghost" id="contratoGerarPix">Gerar Pix (' + fmtBRL(info.valor) + ')</button>' +
      '<div id="contratoPixBrick" style="margin-top:1rem;"></div>' +
      '<p class="taxa-msg" id="contratoPixMsg"></p>' +
      '</div>';
    container.innerHTML = html;

    var planoEscolhido = null;
    var botoesPlano = container.querySelectorAll('[data-contrato-plano]');
    botoesPlano.forEach(function (btn) {
      btn.addEventListener('click', function () {
        botoesPlano.forEach(function (b) { b.classList.add('adm-btn-ghost'); });
        btn.classList.remove('adm-btn-ghost');
        planoEscolhido = btn.getAttribute('data-contrato-plano');
        abrirCartaoBrick(planoEscolhido);
      });
    });

    function abrirCartaoBrick(plano) {
      var msgEl = $('#contratoMsg', container);
      var brickEl = $('#contratoCartaoBrick', container);
      msgEl.textContent = 'Carregando o formulário do cartão…';
      msgEl.className = 'taxa-msg';
      Store.mpPublicKey().then(function (publicKey) {
        return RafaelMP.montarCartaoAssinatura({
          publicKey: publicKey,
          containerId: 'contratoCartaoBrick',
          telefone: info.telefone,
          plano: plano,
          valor: plano === 'anual' ? 1390 : 149,
          edgeUrl: MP_ASSINATURA_URL,
          onResult: function (result) {
            if (result.error) {
              msgEl.textContent = result.error;
              msgEl.className = 'taxa-msg erro';
              return;
            }
            msgEl.textContent = 'Cartão cadastrado! A cobrança automática já está ativa.';
            msgEl.className = 'taxa-msg ok';
            setTimeout(renderContrato, 1200);
          }
        });
      }).catch(function (e) {
        msgEl.textContent = e.message || 'Erro ao carregar o formulário.';
        msgEl.className = 'taxa-msg erro';
      });
    }

    $('#contratoGerarPix', container).addEventListener('click', function () {
      var msgEl = $('#contratoPixMsg', container);
      var brickEl = $('#contratoPixBrick', container);
      msgEl.textContent = 'Carregando o Pix…';
      msgEl.className = 'taxa-msg';
      Store.mpPublicKey().then(function (publicKey) {
        return RafaelMP.montarPagamento({
          publicKey: publicKey,
          containerId: 'contratoPixBrick',
          amount: info.valor,
          telefone: info.telefone,
          tipo: 'cobranca',
          forma: 'pix',
          edgeUrl: MP_PAGAMENTO_URL,
          onResult: function (result) {
            if (result.error) {
              msgEl.textContent = result.error;
              msgEl.className = 'taxa-msg erro';
              return;
            }
            if (result.status === 'approved') {
              msgEl.textContent = 'Pix aprovado! Vencimento atualizado.';
              msgEl.className = 'taxa-msg ok';
              setTimeout(renderContrato, 1200);
            } else if (result.qr_code_base64) {
              brickEl.innerHTML = '<p style="margin-bottom:0.6rem;">Escaneie o QR Code ou copie o código Pix:</p>' +
                '<img src="data:image/png;base64,' + result.qr_code_base64 + '" style="max-width:220px; border-radius:8px;">' +
                '<textarea class="field-input" readonly style="margin-top:0.6rem; font-size:0.75rem;" rows="3">' + esc(result.qr_code) + '</textarea>';
              msgEl.textContent = 'Assim que o Pix cair, o vencimento avança sozinho.';
              msgEl.className = 'taxa-msg';
            }
          }
        });
      }).catch(function (e) {
        msgEl.textContent = e.message || 'Erro ao gerar o Pix.';
        msgEl.className = 'taxa-msg erro';
      });
    });
  }

  function renderGaleria() {
    var container = $('#view-galeria');
    loading(container, 'Carregando a galeria…');
    Promise.all([Store.listGallery(), Store.listStaff(session.token)]).then(function (results) {
      galeriaRenderComDados(container, results[0], results[1]);
    }).catch(function (e) { erro(container, e); });
  }

  function galeriaRenderComDados(container, gallery, team) {
    var podeGerenciar = session.role === 'owner';
    var html = '<div class="admin-view-head"><p class="eyebrow">Vitrine</p><h2>Galeria</h2><p>Fotos dos cortes, no estilo grade do Instagram.</p></div>';

    html += '<div class="adm-panel"><div class="adm-gallery-head">' +
      '<a class="adm-ig-link" href="' + IG_URL + '" target="_blank" rel="noopener">' + INSTAGRAM_ICON + esc(IG_HANDLE) + '</a>' +
      '<div class="adm-hours">Seg a sáb: 8h às 18h<br>Qui e sex: 8h às 19h</div>' +
      '</div>' +
      '<label class="adm-btn"> + Adicionar fotos<input type="file" accept="image/*" multiple id="galeriaUpload" style="display:none;"></label>' +
      '<div class="adm-gallery-grid" id="galeriaGrid" style="margin-top:1.2rem;">';

    if (!gallery.length) {
      html += '<p class="adm-gallery-empty">Nenhuma foto ainda — adicione a primeira acima.</p>';
    } else {
      gallery.forEach(function (p) {
        html += '<div class="adm-gallery-item"><div class="adm-gallery-item-inner"><img src="' + esc(p.foto_url) + '" alt="">';
        if (podeGerenciar) {
          html += '<button type="button" class="adm-gallery-remove" data-remove-photo="' + p.id + '">×</button>' +
            '<select class="adm-gallery-tag-select" data-tag-photo="' + p.id + '" style="position:absolute; left:4px; bottom:4px; max-width:80%;">' +
            '<option value="">Sem marcação</option>' +
            team.map(function (t) { return '<option value="' + t.id + '"' + (t.id === p.staff_id ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join('') +
            '</select>';
        } else if (p.staff_id) {
          var t = team.filter(function (x) { return x.id === p.staff_id; })[0];
          if (t) html += '<span class="adm-gallery-tag">' + esc(t.nome) + '</span>';
        }
        html += '</div></div>';
      });
    }
    html += '</div></div>';

    container.innerHTML = html;

    $('#galeriaUpload', container).addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      if (!files.length) return;
      Promise.all(files.map(function (file) {
        return Store.uploadPhoto(file, 'galeria', 1000, 0.82)
          .then(function (url) { return Store.addGalleryPhoto(session.token, url, null); });
      })).then(renderGaleria).catch(function (err) { alert('Não deu pra subir alguma foto: ' + err.message); renderGaleria(); });
    });
    $all('[data-remove-photo]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover esta foto?')) {
          Store.removeGalleryPhoto(session.token, btn.dataset.removePhoto).then(renderGaleria).catch(function (e) { alert(e.message); });
        }
      });
    });
    $all('[data-tag-photo]', container).forEach(function (select) {
      select.addEventListener('change', function () {
        Store.tagGalleryPhoto(session.token, select.dataset.tagPhoto, select.value || null).catch(function (e) { alert(e.message); });
      });
    });
  }

  // --------------------------------------------------------------- modal
  var modalOverlay = $('#admModalOverlay');
  var modalContent = $('#admModalContent');
  function openModal(node) {
    modalContent.innerHTML = '';
    modalContent.appendChild(node);
    var closeBtn = modalContent.querySelector('#modalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modalOverlay.classList.add('open');
  }
  function closeModal() { modalOverlay.classList.remove('open'); modalContent.innerHTML = ''; }
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
})();

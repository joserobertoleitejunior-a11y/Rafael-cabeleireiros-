/* App do admin — PIN, abas, e as 5 telas (PDV, Dashboard, Clientes,
   Serviços e Valores, Galeria). Tudo lido/escrito via RafaelAdminStore
   (localStorage) e RafaelCharts (gráficos SVG). */
(function () {
  var Store = window.RafaelAdminStore;
  var Charts = window.RafaelCharts;
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
  function fmtDateBR(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDayBR(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  function resizeImageFile(file, maxDim, quality, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/jpeg', quality || 0.82));
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }
  var WHATSAPP_ICON = '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 2C8.3 2 2 8.3 2 16c0 2.5.7 4.9 1.9 7L2 30l7.2-1.9c2 1.1 4.3 1.7 6.8 1.7 7.7 0 14-6.3 14-14S23.7 2 16 2zm0 25.5c-2.2 0-4.4-.6-6.2-1.7l-.4-.3-4.3 1.1 1.1-4.2-.3-.4C4.6 20.2 4 18.1 4 16 4 9.4 9.4 4 16 4s12 5.4 12 12-5.4 11.5-12 11.5zm6.5-8.8c-.4-.2-2.1-1-2.4-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.6.2-.2.2-.4.3-.6.1-.2 0-.5 0-.7-.1-.2-.8-2-1.1-2.7-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.5-.3.4-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.7-.5z"/></svg>';
  var INSTAGRAM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>';

  // ------------------------------------------------------------ PIN gate
  var pinScreen = $('#pinScreen');
  var pinInput = $('#pinInput');
  var pinSubmit = $('#pinSubmit');
  var pinError = $('#pinError');
  var pinTitle = $('#pinTitle');
  var pinSubtitle = $('#pinSubtitle');
  var appRoot = $('#adminApp');

  function showPinScreen() {
    var creating = !Store.hasPin();
    pinTitle.textContent = creating ? 'Criar senha do painel' : 'Painel Rafael Cabeleireiros';
    pinSubtitle.textContent = creating
      ? 'Escolha 4 números pra travar o painel neste aparelho.'
      : 'Digite a senha pra entrar.';
    pinInput.value = '';
    pinError.textContent = '';
    pinScreen.style.display = 'flex';
    appRoot.style.display = 'none';
    setTimeout(function () { pinInput.focus(); }, 50);
  }

  function unlock() {
    pinScreen.style.display = 'none';
    appRoot.style.display = '';
    initApp();
  }

  pinSubmit.addEventListener('click', function () {
    var val = pinInput.value.trim();
    if (val.length < 4) {
      pinError.textContent = 'Use pelo menos 4 números.';
      return;
    }
    if (!Store.hasPin()) {
      Store.setPin(val);
      unlock();
      return;
    }
    if (Store.checkPin(val)) {
      unlock();
    } else {
      pinError.textContent = 'Senha errada. Tenta de novo.';
      pinInput.value = '';
      pinInput.focus();
    }
  });
  pinInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') pinSubmit.click();
  });

  showPinScreen();

  // -------------------------------------------------------------- router
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
    if (lockBtn) lockBtn.addEventListener('click', showPinScreen);

    renderCurrentView();
  }

  function activeViewName() {
    var active = $('.admin-tab.active');
    return active ? active.dataset.view : 'pdv';
  }
  function renderCurrentView() {
    var view = activeViewName();
    if (view === 'pdv') renderPDV();
    else if (view === 'dashboard') renderDashboard();
    else if (view === 'clientes') renderClientes();
    else if (view === 'servicos') renderServicos();
    else if (view === 'galeria') renderGaleria();
  }
  window.RafaelAdminRefresh = renderCurrentView;

  // ----------------------------------------------------------------- PDV
  var pdvState = { barbeiroId: null, servicoId: null, modo: null, pagamentos: [], metodoAtivo: null, valorAtivo: '', clienteNome: '', clienteTelefone: '' };

  function pdvReset() {
    pdvState = { barbeiroId: null, servicoId: null, modo: null, pagamentos: [], metodoAtivo: null, valorAtivo: '', clienteNome: '', clienteTelefone: '' };
  }

  function renderPDV() {
    var container = $('#view-pdv');
    var data = Store.getData();
    var barbeiro = data.team.filter(function (t) { return t.id === pdvState.barbeiroId; })[0];
    var servico = data.services.filter(function (s) { return s.id === pdvState.servicoId; })[0];
    var total = servico ? Number(servico.preco) : 0;
    var pago = pdvState.pagamentos.reduce(function (s, p) { return s + p.valor; }, 0);
    var restante = Math.max(0, total - pago);

    var html = '';
    html += '<div class="admin-view-head"><p class="eyebrow">Atendimento</p><h2>Caixa PDV</h2><p>Escolha o profissional, o serviço e feche o pagamento.</p></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">1. Profissional</h3><div class="adm-pick-grid" id="pdvBarbeiros">';
    data.team.forEach(function (t) {
      html += '<button type="button" class="adm-pick-card' + (t.id === pdvState.barbeiroId ? ' selected' : '') + '" data-id="' + t.id + '">' +
        (t.foto ? '<img src="' + t.foto + '" alt="">' : '<span class="avatar-fallback">' + esc(t.nome.charAt(0)) + '</span>') +
        '<span>' + esc(t.nome) + '</span></button>';
    });
    html += '</div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">2. Serviço</h3><div class="adm-pick-grid" id="pdvServicos">';
    data.services.forEach(function (s) {
      html += '<button type="button" class="adm-pick-card' + (s.id === pdvState.servicoId ? ' selected' : '') + '" data-id="' + s.id + '">' +
        '<span>' + esc(s.nome) + '</span><span class="price">' + Charts.fmtBRL(s.preco) + '</span></button>';
    });
    html += '</div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.1rem;">3. Agora ou agendado?</h3>' +
      '<div class="adm-toggle-row">' +
      '<button type="button" class="adm-toggle-btn' + (pdvState.modo === 'agora' ? ' selected' : '') + '" data-modo="agora">Já foi cortado agora</button>' +
      '<button type="button" class="adm-toggle-btn' + (pdvState.modo === 'agendar' ? ' selected' : '') + '" data-modo="agendar">Agendar pra depois</button>' +
      '</div>';
    if (pdvState.modo === 'agendar') {
      html += '<button type="button" class="adm-btn adm-btn-block" style="margin-top:1rem;" id="pdvAbrirAgenda">Abrir agenda →</button>' +
        '<p style="color:var(--adm-text-faint); font-size:0.8rem; margin-top:0.6rem;">Isso abre a mesma agenda do site — o cliente entra na lista de horários, sem passar pelo caixa agora.</p>';
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
        html += '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin-bottom:0.8rem;">Total: <strong style="color:var(--adm-gold);">' + Charts.fmtBRL(total) + '</strong>' +
          (pago > 0 ? ' · Falta: <strong style="color:var(--adm-gold);">' + Charts.fmtBRL(restante) + '</strong>' : '') + '</p>';
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
            html += '<div class="adm-split-row"><span>' + p.metodo + '</span><span>' + Charts.fmtBRL(p.valor) + '</span><button type="button" data-remove-pag="' + i + '">×</button></div>';
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
    wirePDV(container, servico, total, pago, restante);
  }

  function wirePDV(container, servico, total, pago, restante) {
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
        var data = Store.getData();
        var barbeiro = data.team.filter(function (t) { return t.id === pdvState.barbeiroId; })[0];
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
          window.setTimeout(function () {
            alert('Troco pra dar: ' + Charts.fmtBRL(valor - restante));
          }, 10);
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
        var data = Store.getData();
        var barbeiro = data.team.filter(function (t) { return t.id === pdvState.barbeiroId; })[0];
        var nome = pdvState.clienteNome || '';
        var telefone = pdvState.clienteTelefone || '';
        Store.addSale({
          barbeiroId: pdvState.barbeiroId,
          barbeiroNome: barbeiro ? barbeiro.nome : 'Sem profissional',
          servicoId: pdvState.servicoId,
          servicoNome: servico.nome,
          valor: total,
          pagamentos: pdvState.pagamentos,
          clienteNome: nome.trim(),
          clienteTelefone: digitsOnly(telefone),
          agendado: false
        });
        pdvReset();
        $all('.admin-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === 'dashboard'); });
        $all('.admin-view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-dashboard'); });
        renderDashboard();
      });
    }
  }

  // ----------------------------------------------------------- Dashboard
  function renderDashboard() {
    var container = $('#view-dashboard');
    var stats = Store.getStats();

    var html = '';
    html += '<div class="admin-view-head"><p class="eyebrow">Visão geral</p><h2>Dashboard</h2><p>Números deste mês, direto do que passou pelo Caixa PDV.</p></div>';

    html += '<div class="adm-stat-grid">' +
      '<div class="adm-stat-tile"><div class="label">Cortes no mês</div><div class="value">' + stats.cortesMes + '</div></div>' +
      '<div class="adm-stat-tile"><div class="label">Ganhos no mês</div><div class="value">' + Charts.fmtBRL(stats.ganhosMes) + '</div></div>' +
      '<div class="adm-stat-tile"><div class="label">Ticket médio</div><div class="value">' + Charts.fmtBRL(stats.ticketMedio) + '</div></div>' +
      '</div>';

    html += '<div class="adm-panel" style="margin-top:1.2rem;"><h3 style="margin-bottom:0.6rem;font-size:1.1rem;">Quem cortou este mês</h3><div id="chartBarbeiro"></div></div>';
    html += '<div class="adm-panel"><h3 style="margin-bottom:0.6rem;font-size:1.1rem;">Ganhos por dia</h3><div id="chartGanhos"></div></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.4rem;font-size:1.1rem;">Histórico de cortes</h3>';
    if (!stats.historico.length) {
      html += '<p style="color:var(--adm-text-faint); font-size:0.88rem;">Nenhuma venda registrada ainda.</p>';
    } else {
      html += '<div class="adm-hist-list">';
      stats.historico.forEach(function (s) {
        html += '<div class="adm-hist-row"><div><div class="adm-hist-main">' + esc(s.servicoNome) + (s.clienteNome ? ' — ' + esc(s.clienteNome) : '') + '</div>' +
          '<div class="adm-hist-sub">' + esc(s.barbeiroNome) + ' · ' + fmtDateBR(s.dataISO) + '</div></div>' +
          '<div class="adm-hist-value">' + Charts.fmtBRL(s.valor) + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    var porBarbeiroData = Object.keys(stats.porBarbeiro).map(function (k) { return { label: k, value: stats.porBarbeiro[k] }; });
    Charts.barChart($('#chartBarbeiro'), {
      data: porBarbeiroData, height: 130, ariaLabel: 'Cortes por profissional este mês',
      labelHeader: 'Profissional', valueHeader: 'Cortes', valueFormatter: function (v) { return v + (v === 1 ? ' corte' : ' cortes'); }
    });

    var porDiaKeys = Object.keys(stats.porDia).sort();
    var porDiaData = porDiaKeys.map(function (k) { return { label: fmtDayBR(k), value: stats.porDia[k], color: '#B08D2F' }; });
    Charts.barChart($('#chartGanhos'), {
      data: porDiaData, height: 130, ariaLabel: 'Ganhos por dia este mês',
      labelHeader: 'Dia', valueHeader: 'Ganhos', valueFormatter: Charts.fmtBRL
    });
  }

  // ------------------------------------------------------------ Clientes
  function renderClientes() {
    var container = $('#view-clientes');
    var clientes = Store.getClients();

    var html = '<div class="admin-view-head"><p class="eyebrow">Base de clientes</p><h2>Clientes</h2><p>Construída a partir do histórico de vendas do Caixa PDV.</p></div>';

    if (!clientes.length) {
      html += '<div class="adm-panel"><p style="color:var(--adm-text-faint); font-size:0.9rem;">Nenhum cliente ainda — registre uma venda com nome e telefone no Caixa PDV pra começar a lista.</p></div>';
      container.innerHTML = html;
      return;
    }

    html += '<div class="adm-client-grid">';
    clientes.forEach(function (c) {
      var ultimoFeedback = c.feedback.length ? c.feedback[c.feedback.length - 1] : null;
      html += '<div class="adm-client-card">' +
        '<div><div class="adm-client-name">' + esc(c.nome || 'Sem nome') + '</div><div class="adm-client-phone">' + esc(c.telefone) + '</div></div>' +
        '<div class="adm-client-stats">' +
        '<div><strong>' + c.totalCortes + '</strong><span>Total de cortes</span></div>' +
        '<div><strong>' + c.cortesEsteMes + '</strong><span>Este mês</span></div>' +
        '</div>' +
        (ultimoFeedback ? '<p class="adm-client-feedback">"' + esc(ultimoFeedback.comentario) + '"</p>' : '') +
        '<a class="adm-whatsapp-btn" target="_blank" rel="noopener" href="' + waLink(c.telefone) + '">' + WHATSAPP_ICON + ' Abrir WhatsApp</a>' +
        '<form class="adm-feedback-form" data-telefone="' + esc(c.telefone) + '">' +
        '<input type="text" placeholder="Anotar feedback do cliente…" required>' +
        '<button type="submit" class="adm-btn adm-btn-sm">+</button>' +
        '</form>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    $all('.adm-feedback-form', container).forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input');
        if (!input.value.trim()) return;
        Store.addFeedback(form.dataset.telefone, { comentario: input.value.trim() });
        renderClientes();
      });
    });
  }

  // ----------------------------------------------------- Serviços e Valores
  function contarCortesPorBarbeiro(barbeiroId) {
    var d = Store.getData();
    return d.sales.filter(function (s) { return s.barbeiroId === barbeiroId; }).length;
  }

  function renderServicos() {
    var container = $('#view-servicos');
    var data = Store.getData();

    var html = '<div class="admin-view-head"><p class="eyebrow">Gestão</p><h2>Serviços e Valores</h2><p>Preços da casa e quem faz parte da equipe.</p></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.6rem;font-size:1.15rem;">Serviços</h3>';
    data.services.forEach(function (s) {
      html += '<div class="adm-service-row"><span class="adm-service-name">' + esc(s.nome) + '</span>' +
        '<span class="adm-service-price">' + Charts.fmtBRL(s.preco) + '</span>' +
        '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-edit-service="' + s.id + '">Editar</button>' +
        '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-remove-service="' + s.id + '">Remover</button></div>';
    });
    html += '<button type="button" class="adm-btn" style="margin-top:1rem;" id="addServiceBtn">+ Adicionar serviço</button></div>';

    html += '<div class="adm-panel"><h3 style="margin-bottom:0.8rem;font-size:1.15rem;">Equipe</h3><div class="adm-team-grid">';
    data.team.forEach(function (t) {
      var cortes = contarCortesPorBarbeiro(t.id);
      html += '<div class="adm-team-card">' +
        (t.foto ? '<img class="adm-team-photo" src="' + t.foto + '" alt="">' : '<div class="adm-team-photo-fallback">' + esc(t.nome.charAt(0)) + '</div>') +
        '<div class="adm-team-name">' + esc(t.nome) + '</div><div class="adm-team-role">' + esc(t.especialidade || '') + '</div>' +
        '<div class="adm-team-count">' + cortes + ' corte' + (cortes === 1 ? '' : 's') + '</div>' +
        '<label class="adm-team-upload">Trocar foto<input type="file" accept="image/*" data-team-photo="' + t.id + '" style="display:block; margin-top:0.3rem;"></label>' +
        '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-remove-team="' + t.id + '">Remover</button>' +
        '</div>';
    });
    html += '</div><button type="button" class="adm-btn" style="margin-top:1rem;" id="addTeamBtn">+ Adicionar profissional</button></div>';

    container.innerHTML = html;
    wireServicos(container);
  }

  function wireServicos(container) {
    $all('[data-remove-service]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover este serviço?')) { Store.removeService(btn.dataset.removeService); renderServicos(); }
      });
    });
    $all('[data-edit-service]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(renderServiceForm(Store.getData().services.filter(function (s) { return s.id === btn.dataset.editService; })[0]));
      });
    });
    $('#addServiceBtn', container).addEventListener('click', function () { openModal(renderServiceForm(null)); });

    $all('[data-remove-team]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover este profissional da equipe?')) { Store.removeTeam(btn.dataset.removeTeam); renderServicos(); }
      });
    });
    $('#addTeamBtn', container).addEventListener('click', function () { openModal(renderTeamForm(null)); });
    $all('[data-team-photo]', container).forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        resizeImageFile(file, 300, 0.85, function (dataUrl) {
          if (dataUrl) { Store.updateTeam(input.dataset.teamPhoto, { foto: dataUrl }); renderServicos(); }
        });
      });
    });
  }

  function renderServiceForm(service) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>' + (service ? 'Editar serviço' : 'Novo serviço') + '</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>Nome</label><input id="svcNome" type="text" value="' + (service ? esc(service.nome) : '') + '"></div>' +
      '<div class="adm-field"><label>Preço (R$)</label><input id="svcPreco" type="number" step="0.01" min="0" value="' + (service ? service.preco : '') + '"></div>' +
      '<button type="button" class="adm-btn adm-btn-block" id="svcSalvar">Salvar</button>';
    wrap.querySelector('#svcSalvar').addEventListener('click', function () {
      var nome = wrap.querySelector('#svcNome').value.trim();
      var preco = parseFloat(wrap.querySelector('#svcPreco').value) || 0;
      if (!nome) return;
      if (service) Store.updateService(service.id, { nome: nome, preco: preco });
      else Store.addService({ nome: nome, preco: preco });
      closeModal();
      renderServicos();
    });
    return wrap;
  }

  function renderTeamForm() {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="adm-modal-head"><h3>Novo profissional</h3><button type="button" class="adm-modal-close" id="modalCloseBtn">×</button></div>' +
      '<div class="adm-field"><label>Nome</label><input id="teamNome" type="text"></div>' +
      '<div class="adm-field"><label>Especialidade</label><input id="teamEsp" type="text" placeholder="Ex: Barbeiro · Colorista"></div>' +
      '<div class="adm-field"><label>Foto (opcional)</label><input id="teamFoto" type="file" accept="image/*"></div>' +
      '<button type="button" class="adm-btn adm-btn-block" id="teamSalvar">Salvar</button>';
    wrap.querySelector('#teamSalvar').addEventListener('click', function () {
      var nome = wrap.querySelector('#teamNome').value.trim();
      var esp = wrap.querySelector('#teamEsp').value.trim();
      if (!nome) return;
      var file = wrap.querySelector('#teamFoto').files[0];
      function save(foto) {
        Store.addTeam({ nome: nome, especialidade: esp, foto: foto || null });
        closeModal();
        renderServicos();
      }
      if (file) resizeImageFile(file, 300, 0.85, save);
      else save(null);
    });
    return wrap;
  }

  // ------------------------------------------------------------- Galeria
  var IG_HANDLE = '@rafael_cabeleireiros';
  var IG_URL = 'https://www.instagram.com/rafael_cabeleireiros';

  function renderGaleria() {
    var container = $('#view-galeria');
    var data = Store.getData();

    var html = '<div class="admin-view-head"><p class="eyebrow">Vitrine</p><h2>Galeria</h2><p>Fotos dos cortes, no estilo grade do Instagram.</p></div>';

    html += '<div class="adm-panel"><div class="adm-gallery-head">' +
      '<a class="adm-ig-link" href="' + IG_URL + '" target="_blank" rel="noopener">' + INSTAGRAM_ICON + esc(IG_HANDLE) + '</a>' +
      '<div class="adm-hours">Seg a sáb: 8h às 18h<br>Qui e sex: 8h às 19h</div>' +
      '</div>' +
      '<label class="adm-btn"> + Adicionar fotos<input type="file" accept="image/*" multiple id="galeriaUpload" style="display:none;"></label>' +
      '<div class="adm-gallery-grid" id="galeriaGrid" style="margin-top:1.2rem;">';

    if (!data.gallery.length) {
      html += '<p class="adm-gallery-empty">Nenhuma foto ainda — adicione a primeira acima.</p>';
    } else {
      data.gallery.forEach(function (p) {
        var barbeiro = data.team.filter(function (t) { return t.id === p.barbeiroId; })[0];
        html += '<div class="adm-gallery-item"><img src="' + p.foto + '" alt="">' +
          '<button type="button" class="adm-gallery-remove" data-remove-photo="' + p.id + '">×</button>' +
          '<select class="adm-gallery-tag-select" data-tag-photo="' + p.id + '" style="position:absolute; left:4px; bottom:4px; max-width:80%;">' +
          '<option value="">Sem marcação</option>' +
          data.team.map(function (t) { return '<option value="' + t.id + '"' + (t.id === p.barbeiroId ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join('') +
          '</select></div>';
      });
    }
    html += '</div></div>';

    container.innerHTML = html;

    $('#galeriaUpload', container).addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      var remaining = files.length;
      if (!remaining) return;
      files.forEach(function (file) {
        resizeImageFile(file, 900, 0.82, function (dataUrl) {
          if (dataUrl) Store.addPhoto({ foto: dataUrl, barbeiroId: null });
          remaining--;
          if (remaining === 0) renderGaleria();
        });
      });
    });
    $all('[data-remove-photo]', container).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Remover esta foto?')) { Store.removePhoto(btn.dataset.removePhoto); renderGaleria(); }
      });
    });
    $all('[data-tag-photo]', container).forEach(function (select) {
      select.addEventListener('change', function () {
        var d = Store.getData();
        var photo = d.gallery.filter(function (p) { return p.id === select.dataset.tagPhoto; })[0];
        if (photo) { photo.barbeiroId = select.value || null; Store.setData(d); }
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

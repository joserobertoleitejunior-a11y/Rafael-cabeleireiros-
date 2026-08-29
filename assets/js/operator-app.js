/* Painel do operador (Zé Roberto) — controla a assinatura de cada cliente
   que usa o sistema (por ora só o Rafael). Separado por completo do login
   da barbearia: login, sessão e tabela próprios no Supabase. O aviso de
   vencimento é manual por escolha do operador — o botão só abre o
   WhatsApp já com a mensagem pronta, ele que decide a hora de mandar. */
(function () {
  var SESSION_KEY = 'operadorSessao';

  function db() {
    if (!window.db) throw new Error('Sem conexão com o Supabase (CDN bloqueada ou offline).');
    return window.db;
  }
  function unwrap(promise) {
    return promise.then(function (res) {
      if (res.error) throw new Error(res.error.message || 'Erro no Supabase.');
      return res.data;
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtBRL(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDateBR(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  }
  function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
  function waLink(tel, msg) {
    var d = digitsOnly(tel);
    if (d.length && d.slice(0, 2) !== '55') d = '55' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(msg);
  }

  var pinScreen = document.getElementById('pinScreen');
  var pinInput = document.getElementById('pinInput');
  var pinSubmit = document.getElementById('pinSubmit');
  var pinError = document.getElementById('pinError');
  var opApp = document.getElementById('opApp');
  var viewSubs = document.getElementById('viewSubs');
  var session = null;

  function saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* segue sem persistir */ }
  }
  function loadSession() {
    try { var raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* nada a fazer */ }
  }

  function showPin() {
    session = null;
    clearSession();
    pinScreen.style.display = 'flex';
    opApp.style.display = 'none';
  }
  function showApp() {
    pinScreen.style.display = 'none';
    opApp.style.display = '';
    renderSubs();
  }

  pinSubmit.addEventListener('click', function () {
    var pin = pinInput.value.trim();
    if (!pin) return;
    pinSubmit.disabled = true;
    pinError.textContent = '';
    unwrap(db().rpc('operator_login', { p_pin: pin })).then(function (data) {
      pinSubmit.disabled = false;
      session = { token: data.token, nome: data.nome };
      saveSession(session);
      showApp();
    }).catch(function (e) {
      pinSubmit.disabled = false;
      pinError.textContent = e.message || 'PIN incorreto.';
      pinInput.value = '';
    });
  });
  pinInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') pinSubmit.click(); });
  document.getElementById('lockBtn').addEventListener('click', showPin);

  function diasEntre(iso) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var venc = new Date(iso + 'T00:00:00');
    return Math.round((venc - hoje) / 86400000);
  }

  function mensagemPara(sub, dias) {
    var primeiro = (sub.cliente_nome || '').split(' ')[0];
    if (dias > 0) {
      return 'Oi ' + primeiro + '! Passando pra lembrar que a mensalidade do sistema vence em ' + dias + ' dia(s), no dia ' + fmtDateBR(sub.vencimento) + ' (' + fmtBRL(sub.valor) + '). Qualquer dúvida me chama por aqui!';
    }
    if (dias <= 0 && sub.status !== 'bloqueado') {
      var atraso = Math.abs(dias);
      return 'Oi ' + primeiro + '! O pagamento da mensalidade (venceu em ' + fmtDateBR(sub.vencimento) + ') ainda não caiu aqui. Você tem até ' + (7 - atraso > 0 ? (7 - atraso) + ' dia(s)' : 'hoje') + ' pra regularizar antes que o acesso ao painel seja bloqueado. Qualquer coisa me avisa!';
    }
    return 'Oi ' + primeiro + '! Como o pagamento não foi regularizado, o acesso ao painel administrativo foi bloqueado temporariamente. Assim que cair o pagamento, libero na hora — é só me avisar.';
  }

  function badgeCor(status) {
    if (status === 'em_dia') return 'var(--adm-gold)';
    if (status === 'atrasado') return '#E0A84A';
    return 'var(--adm-danger)';
  }

  function renderSubs() {
    viewSubs.innerHTML = '<p style="color:var(--adm-text-faint); padding:2rem 0; text-align:center;">Carregando…</p>';
    unwrap(db().rpc('operator_list_subscriptions', { p_token: session.token })).then(function (subs) {
      var html = '<div class="admin-view-head"><p class="eyebrow">Assinaturas</p><h2>Clientes do sistema</h2></div>';
      subs.forEach(function (s) {
        var dias = diasEntre(s.vencimento);
        var diasTexto = dias > 0 ? ('vence em ' + dias + ' dia(s)') : dias === 0 ? 'vence hoje' : ('atrasado há ' + Math.abs(dias) + ' dia(s)');
        html += '<div class="adm-panel" style="margin-bottom:1.2rem;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.6rem;">' +
          '<div><h3 style="font-size:1.3rem;">' + esc(s.cliente_nome) + '</h3>' +
          '<p style="color:var(--adm-text-soft); font-size:0.88rem; margin-top:0.3rem;">Plano ' + esc(s.plano) + ' · ' + fmtBRL(s.valor) + ' · vencimento ' + fmtDateBR(s.vencimento) + '</p>' +
          '<p style="font-size:0.82rem; margin-top:0.2rem; color:' + badgeCor(s.status) + ';">● ' + esc(s.status).toUpperCase() + ' — ' + diasTexto + '</p></div>' +
          '</div>' +
          '<div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-top:1rem;">' +
          '<a class="adm-btn adm-btn-sm" target="_blank" rel="noopener" href="' + waLink(s.cliente_telefone, mensagemPara(s, dias)) + '">Avisar no WhatsApp</a>' +
          '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-marcar-pago="' + s.id + '">Marcar como pago</button>' +
          (s.status !== 'bloqueado'
            ? '<button type="button" class="adm-btn adm-btn-danger adm-btn-sm" data-set-status="' + s.id + '" data-status="bloqueado">Bloquear acesso</button>'
            : '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-set-status="' + s.id + '" data-status="em_dia">Desbloquear acesso</button>') +
          (s.status === 'em_dia' && dias <= 0
            ? '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" data-set-status="' + s.id + '" data-status="atrasado">Marcar como atrasado</button>'
            : '') +
          '</div></div>';
      });
      viewSubs.innerHTML = html;

      viewSubs.querySelectorAll('[data-marcar-pago]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          unwrap(db().rpc('operator_mark_paid', { p_token: session.token, p_id: btn.dataset.marcarPago })).then(renderSubs).catch(function (e) { alert(e.message); });
        });
      });
      viewSubs.querySelectorAll('[data-set-status]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          unwrap(db().rpc('operator_set_status', { p_token: session.token, p_id: btn.dataset.setStatus, p_status: btn.dataset.status })).then(renderSubs).catch(function (e) { alert(e.message); });
        });
      });
    }).catch(function (e) {
      if (/sess[aã]o inv[aá]lida|expirada/i.test(e.message || '')) { showPin(); return; }
      viewSubs.innerHTML = '<p style="color:var(--adm-danger); padding:2rem 0; text-align:center;">Não deu pra carregar: ' + esc(e.message) + '</p>';
    });
  }

  (function boot() {
    var saved = loadSession();
    if (!saved) { showPin(); return; }
    session = saved;
    showApp();
  })();
})();

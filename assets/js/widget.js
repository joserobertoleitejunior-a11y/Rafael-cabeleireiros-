/* Widget de agendamento (Agenda) — passo a passo:
   1) seus dados (nome/telefone, com reconhecimento de cliente que já
   agendou antes)  2) profissional  3) serviço  4) dia/horário
   5) confirmar (grava no Supabase + WhatsApp).
   Qualquer botão com [data-open-widget] abre o widget. Se tiver
   data-preselect-prof="Nome", o profissional já entra escolhido.

   Profissionais, serviços e dias vêm do Supabase quando disponível;
   se a rede/CDN não responder, cai de volta pro conteúdo fixo que já
   está no HTML, pra nunca deixar a agenda vazia. */
(function () {
  var WHATSAPP_NUMBER = '5515996507174';
  var STORAGE_KEY = 'rafaelClienteContato';
  var STEP_CONTATO = 1;
  var DIAS_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  var HORARIOS_PADRAO = ['09:00', '10:30', '14:00', '15:30', '17:00', '18:00'];

  var overlay = document.getElementById('wizardOverlay');
  if (!overlay) return;

  // Chama uma função do Supabase (window.db.rpc/from/...) sem deixar um
  // erro síncrono dela travar o resto do agendamento — foi exatamente
  // isso que prendia a tela em "Antes de começar" sem nenhum aviso: uma
  // chamada de rede sem try/catch quebrava no meio e nunca deixava o
  // código chegar em current++ / render().
  function safeDbCall(fn) {
    try { fn(); } catch (e) { console.error('Chamada ao banco falhou (ignorada, não afeta o agendamento):', e); }
  }

  var closeBtn = document.getElementById('wizardClose');
  var backBtn = document.getElementById('wizardBack');
  var nextBtn = document.getElementById('wizardNext');
  var welcomeHint = document.getElementById('welcomeBackHint');
  var nomeInput = document.getElementById('clienteNome');
  var telefoneInput = document.getElementById('clienteTelefone');
  var profissionalList = overlay.querySelector('[data-group="profissional"]');
  var servicoGrid = overlay.querySelector('[data-group="servico"]');
  var diaRow = overlay.querySelector('[data-group="dia"]');
  var horarioGrid = overlay.querySelector('[data-group="horario"]');
  var steps = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-step'));
  var dots = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-steps-dots span'));
  var totalSteps = steps.length;
  var current = 1;
  var choices = {};
  var lastFocused = null;
  var lockedScrollY = 0;
  var isReturningClient = false;
  var staffList = [];
  var diasDisponiveis = [];
  var diasFechados = null; // Set de dia_semana (0=domingo..6=sábado); null = ainda não carregou

  function loadSavedContact() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.nome && data.telefone) return data;
    } catch (e) { /* localStorage indisponível — segue sem reconhecimento */ }
    return null;
  }

  function saveContact(nome, telefone) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nome: nome, telefone: telefone }));
    } catch (e) { /* modo privado / storage cheio — não trava o agendamento */ }
  }

  // Mesma trava de scroll do menu.js — overflow:hidden no body não
  // basta no iOS Safari, precisa fixar a posição e devolver ao fechar.
  function lockScroll() {
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.top = '-' + lockedScrollY + 'px';
    document.body.classList.add('scroll-locked');
  }
  function unlockScroll() {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // -------- dados reais (Supabase), com fallback pro que já está no HTML --------
  function carregarProfissionaisEServicos() {
    if (!window.db) return;
    safeDbCall(function () {
      window.db.from('staff_public').select('id,nome,especialidade,foto_url').then(function (res) {
        if (res.error || !res.data || !res.data.length) return;
        staffList = res.data;
        profissionalList.innerHTML = res.data.map(function (p) {
          return '<button type="button" class="pick-card" data-value="' + esc(p.nome) + '" data-staff-id="' + p.id + '">' +
            (p.foto_url ? '<img src="' + esc(p.foto_url) + '" class="tone-bw" alt="">' : '<img src="assets/img/placeholder-portrait.svg" class="tone-bw" alt="">') +
            esc(p.nome) + (p.especialidade ? ' — ' + esc(p.especialidade) : '') +
            '</button>';
        }).join('');
        // O botão "Agendar com Fulano" pré-seleciona o profissional antes
        // mesmo dessa busca terminar — se essa pessoa já não estiver mais na
        // lista de verdade (foi removida), a escolha preenchida na tela é
        // inválida. Sem isso, dava pra "agendar" com alguém que já não
        // trabalha mais lá. Revalida sempre (mesmo quando continua válida),
        // porque o innerHTML acima de recriar os cartões apaga o destaque
        // ".selected" de quem já tinha sido escolhido.
        if (choices.profissional) {
          var aindaValido = res.data.some(function (p) { return p.nome === choices.profissional; });
          selectChoice('profissional', aindaValido ? choices.profissional : '');
        }
      }).catch(function () { /* offline: mantém o HTML fixo */ });
    });

    // A trilha da página (masculino/feminino, ver body[data-genero]) filtra
    // o que aparece pra agendar — serviço "unissex" (ex: Coloração) aparece
    // nas duas. Sem trilha marcada (ex: o Caixa PDV do painel), mostra tudo.
    var genero = document.body.getAttribute('data-genero');
    safeDbCall(function () {
      window.db.from('services').select('id,nome,preco,categoria').eq('ativo', true).then(function (res) {
        if (res.error || !res.data || !res.data.length) return;
        var lista = genero ? res.data.filter(function (s) { return s.categoria === genero || s.categoria === 'unissex'; }) : res.data;
        if (!lista.length) return;
        servicoGrid.innerHTML = lista.map(function (s) {
          return '<button type="button" class="pick-btn" data-value="' + esc(s.nome) + '">' + esc(s.nome) + '</button>';
        }).join('');
      }).catch(function () { /* offline: mantém o HTML fixo */ });
    });
  }

  // Dias que a casa fica fechada (dia_semana 0=domingo..6=sábado), pra não
  // deixar escolher um dia sem expediente. Sem rede, cai no padrão (só
  // domingo fechado) — o banco ainda recusa no fim das contas.
  function carregarDiasFechados() {
    if (!window.db) { diasFechados = new Set([0]); return Promise.resolve(); }
    try {
      return window.db.from('business_hours').select('dia_semana,fechado').then(function (res) {
        diasFechados = new Set((res.data || []).filter(function (r) { return r.fechado; }).map(function (r) { return r.dia_semana; }));
        if (!diasFechados.size) diasFechados = new Set([0]);
      }).catch(function () { diasFechados = new Set([0]); });
    } catch (e) {
      diasFechados = new Set([0]);
      return Promise.resolve();
    }
  }

  // Delegação de clique nos grupos — anexada uma única vez; sobrevive a
  // innerHTML novo (fetch do Supabase, geração de dias) porque o listener
  // fica no container, não nos botões.
  function rewireGroup(group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-value]');
      if (!btn || btn.disabled) return;
      selectChoice(group.getAttribute('data-group'), btn.getAttribute('data-value'));
    });
  }

  // -------- dias reais (próximos dias com expediente, conforme o horário
  // de funcionamento cadastrado pelo Rafael) --------
  function gerarDiasUteis(n) {
    var fechados = diasFechados || new Set([0]);
    var dias = [];
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (var i = 1; dias.length < n; i++) {
      var d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      if (!fechados.has(d.getDay())) dias.push(d);
    }
    return dias;
  }
  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function renderDias() {
    diasDisponiveis = gerarDiasUteis(6);
    diaRow.innerHTML = diasDisponiveis.map(function (d) {
      var label = DIAS_ABREV[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
      return '<button type="button" class="day-btn" data-value="' + label + '" data-iso="' + isoDate(d) + '">' +
        DIAS_ABREV[d.getDay()] + '<br>' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</button>';
    }).join('');
    renderHorarios(HORARIOS_PADRAO.map(function (h) { return { horario: h, disponivel: true }; }));
  }
  function renderHorarios(slots) {
    horarioGrid.innerHTML = slots.map(function (s) {
      return '<button type="button" class="time-btn" data-value="' + s.horario + '"' + (s.disponivel ? '' : ' disabled style="opacity:.35;"') + '>' + s.horario + (s.disponivel ? '' : ' (cheio)') + '</button>';
    }).join('');
  }

  // ao escolher o dia (e já com profissional escolhido), busca os horários
  // de verdade no banco — só dentro do horário de funcionamento e sem
  // conflito com quem já marcou (a função roda no servidor porque a
  // tabela de agendamentos não é pública, só o resultado sim/não é).
  function atualizarHorariosOcupados() {
    var diaBtn = diaRow.querySelector('.day-btn.selected');
    if (!diaBtn || !window.db) { renderHorarios(HORARIOS_PADRAO.map(function (h) { return { horario: h, disponivel: true }; })); return; }
    var iso = diaBtn.getAttribute('data-iso');
    var profBtn = profissionalList.querySelector('.pick-card.selected');
    var staffId = profBtn ? profBtn.getAttribute('data-staff-id') : null;
    try {
      window.db.rpc('public_agenda_slots', { p_dia: iso, p_staff_id: staffId || null }).then(function (res) {
        if (res.error || !res.data) { renderHorarios(HORARIOS_PADRAO.map(function (h) { return { horario: h, disponivel: true }; })); return; }
        renderHorarios(res.data);
      }).catch(function () { renderHorarios(HORARIOS_PADRAO.map(function (h) { return { horario: h, disponivel: true }; })); });
    } catch (e) {
      renderHorarios(HORARIOS_PADRAO.map(function (h) { return { horario: h, disponivel: true }; }));
    }
  }

  function isStepValid(step) {
    var stepEl = steps[step - 1];
    var requiredInputs = stepEl.querySelectorAll('.field-input[required]');
    if (requiredInputs.length) {
      return Array.prototype.every.call(requiredInputs, function (inp) {
        return inp.value.trim().length > 0;
      });
    }
    var group = stepEl.querySelector('[data-group]');
    if (!group) return true;
    var name = group.getAttribute('data-group');
    return Boolean(choices[name]);
  }

  function render() {
    steps.forEach(function (s) {
      s.classList.toggle('active', Number(s.dataset.step) === current);
    });
    dots.forEach(function (d) {
      var n = Number(d.dataset.dot);
      d.classList.toggle('active', n === current);
      d.classList.toggle('done', n < current);
    });
    // No passo 1 o "Voltar" não fica cinza sem fazer nada — ele fecha o
    // agendamento e volta pro hero, que é o "voltar" que faz sentido ali.
    nextBtn.textContent = current === totalSteps ? 'Confirmar e enviar no WhatsApp' : 'Continuar';
    // Não usamos o atributo disabled de verdade aqui — em alguns celulares
    // o autopreenchimento do teclado (nome/telefone) não dispara o evento
    // "input", e o botão ficava com disabled=true travado pra sempre,
    // mesmo com os campos já preenchidos. A classe só avisa visualmente;
    // o clique sempre confere o valor de verdade dos campos na hora.
    nextBtn.classList.toggle('is-disabled', !isStepValid(current));

    if (current === totalSteps) {
      document.getElementById('summaryBox').innerHTML =
        'Nome: <strong>' + esc(choices.nome || '—') + '</strong><br>' +
        'Profissional: <strong>' + esc(choices.profissional || '—') + '</strong><br>' +
        'Serviço: <strong>' + esc(choices.servico || '—') + '</strong><br>' +
        'Dia: <strong>' + esc(choices.dia || '—') + '</strong><br>' +
        'Horário: <strong>' + esc(choices.horario || '—') + '</strong>';
    }
  }

  function selectChoice(groupName, value) {
    choices[groupName] = value;
    var group = overlay.querySelector('[data-group="' + groupName + '"]');
    if (group) {
      group.querySelectorAll('[data-value]').forEach(function (b) {
        b.classList.toggle('selected', b.getAttribute('data-value') === value);
      });
    }
    if (groupName === 'profissional' || groupName === 'dia') atualizarHorariosOcupados();
    render();
  }

  function syncContatoFields() {
    choices.nome = nomeInput ? nomeInput.value.trim() : '';
    choices.telefone = telefoneInput ? telefoneInput.value.trim() : '';
  }

  ['input', 'change', 'blur'].forEach(function (evt) {
    if (nomeInput) nomeInput.addEventListener(evt, function () { syncContatoFields(); render(); });
    if (telefoneInput) telefoneInput.addEventListener(evt, function () { syncContatoFields(); render(); });
  });

  // Bug conhecido do Safari/Chrome no celular: um overlay position:fixed
  // com rolagem própria (que é exatamente o nosso .wizard-overlay) pode
  // ficar com a área de toque "desalinhada" do que é mostrado na tela
  // depois que o teclado do celular abre e fecha (ao digitar nome/telefone).
  // Os botões continuam aparecendo normais, mas o toque neles para de
  // funcionar — sem erro nenhum, porque visualmente nada muda. O truque
  // pra forçar o navegador a recalcular é alternar um transform no overlay
  // assim que o teclado fecha.
  function forcarRecalculoDeToque() {
    overlay.style.transform = 'translateZ(0)';
    window.scrollTo(0, 0);
    setTimeout(function () { overlay.style.transform = ''; }, 60);
  }
  [nomeInput, telefoneInput].forEach(function (inp) {
    if (inp) inp.addEventListener('blur', function () { setTimeout(forcarRecalculoDeToque, 80); });
  });

  var dadosCarregados = false;
  function open(preselectProf, preselectServico) {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    lockScroll();

    if (!dadosCarregados) {
      carregarProfissionaisEServicos();
      carregarDiasFechados().then(renderDias);
      dadosCarregados = true;
    }

    var saved = loadSavedContact();
    isReturningClient = Boolean(saved);
    if (saved) {
      choices.nome = saved.nome;
      choices.telefone = saved.telefone;
      if (nomeInput) nomeInput.value = saved.nome;
      if (telefoneInput) telefoneInput.value = saved.telefone;
      // cliente que já tem contato salvo pula o passo 1 — registra o
      // acesso aqui mesmo, senão quem só volta nunca contaria de novo
      if (window.db) {
        safeDbCall(function () {
          window.db.rpc('registrar_cliente', { p_nome: saved.nome, p_telefone: saved.telefone }).catch(function () { /* offline, sem problema */ });
        });
      }
    }
    if (welcomeHint) {
      if (isReturningClient) {
        welcomeHint.textContent = 'Bem-vindo de volta, ' + saved.nome.split(' ')[0] + '! Já preenchemos seus dados — é só conferir.';
        welcomeHint.style.display = '';
      } else {
        welcomeHint.style.display = 'none';
      }
    }

    if (preselectProf) selectChoice('profissional', preselectProf);
    if (preselectServico) selectChoice('servico', preselectServico);
    current = isReturningClient ? (preselectProf ? (preselectServico ? 4 : 3) : 2) : STEP_CONTATO;
    render();
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    unlockScroll();
    current = 1;
    choices = {};
    overlay.querySelectorAll('.selected').forEach(function (b) {
      b.classList.remove('selected');
    });
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  rewireGroup(profissionalList);
  rewireGroup(servicoGrid);
  rewireGroup(diaRow);
  rewireGroup(horarioGrid);

  backBtn.addEventListener('click', function () {
    if (current > 1) {
      current--;
      render();
      overlay.scrollTop = 0;
    } else {
      close();
    }
  });

  // Devolve {ok:true} quando salvou, ou {ok:false, bloqueado:true, message}
  // quando o próprio banco recusou o horário (alguém marcou primeiro, ou
  // caiu fora do expediente) — nesse caso não faz sentido seguir pro
  // WhatsApp como se tivesse dado certo. Erro de rede/offline segue
  // {ok:false, bloqueado:false} e cai no fallback (o Rafael confirma pelo
  // WhatsApp mesmo).
  function salvarAgendamentoNoBanco() {
    if (!window.db) return Promise.resolve({ ok: false, bloqueado: false });
    var diaBtn = diaRow.querySelector('.day-btn.selected');
    var profBtn = profissionalList.querySelector('.pick-card.selected');
    try {
      return window.db.from('appointments').insert({
        cliente_nome: choices.nome || '',
        cliente_telefone: choices.telefone || '',
        staff_id: profBtn ? profBtn.getAttribute('data-staff-id') : null,
        staff_nome: choices.profissional || null,
        servico: choices.servico || null,
        dia: diaBtn ? diaBtn.getAttribute('data-iso') : null,
        dia_label: choices.dia || null,
        horario: choices.horario || '',
        origem: 'site'
      }).then(function (res) {
        if (res.error) {
          console.error('Não deu pra salvar o agendamento no banco:', res.error.message);
          return { ok: false, bloqueado: true, message: res.error.message };
        }
        return { ok: true };
      }).catch(function (e) {
        console.error('Agenda offline, seguindo só pelo WhatsApp:', e);
        return { ok: false, bloqueado: false };
      });
    } catch (e) {
      console.error('Agenda offline, seguindo só pelo WhatsApp:', e);
      return Promise.resolve({ ok: false, bloqueado: false });
    }
  }

  nextBtn.addEventListener('click', function () {
    syncContatoFields();
    if (!isStepValid(current)) {
      render();
      var stepEl = steps[current - 1];
      var vazio = stepEl.querySelector('.field-input[required]');
      if (vazio) {
        // reportValidity mostra a bolha nativa "preencha este campo" e já
        // rola/foca sozinho — importante porque em alguns celulares o
        // autopreenchimento mostra o texto na tela sem de fato gravar no
        // value do campo, e aí um focus() silencioso parecia "não fazer nada".
        if (vazio.reportValidity) vazio.reportValidity();
        else vazio.focus();
      }
      return;
    }

    var eraStepContato = current === STEP_CONTATO;
    if (eraStepContato) {
      syncContatoFields();
      saveContact(choices.nome, choices.telefone);
    }

    if (current < totalSteps) {
      current++;
      render();
      overlay.scrollTop = 0;
      // Captura o cliente no banco DEPOIS de já ter avançado a tela — um
      // erro aqui (rede, SDK, o que for) nunca pode travar o agendamento,
      // então isso roda por último e nunca bloqueia o passo seguinte.
      if (eraStepContato && window.db) {
        safeDbCall(function () {
          window.db.rpc('registrar_cliente', { p_nome: choices.nome || '', p_telefone: choices.telefone || '' }).catch(function () { /* offline: sem problema, tenta de novo na próxima visita */ });
        });
      }
      return;
    }

    nextBtn.disabled = true;
    salvarAgendamentoNoBanco().then(function (resultado) {
      if (resultado && resultado.bloqueado) {
        nextBtn.disabled = false;
        alert('Esse horário acabou de ficar indisponível: ' + resultado.message + ' Escolha outro horário.');
        current = 4;
        render();
        atualizarHorariosOcupados();
        return;
      }
      var msg = 'Olá! Quero agendar um horário:%0A' +
        '• Nome: ' + encodeURIComponent(choices.nome || '') + '%0A' +
        '• Telefone: ' + encodeURIComponent(choices.telefone || '') + '%0A' +
        '• Profissional: ' + encodeURIComponent(choices.profissional || '') + '%0A' +
        '• Serviço: ' + encodeURIComponent(choices.servico || '') + '%0A' +
        '• Dia: ' + encodeURIComponent(choices.dia || '') + '%0A' +
        '• Horário: ' + encodeURIComponent(choices.horario || '');
      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + msg;
      window.open(url, '_blank', 'noopener');
      close();
    });
  });

  // Abre o widget a partir de qualquer botão marcado com data-open-widget.
  document.querySelectorAll('[data-open-widget]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      open(btn.getAttribute('data-preselect-prof'), btn.getAttribute('data-preselect-servico'));
      if (window.RafaelMenu) window.RafaelMenu.close();
    });
  });

  window.RafaelWidget = { open: open, close: close };
})();

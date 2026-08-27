/* Widget de agendamento (Agenda) — passo a passo:
   1) seus dados (nome/telefone, com reconhecimento de cliente que já
   agendou antes)  2) profissional  3) serviço  4) dia/horário
   5) confirmar (envia no WhatsApp).
   Qualquer botão com [data-open-widget] abre o widget. Se tiver
   data-preselect-prof="Nome", o profissional já entra escolhido. */
(function () {
  var WHATSAPP_NUMBER = '5515996507174';
  var STORAGE_KEY = 'rafaelClienteContato';
  var STEP_CONTATO = 1;

  var overlay = document.getElementById('wizardOverlay');
  if (!overlay) return;

  var closeBtn = document.getElementById('wizardClose');
  var backBtn = document.getElementById('wizardBack');
  var nextBtn = document.getElementById('wizardNext');
  var welcomeHint = document.getElementById('welcomeBackHint');
  var nomeInput = document.getElementById('clienteNome');
  var telefoneInput = document.getElementById('clienteTelefone');
  var steps = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-step'));
  var dots = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-steps-dots span'));
  var totalSteps = steps.length;
  var current = 1;
  var choices = {};
  var lastFocused = null;
  var lockedScrollY = 0;
  var isReturningClient = false;

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
    // instantâneo — evita "piscar" pro topo antes de voltar pro scroll certo
    window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
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
    backBtn.disabled = current === 1;
    nextBtn.textContent = current === totalSteps ? 'Confirmar e enviar no WhatsApp' : 'Continuar';
    nextBtn.disabled = !isStepValid(current);

    if (current === totalSteps) {
      document.getElementById('summaryBox').innerHTML =
        'Nome: <strong>' + (choices.nome || '—') + '</strong><br>' +
        'Profissional: <strong>' + (choices.profissional || '—') + '</strong><br>' +
        'Serviço: <strong>' + (choices.servico || '—') + '</strong><br>' +
        'Dia: <strong>' + (choices.dia || '—') + '</strong><br>' +
        'Horário: <strong>' + (choices.horario || '—') + '</strong>';
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
    render();
  }

  function syncContatoFields() {
    choices.nome = nomeInput ? nomeInput.value.trim() : '';
    choices.telefone = telefoneInput ? telefoneInput.value.trim() : '';
  }

  if (nomeInput) nomeInput.addEventListener('input', function () { syncContatoFields(); render(); });
  if (telefoneInput) telefoneInput.addEventListener('input', function () { syncContatoFields(); render(); });

  function open(preselectProf) {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    lockScroll();

    var saved = loadSavedContact();
    isReturningClient = Boolean(saved);
    if (saved) {
      choices.nome = saved.nome;
      choices.telefone = saved.telefone;
      if (nomeInput) nomeInput.value = saved.nome;
      if (telefoneInput) telefoneInput.value = saved.telefone;
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
    current = isReturningClient ? (preselectProf ? 3 : 2) : STEP_CONTATO;
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

  overlay.querySelectorAll('[data-group]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-value]');
      if (!btn) return;
      selectChoice(group.getAttribute('data-group'), btn.getAttribute('data-value'));
    });
  });

  backBtn.addEventListener('click', function () {
    if (current > 1) {
      current--;
      render();
    }
  });

  nextBtn.addEventListener('click', function () {
    if (!isStepValid(current)) return;

    if (current === STEP_CONTATO) {
      syncContatoFields();
      saveContact(choices.nome, choices.telefone);
    }

    if (current < totalSteps) {
      current++;
      render();
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

  // Abre o widget a partir de qualquer botão marcado com data-open-widget.
  document.querySelectorAll('[data-open-widget]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      open(btn.getAttribute('data-preselect-prof'));
      if (window.RafaelMenu) window.RafaelMenu.close();
    });
  });

  window.RafaelWidget = { open: open, close: close };
})();

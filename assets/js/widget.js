/* Widget de agendamento (Agenda) — passo a passo:
   1) profissional  2) serviço  3) dia/horário  4) confirmar (envia no WhatsApp)
   Qualquer botão com [data-open-widget] abre o widget. Se tiver
   data-preselect-prof="Nome", o profissional já entra escolhido e o
   widget pula direto pro passo do serviço. */
(function () {
  var WHATSAPP_NUMBER = '5515996507174';

  var overlay = document.getElementById('wizardOverlay');
  if (!overlay) return;

  var closeBtn = document.getElementById('wizardClose');
  var backBtn = document.getElementById('wizardBack');
  var nextBtn = document.getElementById('wizardNext');
  var steps = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-step'));
  var dots = Array.prototype.slice.call(overlay.querySelectorAll('.wizard-steps-dots span'));
  var totalSteps = steps.length;
  var current = 1;
  var choices = {};
  var lastFocused = null;

  function isStepValid(step) {
    var group = steps[step - 1].querySelector('[data-group]');
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

  function open(startStep) {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    current = startStep || 1;
    render();
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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
    if (current < totalSteps) {
      current++;
      render();
      return;
    }
    var msg = 'Olá! Quero agendar um horário:%0A' +
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
      var preselect = btn.getAttribute('data-preselect-prof');
      if (preselect) {
        selectChoice('profissional', preselect);
        open(2);
      } else {
        open(1);
      }
      if (window.RafaelMenu) window.RafaelMenu.close();
    });
  });

  window.RafaelWidget = { open: open, close: close };
})();

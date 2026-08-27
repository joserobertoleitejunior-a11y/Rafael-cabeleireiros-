/* Gráficos do dashboard — SVG simples, sem biblioteca externa.
   Paleta categórica validada (ouro / azul-ardósia / terracota) pra ΔE de
   contraste e daltonismo — ver PADROES-AGENCIA.md e o passo de dataviz. */
(function (global) {
  var CATEGORICAL = ['#B08D2F', '#3D6FA5', '#A8543F'];

  function fmtBRL(v) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function el(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // opts: { data:[{label,value}], height, color, valueFormatter, ariaLabel, labelHeader, valueHeader }
  function barChart(container, opts) {
    var data = opts.data || [];
    container.innerHTML = '';
    if (!data.length) {
      container.innerHTML = '<p class="admin-chart-empty">Sem dados neste período ainda.</p>';
      return;
    }
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var h = opts.height || 140;
    var n = data.length;
    var barW = 100 / n;
    var fmt = opts.valueFormatter || function (v) { return String(v); };

    var svg = el('svg', {
      viewBox: '0 0 100 ' + h,
      preserveAspectRatio: 'none',
      class: 'admin-chart-svg',
      role: 'img',
      'aria-label': opts.ariaLabel || 'Gráfico de barras'
    });

    svg.appendChild(el('line', {
      x1: 0, x2: 100, y1: h - 22, y2: h - 22,
      stroke: 'rgba(245,241,232,0.16)', 'stroke-width': 0.6
    }));

    data.forEach(function (d, i) {
      var barH = max > 0 ? (d.value / max) * (h - 42) : 0;
      var w = barW * 0.5;
      var x = i * barW + (barW - w) / 2;
      var y = (h - 22) - barH;
      var color = d.color || opts.color || CATEGORICAL[i % CATEGORICAL.length];

      var rect = el('rect', {
        x: x, y: y, width: w, height: Math.max(barH, 1.5),
        rx: Math.min(w / 2, 2.4), fill: color
      });
      var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = d.label + ': ' + fmt(d.value);
      rect.appendChild(title);
      svg.appendChild(rect);

      var label = el('text', {
        x: x + w / 2, y: h - 8, 'text-anchor': 'middle',
        'font-size': 5, fill: 'rgba(245,241,232,0.6)'
      });
      label.textContent = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
      svg.appendChild(label);
    });

    container.appendChild(svg);

    var details = document.createElement('details');
    details.className = 'admin-chart-table-toggle';
    var summary = document.createElement('summary');
    summary.textContent = 'Ver como tabela';
    details.appendChild(summary);
    var table = document.createElement('table');
    table.className = 'admin-chart-table';
    var rows = data.map(function (d) {
      return '<tr><td>' + d.label + '</td><td>' + fmt(d.value) + '</td></tr>';
    }).join('');
    table.innerHTML = '<thead><tr><th>' + (opts.labelHeader || 'Item') + '</th><th>' + (opts.valueHeader || 'Valor') + '</th></tr></thead><tbody>' + rows + '</tbody>';
    details.appendChild(table);
    container.appendChild(details);
  }

  global.RafaelCharts = { barChart: barChart, fmtBRL: fmtBRL, CATEGORICAL: CATEGORICAL };
})(window);

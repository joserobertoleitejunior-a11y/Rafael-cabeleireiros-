/* Camada de dados do admin — tudo salvo no localStorage do navegador.
   Sem backend: os dados não sincronizam entre aparelhos, cada dispositivo
   tem a própria cópia. Serve pra um único ponto de uso (o celular/tablet
   do balcão), não pra equipe inteira acessando de lugares diferentes. */
(function (global) {
  var DATA_KEY = 'rafaelAdminData';
  var PIN_KEY = 'rafaelAdminPin';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function seed() {
    return {
      services: [
        { id: uid(), nome: 'Corte', preco: 45 },
        { id: uid(), nome: 'Barba', preco: 35 },
        { id: uid(), nome: 'Corte + Barba', preco: 70 },
        { id: uid(), nome: 'Coloração', preco: 90 }
      ],
      team: [
        { id: 'rafael-souza', nome: 'Rafael Souza', especialidade: 'Fundador · Master Barber', foto: null },
        { id: 'carla-menezes', nome: 'Carla Menezes', especialidade: 'Colorista & Tratamentos', foto: null }
      ],
      sales: [],
      feedback: {},
      gallery: []
    };
  }

  function load() {
    var base = seed();
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) {
        save(base);
        return base;
      }
      var data = JSON.parse(raw);
      var merged = Object.assign({}, base, data);
      merged.feedback = data.feedback || {};
      return merged;
    } catch (e) {
      return base;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch (e) {
      /* localStorage cheio ou indisponível — a ação em memória segue,
         mas não persiste; quem chamou deve avisar o usuário se precisar */
    }
  }

  function monthKey(iso) {
    return iso.slice(0, 7); // YYYY-MM
  }

  var Store = {
    uid: uid,
    getData: load,
    setData: save,

    // ---- vendas (Caixa PDV) ----
    addSale: function (sale) {
      var d = load();
      sale.id = uid();
      sale.dataISO = sale.dataISO || new Date().toISOString();
      d.sales.push(sale);
      save(d);
      return sale;
    },
    removeSale: function (id) {
      var d = load();
      d.sales = d.sales.filter(function (s) { return s.id !== id; });
      save(d);
    },
    getSales: function () {
      return load().sales.slice().sort(function (a, b) { return b.dataISO.localeCompare(a.dataISO); });
    },

    // ---- serviços ----
    addService: function (svc) {
      var d = load();
      svc.id = uid();
      d.services.push(svc);
      save(d);
      return svc;
    },
    updateService: function (id, patch) {
      var d = load();
      var s = d.services.filter(function (x) { return x.id === id; })[0];
      if (s) Object.assign(s, patch);
      save(d);
    },
    removeService: function (id) {
      var d = load();
      d.services = d.services.filter(function (s) { return s.id !== id; });
      save(d);
    },

    // ---- equipe ----
    addTeam: function (member) {
      var d = load();
      member.id = uid();
      d.team.push(member);
      save(d);
      return member;
    },
    updateTeam: function (id, patch) {
      var d = load();
      var m = d.team.filter(function (x) { return x.id === id; })[0];
      if (m) Object.assign(m, patch);
      save(d);
    },
    removeTeam: function (id) {
      var d = load();
      d.team = d.team.filter(function (t) { return t.id !== id; });
      save(d);
    },

    // ---- feedback de cliente (por telefone) ----
    addFeedback: function (telefone, fb) {
      var d = load();
      if (!d.feedback[telefone]) d.feedback[telefone] = [];
      fb.dataISO = new Date().toISOString();
      d.feedback[telefone].push(fb);
      save(d);
    },

    // ---- galeria ----
    addPhoto: function (photo) {
      var d = load();
      photo.id = uid();
      photo.dataISO = new Date().toISOString();
      d.gallery.unshift(photo);
      save(d);
      return photo;
    },
    removePhoto: function (id) {
      var d = load();
      d.gallery = d.gallery.filter(function (p) { return p.id !== id; });
      save(d);
    },

    // ---- clientes: derivados do histórico de vendas ----
    getClients: function () {
      var d = load();
      var map = {};
      d.sales.forEach(function (s) {
        if (!s.clienteTelefone) return;
        if (!map[s.clienteTelefone]) {
          map[s.clienteTelefone] = { telefone: s.clienteTelefone, nome: s.clienteNome || '', cortes: [] };
        }
        map[s.clienteTelefone].cortes.push(s);
        if (s.clienteNome) map[s.clienteTelefone].nome = s.clienteNome;
      });
      var now = new Date();
      var thisMonth = monthKey(now.toISOString());
      return Object.keys(map).map(function (tel) {
        var c = map[tel];
        c.totalCortes = c.cortes.length;
        c.ultimaVisita = c.cortes.reduce(function (max, s) { return s.dataISO > max ? s.dataISO : max; }, c.cortes[0].dataISO);
        c.cortesEsteMes = c.cortes.filter(function (s) { return monthKey(s.dataISO) === thisMonth; }).length;
        c.feedback = d.feedback[tel] || [];
        return c;
      }).sort(function (a, b) { return b.ultimaVisita.localeCompare(a.ultimaVisita); });
    },

    // ---- estatísticas pro dashboard ----
    getStats: function () {
      var d = load();
      var now = new Date();
      var thisMonth = monthKey(now.toISOString());
      var salesThisMonth = d.sales.filter(function (s) { return monthKey(s.dataISO) === thisMonth; });
      var ganhosMes = salesThisMonth.reduce(function (sum, s) { return sum + (Number(s.valor) || 0); }, 0);

      var porBarbeiro = {};
      salesThisMonth.forEach(function (s) {
        var key = s.barbeiroNome || 'Sem profissional';
        porBarbeiro[key] = (porBarbeiro[key] || 0) + 1;
      });

      var porDia = {};
      salesThisMonth.forEach(function (s) {
        var dia = s.dataISO.slice(0, 10);
        porDia[dia] = (porDia[dia] || 0) + (Number(s.valor) || 0);
      });

      return {
        cortesMes: salesThisMonth.length,
        ganhosMes: ganhosMes,
        ticketMedio: salesThisMonth.length ? ganhosMes / salesThisMonth.length : 0,
        porBarbeiro: porBarbeiro,
        porDia: porDia,
        historico: d.sales.slice().sort(function (a, b) { return b.dataISO.localeCompare(a.dataISO); }).slice(0, 25)
      };
    },

    // ---- PIN (trava simples, não é autenticação de verdade — ver README) ----
    hasPin: function () { return Boolean(localStorage.getItem(PIN_KEY)); },
    setPin: function (pin) { localStorage.setItem(PIN_KEY, pin); },
    checkPin: function (pin) { return localStorage.getItem(PIN_KEY) === pin; },
    clearPin: function () { localStorage.removeItem(PIN_KEY); }
  };

  global.RafaelAdminStore = Store;
})(window);

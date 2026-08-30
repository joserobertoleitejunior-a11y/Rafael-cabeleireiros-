/* Camada de dados do admin — agora fala com o Supabase (banco de verdade).
   Autenticação por PIN acontece 100% no banco (função login_pin), então o
   PIN nunca é comparado no navegador — só o token de sessão que ela devolve
   fica guardado aqui, em localStorage, pra sobreviver a um F5. */
(function (global) {
  var SESSION_KEY = 'rafaelAdminSessao';

  function db() {
    if (!global.db) throw new Error('Sem conexão com o Supabase (CDN bloqueada ou offline).');
    return global.db;
  }

  function unwrap(promise) {
    return promise.then(function (res) {
      if (res.error) throw new Error(res.error.message || 'Erro no Supabase.');
      return res.data;
    });
  }

  function saveSession(session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* segue sem persistir */ }
  }
  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* nada a fazer */ }
  }

  // Comprime e converte um arquivo de imagem em blob JPEG, e sobe no
  // Storage do Supabase (bucket "fotos", público). Devolve a URL pública.
  function uploadPhoto(file, pastaPrefixo, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, (maxDim || 900) / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('Não deu pra processar a imagem.')); return; }
            var nomeArquivo = (pastaPrefixo || 'foto') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
            db().storage.from('fotos').upload(nomeArquivo, blob, { contentType: 'image/jpeg' })
              .then(function (res) {
                if (res.error) { reject(new Error(res.error.message)); return; }
                var pub = db().storage.from('fotos').getPublicUrl(nomeArquivo);
                resolve(pub.data.publicUrl);
              })
              .catch(reject);
          }, 'image/jpeg', quality || 0.82);
        };
        img.onerror = function () { reject(new Error('Arquivo de imagem inválido.')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Não deu pra ler o arquivo.')); };
      reader.readAsDataURL(file);
    });
  }

  var Store = {
    // ---- sessão / autenticação ----
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,

    login: function (pin) {
      return unwrap(db().rpc('login_pin', { p_pin: pin })).then(function (data) {
        var session = { token: data.token, staffId: data.staff_id, nome: data.nome, role: data.role };
        saveSession(session);
        return session;
      });
    },
    checkSession: function (token) {
      return unwrap(db().rpc('check_session', { p_token: token })).then(function (data) {
        if (!data) return null;
        return { token: token, staffId: data.staff_id, nome: data.nome, role: data.role };
      });
    },
    logout: function (token) {
      clearSession();
      if (!token) return Promise.resolve();
      return unwrap(db().rpc('logout_session', { p_token: token })).catch(function () { /* sessão já pode ter expirado */ });
    },

    // ---- equipe (leitura: qualquer logado · escrita: só dono) ----
    listStaff: function (token) {
      return unwrap(db().rpc('admin_list_staff', { p_token: token }));
    },
    addStaff: function (token, nome, especialidade, pin, role, fotoUrl) {
      return unwrap(db().rpc('admin_add_staff', {
        p_token: token, p_nome: nome, p_especialidade: especialidade, p_pin: pin, p_role: role || 'staff', p_foto_url: fotoUrl || null
      }));
    },
    updateStaffPhoto: function (token, id, fotoUrl) {
      return unwrap(db().rpc('admin_update_staff_photo', { p_token: token, p_id: id, p_foto_url: fotoUrl }));
    },
    removeStaff: function (token, id) {
      return unwrap(db().rpc('admin_remove_staff', { p_token: token, p_id: id }));
    },

    // ---- serviços (leitura pública · escrita: só dono) ----
    listServices: function () {
      return unwrap(db().from('services').select('id,nome,preco,categoria').eq('ativo', true).order('created_at'));
    },
    addService: function (token, nome, preco, categoria) {
      return unwrap(db().rpc('admin_add_service', { p_token: token, p_nome: nome, p_preco: preco, p_categoria: categoria || 'unissex' }));
    },
    updateService: function (token, id, nome, preco, categoria) {
      return unwrap(db().rpc('admin_update_service', { p_token: token, p_id: id, p_nome: nome, p_preco: preco, p_categoria: categoria || null }));
    },
    removeService: function (token, id) {
      return unwrap(db().rpc('admin_delete_service', { p_token: token, p_id: id }));
    },

    // ---- Caixa PDV (qualquer funcionário logado) ----
    addSale: function (token, sale) {
      return unwrap(db().rpc('pdv_add_sale', {
        p_token: token,
        p_staff_id: sale.staffId || null,
        p_staff_nome: sale.staffNome || null,
        p_service_id: sale.serviceId || null,
        p_service_nome: sale.serviceNome,
        p_valor: sale.valor,
        p_pagamentos: sale.pagamentos || [],
        p_cliente_nome: sale.clienteNome || null,
        p_cliente_telefone: sale.clienteTelefone || null
      }));
    },

    // ---- clientes (qualquer funcionário logado — sem valores de venda) ----
    listClients: function (token) {
      return unwrap(db().rpc('list_clients', { p_token: token }));
    },
    listClientFeedback: function (token, telefone) {
      return unwrap(db().rpc('list_client_feedback', { p_token: token, p_telefone: telefone }));
    },
    clientProfile: function (token, telefone) {
      return unwrap(db().rpc('client_profile', { p_token: token, p_telefone: telefone }));
    },
    addStaffFeedback: function (token, telefone, comentario) {
      return unwrap(db().rpc('add_staff_feedback', { p_token: token, p_telefone: telefone, p_comentario: comentario }));
    },

    // ---- galeria (adicionar: qualquer logado · marcar/remover: só dono · leitura pública) ----
    listGallery: function () {
      return unwrap(db().from('gallery').select('id,foto_url,staff_id,created_at').order('created_at', { ascending: false }));
    },
    addGalleryPhoto: function (token, fotoUrl, staffId) {
      return unwrap(db().rpc('add_gallery_photo', { p_token: token, p_foto_url: fotoUrl, p_staff_id: staffId || null }));
    },
    removeGalleryPhoto: function (token, id) {
      return unwrap(db().rpc('admin_remove_gallery_photo', { p_token: token, p_id: id }));
    },
    tagGalleryPhoto: function (token, id, staffId) {
      return unwrap(db().rpc('admin_tag_gallery_photo', { p_token: token, p_id: id, p_staff_id: staffId || null }));
    },

    // ---- dashboard (só dono) ----
    dashboardStats: function (token) {
      return unwrap(db().rpc('admin_dashboard_stats', { p_token: token }));
    },

    // ---- taxa de criação do site (pagamento único, separado da mensalidade) ----
    minhaTaxaCriacao: function (token) {
      return unwrap(db().rpc('minha_taxa_criacao', { p_token: token }));
    },
    minhaAssinatura: function (token) {
      return unwrap(db().rpc('minha_assinatura', { p_token: token }));
    },

    // ---- agenda (qualquer funcionário logado marca/desmarca — validação de
    // horário de funcionamento e de conflito acontece no banco, via trigger) ----
    listAppointments: function (token) {
      return unwrap(db().rpc('admin_list_appointments', { p_token: token }));
    },
    updateAppointmentStatus: function (token, id, status) {
      return unwrap(db().rpc('admin_update_appointment_status', { p_token: token, p_id: id, p_status: status }));
    },
    createAppointment: function (a) {
      return unwrap(db().from('appointments').insert({
        cliente_nome: a.clienteNome || '',
        cliente_telefone: a.clienteTelefone || '',
        staff_id: a.staffId || null,
        staff_nome: a.staffNome || null,
        servico: a.servico || null,
        dia: a.dia,
        dia_label: a.diaLabel || null,
        horario: a.horario,
        origem: 'pdv'
      }).select().single());
    },
    agendaSlots: function (dia, staffId) {
      return unwrap(db().rpc('public_agenda_slots', { p_dia: dia, p_staff_id: staffId || null }));
    },

    // ---- horário de funcionamento (leitura pública · escrita: só dono) ----
    listBusinessHours: function () {
      return unwrap(db().from('business_hours').select('dia_semana,abre,fecha,fechado').order('dia_semana'));
    },
    updateBusinessHours: function (token, diaSemana, abre, fecha, fechado) {
      return unwrap(db().rpc('admin_update_business_hours', {
        p_token: token, p_dia_semana: diaSemana, p_abre: abre, p_fecha: fecha, p_fechado: fechado
      }));
    },

    // ---- produtos (leitura pública · escrita: só dono) ----
    listProducts: function () {
      return unwrap(db().from('products').select('id,nome,descricao,preco,foto_url').eq('ativo', true).order('created_at'));
    },
    addProduct: function (token, nome, descricao, preco, fotoUrl) {
      return unwrap(db().rpc('admin_add_product', { p_token: token, p_nome: nome, p_descricao: descricao, p_preco: preco, p_foto_url: fotoUrl || null }));
    },
    updateProduct: function (token, id, nome, descricao, preco, fotoUrl) {
      return unwrap(db().rpc('admin_update_product', { p_token: token, p_id: id, p_nome: nome, p_descricao: descricao, p_preco: preco, p_foto_url: fotoUrl || null }));
    },
    removeProduct: function (token, id) {
      return unwrap(db().rpc('admin_remove_product', { p_token: token, p_id: id }));
    },

    uploadPhoto: uploadPhoto
  };

  global.RafaelAdminStore = Store;
})(window);

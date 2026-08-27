/* Cliente Supabase compartilhado — chave pública (anon), protegida pelo
   RLS + funções RPC no banco (ver supabase/migrations). Sem isso, nada
   funciona: agenda real, painel, PDV, tudo depende deste arquivo. */
(function (global) {
  var SUPABASE_URL = 'https://fwxwhndjgzwipgpzbnzr.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_MKW9-5jvknelLGs8sY82wQ_PytW6rZa';

  if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
    console.error('Supabase JS não carregou (CDN bloqueado ou offline). O site funciona sem agenda/painel até isso voltar.');
    global.db = null;
    return;
  }

  global.db = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
})(window);

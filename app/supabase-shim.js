// Versão publicada: window.claude.use('user'|'db'|'assets') em cima do Supabase.
// - db: tabela public.docs (colecao, id, dados jsonb). Leitura pública; escrita só para admin (RLS).
// - assets: bucket público "arquivos" (folhas do kartódromo). Envio e remoção só para admin.
// - user: quem fez login e está na tabela public.admins pode editar; o resto do público só visualiza.
(() => {
  const cfg = window.IDT_CONFIG || {};
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const BUCKET = 'arquivos';

  // ---------- db ----------
  const listeners = new Map(); // coleção → Set
  const snapDe = (rows) => ({ docs: rows.map((r) => ({ id: r.id, data: () => r.dados, exists: true })), size: rows.length, empty: !rows.length });
  async function lerColecao(col) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from('docs').select('id, dados').eq('colecao', col).range(de, de + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }
  async function notify(col) {
    const set = listeners.get(col);
    if (!set || !set.size) return;
    try { const snap = snapDe(await lerColecao(col)); set.forEach((s) => { try { s.next(snap); } catch (e) { console.error(e); } }); }
    catch (e) { set.forEach((s) => s.error && s.error(e)); }
  }
  // mudanças feitas por outra pessoa (outro admin, outra aba) chegam pelo realtime
  const atraso = new Map();
  sb.channel('docs').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (m) => {
    const col = (m.new && m.new.colecao) || (m.old && m.old.colecao);
    if (!col || !listeners.has(col)) return;
    clearTimeout(atraso.get(col)); atraso.set(col, setTimeout(() => notify(col), 250));
  }).subscribe();

  const merge = (a, b) => {
    const out = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
    for (const [k, v] of Object.entries(b || {})) {
      if (v && typeof v === 'object' && v.__delete__ === true) delete out[k];
      else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(out[k], v);
      else out[k] = v;
    }
    return out;
  };
  const partes = (p) => { const s = p.split('/'); return { col: s.slice(0, -1).join('/'), id: s[s.length - 1] }; };
  const falhou = (error) => { if (error) { const e = new Error(error.message || 'erro no banco'); e.code = error.code; throw e; } };

  const db = {
    collection(col) {
      return {
        onSnapshot(next, error) {
          if (!listeners.has(col)) listeners.set(col, new Set());
          const s = { next, error }; listeners.get(col).add(s);
          lerColecao(col).then((rows) => next(snapDe(rows)), (e) => error && error(e));
          return () => listeners.get(col).delete(s);
        },
        async get() { return snapDe(await lerColecao(col)); },
        doc: (id) => db.doc(col + '/' + id),
      };
    },
    doc(p) {
      const { col, id } = partes(p);
      const atual = async () => { const { data, error } = await sb.from('docs').select('dados').eq('colecao', col).eq('id', id).maybeSingle(); falhou(error); return data ? data.dados : null; };
      const grava = async (dados) => { const { error } = await sb.from('docs').upsert({ colecao: col, id, dados, atualizado_em: new Date().toISOString() }); falhou(error); await notify(col); };
      return {
        id,
        async get() { const d = await atual(); return { id, exists: d != null, data: () => d }; },
        set: (d) => grava(d),
        async update(d) { await grava(merge(await atual(), d)); },
        async delete() { const { error } = await sb.from('docs').delete().eq('colecao', col).eq('id', id); falhou(error); await notify(col); },
      };
    },
  };

  // ---------- usuário ----------
  let sessao = null, admin = false;
  const pronto = (async () => {
    const { data } = await sb.auth.getSession();
    sessao = data.session;
    if (sessao) { const { data: ok } = await sb.rpc('is_admin'); admin = ok === true; }
  })();
  const user = {
    canEdit: async () => { await pronto; return admin; },
    id: async () => { await pronto; return sessao ? sessao.user.id : null; },
    email: async () => { await pronto; return sessao ? sessao.user.email : null; },
    profiles: async (ids) => { await pronto; return Object.fromEntries(ids.map((i) => [i, { name: sessao && i === sessao.user.id ? sessao.user.email : '' }])); },
  };

  // ---------- arquivos ----------
  const novoId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const assets = {
    async upload(blob, opts = {}) {
      const id = opts.id || novoId();
      const { error } = await sb.storage.from(BUCKET).upload(id, blob, { contentType: opts.type || blob.type || 'application/octet-stream', upsert: !!opts.id });
      if (error) { const e = new Error(error.message); e.code = /size|large/i.test(error.message) ? 'too_large' : 'upload'; throw e; }
      return { id, url: assets.url(id), sizeBytes: blob.size };
    },
    async delete(id) { await sb.storage.from(BUCKET).remove([id]); },
    url: (id) => sb.storage.from(BUCKET).getPublicUrl(id).data.publicUrl,
  };

  // ---------- login do admin ----------
  async function entrar(email, senha) {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) return { ok: false, motivo: /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message };
    const { data: ok } = await sb.rpc('is_admin');
    if (ok !== true) { await sb.auth.signOut(); return { ok: false, motivo: 'Este e-mail não tem acesso de administrador.' }; }
    return { ok: true };
  }
  async function sair() { await sb.auth.signOut(); }
  async function esqueci(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    return error ? { ok: false, motivo: error.message } : { ok: true };
  }
  // link do e-mail de "esqueci a senha": abre o formulário para criar a senha nova
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') window.dispatchEvent(new CustomEvent('idt-nova-senha')); });
  async function novaSenha(senha) { const { error } = await sb.auth.updateUser({ password: senha }); return error ? { ok: false, motivo: error.message } : { ok: true }; }

  const caps = { user, db, assets };
  window.claude = { use: async (name) => caps[name] || null, arquivoUrl: assets.url, conta: { entrar, sair, esqueci, novaSenha, email: user.email }, publicado: true };
})();

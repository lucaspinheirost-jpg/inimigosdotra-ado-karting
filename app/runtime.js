// Núcleo do sistema único: lê o banco (provas, resultados, voltas, config) e entrega ao painel
// os mesmos datasets de antes ("resultados" e "voltas", no formato dos CSVs) através de `window.dash`.
// window.IDT guarda o estado compartilhado com a Administração.
(() => {
  const IDT = window.IDT = {
    canEdit: false, uid: null, user: null, db: null, assets: null, erro: null,
    provas: new Map(), resultados: new Map(), voltas: new Map(), config: new Map(), folhas: new Map(),
    carregado: { provas: false, resultados: false, voltas: false, config: false, folhas: false },
    ouvintes: [],
  };
  // piloto que já vem escolhido nos filtros (Análise, Comparar voltas, Raio-X e balão das Corridas)
  IDT.PILOTO_PADRAO = 'Lucas Pinheiro';
  IDT.aoMudar = (fn) => { IDT.ouvintes.push(fn); };
  IDT.pista = (p) => [p.kartodromo, p.tracado, p.pisoLento ? 'piso lento' : ''].filter(Boolean).join(' · ');
  IDT.arquivoUrl = (id) => (window.claude && window.claude.arquivoUrl ? window.claude.arquivoUrl(id) : '/_blob/' + id);
  IDT.apelidos = () => (IDT.config.get('apelidos') || {}).mapa || {};

  // ---------- datasets ----------
  let versao = 0, cache = {};
  const fontes = {
    resultados() {
      const out = [];
      for (const [id, doc] of IDT.resultados) {
        const p = IDT.provas.get(id);
        if (!p || !Array.isArray(doc.linhas)) continue;
        for (const l of doc.linhas) out.push({ corrida: String(p.numero), data: p.data, kartodromo: p.kartodromo, pos: String(l.pos), piloto: l.piloto, voltas: String(l.voltas), melhor_volta_s: String(l.melhor) });
      }
      return out.sort((a, b) => a.corrida - b.corrida || a.pos - b.pos);
    },
    voltas() {
      const out = [];
      const txt = (x) => (x == null ? null : String(x));
      for (const [id, doc] of IDT.voltas) {
        const p = IDT.provas.get(id);
        if (!p || !IDT.resultados.has(id) || !Array.isArray(doc.linhas)) continue;
        const pista = IDT.pista(p), corrida = String(p.numero);
        for (const [piloto, volta, tempo, s1, s2, s3, valida] of doc.linhas) {
          out.push({ corrida, piloto, volta: String(volta), tempo_s: String(tempo), s1: txt(s1), s2: txt(s2), s3: txt(s3), valida: String(valida), pista });
        }
      }
      return out.sort((a, b) => a.corrida - b.corrida || (a.piloto < b.piloto ? -1 : a.piloto > b.piloto ? 1 : 0) || a.volta - b.volta);
    },
  };
  const COLUNAS = { resultados: ['corrida', 'data', 'kartodromo', 'pos', 'piloto', 'voltas', 'melhor_volta_s'], voltas: ['corrida', 'piloto', 'volta', 'tempo_s', 's1', 's2', 's3', 'valida', 'pista'] };
  const pronto = (id) => IDT.carregado.provas && IDT.carregado.resultados && (id !== 'voltas' || IDT.carregado.voltas);

  // ---------- dash (o que o painel usa: data, calc, draw, onData, setLink) ----------
  const calcs = {}, drawers = new Map(), onDataFns = [];
  let montado = false, agendado = false;
  function data(id) {
    if (fontes[id]) {
      if (IDT.erro) return { status: 'error', data: [], columns: [], message: IDT.erro, refreshing: false, meta: {} };
      if (!pronto(id)) return { status: 'loading', data: [], columns: [], refreshing: false, meta: {} };
      if (!cache[id] || cache[id].v !== versao) { const rows = fontes[id](); rows.columns = COLUNAS[id]; cache[id] = { v: versao, rows }; }
      return { status: 'ok', data: cache[id].rows, columns: COLUNAS[id], refreshing: false, meta: {} };
    }
    const c = calcs[id];
    if (!c) return { status: 'missing', data: [], message: 'dataset desconhecido: ' + id };
    const ins = c.inputs.map(data);
    const ruim = ins.find((d) => d.status !== 'ok');
    if (ruim) return { status: ruim.status === 'error' ? 'error' : 'loading', data: null, message: ruim.message };
    const chave = ins.map((d) => d.data);
    if (!c.chave || c.chave.some((k, i) => k !== chave[i])) {
      try { c.cache = { status: 'ok', data: c.fn(...chave) }; } catch (e) { console.error('[painel] calc', id, e); c.cache = { status: 'error', data: null, message: String(e) }; }
      c.chave = chave;
    }
    const out = { ...c.cache, refreshing: false, meta: {} };
    if (Array.isArray(out.data)) out.columns = out.data.length ? Object.keys(out.data[0]) : [];
    return out;
  }
  function desenha(nome) {
    const fn = drawers.get(nome);
    if (fn) document.querySelectorAll(`[data-draw="${CSS.escape(nome)}"]`).forEach((el) => { try { fn(el); } catch (e) { console.error('[painel] draw', nome, e); } });
  }
  function redesenha() {
    agendado = false;
    drawers.forEach((_, n) => desenha(n));
    onDataFns.forEach((fn) => { try { fn(); } catch (e) { console.error('[painel] onData', e); } });
  }
  const agenda = () => { if (montado && !agendado) { agendado = true; setTimeout(redesenha, 0); } };
  let largura = 0;
  new ResizeObserver(() => { const w = document.documentElement.clientWidth; if (w !== largura) { largura = w; agenda(); } }).observe(document.documentElement);

  const params = {};
  window.dash = {
    data,
    calc(id, spec) { calcs[id] = { inputs: spec.inputs || [], fn: spec.fn, title: spec.title }; },
    loader() {},
    draw(nome, fn) { if (fn) { drawers.set(nome, fn); if (montado) desenha(nome); } else desenha(nome); },
    onData(fn) { onDataFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    setLink(nome) { try { history.replaceState(null, '', '#' + nome); } catch (e) { /* sem histórico */ } },
    refresh() {},
    params: () => ({ ...params }),
    setParams(p) { Object.assign(params, p); agenda(); },
    resetParams() { for (const k in params) delete params[k]; agenda(); },
    colors: ['#0062e6', '#363b45', '#f2b705', '#c47a3c', '#1e8a4c', '#c62828'],
  };

  const avisa = () => {
    versao++; agenda();
    IDT.ouvintes.forEach((fn) => { try { fn(); } catch (e) { console.error('[idt]', e); } });
  };
  IDT.avisa = avisa;

  // ---------- início ----------
  IDT.iniciar = async () => {
    montado = true; redesenha();
    try {
      const [user, db] = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
      IDT.user = user; IDT.db = db;
      IDT.canEdit = user ? await user.canEdit() : false;
      IDT.uid = user ? await user.id() : null;
      if (IDT.canEdit) IDT.assets = await window.claude.use('assets');
    } catch (e) { console.error(e); }
    if (!IDT.db) { IDT.erro = 'Não foi possível abrir o banco de dados.'; avisa(); return; }
    for (const col of ['provas', 'resultados', 'voltas', 'config', 'folhas']) {
      IDT.db.collection(col).onSnapshot((snap) => {
        IDT[col] = new Map(snap.docs.map((d) => [d.id, d.data()]));
        IDT.carregado[col] = true; avisa();
      }, (e) => { console.error('[idt] leitura', col, e); IDT.erro = 'Não foi possível carregar os dados. Recarregue a página.'; avisa(); });
    }
    avisa();
  };
})();

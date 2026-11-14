// Administração do sistema único: cadastro de provas, arquivos, leitura automática, conferência e lançamento no painel.
(() => {
  const L = window.IDTLeitor;
  const SLOTS = [
    { key: 'corrida', title: 'Corrida', desc: 'Resultado final (alimenta o painel)' },
    { key: 'tomada', title: 'Tomada de Tempo', desc: 'Classificação do treino (aba Corridas)' },
    { key: 'voltas', title: 'Volta a Volta', desc: 'Tempo de cada volta (opcional)' },
  ];
  const ACCEPT = '.html,.htm,.pdf,.jpg,.jpeg,.png,.webp';
  const COLS = ['piloto', 'volta', 'tempo_s', 's1', 's2', 's3', 'valida'];
  const S = { filter: 'todas', editing: null, busy: {}, confirm: null, errors: {}, conf: null, aviso: {} };
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const dataBR = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—');
  const quando = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const tam = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const volta = (s) => { if (s == null || !isFinite(s)) return ''; const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(3).padStart(6, '0').replace('.', ','); };
  const docId = (n) => 'p' + String(n).padStart(3, '0');
  const agora = () => new Date().toISOString();
  const lista = () => [...IDT.provas.entries()].map(([id, d]) => ({ id, ...d })).sort((a, b) => b.numero - a.numero);
  const pilotosConhecidos = (exceto) => {
    const s = new Set();
    for (const [id, d] of IDT.resultados) if (id !== exceto) (d.linhas || []).forEach((l) => s.add(l.piloto));
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };
  const db = () => IDT.db;

  // ---------- visibilidade da aba ----------
  function acesso() {
    const tab = $('#tab-admin');
    if (tab) tab.hidden = !IDT.canEdit;
    if (!IDT.canEdit && !$('#admin').hidden) { const g = $('[data-tab="geral"]'); if (g) g.click(); }
  }

  // ---------- formulário da prova ----------
  const form = () => $('#adm-form');
  function openForm(p) {
    S.editing = p ? p.id : null;
    $('#adm-form-eyebrow').textContent = p ? 'Editar prova' : 'Nova prova';
    $('#adm-form-title').textContent = p ? `Prova ${p.numero}` : 'Cadastrar prova';
    const max = lista().reduce((m, x) => Math.max(m, x.numero || 0), 0);
    $('#f-num').value = p ? p.numero : max + 1;
    $('#f-num').disabled = !!p;
    $('#f-data').value = p ? p.data : '';
    const conhecidos = ['Granja Viana', 'Interlagos', 'Aldeia da Serra'];
    const k = p ? p.kartodromo : 'Granja Viana';
    $('#f-kart').value = conhecidos.includes(k) ? k : '__outro';
    $('#f-outro').value = conhecidos.includes(k) ? '' : k;
    $('#f-outro-wrap').hidden = conhecidos.includes(k);
    $('#f-circ').value = p ? p.tracado || '' : 'Circuito 101';
    $('#f-obs').value = p ? p.observacao || '' : '';
    $('#f-lento').checked = !!(p && p.pisoLento);
    $('#adm-form-err').hidden = true;
    form().hidden = false;
    form().scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#f-data').focus({ preventScroll: true });
  }
  async function salvarProva() {
    const err = $('#adm-form-err');
    const numero = Number($('#f-num').value);
    const data = $('#f-data').value;
    const kart = $('#f-kart').value === '__outro' ? $('#f-outro').value.trim() : $('#f-kart').value;
    const show = (t) => { err.textContent = t; err.hidden = false; };
    if (!Number.isInteger(numero) || numero < 1) return show('Informe o número da prova (1 ou mais).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return show('Informe a data da prova.');
    if (!kart) return show('Informe o nome do kartódromo.');
    const btn = $('#adm-form-save'); btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const ref = db().doc('provas/' + docId(numero));
      const campos = { numero, data, kartodromo: kart, tracado: $('#f-circ').value.trim(), observacao: $('#f-obs').value.trim(), pisoLento: $('#f-lento').checked, atualizadoEm: agora(), atualizadoPor: IDT.uid };
      if (S.editing) await ref.update(campos);
      else {
        const ex = await ref.get();
        if (ex.exists) { show(`Já existe a prova ${numero}. Use Editar dados nela.`); return; }
        await ref.set({ ...campos, status: 'aguardando', arquivos: { corrida: null, tomada: null, voltas: null }, criadoEm: agora(), criadoPor: IDT.uid });
      }
      form().hidden = true; S.editing = null;
    } catch (e) { show('Não foi possível salvar. Confira sua conexão e tente de novo.'); }
    finally { btn.disabled = false; btn.textContent = 'Salvar prova'; }
  }

  // ---------- arquivos ----------
  const formatoDe = (ext) => (['html', 'htm'].includes(ext) ? ['HTML', 'text/plain'] : ext === 'pdf' ? ['PDF', 'application/pdf'] : ['jpg', 'jpeg'].includes(ext) ? ['Foto', 'image/jpeg'] : ext === 'png' ? ['Foto', 'image/png'] : ext === 'webp' ? ['Foto', 'image/webp'] : null);
  async function enviar(p, slot, file) {
    const k = p.id + ':' + slot;
    S.errors[k] = null;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const f = formatoDe(ext);
    if (!f) { S.errors[k] = 'Formato não aceito. Envie HTML, PDF ou foto (JPG, PNG).'; render(); return; }
    if (file.size > 20 * 1048576) { S.errors[k] = 'Arquivo acima de 20 MB. Exporte de novo ou tire a foto em resolução menor.'; render(); return; }
    const [formato, tipo] = f;
    S.busy[k] = 'Enviando…'; render();
    let buf = null;
    try {
      buf = await file.arrayBuffer();
      const blob = formato === 'HTML' ? new Blob([buf], { type: 'text/plain' }) : file;
      const up = await IDT.assets.upload(blob, { type: tipo });
      const antigo = p.arquivos && p.arquivos[slot];
      await db().doc('provas/' + p.id).update({
        arquivos: { [slot]: { asset: up.id, nome: file.name, formato, tamanho: up.sizeBytes || file.size, enviadoEm: agora(), enviadoPor: IDT.uid, previa: null } },
        atualizadoEm: agora(),
      });
      if (antigo && antigo.asset && antigo.asset !== up.id) { try { await IDT.assets.delete(antigo.asset); } catch (e) { /* fica sem uso */ } }
    } catch (e) {
      const c = e && e.code;
      S.errors[k] = c === 'too_large' ? 'Arquivo grande demais (máximo 20 MB).'
        : c === 'quota_or_state' ? 'O espaço de arquivos está cheio. Remova arquivos antigos e tente de novo.'
        : c === 'rate_limited' ? 'Muitos envios seguidos. Espere alguns segundos e tente de novo.'
        : 'Não foi possível enviar. Confira sua conexão e tente de novo.';
      buf = null;
    } finally { delete S.busy[k]; render(); }
    if (buf && (slot === 'corrida' || slot === 'voltas')) lerEConferir(p.id, slot, { nome: file.name, buf });
    if (buf && slot === 'tomada') lerTomada(p.id, { nome: file.name, buf });
  }
  async function remover(p, slot) {
    const k = p.id + ':' + slot;
    const a = p.arquivos && p.arquivos[slot];
    S.busy[k] = 'Removendo…'; S.confirm = null; render();
    try {
      await db().doc('provas/' + p.id).update({ arquivos: { [slot]: null }, atualizadoEm: agora() });
      if (a && a.asset) { try { await IDT.assets.delete(a.asset); } catch (e) { /* segue */ } }
    } catch (e) { S.errors[k] = 'Não foi possível remover. Tente de novo.'; }
    finally { delete S.busy[k]; render(); }
  }
  const escolher = (p, slot) => {
    const inp = el('input', { type: 'file', accept: ACCEPT, class: 'sr' });
    inp.addEventListener('change', () => { if (inp.files[0]) enviar(p, slot, inp.files[0]); inp.remove(); });
    document.body.append(inp); inp.click();
  };
  async function baixar(a) {
    const r = await fetch(IDT.arquivoUrl(a.asset));
    if (!r.ok) throw new Error('download ' + r.status);
    return { nome: a.nome, buf: await r.arrayBuffer() };
  }

  // ---------- leitura e conferência ----------
  async function lerEConferir(id, slot, arquivo) {
    const k = id + ':' + slot;
    S.errors[k] = null;
    S.busy[k] = 'Lendo o arquivo…'; render();
    try {
      if (!arquivo) arquivo = await baixar(IDT.provas.get(id).arquivos[slot]);
      if (slot === 'corrida') {
        const r = await L.lerResultado(arquivo);
        if (r.ok) abrirResultado(id, r.linhas, 'arquivo', `Lido de ${arquivo.nome}: ${r.linhas.length} pilotos. Confira os nomes antes de lançar.`);
        else abrirResultado(id, null, 'manual', r.motivo === 'foto'
          ? 'Foto não é lida automaticamente. Digite o resultado olhando a foto (use Abrir no espaço Corrida).'
          : 'Não consegui ler este arquivo (formato diferente do sistema de cronometragem). Digite o resultado abaixo.');
      } else {
        if (!IDT.resultados.has(id)) { S.errors[k] = 'Lance o resultado da Corrida primeiro: o volta a volta usa os nomes e a melhor volta oficiais.'; return; }
        const r = await L.lerVoltas(arquivo);
        if (r.ok) abrirVoltas(id, r.voltas, arquivo.nome);
        else S.errors[k] = r.motivo === 'foto' ? 'Volta a volta em foto não é lido; ele fica guardado como arquivo.' : 'Não consegui ler este volta a volta. Ele fica guardado como arquivo, sem entrar no painel.';
      }
    } catch (e) {
      console.error(e);
      S.errors[k] = 'Não foi possível ler o arquivo agora. Tente de novo.';
    } finally { delete S.busy[k]; render(); }
  }

  // Resultado: uma linha por piloto, editável.
  function abrirResultado(id, linhas, origem, aviso) {
    const conhecidos = pilotosConhecidos(id), ap = IDT.apelidos();
    let rows;
    if (linhas) rows = linhas.map((l) => { const m = L.casarNome(l.nomeArquivo, conhecidos, ap); return { pos: l.pos, cru: l.nomeArquivo, piloto: m.nome, voltas: l.voltas, melhor: volta(l.melhor) }; });
    else {
      const atual = IDT.resultados.get(id);
      rows = atual && atual.linhas ? atual.linhas.map((l) => ({ pos: l.pos, cru: '', piloto: l.piloto, voltas: l.voltas, melhor: volta(l.melhor) }))
        : Array.from({ length: 12 }, (_, i) => ({ pos: i + 1, cru: '', piloto: '', voltas: '', melhor: '' }));
    }
    S.conf = { id, tipo: 'resultado', origem, aviso, rows, erro: null };
    render();
    requestAnimationFrame(() => { const c = $('#adm-conf'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  const tagNome = (nome, conhecidos) => {
    if (!nome.trim()) return el('span', { class: 'tag bad' }, 'falta');
    return conhecidos.includes(nome.trim()) ? el('span', { class: 'tag ok' }, 'já corre') : el('span', { class: 'tag novo' }, 'piloto novo');
  };
  function painelResultado(p) {
    const C = S.conf, conhecidos = pilotosConhecidos(p.id);
    const tb = el('tbody');
    C.rows.forEach((r, i) => {
      const tag = el('span', {}, tagNome(r.piloto, conhecidos));
      const nome = el('input', { class: 'input', type: 'text', list: 'adm-pilotos', value: r.piloto, 'aria-label': `Piloto na posição ${r.pos}` });
      nome.addEventListener('input', () => { r.piloto = nome.value; tag.replaceChildren(tagNome(r.piloto, conhecidos)); });
      const num = (campo, cls, label) => { const x = el('input', { class: 'input ' + cls, type: 'text', inputmode: 'decimal', value: r[campo] == null ? '' : String(r[campo]), 'aria-label': label }); x.addEventListener('input', () => { r[campo] = x.value; x.classList.remove('bad'); }); return x; };
      tb.append(el('tr', {},
        el('td', {}, num('pos', 'n', 'Posição')),
        el('td', {}, el('div', { class: 'who' }, nome, tag), r.cru && L.chave(r.cru) !== L.chave(r.piloto) ? el('div', { class: 'cru' }, 'no arquivo: ' + r.cru) : null),
        el('td', { class: 'num' }, num('voltas', 'n', 'Voltas')),
        el('td', { class: 'num' }, num('melhor', 't', 'Melhor volta')),
        el('td', {}, el('button', { class: 'x', type: 'button', title: 'Tirar esta linha', 'aria-label': 'Tirar esta linha', onclick: () => { C.rows.splice(i, 1); render(); } }, '×'))));
    });
    const tabela = el('div', { class: 'conf-scroll' }, el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Pos'), el('th', {}, 'Piloto no painel'), el('th', { class: 'num' }, 'Voltas'), el('th', { class: 'num' }, 'Melhor volta'), el('th', {}, ''))), tb));
    const jaTem = IDT.resultados.has(p.id);
    return el('div', { class: 'conf', id: 'adm-conf' },
      el('div', { class: 'row' }, el('h3', {}, (jaTem ? 'Revisar resultado' : 'Conferir resultado') + ` · Prova ${p.numero}`)),
      C.aviso ? el('p', { class: 'msg ' + (C.origem === 'manual' ? 'warn' : 'info') }, C.aviso) : null,
      el('p', { class: 'note' }, 'Use o nome como já aparece no painel para o piloto somar pontos no histórico. Melhor volta no formato 1:01,108 ou 59,826. A posição é a ordem de chegada.'),
      tabela,
      el('div', { class: 'row' }, el('button', { class: 'btn secondary sm', type: 'button', onclick: () => { C.rows.push({ pos: C.rows.length + 1, cru: '', piloto: '', voltas: '', melhor: '' }); render(); } }, '+ Adicionar piloto')),
      C.erro ? el('p', { class: 'msg err', role: 'alert' }, C.erro) : null,
      el('div', { class: 'actions' },
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { S.conf = null; render(); } }, 'Cancelar'),
        el('button', { class: 'btn primary', type: 'button', id: 'adm-lancar', onclick: () => lancarResultado(p) }, jaTem ? 'Salvar no painel' : 'Lançar no painel')));
  }
  async function lancarResultado(p) {
    const C = S.conf;
    const rows = C.rows.filter((r) => String(r.piloto).trim() || String(r.voltas).trim() || String(r.melhor).trim());
    const erros = [];
    const linhas = rows.map((r) => ({ pos: Number(String(r.pos).trim()), piloto: String(r.piloto).trim().replace(/\s+/g, ' '), voltas: Number(String(r.voltas).trim()), melhor: L.segundos(r.melhor), cru: r.cru }));
    if (!linhas.length) erros.push('Preencha pelo menos um piloto.');
    linhas.forEach((l) => {
      if (!l.piloto) erros.push(`Falta o nome na posição ${l.pos || '?'}.`);
      if (!Number.isInteger(l.voltas) || l.voltas < 0) erros.push(`Voltas inválidas para ${l.piloto || 'posição ' + l.pos}.`);
      if (l.melhor == null || l.melhor <= 0) erros.push(`Melhor volta inválida para ${l.piloto || 'posição ' + l.pos} (use 1:01,108).`);
    });
    const pos = linhas.map((l) => l.pos).sort((a, b) => a - b);
    if (pos.some((x, i) => x !== i + 1)) erros.push('As posições precisam ir de 1 até ' + linhas.length + ', sem repetir.');
    const dup = linhas.map((l) => l.piloto.toLowerCase()).filter((n, i, a) => n && a.indexOf(n) !== i);
    if (dup.length) erros.push('Piloto repetido: ' + [...new Set(dup)].join(', ') + '.');
    if (erros.length) { C.erro = erros.slice(0, 4).join(' '); render(); return; }
    const btn = $('#adm-lancar'); if (btn) { btn.disabled = true; btn.textContent = 'Lançando…'; }
    try {
      linhas.sort((a, b) => a.pos - b.pos);
      await db().doc('resultados/' + p.id).set({ linhas: linhas.map(({ pos, piloto, voltas, melhor }) => ({ pos, piloto, voltas, melhor })), origem: C.origem, lancadoEm: agora(), lancadoPor: IDT.uid });
      // aprende como o nome aparece na folha do kartódromo
      const novos = {};
      for (const l of linhas) if (l.cru && L.chave(l.cru) !== L.chave(l.piloto) && IDT.apelidos()[L.chave(l.cru)] !== l.piloto) novos[L.chave(l.cru)] = l.piloto;
      if (Object.keys(novos).length) {
        const ref = db().doc('config/apelidos');
        if (IDT.config.has('apelidos')) await ref.update({ mapa: novos }); else await ref.set({ mapa: novos });
      }
      await db().doc('provas/' + p.id).update({ status: 'processada', processadoEm: agora() });
      const arq = p.arquivos && p.arquivos.corrida;
      if (arq && L.tipoDe(arq.nome) !== 'outro') { try { await gerarFolha(p.id, 'corrida'); } catch (e) { console.warn('[folha]', e); } }
      S.aviso[p.id] = `Resultado lançado: ${linhas.length} pilotos. O painel já está atualizado.` + (IDT.voltas.has(p.id) ? ' Se mudou algum nome, leia o volta a volta de novo.' : '');
      S.conf = null;
    } catch (e) { console.error(e); C.erro = 'Não foi possível salvar. Confira a conexão e tente de novo.'; }
    render();
  }

  // Volta a volta: um grupo por piloto do arquivo, casado com os pilotos do resultado oficial.
  function abrirVoltas(id, voltas, nomeArq) {
    const res = (IDT.resultados.get(id).linhas || []);
    const nomes = res.map((l) => l.piloto), ap = IDT.apelidos();
    const grupos = new Map();
    for (const v of voltas) { if (!grupos.has(v.nomeArquivo)) grupos.set(v.nomeArquivo, []); grupos.get(v.nomeArquivo).push(v); }
    const gs = [...grupos.entries()].map(([cru, vs]) => {
      const m = L.casarNome(cru, nomes, ap);
      return { cru, piloto: nomes.includes(m.nome) ? m.nome : '', voltas: vs.sort((a, b) => a.volta - b.volta) };
    });
    S.conf = { id, tipo: 'voltas', nomeArq, grupos: gs, erro: null };
    render();
    requestAnimationFrame(() => { const c = $('#adm-conf'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  function painelVoltas(p) {
    const C = S.conf;
    const res = IDT.resultados.get(p.id).linhas || [];
    const oficial = new Map(res.map((l) => [l.piloto, l]));
    const tb = el('tbody');
    for (const g of C.grupos) {
      const sel = el('select', { class: 'input', 'aria-label': 'Piloto de ' + g.cru },
        el('option', { value: '' }, '— não lançar —'), ...res.map((l) => el('option', { value: l.piloto }, `P${l.pos} · ${l.piloto}`)));
      sel.value = g.piloto;
      sel.addEventListener('change', () => { g.piloto = sel.value; render(); });
      const o = oficial.get(g.piloto);
      const melhor = Math.min(...g.voltas.map((v) => v.tempo).filter((t) => o == null || t >= o.melhor - 0.0005));
      const okV = o && g.voltas.length === o.voltas, okM = o && Math.abs(melhor - o.melhor) <= 0.0005;
      const setores = g.voltas.filter((v) => v.s1 != null).length;
      tb.append(el('tr', {},
        el('td', {}, el('div', { class: 'cru' }, g.cru)),
        el('td', {}, sel),
        el('td', { class: 'num' }, `${g.voltas.length}`, o ? el('span', { class: 'note' }, ` / ${o.voltas}`) : null, ' ', o ? el('span', { class: 'tag ' + (okV ? 'ok' : 'novo') }, okV ? 'confere' : 'difere') : null),
        el('td', { class: 'num' }, volta(melhor), ' ', o ? el('span', { class: 'tag ' + (okM ? 'ok' : 'novo') }, okM ? 'confere' : 'oficial ' + volta(o.melhor)) : null),
        el('td', { class: 'num' }, setores ? `${setores} voltas` : '—')));
    }
    const semDono = res.filter((l) => !C.grupos.some((g) => g.piloto === l.piloto)).map((l) => l.piloto);
    const repetidos = C.grupos.map((g) => g.piloto).filter((n, i, a) => n && a.indexOf(n) !== i);
    return el('div', { class: 'conf', id: 'adm-conf' },
      el('h3', {}, `Conferir volta a volta · Prova ${p.numero}`),
      el('p', { class: 'msg info' }, `Lido de ${C.nomeArq}: ${C.grupos.length} pilotos, ${C.grupos.reduce((s, g) => s + g.voltas.length, 0)} voltas. Cada piloto do arquivo precisa apontar para um piloto do resultado oficial.`),
      semDono.length ? el('p', { class: 'msg warn' }, 'Sem volta a volta: ' + semDono.join(', ') + '.') : null,
      repetidos.length ? el('p', { class: 'msg err' }, 'Piloto escolhido duas vezes: ' + [...new Set(repetidos)].join(', ') + '.') : null,
      el('div', { class: 'conf-scroll' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, 'No arquivo'), el('th', {}, 'Piloto no painel'), el('th', { class: 'num' }, 'Voltas lidas / oficiais'), el('th', { class: 'num' }, 'Melhor volta'), el('th', { class: 'num' }, 'Setores'))), tb)),
      el('p', { class: 'note' }, 'Voltas abaixo da melhor volta oficial são marcadas como falha de cronometragem. Setores só entram quando S1 + S2 + S3 batem com o tempo da volta.'),
      C.erro ? el('p', { class: 'msg err', role: 'alert' }, C.erro) : null,
      el('div', { class: 'actions' },
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { S.conf = null; render(); } }, 'Cancelar'),
        el('button', { class: 'btn primary', type: 'button', id: 'adm-lancar', disabled: repetidos.length > 0 || !C.grupos.some((g) => g.piloto) }, 'Lançar volta a volta')));
  }
  async function lancarVoltas(p) {
    const C = S.conf;
    const oficial = new Map((IDT.resultados.get(p.id).linhas || []).map((l) => [l.piloto, l]));
    const linhas = [];
    for (const g of C.grupos) {
      const o = oficial.get(g.piloto);
      if (!o) continue;
      for (const v of g.voltas) {
        const valida = v.tempo < o.melhor - 0.0005 ? 0 : 1;
        let { s1, s2, s3 } = v;
        if (s1 == null || s2 == null || s3 == null || Math.abs(s1 + s2 + s3 - v.tempo) > 0.02) s1 = s2 = s3 = null;
        linhas.push([g.piloto, v.volta, v.tempo, s1, s2, s3, valida]);
      }
    }
    const btn = $('#adm-lancar'); if (btn) { btn.disabled = true; btn.textContent = 'Lançando…'; }
    try {
      await db().doc('voltas/' + p.id).set({ colunas: COLS, linhas, origem: 'arquivo', lancadoEm: agora(), lancadoPor: IDT.uid });
      const ap = {};
      for (const g of C.grupos) if (g.piloto && L.chave(g.cru) !== L.chave(g.piloto) && IDT.apelidos()[L.chave(g.cru)] !== g.piloto) ap[L.chave(g.cru)] = g.piloto;
      if (Object.keys(ap).length) { const ref = db().doc('config/apelidos'); if (IDT.config.has('apelidos')) await ref.update({ mapa: ap }); else await ref.set({ mapa: ap }); }
      S.aviso[p.id] = `Volta a volta lançado: ${linhas.length} voltas de ${new Set(linhas.map((l) => l[0])).size} pilotos.`;
      S.conf = null;
    } catch (e) { console.error(e); C.erro = 'Não foi possível salvar. Confira a conexão e tente de novo.'; }
    render();
  }

  // Folha completa (como no arquivo do kartódromo) para a aba Corridas. slot 'corrida' → folhas.prova, 'tomada' → folhas.tomada.
  // Nomes: na prova, pela posição no resultado oficial; na tomada, pelos pilotos da prova e apelidos aprendidos.
  async function gerarFolha(id, slot, arquivo) {
    const p = IDT.provas.get(id), a = p && p.arquivos && p.arquivos[slot];
    if (!a && !arquivo) return { ok: false, motivo: 'sem arquivo' };
    if (!arquivo) arquivo = await baixar(a);
    const r = await L.lerFolha(arquivo);
    if (!r.ok) return r;
    const res = (IDT.resultados.get(id) || {}).linhas || [];
    const porPos = new Map(res.map((l) => [l.pos, l.piloto]));
    const daProva = res.map((l) => l.piloto), todos = pilotosConhecidos(), ap = IDT.apelidos();
    const linhas = r.linhas.map((l) => {
      let piloto = slot === 'corrida' ? porPos.get(l.pos) : null;
      if (!piloto) {
        const m = L.casarNome(l.nomeArquivo, daProva, ap);
        piloto = daProva.includes(m.nome) ? m.nome : L.casarNome(l.nomeArquivo, todos, ap).nome;
      }
      return { ...l, piloto, cru: l.nomeArquivo };
    });
    const chaveF = slot === 'corrida' ? 'prova' : 'tomada';
    const atual = IDT.folhas.get(id) || {};
    await db().doc('folhas/' + id).set({ ...atual, [chaveF]: { titulo: r.titulo || '', arquivo: arquivo.nome, linhas, lidoEm: agora() } });
    return { ok: true, n: linhas.length };
  }
  async function lerTomada(id, arquivo) {
    const k = id + ':tomada';
    S.errors[k] = null; S.busy[k] = 'Lendo a tomada…'; render();
    try {
      const r = await gerarFolha(id, 'tomada', arquivo);
      if (r.ok) S.aviso[id] = `Tomada de tempo lida: ${r.n} pilotos. Ela já aparece na aba Corridas.`;
      else S.errors[k] = r.motivo === 'foto' ? 'Tomada em foto não é lida; ela fica guardada como arquivo.' : 'Não consegui ler esta tomada de tempo. Ela fica guardada como arquivo.';
    } catch (e) { console.error(e); S.errors[k] = 'Não foi possível ler a tomada agora. Tente de novo.'; }
    finally { delete S.busy[k]; render(); }
  }
  window.IDTAdmin = { gerarFolha };

  async function tirarDoPainel(p) {
    S.confirm = null;
    try {
      if (IDT.voltas.has(p.id)) await db().doc('voltas/' + p.id).delete();
      await db().doc('resultados/' + p.id).delete();
      await db().doc('provas/' + p.id).update({ status: 'aguardando' });
      S.aviso[p.id] = 'Prova retirada do painel. Os arquivos continuam guardados.';
    } catch (e) { S.aviso[p.id] = 'Não foi possível retirar do painel. Tente de novo.'; }
    render();
  }

  // ---------- desenho ----------
  async function nomes(ids) {
    if (!IDT.user || !ids.length || !IDT.user.profiles) return {};
    try { return await IDT.user.profiles(ids); } catch (e) { return {}; }
  }
  let desenhando = false, denovo = false;
  async function render() {
    if (desenhando) { denovo = true; return; }
    desenhando = true;
    try { await desenhar(); } finally { desenhando = false; if (denovo) { denovo = false; render(); } }
  }
  async function desenhar() {
    acesso();
    if (!IDT.canEdit) return;
    $('#adm-nodb').hidden = !IDT.erro;
    if (!IDT.carregado.provas || !IDT.carregado.resultados) return;
    const ps = lista();
    const noPainel = (p) => IDT.resultados.has(p.id);
    const comVoltas = (p) => IDT.voltas.has(p.id);
    const kp = { provas: ps.length, painel: ps.filter(noPainel).length, voltas: ps.filter(comVoltas).length, pend: ps.filter((p) => !noPainel(p)).length };
    document.querySelectorAll('.adm [data-k]').forEach((x) => { x.textContent = String(kp[x.dataset.k]); });
    $('#kpi-pend').classList.toggle('alert', kp.pend > 0);
    const dl = $('#adm-pilotos'); dl.replaceChildren(...pilotosConhecidos().map((n) => el('option', { value: n })));

    const tem = (p, s) => !!(p.arquivos && p.arquivos[s]);
    const ids = [...new Set(ps.flatMap((p) => SLOTS.map((s) => tem(p, s.key) && p.arquivos[s.key].enviadoPor)).filter(Boolean))];
    const prof = await nomes(ids);

    let vis = ps;
    if (S.filter === 'pend') vis = ps.filter((p) => !noPainel(p));
    if (S.filter === 'semvoltas') vis = ps.filter((p) => !comVoltas(p));
    const list = $('#adm-list');
    // mantém o foco/cursor de quem está digitando na conferência
    const ativo = document.activeElement && list.contains(document.activeElement) && document.activeElement.matches('input') ? document.activeElement : null;
    const foco = ativo ? { label: ativo.getAttribute('aria-label'), pos: ativo.selectionStart } : null;
    list.replaceChildren();
    if (!ps.length) { list.append(el('div', { class: 'empty-state' }, el('strong', {}, 'Nenhuma prova cadastrada ainda'), el('span', {}, 'Clique em Nova prova para cadastrar a primeira.'))); return; }
    if (!vis.length) { list.append(el('div', { class: 'empty-state' }, el('strong', {}, 'Nenhuma prova neste filtro'), el('span', {}, 'Escolha Todas para ver a lista completa.'))); return; }

    for (const p of vis) {
      const res = IDT.resultados.get(p.id);
      const st = res ? el('span', { class: 'pill ok' }, comVoltas(p) ? 'No painel · com volta a volta' : 'No painel') : el('span', { class: 'pill warn' }, 'Falta lançar');
      const head = el('div', { class: 'prova-head' },
        el('span', { class: 'num' }, 'Prova ' + p.numero),
        el('span', { class: 'meta' }, el('b', {}, dataBR(p.data)), ' · ' + IDT.pista(p) + (p.observacao ? ' · ' + p.observacao : '')),
        el('span', { class: 'spacer' }), st,
        el('button', { class: 'btn ghost sm', type: 'button', onclick: () => openForm(p) }, 'Editar dados'));
      const slots = el('div', { class: 'slots' });
      for (const s of SLOTS) {
        const k = p.id + ':' + s.key;
        const a = tem(p, s.key) ? p.arquivos[s.key] : null;
        const box = el('div', { class: 'slot' }, el('div', { class: 'slot-title' }, el('h3', {}, s.title), el('span', {}, s.desc)));
        if (S.busy[k]) box.append(el('div', { class: 'busy', role: 'status' }, S.busy[k]));
        else if (a) {
          const quem = a.enviadoPor ? (prof[a.enviadoPor] && prof[a.enviadoPor].name) || '' : '';
          box.append(el('div', { class: 'file' },
            el('span', { class: 'fn' }, el('span', { class: 'fmt' }, a.formato || 'Arquivo'), a.nome || 'arquivo'),
            el('span', { class: 'fm' }, [a.tamanho ? tam(a.tamanho) : null, a.enviadoEm ? 'enviado em ' + quando(a.enviadoEm) : null, quem ? 'por ' + quem : null].filter(Boolean).join(' · ')),
            a.previa ? el('span', { class: 'pv' }, a.previa) : null));
          const row = el('div', { class: 'row' }, el('a', { class: 'btn secondary sm', href: IDT.arquivoUrl(a.asset), target: '_blank', rel: 'noopener' }, 'Abrir'));
          if (s.key !== 'tomada') row.append(el('button', { class: 'btn secondary sm', type: 'button', onclick: () => lerEConferir(p.id, s.key) }, 'Ler e conferir'));
          else row.append(el('button', { class: 'btn secondary sm', type: 'button', onclick: () => lerTomada(p.id) }, 'Ler de novo'));
          if (IDT.assets) row.append(el('button', { class: 'btn ghost sm', type: 'button', onclick: () => escolher(p, s.key) }, 'Trocar'),
            el('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.confirm = k; render(); } }, 'Remover'));
          box.append(row);
          if (S.confirm === k) box.append(el('div', { class: 'confirm', role: 'alert' }, `Remover o arquivo de ${s.title} da prova ${p.numero}? O arquivo é apagado e não dá para desfazer. O que já foi lançado no painel continua.`,
            el('div', { class: 'row' }, el('button', { class: 'btn danger sm', type: 'button', onclick: () => remover(p, s.key) }, 'Remover arquivo'), el('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.confirm = null; render(); } }, 'Cancelar'))));
        } else if (IDT.assets) {
          const drop = el('div', { class: 'drop' }, 'Arraste o arquivo aqui ou', el('button', { class: 'btn primary sm', type: 'button', onclick: () => escolher(p, s.key) }, 'Enviar arquivo'), el('span', { class: 'note' }, 'HTML, PDF ou foto, até 20 MB'));
          drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
          drop.addEventListener('dragleave', () => drop.classList.remove('over'));
          drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) enviar(p, s.key, f); });
          box.append(drop);
        } else box.append(el('div', { class: 'drop empty' }, 'Sem arquivo'));
        if (S.errors[k]) box.append(el('p', { class: 'msg err', role: 'alert' }, S.errors[k]));
        slots.append(box);
      }
      // faixa de lançamento
      const nv = IDT.voltas.has(p.id) ? (IDT.voltas.get(p.id).linhas || []).length : 0;
      const launch = el('div', { class: 'launch' },
        res ? `No painel: ${res.linhas.length} pilotos · P1 ${(res.linhas.find((l) => l.pos === 1) || {}).piloto || '—'}` + (nv ? ` · ${nv} voltas no volta a volta` : ' · sem volta a volta') + (res.origem === 'manual' ? ' · digitado' : '')
          : 'Ainda não está no painel.',
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn secondary sm', type: 'button', onclick: () => abrirResultado(p.id, null, 'manual', res ? null : 'Digite a ordem de chegada, as voltas e a melhor volta de cada piloto.') }, res ? 'Editar resultado' : 'Digitar resultado'),
        res ? el('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.confirm = p.id + ':painel'; render(); } }, 'Tirar do painel') : null);
      const art = el('article', { class: 'prova', 'aria-label': 'Prova ' + p.numero }, head, slots, launch);
      if (S.confirm === p.id + ':painel') art.append(el('div', { class: 'conf' }, el('div', { class: 'confirm', role: 'alert' }, `Tirar a prova ${p.numero} do painel? Os pontos, recordes e voltas dela saem de todas as abas. Os arquivos continuam guardados e dá para lançar de novo.`,
        el('div', { class: 'row' }, el('button', { class: 'btn danger sm', type: 'button', onclick: () => tirarDoPainel(p) }, 'Tirar do painel'), el('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.confirm = null; render(); } }, 'Cancelar')))));
      if (S.aviso[p.id]) art.append(el('div', { class: 'conf' }, el('p', { class: 'msg ok', role: 'status' }, S.aviso[p.id])));
      if (S.conf && S.conf.id === p.id) {
        const painel = S.conf.tipo === 'resultado' ? painelResultado(p) : painelVoltas(p);
        art.append(painel);
        if (S.conf.tipo === 'voltas') { const b = painel.querySelector('#adm-lancar'); if (b) b.addEventListener('click', () => lancarVoltas(p)); }
      }
      list.append(art);
    }
    if (foco) { const x = [...list.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === foco.label); if (x) { x.focus(); try { x.setSelectionRange(foco.pos, foco.pos); } catch (e) { /* tipo sem cursor */ } } }
  }

  // ---------- ligações ----------
  $('#f-kart').addEventListener('change', () => { $('#f-outro-wrap').hidden = $('#f-kart').value !== '__outro'; });
  $('#adm-new').addEventListener('click', () => openForm(null));
  $('#adm-form-cancel').addEventListener('click', () => { form().hidden = true; S.editing = null; });
  $('#adm-f').addEventListener('submit', (e) => e.preventDefault());
  $('#adm-form-save').addEventListener('click', salvarProva);
  document.querySelectorAll('[data-afilter]').forEach((b) => b.addEventListener('click', () => {
    S.filter = b.dataset.afilter;
    document.querySelectorAll('[data-afilter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  IDT.aoMudar(render);
})();

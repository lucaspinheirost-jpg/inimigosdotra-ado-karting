// Aba Corridas: escolhe a prova e mostra as folhas do kartódromo (Resultado, Tomada de tempo, Volta a volta de todos)
// e a Análise da corrida. No volta a volta, tocar num piloto abre o balão com a análise dele e a comparação
// com a última corrida dele (de preferência no mesmo traçado).
(() => {
  const L = window.IDTLeitor;
  const C = { id: null, vista: 'prova', piloto: null, modoVV: 'piloto', fechado: false };
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

  // ---------- formatos ----------
  const dataBR = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
  const volta = (s) => { if (s == null || !isFinite(s)) return '—'; const m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(3).padStart(6, '0').replace('.', ','); };
  const seg = (s, c = 3) => (s == null || !isFinite(s) ? '—' : s.toFixed(c).replace('.', ','));
  const txt = (t) => String(t || '').replace('.', ',');
  const sinal = (n, f) => (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n));

  // ---------- dados ----------
  const provas = () => [...IDT.provas.entries()].filter(([id]) => IDT.resultados.has(id)).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.numero - a.numero);
  const resultado = (id) => ((IDT.resultados.get(id) || {}).linhas || []).slice().sort((a, b) => a.pos - b.pos);
  // folha do resultado: a lida do arquivo; sem ela, monta com o que está no painel (pos, piloto, voltas, melhor)
  const folha = (id, tipo) => {
    const f = (IDT.folhas.get(id) || {})[tipo];
    if (f && f.linhas && f.linhas.length) return f;
    if (tipo !== 'prova') return null;
    const res = resultado(id);
    return res.length ? { titulo: '', resumida: true, linhas: res.map((l) => ({ pos: l.pos, piloto: l.piloto, voltas: l.voltas, melhor: String(l.melhor) })) } : null;
  };
  const voltasDe = (id) => {
    const m = new Map();
    for (const [piloto, v, t, s1, s2, s3, ok] of ((IDT.voltas.get(id) || {}).linhas || [])) {
      if (!m.has(piloto)) m.set(piloto, []);
      m.get(piloto).push({ volta: Number(v), t: Number(t), ok: Number(ok) === 1, s1, s2, s3 });
    }
    m.forEach((ls) => ls.sort((a, b) => a.volta - b.volta));
    return m;
  };
  // mesmas regras do painel: voltas limpas = válidas, sem a 1ª, até 7% acima da melhor
  const ritmo = (laps) => {
    const ok = (laps || []).filter((l) => l.ok);
    if (!ok.length) return null;
    const melhor = Math.min(...ok.map((l) => l.t));
    const lv = ok.find((l) => l.t === melhor).volta;
    const limpas = ok.filter((l) => l.volta > 1 && l.t <= melhor * 1.07).map((l) => l.t);
    const media = limpas.length ? limpas.reduce((a, b) => a + b, 0) / limpas.length : null;
    const desvio = limpas.length > 1 ? Math.sqrt(limpas.reduce((a, b) => a + (b - media) ** 2, 0) / (limpas.length - 1)) : null;
    const best = (k) => { const v = ok.map((l) => l[k]).filter((x) => x != null && x > 0); return v.length ? Math.min(...v) : null; };
    const s1 = best('s1'), s2 = best('s2'), s3 = best('s3');
    return { melhor, lv, media, desvio, s1, s2, s3, ideal: s1 && s2 && s3 ? s1 + s2 + s3 : null, n: laps.length };
  };
  const posTomada = (id) => { const f = folha(id, 'tomada'); return f ? new Map(f.linhas.filter((l) => l.piloto).map((l) => [l.piloto, l.pos])) : new Map(); };

  // ---------- cabeçalho ----------
  function cabecalho(ps) {
    const sel = $('#cor-sel');
    sel.replaceChildren(...ps.map((p) => new Option(`Prova ${p.numero} · ${dataBR(p.data)} · ${p.kartodromo}`, p.id)));
    sel.value = C.id;
    const i = ps.findIndex((p) => p.id === C.id);
    $('#cor-ant').disabled = i >= ps.length - 1;
    $('#cor-prox').disabled = i <= 0;
    const p = ps[i];
    $('#cor-tit').textContent = `Prova ${p.numero} · ${dataBR(p.data)}`;
    const res = resultado(p.id);
    $('#cor-meta').textContent = [IDT.pista(p), p.observacao, res.length + ' pilotos'].filter(Boolean).join(' · ');
    const tem = { prova: true, tomada: !!folha(p.id, 'tomada'), voltas: IDT.voltas.has(p.id), analise: true };
    document.querySelectorAll('[data-cvista]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.cvista === C.vista));
      b.title = tem[b.dataset.cvista] ? '' : 'Esta prova não tem este arquivo';
    });
    return tem;
  }

  // ---------- folhas (Resultado e Tomada) ----------
  const COLS = [
    ['pos', 'Pos'], ['kart', 'Kart', 'cor-opt'], ['piloto', 'Piloto'], ['voltas', 'Voltas'], ['total', 'Tempo total', 'cor-opt'],
    ['diff', 'Dif. p/ 1º'], ['espaco', 'Dif. p/ frente', 'cor-opt'], ['melhor', 'Melhor volta'],
    ['s1', 'S1', 'cor-opt'], ['s2', 'S2', 'cor-opt'], ['s3', 'S3', 'cor-opt'], ['vel', 'Vel. km/h', 'cor-opt'],
  ];
  function vistaFolha(p, tipo) {
    const f = folha(p.id, tipo);
    const nome = tipo === 'prova' ? 'Resultado da prova' : 'Tomada de tempo';
    if (!f) return el('div', { class: 'idt-card' }, el('div', { class: 'cor-vazio' }, el('strong', {}, 'Sem tomada de tempo nesta prova'), el('span', {}, 'O arquivo da tomada não foi enviado para esta prova.')));
    const tem = (k) => f.linhas.some((l) => l[k] !== '' && l[k] != null);
    const setores = ['s1', 's2', 's3'].every((k) => f.linhas.filter((l) => l[k]).length >= f.linhas.length / 2);
    const cols = COLS.filter(([k]) => (['s1', 's2', 's3'].includes(k) ? setores : tem(k)));
    const tempos = f.linhas.map((l) => L.segundos(l.melhor)).filter((x) => x != null && x > 0);
    const rapida = tempos.length ? Math.min(...tempos) : null;
    const comVoltas = voltasDe(p.id);
    const tb = el('tbody');
    for (const l of f.linhas) {
      const tr = el('tr', { class: l.nc ? 'nc' : null });
      if (comVoltas.has(l.piloto)) { tr.dataset.piloto = l.piloto; tr.title = 'Ver o volta a volta de ' + l.piloto; tr.addEventListener('click', () => abrirPiloto(l.piloto)); }
      for (const [k, , cls] of cols) {
        const td = el('td', { class: cls || null });
        if (k === 'pos') {
          if (l.nc) td.textContent = 'NC';
          else td.append(el('span', { class: 'idt-rank' + (tipo === 'prova' && l.pos <= 3 ? ' r' + l.pos : '') }, String(l.pos)));
        } else if (k === 'piloto') {
          td.className = 'nome';
          td.append(l.piloto || L.titulo(l.cru || ''));
          if (tipo === 'tomada' && l.pos === 1) td.append(' ', el('span', { class: 'idt-badge b-primary' }, 'pole'));
        } else if (k === 'melhor') {
          const s = L.segundos(l.melhor);
          td.textContent = s ? volta(s) : '—';
          if (s && s === rapida) td.className = 'idt-fast';
          if (!s) td.classList.add('vazio');
        } else if (k === 'voltas') td.textContent = l.voltas == null ? '—' : String(l.voltas);
        else {
          const v = l[k];
          td.textContent = v ? txt(v) : (l.pos === 1 && (k === 'diff' || k === 'espaco') ? '' : '—');
          if (!v) td.classList.add('vazio');
          if (/volta/.test(v || '')) td.classList.add('atras');
        }
        tr.append(td);
      }
      tb.append(tr);
    }
    const thead = el('thead', {}, el('tr', {}, ...cols.map(([k, t, cls]) => el('th', { class: [k === 'piloto' ? 'l' : '', cls || ''].join(' ').trim() || null }, t))));
    const notas = [];
    if (f.titulo) notas.push(f.titulo);
    notas.push(f.linhas.length + ' pilotos');
    if (rapida) notas.push('melhor volta em azul');
    if (comVoltas.size) notas.push('toque num piloto para ver o volta a volta dele');
    return el('div', { class: 'idt-card cor-folha' },
      el('div', { class: 'idt-card-head' }, el('div', {}, el('h3', {}, nome), el('p', { class: 'idt-note' }, notas.join(' · ')))),
      f.resumida ? el('p', { class: 'idt-note' }, 'O arquivo desta prova é uma foto, por isso a folha mostra só posição, voltas e melhor volta.') : null,
      el('div', { class: 'idt-tablebox' }, el('table', { class: 'idt-table' }, thead, tb)));
  }

  // ---------- volta a volta: um piloto depois do outro, voltas na vertical (como a folha do kartódromo) ----------
  function vistaVoltas(p) {
    const vs = voltasDe(p.id);
    if (!vs.size) return el('div', { class: 'idt-card' }, el('div', { class: 'cor-vazio' }, el('strong', {}, 'Sem volta a volta nesta prova'), el('span', {}, 'O arquivo do volta a volta não foi enviado ou não pôde ser lido.')));
    if (C.piloto && !vs.has(C.piloto)) C.piloto = null;
    const res = resultado(p.id);
    const pos = new Map(res.map((l) => [l.piloto, l.pos]));
    const quem = [...vs.keys()].sort((a, b) => (pos.get(a) || 99) - (pos.get(b) || 99));
    // no computador o balão já abre com o piloto padrão (ou o vencedor); no celular só quando tocar num piloto
    if (!C.piloto && !C.fechado && window.innerWidth >= 1100) C.piloto = quem.includes(IDT.PILOTO_PADRAO) ? IDT.PILOTO_PADRAO : quem[0];
    const rs = new Map(quem.map((q) => [q, ritmo(vs.get(q))]));
    const geral = Math.min(...[...rs.values()].filter(Boolean).map((r) => r.melhor));
    const fp = folha(p.id, 'prova');
    const kart = new Map(((fp && fp.linhas) || []).map((l) => [l.piloto, l.kart]));
    const escolher = (q) => { C.piloto = q; C.fechado = false; render(); };

    const modo = el('div', { class: 'idt-group', role: 'group', 'aria-label': 'Como mostrar' },
      ...[['piloto', 'Por piloto'], ['grade', 'Todos em grade']].map(([k, t]) => el('button', { type: 'button', class: 'idt-btn secondary sm', 'aria-pressed': String(C.modoVV === k), onclick: () => { C.modoVV = k; render(); } }, t)));
    const leg = el('div', { class: 'cor-leg' }, el('span', {}, el('i', { class: 'fl' }), 'Volta mais rápida da prova'), el('span', {}, el('i', { class: 'pb' }), 'Melhor volta do piloto'), el('span', {}, el('i', { class: 'bad' }), 'Falha de cronometragem (não conta)'));
    const topo = el('div', { class: 'idt-card cor-vv-topo' },
      el('div', { class: 'idt-card-head' }, el('div', {}, el('h3', {}, 'Volta a volta'), el('p', { class: 'idt-note' }, `${quem.length} ${quem.length === 1 ? 'piloto' : 'pilotos, na ordem de chegada'} · toque num piloto para ver a análise dele`)), modo),
      leg);

    let corpo;
    if (C.modoVV === 'grade') corpo = grade(vs, quem, pos, rs, geral);
    else {
      corpo = el('div', { class: 'cor-blocos' });
      for (const q of quem) {
        const laps = vs.get(q), r = rs.get(q);
        const temSet = laps.some((l) => l.ok && l.s1 != null);
        const tb = el('tbody');
        for (const l of laps) {
          const cls = !l.ok ? 'bad' : r && l.t === r.melhor ? (l.t === geral ? 'fl' : 'pb') : r && l.t > r.melhor * 1.07 ? 'lenta' : '';
          tb.append(el('tr', { class: cls || null, title: l.ok ? null : 'Falha de cronometragem: não conta' },
            el('td', {}, String(l.volta)),
            el('td', { class: 't' }, volta(l.t)),
            el('td', { class: 'd' }, !l.ok || !r ? '' : l.t === r.melhor ? 'melhor' : '+' + seg(l.t - r.melhor)),
            ...(temSet ? [l.s1, l.s2, l.s3].map((s) => el('td', { class: 's' }, s != null ? seg(s) : '')) : [])));
        }
        const pp = pos.get(q);
        const bloco = el('article', { class: 'cor-bloco' + (q === C.piloto ? ' is-sel' : ''), 'data-piloto': q },
          el('button', { type: 'button', class: 'cor-bloco-head', onclick: () => escolher(q), 'aria-label': 'Ver a análise de ' + q },
            el('span', { class: 'idt-rank' + (pp <= 3 ? ' r' + pp : '') }, String(pp || '—')),
            el('span', { class: 'quem' }, el('b', {}, q), el('small', {}, [kart.get(q) ? 'Kart ' + kart.get(q) : null, laps.length + ' voltas', r ? 'melhor ' + volta(r.melhor) : null].filter(Boolean).join(' · '))),
            el('span', { class: 'ver' }, q === C.piloto ? 'Em análise' : 'Analisar ›')),
          el('table', { class: 'cor-vt' },
            el('thead', {}, el('tr', {}, el('th', {}, 'Volta'), el('th', {}, 'Tempo'), el('th', {}, 'Dif.'), ...(temSet ? ['S1', 'S2', 'S3'].map((s) => el('th', {}, s)) : []))), tb));
        corpo.append(bloco);
      }
    }
    const box = el('div', { class: 'cor-vv' + (C.piloto ? ' com-piloto' : '') }, el('div', { class: 'cor-vv-main' }, topo, corpo));
    if (C.piloto) box.append(el('div', { class: 'cor-veu', onclick: fechar }), balao(p, C.piloto, vs, rs, geral));
    return box;
  }
  function fechar() { C.piloto = null; C.fechado = true; render(); }

  // grade: pilotos nas linhas, voltas nas colunas
  function grade(vs, quem, pos, rs, geral) {
    const max = Math.max(...[...vs.values()].map((ls) => Math.max(...ls.map((l) => l.volta))));
    const thead = el('thead', {}, el('tr', {}, el('th', {}, 'Piloto'), el('th', {}, 'Melhor'), ...Array.from({ length: max }, (_, i) => el('th', {}, String(i + 1)))));
    const tb = el('tbody');
    for (const q of quem) {
      const laps = vs.get(q), r = rs.get(q);
      const tr = el('tr', { class: q === C.piloto ? 'is-sel' : null, title: 'Ver a análise de ' + q });
      tr.addEventListener('click', () => { C.piloto = q; C.fechado = false; render(); });
      tr.append(el('td', { class: 'nome' }, el('span', { class: 'idt-rank' + ((pos.get(q) || 9) <= 3 ? ' r' + pos.get(q) : '') }, String(pos.get(q) || '—')), q));
      tr.append(el('td', { class: 'melhor' + (r && r.melhor === geral ? ' fl' : '') }, r ? volta(r.melhor) : '—'));
      for (let v = 1; v <= max; v++) {
        const l = laps.find((x) => x.volta === v);
        const td = el('td', {}, l ? volta(l.t) : '');
        if (l) {
          if (!l.ok) { td.className = 'bad'; td.title = 'Falha de cronometragem: não conta'; }
          else if (r && l.t === r.melhor) td.className = l.t === geral ? 'fl' : 'pb';
          else if (r && l.t > r.melhor * 1.07) td.className = 'lenta';
        }
        tr.append(td);
      }
      tb.append(tr);
    }
    return el('div', { class: 'idt-card cor-grade' }, el('div', { class: 'idt-tablebox' }, el('table', { class: 'idt-table' }, thead, tb)));
  }

  // ---------- balão do piloto: análise na corrida + histórico em corridas iguais ----------
  // Só compara com corridas no mesmo kartódromo, mesmo traçado e mesma condição de pista (seca × molhada).
  const condicao = (p) => [p.kartodromo, p.tracado, p.pisoLento ? 'pista molhada' : 'pista seca'].filter(Boolean).join(' · ');
  const ordinal = (n) => n + 'º';
  function balao(p, q, vs, rs, geral) {
    const r = rs.get(q), laps = vs.get(q) || [];
    const res = resultado(p.id);
    const chegada = (res.find((l) => l.piloto === q) || {}).pos;
    const tomada = posTomada(p.id).get(q);
    const todos = [...rs.entries()].filter(([, x]) => x);
    const rank = (k) => (r && r[k] != null ? todos.filter(([, x]) => x[k] != null).map(([, x]) => x[k]).sort((a, b) => a - b).indexOf(r[k]) + 1 : null);
    const nR = (k) => todos.filter(([, x]) => x[k] != null).length;
    const quemRapido = (todos.find(([, x]) => x.melhor === geral) || [''])[0];

    const head = el('div', { class: 'cor-balao-head' },
      el('div', {}, el('h3', {}, q), el('p', {}, [chegada ? `P${chegada} na chegada` : null, tomada ? `P${tomada} na tomada` : null].filter(Boolean).join(' · '))),
      el('button', { class: 'idt-btn ghost cor-fechar', type: 'button', 'aria-label': 'Fechar', onclick: fechar }, '×'));
    const mini = el('div', { class: 'cor-mini' },
      el('div', {}, el('span', { class: 'l' }, 'Melhor volta'), el('span', { class: 'v' }, r ? volta(r.melhor) : '—'), el('span', { class: 'h' }, r ? `${ordinal(rank('melhor'))} da prova · volta ${r.lv}` : '')),
      el('div', {}, el('span', { class: 'l' }, 'Ritmo médio'), el('span', { class: 'v' }, r && r.media ? volta(r.media) : '—'), el('span', { class: 'h' }, r && r.media ? `${ordinal(rank('media'))} melhor da prova` : '')),
      el('div', {}, el('span', { class: 'l' }, 'Constância'), el('span', { class: 'v' }, r && r.desvio != null ? '±' + seg(r.desvio, 2) + ' s' : '—'), el('span', { class: 'h' }, r && r.desvio != null ? `${ordinal(rank('desvio'))} mais constante` : '')),
      r && r.ideal ? el('div', {}, el('span', { class: 'l' }, 'Volta ideal'), el('span', { class: 'v' }, volta(r.ideal)), el('span', { class: 'h' }, `${seg(r.melhor - r.ideal)} s a ganhar`))
        : el('div', {}, el('span', { class: 'l' }, 'Para o mais rápido'), el('span', { class: 'v' }, !r ? '—' : r.melhor === geral ? 'É ele' : '+' + seg(r.melhor - geral) + ' s'), el('span', { class: 'h' }, r && r.melhor === geral ? 'volta mais rápida da prova' : 'na melhor volta')));
    const out = el('aside', { class: 'cor-balao', 'aria-label': 'Análise de ' + q }, head, mini);

    // nesta corrida: frases curtas
    const frases = [];
    const pl = (n, s, p2) => n + ' ' + (n === 1 ? s : p2);
    if (chegada && tomada) {
      const d = tomada - chegada;
      frases.push(d > 0 ? [`Saiu em P${tomada} na tomada e chegou em P${chegada}: `, `ganhou ${pl(d, 'posição', 'posições')}`, '.']
        : d < 0 ? [`Saiu em P${tomada} na tomada e chegou em P${chegada}: `, `perdeu ${pl(-d, 'posição', 'posições')}`, '.']
          : [`Chegou na mesma posição em que saiu da tomada (P${chegada}).`]);
    }
    if (r && r.melhor !== geral) frases.push(['Na melhor volta ficou ', `${seg(r.melhor - geral)} s`, ` atrás da mais rápida da prova (${quemRapido}).`]);
    const limpas = laps.filter((l) => r && l.ok && l.volta > 1 && l.t <= r.melhor * 1.07);
    if (limpas.length >= 6) {
      const meio = Math.floor(limpas.length / 2);
      const m1 = limpas.slice(0, meio).reduce((a, l) => a + l.t, 0) / meio, m2 = limpas.slice(meio).reduce((a, l) => a + l.t, 0) / (limpas.length - meio);
      const d = m2 - m1;
      frases.push(d > 0.25 ? ['Foi perdendo ritmo: no fim andou ', `${seg(d, 2)} s por volta mais lento`, ' que no começo.']
        : d < -0.25 ? ['Cresceu na prova: no fim andou ', `${seg(-d, 2)} s por volta mais rápido`, ' que no começo.']
          : ['Manteve o mesmo ritmo do começo ao fim da prova.']);
    }
    if (r && r.ideal) {
      const comSet = todos.map(([, x]) => x).filter((x) => x.ideal);
      const pior = ['s1', 's2', 's3'].map((k) => {
        const v = laps.filter((l) => l.ok && l[k] != null).map((l) => l[k]);
        return { k: k.toUpperCase(), perde: Math.min(...v) - Math.min(...comSet.map((x) => x[k])) };
      }).sort((a, b) => b.perde - a.perde)[0];
      if (pior && pior.perde > 0.05) frases.push(['Onde mais perde: ', pior.k, `, ${seg(pior.perde)} s atrás do melhor ${pior.k} da prova.`]);
    }
    if (frases.length) out.append(el('h4', {}, 'Nesta corrida'), el('ul', { class: 'cor-frases' }, ...frases.map(([a, b, c]) => el('li', {}, a, b ? el('b', {}, b) : null, c || ''))));

    // histórico em corridas iguais (mesmo kartódromo, traçado e condição)
    const cond = condicao(p);
    const iguais = provas().filter((x) => x.id !== p.id && condicao(x) === cond && resultado(x.id).some((l) => l.piloto === q)).sort((a, b) => a.numero - b.numero);
    out.append(el('h4', {}, 'No histórico, em corridas iguais'), el('p', { class: 'idt-note' }, cond));
    if (!iguais.length) {
      out.append(el('p', { class: 'cor-semhist' }, `Esta é a única corrida dele em ${cond}. A comparação aparece quando ele correr de novo nesta condição.`));
      return out;
    }
    const hist = iguais.map((x) => {
      const l = resultado(x.id).find((y) => y.piloto === q);
      const rr = voltasDe(x.id).has(q) ? ritmo(voltasDe(x.id).get(q)) : null;
      return { x, pos: l.pos, melhor: l.melhor, media: rr && rr.media, desvio: rr && rr.desvio, tomada: posTomada(x.id).get(q) };
    });
    const media = (k) => { const v = hist.map((h) => h[k]).filter((v) => v != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const minimo = (k) => { const v = hist.map((h) => h[k]).filter((v) => v != null); return v.length ? Math.min(...v) : null; };
    const melhorOficial = (res.find((l) => l.piloto === q) || {}).melhor;
    const pfx = (x) => 'P' + String(Math.round(x * 10) / 10).replace('.', ',');
    const linha = (rot, agora, med, rec, fmt, tol) => {
      let cls = '';
      if (agora != null && med != null && Math.abs(agora - med) >= tol) cls = agora < med ? 'melhorou' : 'piorou';
      return el('tr', {}, el('td', {}, rot), el('td', { class: 'agora ' + cls }, agora != null ? fmt(agora) : '—'), el('td', {}, med != null ? fmt(med) : '—'), el('td', {}, rec != null ? fmt(rec) : '—'));
    };
    out.append(el('table', { class: 'cor-cmp' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Agora'), el('th', {}, `Média (${hist.length})`), el('th', {}, 'Melhor dele'))),
      el('tbody', {},
        linha('Chegada', chegada, media('pos'), minimo('pos'), pfx, 0.5),
        tomada || hist.some((h) => h.tomada) ? linha('Tomada', tomada, media('tomada'), minimo('tomada'), pfx, 0.5) : null,
        linha('Melhor volta', melhorOficial, media('melhor'), minimo('melhor'), volta, 0.0005),
        linha('Ritmo médio', r && r.media, media('media'), minimo('media'), volta, 0.0005),
        linha('Constância', r && r.desvio, media('desvio'), minimo('desvio'), (x) => '±' + seg(x, 2), 0.005))),
    el('p', { class: 'idt-note' }, `"Agora" em verde: melhor que a média dele nas outras ${pl(hist.length, 'corrida igual', 'corridas iguais')}. Em vermelho: pior.`));
    if (melhorOficial != null && minimo('melhor') != null && melhorOficial < minimo('melhor')) out.append(el('p', { class: 'cor-recorde' }, 'Melhor volta dele de todas as corridas nesta condição.'));

    const linhasH = [...hist.map((h) => ({ n: h.x.numero, d: h.x.data, pos: h.pos, melhor: h.melhor, id: h.x.id })), { n: p.numero, d: p.data, pos: chegada, melhor: melhorOficial, id: p.id, agora: true }].sort((a, b) => a.n - b.n);
    out.append(el('table', { class: 'cor-cmp cor-hist' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Corridas iguais'), el('th', {}, 'Chegada'), el('th', {}, 'Melhor volta'))),
      el('tbody', {}, ...linhasH.map((h) => el('tr', { class: h.agora ? 'agora' : null },
        el('td', {}, h.agora ? el('b', {}, `Prova ${h.n} · esta`) : el('button', { type: 'button', class: 'cor-link', title: 'Abrir a prova ' + h.n, onclick: () => { C.id = h.id; render(); } }, `Prova ${h.n} · ${dataBR(h.d).slice(0, 5)}`)),
        el('td', {}, h.pos ? 'P' + h.pos : '—'), el('td', {}, volta(h.melhor)))))));

    // gráfico: esta × a última corrida igual com volta a volta
    const comV = hist.filter((h) => voltasDe(h.x.id).has(q));
    const ultima = comV.filter((h) => h.x.numero < p.numero).pop() || comV[comV.length - 1];
    if (ultima && laps.length) {
      const pa = ultima.x;
      const ch = el('div', { class: 'idt-chart' });
      out.append(el('h4', {}, `Volta a volta: esta × prova ${pa.numero}`), ch,
        el('div', { class: 'idt-legend' }, el('span', {}, el('i', { class: 'line sw-primary' }), 'Prova ' + p.numero), el('span', {}, el('i', { class: 'line', style: 'background: var(--idt-ink-400)' }), 'Prova ' + pa.numero)));
      requestAnimationFrame(() => grafico(ch, [{ laps, cor: 'var(--idt-primary)' }, { laps: voltasDe(pa.id).get(q), cor: 'var(--idt-ink-400)' }]));
    }
    return out;
  }
  function grafico(el0, series) {
    if (!window.d3 || !el0.isConnected) return;
    el0.replaceChildren();
    const ss = series.map((s) => ({ ...s, laps: (s.laps || []).filter((l) => l.ok) })).filter((s) => s.laps.length);
    const all = ss.flatMap((s) => s.laps.map((l) => l.t)).sort((a, b) => a - b);
    if (!all.length) return;
    // voltas muito lentas (rodada, bandeira) ficam presas no topo para não achatar o resto
    const lo = all[0], cap = Math.min(all[all.length - 1], Math.max(d3.quantile(all, 0.9) * 1.02, lo * 1.03));
    const maxV = d3.max(ss, (s) => d3.max(s.laps, (l) => l.volta));
    const W = Math.max(260, el0.clientWidth || 320), H = 190, m = { t: 10, r: 8, b: 26, l: 50 };
    const x = d3.scaleLinear([1, maxV], [m.l, W - m.r]);
    const y = d3.scaleLinear([lo - (cap - lo) * 0.08, cap], [H - m.b, m.t]);
    const svg = d3.select(el0).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    const yt = y.ticks(4);
    const tk = (s) => { const mm = Math.floor(s / 60); return mm + ':' + (s - mm * 60).toFixed(1).padStart(4, '0').replace('.', ','); };
    svg.append('g').selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(yt).join('text').attr('x', m.l - 6).attr('y', y).attr('dy', '0.35em').attr('text-anchor', 'end').text(tk);
    const step = Math.max(1, Math.ceil(maxV / 8));
    svg.append('g').selectAll('text').data(d3.range(1, maxV + 1).filter((v) => (v - 1) % step === 0)).join('text').attr('x', x).attr('y', H - 8).attr('text-anchor', 'middle').text((v) => v);
    ss.slice().reverse().forEach((s) => {
      const pts = s.laps, cy = (l) => y(Math.min(l.t, cap));
      svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', s.cor).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('d', d3.line().x((l) => x(l.volta)).y(cy));
      svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (l) => x(l.volta)).attr('cy', cy).attr('r', 2.5).attr('fill', s.cor);
    });
  }

  // ---------- análise da corrida ----------
  function vistaAnalise(p) {
    const res = resultado(p.id), fp = folha(p.id, 'prova'), ft = folha(p.id, 'tomada'), vs = voltasDe(p.id);
    const v1 = res[0], fl1 = fp.linhas.find((l) => l.pos === 1), fl2 = fp.linhas.find((l) => l.pos === 2);
    const pole = ft && ft.linhas.find((l) => l.pos === 1);
    const rap = res.reduce((a, b) => (b.melhor < a.melhor ? b : a), res[0]);
    const rr = vs.has(rap.piloto) ? ritmo(vs.get(rap.piloto)) : null;
    const kpi = (l, v, h, acc) => el('div', { class: 'idt-kpi' + (acc ? ' accent' : '') }, el('span', { class: 'l' }, l), el('span', { class: 'v name' }, v), el('span', { class: 'h' }, h || ''));
    const kpis = el('div', { class: 'idt-kpis' },
      kpi('Vencedor', v1.piloto, fl1 && fl1.total ? 'Tempo total ' + txt(fl1.total) : v1.voltas + ' voltas', true),
      kpi('Pole na tomada', pole ? pole.piloto || L.titulo(pole.cru) : '—', pole ? volta(L.segundos(pole.melhor)) : 'sem tomada nesta prova'),
      kpi('Volta mais rápida', rap.piloto, volta(rap.melhor) + (rr && Math.abs(rr.melhor - rap.melhor) < 0.001 ? ' · volta ' + rr.lv : '')),
      kpi('Do 1º para o 2º', fl2 && fl2.diff ? txt(fl2.diff) + (/volta/.test(fl2.diff) ? '' : ' s') : '—', fl2 ? fl2.piloto : ''));
    const out = [kpis];
    const nome = (q, pos) => el('span', { class: 'quem' }, el('small', {}, 'P' + pos), vs.has(q) ? el('button', { type: 'button', onclick: () => abrirPiloto(q), title: 'Ver o volta a volta de ' + q }, q) : q);

    // da tomada à chegada
    const tom = posTomada(p.id);
    const ganhos = res.filter((l) => tom.has(l.piloto)).map((l) => ({ q: l.piloto, pos: l.pos, d: tom.get(l.piloto) - l.pos }));
    if (ganhos.length >= 3) {
      const maxD = Math.max(1, ...ganhos.map((g) => Math.abs(g.d)));
      out.push(el('div', { class: 'idt-card' },
        el('div', { class: 'idt-card-head' }, el('div', {}, el('h3', {}, 'Da tomada à chegada'), el('p', { class: 'idt-note' }, 'Posições ganhas (verde) ou perdidas (vermelho) entre a tomada de tempo e a chegada.'))),
        el('div', { class: 'cor-barras' }, ...ganhos.map((g) => {
          const w = (Math.abs(g.d) / maxD) * 50;
          const bar = g.d ? el('i', { class: g.d > 0 ? 'ganhou' : 'perdeu', style: g.d > 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%` }) : null;
          return el('div', { class: 'cor-barra' }, nome(g.q, g.pos), el('div', { class: 'cor-eixo' }, bar), el('span', { class: 'val' }, g.d > 0 ? '+' + g.d : g.d < 0 ? '−' + Math.abs(g.d) : '='));
        }))));
    }

    // ritmo de cada piloto
    const rit = res.filter((l) => vs.has(l.piloto)).map((l) => ({ q: l.piloto, pos: l.pos, r: ritmo(vs.get(l.piloto)) })).filter((x) => x.r && x.r.media);
    if (rit.length >= 3) {
      const lo = Math.min(...rit.map((x) => x.r.melhor)), hi = Math.max(...rit.map((x) => x.r.media));
      const pc = (t) => ((t - lo) / (hi - lo || 1)) * 94 + 3;
      out.push(el('div', { class: 'idt-card' },
        el('div', { class: 'idt-card-head' }, el('div', {}, el('h3', {}, 'Ritmo de cada piloto'), el('p', { class: 'idt-note' }, 'Mais à esquerda é mais rápido. Quanto mais curta a linha, mais perto da melhor volta ele andou a prova toda.'))),
        el('div', { class: 'idt-legend' }, el('span', {}, el('i', { class: 'sw-primary', style: 'border-radius:50%' }), 'Melhor volta'), el('span', {}, el('i', { style: 'border-radius:50%;border:2px solid var(--idt-ink-600);background:var(--idt-surface)' }), 'Ritmo médio')),
        el('div', { class: 'cor-barras' }, ...rit.map((x) => el('div', { class: 'cor-barra ritmo' }, nome(x.q, x.pos),
          el('div', { class: 'cor-ritmo' }, el('span', { class: 'seg', style: `left:${pc(x.r.melhor)}%;width:${pc(x.r.media) - pc(x.r.melhor)}%` }), el('span', { class: 'pt media', style: `left:${pc(x.r.media)}%` }), el('span', { class: 'pt melhor', style: `left:${pc(x.r.melhor)}%` })),
          el('span', { class: 'val' }, el('b', {}, volta(x.r.melhor)), ' · ' + volta(x.r.media)))))));
    }

    // destaques
    const itens = [];
    const top = (arr, k, menor = true) => arr.filter((x) => x[k] != null).sort((a, b) => (menor ? a[k] - b[k] : b[k] - a[k]))[0];
    const flat = rit.map((x) => ({ q: x.q, desvio: x.r.desvio, media: x.r.media, ideal: x.r.ideal }));
    const cons = top(flat, 'desvio'), med = top(flat, 'media'), ide = top(flat, 'ideal'), gan = ganhos.length ? top(ganhos, 'd', false) : null;
    if (med) itens.push(['Melhor ritmo médio', 'b-primary', `${med.q}: ${volta(med.media)} de média nas voltas limpas.`]);
    if (cons) itens.push(['Mais constante', 'b-success', `${cons.q}: variou só ±${seg(cons.desvio, 2)} s entre as voltas.`]);
    if (gan && gan.d > 0) itens.push(['Quem mais subiu', 'b-success', `${gan.q}: ganhou ${gan.d} ${gan.d === 1 ? 'posição' : 'posições'} da tomada até a chegada.`]);
    if (ide) itens.push(['Volta ideal mais rápida', 'b-neutral', `${ide.q}: ${volta(ide.ideal)} somando os melhores setores.`]);
    if (itens.length) out.push(el('div', { class: 'idt-card' }, el('h3', {}, 'Destaques'),
      el('div', { class: 'idt-diag' }, ...itens.map(([t, b, s]) => el('div', { class: 'item' }, el('span', { class: 'idt-badge ' + b }, t), el('p', {}, s))))));
    if (!vs.size) out.push(el('p', { class: 'idt-note' }, 'Esta prova não tem volta a volta, por isso a análise de ritmo não aparece.'));
    return out;
  }

  // ---------- desenho ----------
  function abrirPiloto(q) {
    C.vista = 'voltas'; C.piloto = q; C.fechado = false; C.modoVV = 'piloto'; render();
    requestAnimationFrame(() => { const b = [...document.querySelectorAll('.cor-bloco')].find((x) => x.dataset.piloto === q); if (b) window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' }); });
  }
  function render() {
    const sec = $('#corridas');
    if (!sec || sec.hidden) return;
    const corpo = $('#cor-corpo');
    if (!IDT.carregado.provas || !IDT.carregado.resultados) { corpo.replaceChildren(el('p', { class: 'idt-note' }, 'Carregando…')); return; }
    const ps = provas();
    if (!ps.length) { corpo.replaceChildren(el('p', { class: 'idt-note' }, 'Nenhuma prova lançada ainda.')); return; }
    if (!ps.some((p) => p.id === C.id)) C.id = ps[0].id;
    cabecalho(ps);
    const p = ps.find((x) => x.id === C.id);
    const x = window.scrollX, y = window.scrollY;
    const v = C.vista === 'prova' || C.vista === 'tomada' ? vistaFolha(p, C.vista) : C.vista === 'voltas' ? vistaVoltas(p) : vistaAnalise(p);
    corpo.replaceChildren(...[].concat(v));
    window.scrollTo(x, y);
  }

  $('#cor-sel').addEventListener('change', (e) => { C.id = e.target.value; C.piloto = null; C.fechado = false; render(); });
  const passo = (d) => { const ps = provas(); const i = ps.findIndex((p) => p.id === C.id) + d; if (ps[i]) { C.id = ps[i].id; C.piloto = null; C.fechado = false; render(); } };
  $('#cor-ant').addEventListener('click', () => passo(1));
  $('#cor-prox').addEventListener('click', () => passo(-1));
  document.querySelectorAll('[data-cvista]').forEach((b) => b.addEventListener('click', () => { C.vista = b.dataset.cvista; render(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && C.piloto && !$('#corridas').hidden) fechar(); });
  document.querySelectorAll('[data-tab="corridas"]').forEach((b) => b.addEventListener('click', () => setTimeout(render, 0)));
  IDT.aoMudar(render);
  let largura = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largura) > 40) { largura = window.innerWidth; render(); } });
  setTimeout(render, 0);
})();

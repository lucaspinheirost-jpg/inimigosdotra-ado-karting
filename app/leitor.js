// Leitor dos arquivos do kartódromo (HTML e PDF do sistema de cronometragem) e conferência de nomes.
// Expõe window.IDTLeitor = { lerResultado, lerVoltas, casarNome, chave, titulo, segundos }.
(() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  // ---------- utilidades ----------
  const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const chave = (s) => semAcento(String(s || '')).toUpperCase().replace(/[^A-Z]/g, '');
  const palavras = (s) => semAcento(String(s || '')).toUpperCase().replace(/[^A-Z. ]/g, ' ').split(/\s+/).filter(Boolean);
  const PEQ = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E']);
  // Mesmo padrão dos nomes já cadastrados: "LUCAS DE PAULA" → "Lucas de Paula", "MELQUI S." fica "MELQUI S."
  const titulo = (n) => String(n || '').trim().split(/\s+/).map((w, i) => {
    const up = w.toUpperCase();
    if (i > 0 && PEQ.has(semAcento(up))) return up.toLowerCase();
    if (w.endsWith('.') && w.length <= 2) return up;
    return up.charAt(0) + up.slice(1).toLowerCase();
  }).join(' ');
  const segundos = (t) => {
    const s = String(t || '').trim().replace(',', '.');
    if (!/^(\d+:)?\d{1,2}(:\d\d)?\.\d{1,3}$|^\d+\.\d{1,3}$/.test(s)) return null;
    return Math.round(s.split(':').reduce((a, x) => a * 60 + parseFloat(x), 0) * 1000) / 1000;
  };
  const limpaNome = (n) => String(n || '').replace(/^\[\d+\]\s*/, '').replace(/\s+/g, ' ').trim();
  const decode = (buf) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } };

  // ---------- PDF ----------
  let pdfPronto = null;
  const carregaPdf = () => pdfPronto || (pdfPronto = new Promise((ok, bad) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfPronto = null; bad(new Error('Não foi possível carregar o leitor de PDF. Confira a conexão.')); };
    document.head.append(s);
  }));
  // Itens de texto com posição: {s, x, w, y, p}. y cresce para cima (padrão PDF).
  async function itensPdf(buf) {
    const lib = await carregaPdf();
    const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      for (const it of tc.items) { const s = it.str.trim(); if (s) out.push({ s, x: it.transform[4], w: it.width, y: it.transform[5], p: i }); }
    }
    return out;
  }
  // Agrupa em linhas (mesma página, y a até 1,5 pt) ordenadas de cima para baixo.
  const linhasDe = (itens, tol = 1.5) => {
    const ls = [];
    for (const it of [...itens].sort((a, b) => a.p - b.p || b.y - a.y)) {
      const l = ls.length && ls[ls.length - 1];
      if (l && l.p === it.p && Math.abs(l.y - it.y) <= tol) l.itens.push(it); else ls.push({ p: it.p, y: it.y, itens: [it] });
    }
    ls.forEach((l) => l.itens.sort((a, b) => a.x - b.x));
    return ls;
  };
  const centro = (it) => it.x + it.w / 2;

  // Resultado em PDF: linha começa com a posição (x mais à esquerda). Nomes longos quebram em 2 linhas,
  // por isso o nome é tudo o que está na faixa da coluna Nome a até 8 pt de altura da linha.
  function resultadoPdf(itens) {
    const ls = linhasDe(itens);
    const cab = ls.find((l) => l.itens.some((i) => i.s === 'Pos') && l.itens.some((i) => i.s === 'Nome'));
    if (!cab) return null;
    const H = (t) => cab.itens.find((i) => i.s === t);
    const hPos = H('Pos'), hClasse = H('Classe'), hVoltas = H('Voltas');
    const melhores = itens.filter((i) => i.p === cab.p && /^Melhor/.test(i.s) && Math.abs(i.y - cab.y) < 8).sort((a, b) => a.x - b.x);
    const hMelhor = melhores[0];
    if (!hPos || !hClasse || !hVoltas || !hMelhor) return null;
    const linhas = [];
    for (const l of ls) {
      const pos = l.itens[0];
      if (!/^\d{1,3}$/.test(pos.s) || pos.x > hPos.x + hPos.w + 4) continue;
      if (l.p === cab.p && l.y >= cab.y) continue;
      // o nome começa depois do número do kart (e do código [123456], quando existe)
      const ini = Math.max(pos.x + pos.w, ...l.itens.filter((i) => i.x < hClasse.x && (/^\d{3}$/.test(i.s) || /^\[\d+\]$/.test(i.s))).map((i) => i.x + i.w));
      const doNome = itens.filter((i) => i.p === l.p && Math.abs(i.y - l.y) <= 8 && i.x >= ini - 1 && i.x + 1 < hClasse.x - 2 && !/^\[\d+\]$/.test(i.s) && !/^\d{3}$/.test(i.s))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const nome = limpaNome(doNome.map((i) => i.s).join(' '));
      const voltas = l.itens.find((i) => /^\d{1,3}$/.test(i.s) && Math.abs(centro(i) - centro(hVoltas)) < 20);
      const melhor = l.itens.find((i) => segundos(i.s) != null && centro(i) > hMelhor.x - 10 && centro(i) < hMelhor.x + hMelhor.w + 15);
      linhas.push({ pos: Number(pos.s), nomeArquivo: nome, voltas: voltas ? Number(voltas.s) : null, melhor: melhor ? segundos(melhor.s) : null });
    }
    return linhas.length ? linhas : null;
  }

  // Volta a volta em PDF: "009 - NOME - CLASSE" abre o piloto; cada volta começa com a hora do dia.
  // Depois do tempo da volta vêm números com 3 casas: SFSpd Tm, S1, S2, S3 (setores só quando existem).
  function voltasPdf(itens) {
    const out = [];
    let quem = null;
    for (const l of linhasDe(itens)) {
      const txt = l.itens.map((i) => i.s).join(' ');
      const m = txt.match(/^\d{1,3}\s*-\s*(?:\[\d+\]\s*)?(.+?)\s*-\s*[A-Z]+\s*$/);
      if (m && l.itens.length <= 3) { quem = limpaNome(m[1]); continue; }
      if (!quem || !/^\d{1,2}:\d\d:\d\d\.\d{3}$/.test(l.itens[0].s)) continue;
      const v = l.itens.slice(1);
      const iT = v.findIndex((i) => /^\d+:\d\d\.\d{3}$/.test(i.s) || (/^\d{2,3}\.\d{3}$/.test(i.s) && v.indexOf(i) >= 2));
      if (iT < 1) continue;
      const volta = Number(v[0].s);
      const depois = v.slice(iT + 1).map((i) => i.s).filter((s) => /^\d+\.\d{3}$/.test(s)).map(Number);
      const s = depois.length >= 4 ? depois.slice(1, 4) : [null, null, null];
      if (Number.isInteger(volta)) out.push({ nomeArquivo: quem, volta, tempo: segundos(v[iT].s), s1: s[0], s2: s[1], s3: s[2] });
    }
    return out.length ? out : null;
  }

  // ---------- HTML (exportação do mesmo sistema) ----------
  const tabelaHtml = (html) => {
    const doc = new DOMParser().parseFromString(html.replace(/<td([^>]*)\/>/g, '<td$1></td>'), 'text/html');
    const ths = [...doc.querySelectorAll('th')].map((t) => t.textContent.trim());
    const rows = [...doc.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));
    return { ths, rows };
  };
  function resultadoHtml(html) {
    const { ths, rows } = tabelaHtml(html);
    const iP = ths.indexOf('Pos'), iN = ths.indexOf('Nome'), iV = ths.indexOf('Voltas'), iB = ths.indexOf('Melhor Tempo');
    if (iN < 0) return null;
    const linhas = rows.filter((r) => /^\d+$/.test(r[iP < 0 ? 0 : iP] || '')).map((r) => ({
      pos: Number(r[iP < 0 ? 0 : iP]), nomeArquivo: limpaNome(r[iN]), voltas: iV >= 0 ? Number(r[iV]) : null, melhor: iB >= 0 ? segundos(r[iB]) : null,
    }));
    return linhas.length ? linhas : null;
  }
  function voltasHtml(html) {
    const { ths, rows } = tabelaHtml(html);
    const iV = ths.indexOf('Volta'), iT = ths.indexOf('Volta Tm');
    if (iV < 0 || iT < 0) return null;
    const iS = ['S1', 'S2', 'S3'].map((k) => ths.indexOf(k));
    const out = [];
    let quem = null;
    for (const c of rows) {
      if (c.length === 1) { const m = c[0].match(/^\d+\s*-\s*(?:\[\d+\]\s*)?(.+?)\s*-\s/); quem = m ? limpaNome(m[1]) : null; continue; }
      if (c.length > 3 && quem && /^\d+$/.test(c[iV] || '')) {
        const s = iS.map((i) => (i >= 0 && /^\d+\.\d+$/.test(c[i] || '') ? Number(c[i]) : null));
        out.push({ nomeArquivo: quem, volta: Number(c[iV]), tempo: segundos(c[iT]), s1: s[0], s2: s[1], s3: s[2] });
      }
    }
    return out.length ? out : null;
  }

  // ---------- folha completa (Resultado da prova ou Tomada de tempo, como no arquivo) ----------
  // Cada linha: {pos, kart, nomeArquivo, voltas, total, diff, espaco, melhor, s1, s2, s3, vel}. Tempos ficam como texto
  // normalizado ("1:00.998", "12.201", "1 volta"), para a tela mostrar igual à folha do kartódromo.
  const semAc = (s) => semAcento(String(s || '')).toLowerCase().trim();
  const campoDe = (rotulo) => {
    const t = semAc(rotulo);
    if (/^pos$/.test(t)) return 'pos';
    if (/^(no\.?|#)$/.test(t)) return 'kart';
    if (/^codigo/.test(t)) return 'codigo';
    if (/^nome/.test(t)) return 'nome';
    if (/^classe/.test(t)) return 'classe';
    if (/^pitstops?/.test(t)) return 'pit';
    if (/^(voltas|tv)$/.test(t)) return 'voltas';
    if (/^mv$/.test(t)) return 'mvolta';
    if (/^s1/.test(t)) return 's1';
    if (/^s2/.test(t)) return 's2';
    if (/^s3/.test(t)) return 's3';
    if (/^sfspd|^vm$/.test(t)) return 'vel';
    if (/total|^tt$/.test(t)) return 'total';
    if (/^diff|^dl$/.test(t)) return 'diff';
    if (/^espa|^da$/.test(t)) return 'espaco';
    if (/melhor|^tmv$/.test(t)) return 'melhor';
    return null;
  };
  // "00:20:11.086" → "20:11.086"; "01:00.198" → "1:00.198"; "6 Laps" / "-1 volta" → "6 voltas"
  const tempoTxt = (s) => {
    s = String(s || '').trim();
    if (!s || s === '---') return '';
    const v = s.match(/^-?(\d+)\s*(lap|volta)s?$/i);
    if (v) return v[1] + (v[1] === '1' ? ' volta' : ' voltas');
    const sec = segundos(s);
    if (sec == null) return s;
    const ms = s.split('.')[1] || '';
    const casas = Math.max(3, ms.length);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), r = (sec % 60).toFixed(casas);
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + r.padStart(casas + 3, '0');
    return m ? m + ':' + r.padStart(casas + 3, '0') : r;
  };
  const velTxt = (s) => { s = String(s || '').trim(); return /^\d+([.,]\d+)?$/.test(s) ? s.replace('.', ',') : ''; };
  const montaLinha = (o) => ({
    pos: Number(o.pos), kart: o.kart ? String(o.kart).trim() : '', nomeArquivo: limpaNome(o.nome),
    voltas: /^\d+$/.test(String(o.voltas || '').trim()) ? Number(o.voltas) : null,
    total: tempoTxt(o.total), diff: tempoTxt(o.diff), espaco: tempoTxt(o.espaco), melhor: tempoTxt(o.melhor),
    s1: tempoTxt(o.s1), s2: tempoTxt(o.s2), s3: tempoTxt(o.s3), vel: velTxt(o.vel),
  });

  function folhaHtml(html) {
    const { ths, rows } = tabelaHtml(html);
    const campos = ths.map(campoDe);
    if (!campos.includes('pos') || !campos.includes('nome')) return null;
    const linhas = [];
    for (const r of rows) {
      if (r.length < campos.length - 2 || !/^\d+$/.test(r[campos.indexOf('pos')] || '')) continue;
      const o = {};
      campos.forEach((c, i) => { if (c && o[c] == null) o[c] = r[i]; });
      linhas.push(montaLinha(o));
    }
    const t = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    return linhas.length ? { titulo: t.replace(/^\s*Resultados de\s*/i, '').trim(), linhas } : null;
  }

  const ROTULO = /^(Pos|POS|No\.|#|C[óo]digo|Nome|Classe|Coment\S*|Pitstops|Voltas|Melhor|Tempo|Total|Diff|Espa\S*|S[123]|SFSpd|Vlt|Best|MV|TMV|TT|DL|DA|TUV|TV|VM|UF|Pontos)(\s.*)?$/;
  function folhaPdf(itens) {
    const ls = linhasDe(itens);
    const cab = ls.find((l) => l.itens.some((i) => /^pos$/i.test(i.s)) && l.itens.some((i) => /^nome$/i.test(i.s)));
    if (!cab) return null;
    // rótulos de 1 a 3 andares (ex.: "S1 / Melhor / Vlt") viram uma coluna pelo centro
    const rot = itens.filter((i) => i.p === cab.p && Math.abs(i.y - cab.y) <= 13 && ROTULO.test(i.s)).sort((a, b) => centro(a) - centro(b));
    const cols = [];
    for (const it of rot) {
      const c = cols.find((k) => Math.abs(k.c - centro(it)) <= 8);
      if (c) c.its.push(it); else cols.push({ c: centro(it), its: [it] });
    }
    cols.forEach((k) => { k.its.sort((a, b) => b.y - a.y); k.rot = k.its.map((i) => i.s).join(' '); k.campo = campoDe(k.rot); k.x0 = Math.min(...k.its.map((i) => i.x)); k.x1 = Math.max(...k.its.map((i) => i.x + i.w)); });
    cols.sort((a, b) => a.c - b.c);
    const cPos = cols.find((k) => k.campo === 'pos'), iNome = cols.findIndex((k) => k.campo === 'nome');
    if (!cPos || iNome < 0) return null;
    const fimNome = cols[iNome + 1] ? cols[iNome + 1].x0 : Infinity;
    const TIPOS = {
      int: ['pit', 'voltas', 'mvolta'],
      tempo: ['melhor', 'total', 'diff', 'espaco', 's1', 's2', 's3'],
      atraso: ['diff', 'espaco'],
      vel: ['vel'],
    };
    const tipo = (s) => (/^\d{1,3}$/.test(s) ? 'int' : /^-?\d+\s*(lap|volta)s?$/i.test(s) ? 'atraso' : /^\d+,\d{1,2}$/.test(s) ? 'vel' : segundos(s) != null || /^\d+:\d\d:\d\d\.\d+$/.test(s) ? 'tempo' : null);
    const linhas = [];
    for (const l of ls) {
      const pos = l.itens[0];
      if (!/^(\d{1,3}|NC|DNF|DQ)$/.test(pos.s) || pos.x > cPos.x1 + 4) continue;
      if (l.p === cab.p && l.y >= cab.y - 4) continue;
      const kart = l.itens.find((i) => i !== pos && /^\d{1,3}$/.test(i.s) && i.x < fimNome && i.x < (cols[iNome].x0 + 4));
      const ini = Math.max(pos.x + pos.w, ...l.itens.filter((i) => i.x < fimNome && (i === kart || /^\[\d+\]$/.test(i.s))).map((i) => i.x + i.w));
      const doNome = itens.filter((i) => i.p === l.p && Math.abs(i.y - l.y) <= 8 && i.x >= ini - 1 && i.x + 1 < fimNome - 2 && !/^\[\d+\]$/.test(i.s) && i !== kart)
        .filter((i) => !(Math.abs(i.y - l.y) <= 1.5 && /^\d{1,3}$/.test(i.s)))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const o = { pos: pos.s, kart: kart ? kart.s : '', nome: doNome.map((i) => i.s).join(' ') };
      const usados = new Set([pos, kart, ...doNome]);
      for (const it of l.itens) {
        if (usados.has(it) || it.x < fimNome - 2) continue;
        const tp = tipo(it.s);
        if (!tp) continue;
        const cands = cols.filter((k) => TIPOS[tp].includes(k.campo) && o[k.campo] == null);
        if (!cands.length) continue;
        const k = cands.reduce((a, b) => (Math.abs(b.c - centro(it)) < Math.abs(a.c - centro(it)) ? b : a));
        o[k.campo] = it.s;
      }
      const ln = montaLinha(o);
      // "NC" (não classificado) entra depois do último classificado
      if (!/^\d+$/.test(pos.s)) { ln.pos = linhas.reduce((m, x) => Math.max(m, x.pos), 0) + 1; ln.nc = true; }
      linhas.push(ln);
    }
    const tl = ls.find((l) => /Resultados de/i.test(l.itens.map((i) => i.s).join(' ')));
    const titulo = tl ? tl.itens.map((i) => i.s).join(' ').replace(/^.*Resultados de\s*-?\s*/i, '').replace(/\s*-\s*/, ' - ').trim() : '';
    return linhas.length ? { titulo, linhas: linhas.sort((a, b) => a.pos - b.pos) } : null;
  }

  // ---------- entrada pública ----------
  // arquivo: {nome, buf: ArrayBuffer}. Devolve {ok, linhas|voltas, motivo}.
  const tipoDe = (nome) => { const e = (String(nome).split('.').pop() || '').toLowerCase(); return ['html', 'htm', 'txt'].includes(e) ? 'html' : e === 'pdf' ? 'pdf' : 'outro'; };
  async function ler(arquivo, html, pdf) {
    const t = tipoDe(arquivo.nome);
    try {
      if (t === 'html') return html(decode(arquivo.buf));
      if (t === 'pdf') return pdf(await itensPdf(arquivo.buf));
      return null;
    } catch (e) { console.warn('[leitor]', e); return null; }
  }
  const lerResultado = async (arquivo) => {
    const linhas = await ler(arquivo, resultadoHtml, resultadoPdf);
    return linhas ? { ok: true, linhas: linhas.sort((a, b) => a.pos - b.pos) } : { ok: false, motivo: tipoDe(arquivo.nome) === 'outro' ? 'foto' : 'formato' };
  };
  const lerVoltas = async (arquivo) => {
    const voltas = await ler(arquivo, voltasHtml, voltasPdf);
    return voltas ? { ok: true, voltas } : { ok: false, motivo: tipoDe(arquivo.nome) === 'outro' ? 'foto' : 'formato' };
  };

  // ---------- nomes ----------
  // conhecidos: nomes já usados no painel; apelidos: {CHAVE: 'Nome'} aprendidos nas conferências.
  function casarNome(cru, conhecidos, apelidos = {}) {
    const k = chave(cru);
    if (!k) return { nome: '', tipo: 'novo' };
    if (apelidos[k]) return { nome: apelidos[k], tipo: 'apelido' };
    const igual = conhecidos.find((n) => chave(n) === k);
    if (igual) return { nome: igual, tipo: 'igual' };
    // "LUCAS PINHEIRO MORENO" → "Lucas Pinheiro": todas as palavras do nome conhecido aparecem no nome do arquivo
    const pc = palavras(cru);
    const cands = conhecidos.filter((n) => { const pn = palavras(n).filter((w) => !PEQ.has(w)); return pn.length >= 2 && pn[0] === pc[0] && pn.every((w) => pc.includes(w)); });
    if (cands.length === 1) return { nome: cands[0], tipo: 'sugestao' };
    return { nome: titulo(cru), tipo: 'novo' };
  }

  const lerFolha = async (arquivo) => {
    const f = await ler(arquivo, folhaHtml, folhaPdf);
    return f ? { ok: true, ...f } : { ok: false, motivo: tipoDe(arquivo.nome) === 'outro' ? 'foto' : 'formato' };
  };

  window.IDTLeitor = { lerResultado, lerVoltas, lerFolha, casarNome, chave, titulo, segundos, tipoDe };
})();

// Carrega as 13 provas já conferidas (CSVs da pasta Ferramentas) no banco local:
//   db/resultados/pNNN.json  { linhas: [{pos, piloto, voltas, melhor}], origem, lancadoEm }
//   db/voltas/pNNN.json      { pista, colunas, linhas: [[piloto, volta, tempo_s, s1, s2, s3, valida]] }
// e marca provas/p003 e p012 como piso lento.  Uso: node seed-db.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FERR = path.resolve(HERE, '..');
const DB = path.join(HERE, 'db');

const csv = (f) => {
  const [head, ...lines] = fs.readFileSync(path.join(FERR, f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};
const id = (n) => 'p' + String(n).padStart(3, '0');
const num = (x) => (x === '' || x == null ? null : Number(x));
const write = (col, doc, data) => {
  fs.mkdirSync(path.join(DB, col), { recursive: true });
  fs.writeFileSync(path.join(DB, col, doc + '.json'), JSON.stringify(data, null, 1));
};
const at = '2026-11-07T13:00:00Z';

const res = csv('resultados_inimigos_do_tracado.csv');
const byRace = new Map();
for (const r of res) {
  if (!byRace.has(r.corrida)) byRace.set(r.corrida, []);
  byRace.get(r.corrida).push({ pos: Number(r.pos), piloto: r.piloto, voltas: Number(r.voltas), melhor: Number(r.melhor_volta_s) });
}
for (const [n, linhas] of byRace) write('resultados', id(n), { linhas: linhas.sort((a, b) => a.pos - b.pos), origem: 'historico', lancadoEm: at, lancadoPor: null });

const COLS = ['piloto', 'volta', 'tempo_s', 's1', 's2', 's3', 'valida'];
const laps = new Map();
for (const r of csv('voltas_inimigos_do_tracado.csv')) {
  if (!laps.has(r.corrida)) laps.set(r.corrida, { pista: r.pista, linhas: [] });
  laps.get(r.corrida).linhas.push([r.piloto, Number(r.volta), Number(r.tempo_s), num(r.s1), num(r.s2), num(r.s3), Number(r.valida)]);
}
for (const [n, v] of laps) write('voltas', id(n), { pista: v.pista, colunas: COLS, linhas: v.linhas, origem: 'historico', lancadoEm: at, lancadoPor: null });

// Apelidos: como o nome aparece nas folhas do kartódromo → nome usado no painel (de compile.py)
const ALIAS = {
  'LUIS PAULO DA SILVA': 'LUIS PAULO', 'VITORIA MSTIS': 'VITÓRIA FERRARO', 'VITORIA FERRARO': 'VITÓRIA FERRARO', 'VITORIA MARIA': 'VITÓRIA FERRARO',
  'VITORIA M.': 'VITÓRIA FERRARO', 'VITORIA MARIA FERRARO': 'VITÓRIA FERRARO', 'VITOR MASCARENHASW': 'VITOR MASCARENHAS',
  'MELQUINEBERCK BRAYNER': 'MELQUI BRAYNER', 'MELQUI S.': 'MELQUI BRAYNER', 'BRUNO DANTAS SILVA': 'BRUNO DANTAS', 'DIOGO PINHEIRO MORENO': 'DIOGO PINHEIRO',
  'LUCAS PINHEIRO MORENO': 'LUCAS PINHEIRO', 'KAUA CASCAPERA CHAVES': 'KAUÃ CASCAPERA', 'KAUA CASCAPERA': 'KAUÃ CASCAPERA',
  'RODRIGO TADEU CHAVES': 'RODRIGO CHAVES', 'SANDERSON RABELO DE SOUZA': 'SANDERSON RABELO', 'MARCO ANTONIO SANTOS SILVA': 'MARCO ANTONIO',
  'KAIQUE PEIXOTO DA COSTA': 'KAIQUE PEIXOTO', 'GUILHERME SANTOS GAMA': 'GUILHERME GAMA', 'MANOEL RONES MARQUES MELO': 'MANOEL RONES', 'MANOEL RO': 'MANOEL RONES',
  'ESPEDITO M.': 'ESPEDITO MATHEUS', 'MATHEUS SILVA': 'ESPEDITO MATHEUS', 'ANDERSON M.': 'ANDERSON MACHADO', 'ANDREY EDUADO': 'ANDREY EDUARDO',
  'ANDREY EDUADO CAMPOS': 'ANDREY EDUARDO', 'FRANCIEUDO S.': 'FRANCIEUDO DANTAS', 'EDUARDO G.': 'EDUARDO GONSALEZ', 'RAFAEL M.': 'RAFAEL MACHADO',
  'CLEBER P.': 'CLEBER PESSOA', 'CLEBE PESSOA': 'CLEBER PESSOA', 'OSIRIS': 'OSIRIS ANTONIO', 'LIGIA UZUN BENETELLO': 'LIGIA BENETELLO',
  'VINCIUS MENDONCA': 'VINÍCIUS MENDONÇA',
};
const chave = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
const porChave = new Map(res.map((r) => [chave(r.piloto), r.piloto]));
const apelidos = {};
for (const [cru, canon] of Object.entries(ALIAS)) { const n = porChave.get(chave(canon)); if (n) apelidos[chave(cru)] = n; else console.warn('apelido sem piloto:', canon); }
write('config', 'apelidos', { mapa: apelidos });

for (const n of [3, 12]) {
  const f = path.join(DB, 'provas', id(n) + '.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.pisoLento = true;
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
}
console.log(`resultados: ${byRace.size} provas, ${res.length} linhas · voltas: ${laps.size} provas, ${[...laps.values()].reduce((s, v) => s + v.linhas.length, 0)} voltas`);
for (const [n, v] of laps) console.log(' ', id(n), (JSON.stringify(v).length / 1024).toFixed(1) + ' KB');

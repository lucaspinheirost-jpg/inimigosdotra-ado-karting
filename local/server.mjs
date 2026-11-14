// Servidor local do sistema Inimigos do Traçado (sem dependências: só Node).
//   node server.mjs            → http://localhost:5173
// Monta a página única de ../app a cada pedido (salve e recarregue) e imita o runtime do claude.ai
// com claude-shim.js: claude.use('user'|'db'|'assets') gravando em ./db/<coleção>/*.json e ./assets/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FERR = path.resolve(HERE, '..');
const KART = path.resolve(FERR, '..');
const PORT = Number(process.env.PORT || 5173);
const DB = path.join(HERE, 'db');
const ASSETS = path.join(HERE, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body);
};
const sendFile = (res, file, type) => {
  if (!fs.existsSync(file)) return send(res, 404, 'não encontrado: ' + path.basename(file));
  send(res, 200, fs.readFileSync(file), type || TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
};
const readBody = (req) => new Promise((ok, bad) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', bad); });

// ---------- banco local (uma pasta por coleção, um JSON por documento) ----------
const safe = (s) => /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(s) && s !== '.' && s !== '..';
const colDir = (c) => path.join(DB, ...c.split('/'));
const listDocs = (c) => {
  const dir = colDir(c);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: f.slice(0, -5), data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
};
const merge = (a, b) => {
  const out = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && v.__delete__ === true) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out;
};

// ---------- arquivos de prova já enviados no claude.ai: acha o original na pasta da prova ----------
function seededAsset(id) {
  for (const { data } of listDocs('provas')) {
    for (const a of Object.values(data.arquivos || {})) {
      if (!a || a.asset !== id) continue;
      for (const base of [path.join(KART, 'Corridas'), KART]) {
        if (!fs.existsSync(base)) continue;
        for (const dir of fs.readdirSync(base)) {
          const f = path.join(base, dir, a.nome);
          if (/^\d\d - /.test(dir) && fs.existsSync(f)) return f;
        }
      }
    }
  }
  return null;
}

// ---------- página única (montada de Ferramentas/app a cada pedido: é só salvar e recarregar) ----------
const BUILD = pathToFileURL(path.join(FERR, 'app', 'build.mjs')).href;
// node server.mjs --supabase → a mesma página da versão publicada (banco Supabase), para testar e importar dados
const MODO = process.argv.includes('--supabase') ? 'supabase' : 'local';
const appPage = async () => (await import(BUILD + '?t=' + Date.now())).montar({ modo: MODO });

// ---------- roteador ----------
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/' || p === '/index.html') return send(res, 200, await appPage(), TYPES['.html']);
    if (p.startsWith('/app/') && /^[\w.-]+$/.test(p.slice(5))) return sendFile(res, path.join(FERR, 'app', p.slice(5)));
    if (p === '/claude-shim.js') return sendFile(res, path.join(HERE, p.slice(1)));
    if (p === '/icone.png') return sendFile(res, path.join(FERR, 'app', 'icone.png'));
    // tudo do banco local de uma vez (usado para carregar o Supabase)
    if (p === '/api/export') {
      const cols = fs.existsSync(DB) ? fs.readdirSync(DB).filter((c) => fs.statSync(path.join(DB, c)).isDirectory()) : [];
      return send(res, 200, JSON.stringify(cols.flatMap((c) => listDocs(c).map((d) => ({ colecao: c, ...d })))), TYPES['.json']);
    }

    // GET /api/db/<coleção>            → lista   |  GET/PUT/PATCH /api/db/<coleção>/<doc>
    if (p.startsWith('/api/db/')) {
      const parts = p.slice(8).split('/').filter(Boolean);
      if (!parts.length || !parts.every(safe)) return send(res, 400, 'caminho inválido');
      if (parts.length % 2 === 1) {
        if (req.method !== 'GET') return send(res, 405, '');
        return send(res, 200, JSON.stringify(listDocs(parts.join('/'))), TYPES['.json']);
      }
      const col = parts.slice(0, -1).join('/'), id = parts[parts.length - 1];
      const file = path.join(colDir(col), id + '.json');
      const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      if (req.method === 'GET') return send(res, 200, JSON.stringify({ exists: !!cur, data: cur }), TYPES['.json']);
      if (req.method === 'DELETE') { if (cur) fs.unlinkSync(file); return send(res, 200, '{}', TYPES['.json']); }
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (req.method === 'PATCH' && !cur) return send(res, 404, 'documento não existe');
      const next = req.method === 'PUT' ? body : merge(cur, body);
      fs.mkdirSync(colDir(col), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(next, null, 2));
      return send(res, 200, '{}', TYPES['.json']);
    }

    // POST /api/assets (corpo = arquivo)  |  DELETE /api/assets/<id>
    if (p === '/api/assets' && req.method === 'POST') {
      const buf = await readBody(req);
      const id = crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(path.join(ASSETS, id), buf);
      fs.writeFileSync(path.join(ASSETS, id + '.type'), req.headers['content-type'] || 'application/octet-stream');
      return send(res, 200, JSON.stringify({ id, url: '/_blob/' + id, sizeBytes: buf.length }), TYPES['.json']);
    }
    if (p.startsWith('/api/assets/') && req.method === 'DELETE') {
      const id = p.slice(12);
      if (/^[0-9a-f]{32}$/.test(id)) for (const f of [id, id + '.type']) fs.rmSync(path.join(ASSETS, f), { force: true });
      return send(res, 200, '{}', TYPES['.json']);
    }
    if (p.startsWith('/_blob/')) {
      const id = p.slice(7);
      if (!/^[0-9a-f]{32}$/.test(id)) return send(res, 400, 'id inválido');
      const f = path.join(ASSETS, id);
      if (fs.existsSync(f)) return sendFile(res, f, fs.readFileSync(f + '.type', 'utf8'));
      const orig = seededAsset(id);
      return orig ? sendFile(res, orig) : send(res, 404, 'Arquivo não está disponível localmente.');
    }
    send(res, 404, 'não encontrado');
  } catch (e) {
    console.error(e); send(res, 500, String(e && e.stack || e));
  }
}).listen(PORT, () => console.log(`Inimigos do Traçado local em http://localhost:${PORT} (banco: ${MODO})`));

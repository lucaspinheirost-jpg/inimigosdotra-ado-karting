// Monta o sistema único (painel + administração) em um só HTML.
//   import { montar } from './build.mjs'   → usado pelo servidor local (local=true injeta as imitações do claude.ai)
//   node build.mjs                          → grava dist/inimigos_do_tracado.html, pronto para publicar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ler = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n');
const inline = (js) => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';

const BASE = `<style>
:root {
  --cds-chart-grid: #e0e3e8; --cds-chart-muted: #6b7280; --cds-dur-slow: 240ms; --cds-ease-out: cubic-bezier(.2, .8, .2, 1);
  --font-anthropic-sans: Inter; --idt-page-bg: #f5f6f8; color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --cds-chart-grid: #2a2f38; --cds-chart-muted: #9aa1ac; --idt-page-bg: #0d0f13; color-scheme: dark; } }
:root[data-theme="dark"] { --cds-chart-grid: #2a2f38; --cds-chart-muted: #9aa1ac; --idt-page-bg: #0d0f13; color-scheme: dark; }
* { box-sizing: border-box; }
[hidden]:not([hidden=until-found i]) { display: none !important; }
body { margin: 0; background: var(--idt-page-bg); overflow-x: hidden; }
@media (max-width: 720px) { #dash-root { padding-top: 0; } }
#dash-root { max-width: 1280px; margin: 0 auto; padding: 16px max(16px, env(safe-area-inset-right, 0px)) 48px max(16px, env(safe-area-inset-left, 0px)); }
</style>`;

// Supabase da versão publicada: variáveis de ambiente (Vercel) ou app/supabase.config.json.
// A chave "anon" é pública por natureza: quem protege os dados são as regras (RLS) do banco.
function configSupabase() {
  let url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_ANON_KEY;
  const f = path.join(HERE, 'supabase.config.json');
  if ((!url || !chave) && fs.existsSync(f)) ({ url, anonKey: chave } = JSON.parse(fs.readFileSync(f, 'utf8')));
  if (!url || !chave) throw new Error('Falta a configuração do Supabase (SUPABASE_URL e SUPABASE_ANON_KEY ou app/supabase.config.json).');
  return { supabaseUrl: url, supabaseAnonKey: chave };
}

// modo 'local': banco e arquivos do servidor local (local/db). modo 'supabase': a versão publicada.
export function montar({ local = false, modo = local ? 'local' : 'supabase' } = {}) {
  const painel = ler('painel.html')
    .replace('<meta name="dash-one-writer">\n', '')
    .replace('<link rel="stylesheet" href="brand.css">\n', '<style>\n' + ler('brand.css') + '\n</style>\n')
    .replace('  <!-- @@CORRIDAS@@ -->\n', ler('corridas.html'))
    .replace('  <!-- @@ADMIN@@ -->\n', ler('admin.html'));
  for (const m of ['@@ADMIN@@', '@@CORRIDAS@@']) if (painel.includes(m)) throw new Error('marcador ' + m + ' não encontrado em painel.html');
  const backend = modo === 'local' ? ['<script src="/claude-shim.js"></script>'] : [
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>',
    '<script>window.IDT_CONFIG = ' + JSON.stringify(configSupabase()) + ';</script>',
    inline(ler('supabase-shim.js')),
  ];
  const desc = 'Resultados, volta a volta e análise de cada piloto do campeonato de kart Inimigos do Traçado.';
  return [
    // data-theme="light": o painel fica sempre claro, mesmo com o celular/Windows no modo escuro
    '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8">',
    '<meta name="color-scheme" content="light">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="theme-color" content="#ffffff">',
    '<title>Inimigos do Traçado · Painel da temporada</title>',
    `<meta name="description" content="${desc}">`,
    '<meta property="og:title" content="Inimigos do Traçado · Painel da temporada">',
    `<meta property="og:description" content="${desc}">`,
    '<meta property="og:type" content="website">',
    '<link rel="icon" type="image/png" href="icone.png"><link rel="apple-touch-icon" href="icone.png">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600;700&display=swap">',
    BASE,
    ...backend,
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
    inline(ler('runtime.js')),
    inline(ler('leitor.js')),
    '</head><body><div id="dash-root">',
    painel,
    '</div>',
    inline(ler('admin.js')),
    inline(ler('corridas.js')),
    inline(ler('ajuda.js')),
    inline(ler('conta.js')),
    '<script>IDT.iniciar();</script>',
    '</body></html>',
  ].join('\n');
}

// node app/build.mjs → app/dist/index.html (+ ícone), pronto para a Vercel
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.join(HERE, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const html = montar({ modo: 'supabase' });
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  fs.copyFileSync(path.join(HERE, 'icone.png'), path.join(dist, 'icone.png'));
  console.log('ok', path.join(dist, 'index.html'), (html.length / 1024).toFixed(0) + ' KB');
}

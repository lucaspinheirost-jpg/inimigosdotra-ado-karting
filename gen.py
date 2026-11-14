"""Gera o HTML de cada peça do Instagram (1080 px) para renderizar em PNG."""
import csv, os, sys, json, pathlib
root, outdir, csvp = sys.argv[1:4]
LOGO = pathlib.Path(root, 'Logo', 'Logo Kart.png').resolve().as_uri()
VIDEO = pathlib.Path(root, '10 - 11-07-2026 - Granja Viana', '01 - Vídeo', '20230101_001810A.mp4').resolve().as_uri()
os.makedirs(outdir, exist_ok=True)

R = list(csv.DictReader(open(csvp, encoding='utf-8')))
first = {}
for r in R: first[r['piloto']] = min(first.get(r['piloto'], 99), int(r['corrida']))
estreantes13 = [r for r in sorted(R, key=lambda r: int(r['pos'])) if r['corrida'] == '13' and first[r['piloto']] == 13]

HEAD = '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&family=Inter:wght@500;600;700&display=swap">
<style>
body{margin:0;background:#000}
.c{position:relative;overflow:hidden;background:#000;color:#fff;font-family:Inter,sans-serif;box-sizing:border-box}
.chk{background-image:linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%),linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%);background-size:60px 60px;background-position:0 0,30px 30px}
.imp{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-style:italic;font-weight:800;text-transform:uppercase}
.nm{font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:700;text-transform:uppercase}
.eb{font:600 30px/1 Inter,sans-serif;letter-spacing:.12em;color:#c9cdd3}
.mut{color:#c9cdd3}
.tab{font-variant-numeric:tabular-nums}
.foot{position:absolute;left:72px;right:72px;bottom:60px;display:flex;justify-content:space-between;align-items:flex-end;font:600 26px/1.3 Inter,sans-serif;color:#9aa1ac;letter-spacing:.04em}
.logo{object-fit:contain}
.pill{display:inline-block;border-radius:999px;font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:800;text-align:center}
.g{background:#f2b705;color:#3a2a00}.s{background:#c9cdd3;color:#14171c}.b{background:#c47a3c;color:#24120a}.n{background:#1d2128;color:#fff}
.row{display:grid;align-items:center;border-radius:14px;background:#111318}
.blue{background:#0062e6}
</style></head><body>'''
TAIL = '</body></html>'
pieces = []

def piece(folder, name, w, h, body):
    pieces.append({'folder': folder, 'name': name, 'w': w, 'h': h, 'html': HEAD + f'<div class="c" style="width:{w}px;height:{h}px">' + body.replace('@LOGO@', LOGO) + '</div>' + TAIL})

def foot(right='', logo=True):
    lg = '<img class="logo" src="@LOGO@" style="width:150px;height:125px">' if logo else ''
    return f'<div class="foot"><span>@inimigosdotracado{("<br>" + right) if right else ""}</span>{lg}</div>'

def track(y1=980, y2=1010, blue='#0062e6', op=1):
    return f'<svg viewBox="0 0 1080 1350" width="1080" height="1350" style="position:absolute;left:0;top:0"><path d="M-20 {y1} C 300 {y1-10}, 700 {y1-30}, 1100 {y1-250}" fill="none" stroke="#f2b705" stroke-width="5" stroke-dasharray="18 14"/><path d="M-20 {y2} C 360 {y2+10}, 760 {y2-20}, 1100 {y2-180}" fill="none" stroke="{blue}" stroke-opacity="{op}" stroke-width="22" stroke-linecap="round"/></svg>'

def podium_rows(rows, top):
    out = f'<div style="position:absolute;left:72px;right:72px;top:{top}px;display:flex;flex-direction:column;gap:22px">'
    for pos, nome, tempo, cls in rows:
        ring = 'box-shadow:inset 0 0 0 3px #f2b705;background:#16191f;' if cls == 'g' else ''
        out += f'<div class="row" style="grid-template-columns:120px 1fr auto;gap:28px;padding:22px 28px;{ring}"><span class="pill {cls}" style="font-size:64px;line-height:1;padding:6px 0">{pos}</span><span class="nm" style="font-size:52px;line-height:1.1">{nome}</span><span class="tab mut" style="font:600 36px/1 Inter,sans-serif">{tempo}</span></div>'
    return out + '</div>'

L, E, M = '01 - Lancamento (9 posts)', '02 - Ideias extras', '03 - Modelos para preencher'

# ---------------- LANÇAMENTO ----------------
piece(L, '01-apresentacao', 1080, 1350, '''
<div class="chk" style="position:absolute;left:-80px;right:-80px;top:96px;height:120px;transform:rotate(-12deg);opacity:.9"></div>
<img class="logo" src="@LOGO@" style="position:absolute;left:190px;top:250px;width:700px;height:583px">
<div class="imp" style="position:absolute;left:0;right:0;top:870px;text-align:center;font-size:128px;line-height:.9">Bem-vindo ao grid</div>
<div style="position:absolute;left:72px;right:72px;top:1080px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center">
''' + ''.join(f'<div style="border-top:4px solid #0062e6;padding-top:22px;display:flex;flex-direction:column;gap:6px"><span class="imp tab" style="font-size:96px;line-height:1">{n}</span><span class="eb" style="font-size:28px">{t}</span></div>' for n, t in [('13', 'PROVAS'), ('173', 'PILOTOS'), ('3', 'KARTÓDROMOS')]) + '''
</div>
<div class="foot"><span>@inimigosdotracado</span><span>KART RENTAL · SÃO PAULO · DESDE DEZ/2025</span></div>''')

camp = [('Lucas Pinheiro', 228), ('Lucas Santacroce', 135), ('Guilherme Gama', 91), ('Willian Cardoso', 63), ('Eduardo Gonsalez', 43), ('Kleber Neves', 41), ('Rodrigo Chaves', 41), ('Kauã Cascapera', 40), ('Diogo Pinheiro', 40), ('Melqui Brayner', 39)]
rows = ''
for i, (n, p) in enumerate(camp):
    cls = ['g', 's', 'b'][i] if i < 3 else 'n'
    st = 'box-shadow:inset 0 0 0 3px #f2b705;background:#16191f;' if i == 0 else ('background:#0b0c0f;' if i % 2 else '')
    rows += f'<div class="row" style="grid-template-columns:76px 1fr 150px;gap:24px;padding:10px 20px;{st}"><span class="pill {cls}" style="font-size:46px;line-height:1;padding:4px 0">P{i+1}</span><span class="nm" style="font-size:46px;line-height:1.1">{n}</span><span class="imp tab" style="font-size:56px;line-height:1;text-align:right">{p}</span></div>'
piece(L, '02-campeonato', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;gap:20px;box-sizing:border-box">
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="display:flex;flex-direction:column;gap:14px"><span class="eb">TEMPORADA 2025/26 · 13 PROVAS</span><span class="imp" style="font-size:130px;line-height:.9">Campeonato</span></div><img class="logo" src="@LOGO@" style="width:170px;height:142px"></div>
<div style="height:4px;background:#0062e6;border-radius:2px"></div>
{rows}
<div style="margin-top:auto;font:500 26px/1.3 Inter,sans-serif;color:#9aa1ac">Pontos no sistema da F1: 25 · 18 · 15 · 12 · 10 · 8 · 6 · 4 · 2 · 1 do 1º ao 10º lugar</div>
</div>''')

piece(L, '03-sequencia', 1080, 1350, track(980, 1010, '#000', .35) + '''
<div class="eb" style="position:absolute;left:72px;top:96px;color:#fff;font-size:32px">PROVAS 8 A 13 · MAIO A OUTUBRO DE 2026</div>
<div class="imp" style="position:absolute;left:40px;top:120px;font-size:620px;line-height:.9">6</div>
<div class="imp" style="position:absolute;left:400px;top:300px;font-size:132px;line-height:.9">Vitórias<br>seguidas</div>
<div style="position:absolute;left:400px;top:560px;display:flex;gap:12px">''' + ''.join(f'<span class="pill g" style="font-size:40px;line-height:1;padding:8px 18px">{n}</span>' for n in ['8', '9', '10', '11', '12', '13']) + '''</div>
<div style="position:absolute;left:72px;top:760px;display:flex;flex-direction:column;gap:14px"><span class="nm" style="font-size:72px;line-height:1">Lucas Pinheiro</span><span style="font:500 34px/1.3 Inter,sans-serif">Líder do campeonato com 228 pontos</span></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:280px;background:#000;display:flex;align-items:center;gap:40px;padding:0 72px;box-sizing:border-box"><img class="logo" src="@LOGO@" style="width:210px;height:175px;flex:none"><p style="margin:0;font:500 34px/1.35 Inter,sans-serif;color:#c9cdd3"><b style="color:#fff">Quem vai quebrar essa sequência?</b><br>A próxima prova vem aí.</p></div>''')
pieces[-1]['html'] = pieces[-1]['html'].replace('<div class="c" style="width:1080px;height:1350px">', '<div class="c" style="width:1080px;height:1350px;background:#0062e6">')

piece(L, '04-reels-capa-onboard', 1080, 1920, f'''
<video id="v" src="{VIDEO}" muted preload="auto" style="position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover"></video>
<script>const v=document.getElementById('v');v.addEventListener('loadedmetadata',()=>{{v.currentTime=200;}});</script>
<div style="position:absolute;left:0;right:0;bottom:0;height:1100px;background:linear-gradient(to top,#000 48%,rgba(0,0,0,0))"></div>
<div style="position:absolute;left:0;right:0;top:0;height:420px;background:linear-gradient(to bottom,rgba(0,0,0,.75),rgba(0,0,0,0))"></div>
<img class="logo" src="@LOGO@" style="position:absolute;left:72px;top:270px;width:220px;height:183px">
<div class="chk" style="position:absolute;left:-80px;right:-80px;top:1030px;height:80px;transform:rotate(-12deg);opacity:.9"></div>
<div style="position:absolute;left:72px;right:72px;top:1280px;display:flex;flex-direction:column;gap:16px">
<span class="eb" style="font-size:32px">PROVA 10 · GRANJA VIANA · CIRCUITO 101</span>
<span class="imp" style="font-size:200px;line-height:.88">Onboard</span>
<span style="border-top:4px solid #0062e6;padding-top:20px;font:500 36px/1.3 Inter,sans-serif;color:#c9cdd3">Uma volta inteira, do ponto de vista de quem pilota</span>
</div>''')

piece(L, '05-recorde', 1080, 1350, track(900, 935) + '''
<div class="eb" style="position:absolute;left:72px;top:96px;font-size:32px">GRANJA VIANA · CIRCUITO 101</div>
<div class="imp" style="position:absolute;left:66px;top:150px;font-size:120px;line-height:.9">Melhor volta<br>do grupo</div>
<div class="imp tab" style="position:absolute;left:50px;top:440px;font-size:240px;line-height:.9">1:00,784</div>
<div style="position:absolute;left:72px;top:1000px;display:flex;flex-direction:column;gap:14px"><span class="nm" style="font-size:64px;line-height:1">Lucas Pinheiro</span><span class="mut" style="font:500 34px/1.3 Inter,sans-serif">Prova 10 · 11/07/2026 · volta 17</span></div>
''' + foot('QUEM TIRA ESSE TEMPO?'))

pres = [('Lucas Pinheiro', 13), ('Guilherme Gama', 12), ('Vitória Ferraro', 9), ('Lucas Santacroce', 9), ('Eduardo Gonsalez', 8)]
bars = ''.join(f'<div style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="nm" style="font-size:46px;line-height:1">{n}</span><span class="imp tab" style="font-size:52px;line-height:1">{k} provas</span></div><div style="height:22px;border-radius:11px;background:#1d2128;overflow:hidden"><div style="height:100%;border-radius:11px;width:{k/13*100:.1f}%;background:{"#0062e6" if i == 0 else "#c9cdd3"}"></div></div></div>' for i, (n, k) in enumerate(pres))
piece(L, '06-presenca', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:26px;box-sizing:border-box">
<span class="eb">PRESENÇA NAS 13 PROVAS</span>
<span class="imp tab" style="font-size:250px;line-height:.85">13/13</span>
<span class="imp" style="font-size:92px;line-height:.9">Não falta uma</span>
<div style="height:4px;background:#0062e6;border-radius:2px"></div>
<div style="display:flex;flex-direction:column;gap:24px">{bars}</div>
</div>''' + foot('', True).replace('<span>@inimigosdotracado</span>', '<span>@inimigosdotracado</span>'))

sect = ''.join(f'<div style="display:flex;flex-direction:column;gap:10px;background:#111318;border-radius:14px;padding:24px;border-top:6px solid #0062e6"><span class="imp" style="font-size:56px;line-height:1;color:#4d8dff">{n}</span><span class="imp tab" style="font-size:84px;line-height:1">{t}</span><span style="font:500 26px/1.3 Inter,sans-serif;color:#9aa1ac">{d}</span></div>' for n, t, d in [('S1', '14,119', 'melhor 1º trecho'), ('S2', '24,492', 'melhor 2º trecho'), ('S3', '21,841', 'melhor 3º trecho')])
piece(L, '07-raiox-1', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:28px;box-sizing:border-box">
<span class="eb">RAIO-X DO PILOTO · CIRCUITO 101</span>
<span class="imp" style="font-size:150px;line-height:.88">Volta ideal</span>
<span class="mut" style="font:500 36px/1.35 Inter,sans-serif">A soma dos seus melhores trechos, mesmo que tenham saído em voltas diferentes.</span>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">{sect}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:4px solid #f2b705;padding-top:22px"><span style="font:600 34px/1.2 Inter,sans-serif">Volta ideal</span><span class="imp tab" style="font-size:150px;line-height:.9;color:#f2b705">1:00,452</span></div>
<div style="display:flex;justify-content:space-between;font:500 30px/1.3 Inter,sans-serif"><span class="mut">Melhor volta real: 1:00,784</span><span style="font-weight:600">0,332 s para achar</span></div>
</div>''' + foot('EXEMPLO: LUCAS PINHEIRO · ARRASTA →'))

steps = [('1', 'Abra o painel', 'link na bio'), ('2', 'Aba Raio-X do piloto', 'no topo da página'), ('3', 'Digite seu nome', 'sem acento funciona'), ('4', 'Escolha a pista', 'e compare com o recorde')]
st = ''.join(f'<div class="row" style="grid-template-columns:110px 1fr;gap:28px;padding:26px 30px"><span class="pill" style="background:#0062e6;color:#fff;font-size:64px;line-height:1;padding:8px 0">{a}</span><span style="display:flex;flex-direction:column;gap:6px"><span class="nm" style="font-size:58px;line-height:1">{b}</span><span class="mut" style="font:500 30px/1.2 Inter,sans-serif">{c}</span></span></div>' for a, b, c in steps)
piece(L, '07-raiox-2', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:26px;box-sizing:border-box">
<span class="eb">RAIO-X DO PILOTO</span>
<span class="imp" style="font-size:130px;line-height:.88">Veja o seu</span>
<div style="display:flex;flex-direction:column;gap:20px;margin-top:10px">{st}</div>
<span class="mut" style="font:500 32px/1.4 Inter,sans-serif;margin-top:8px">Você descobre seu ponto forte, onde perde tempo e quanto falta para a sua volta ideal.</span>
</div>''' + foot())

piece(L, '08-resultado-prova-13', 1080, 1350, '''
<div class="chk" style="position:absolute;right:-120px;top:-60px;width:560px;height:220px;transform:rotate(-12deg);opacity:.9;background-size:56px 56px;background-position:0 0,28px 28px"></div>
<img class="logo" src="@LOGO@" style="position:absolute;left:72px;top:64px;width:200px;height:167px">
<div class="eb" style="position:absolute;left:72px;top:300px">PROVA 13 · 04/10/2026 · GRANJA VIANA</div>
<div class="imp" style="position:absolute;left:66px;top:350px;font-size:170px;line-height:.9">P1 de novo</div>
<svg viewBox="0 0 640 60" width="640" height="60" style="position:absolute;left:72px;top:530px"><path d="M4 50 C 200 50, 380 46, 636 8" fill="none" stroke="#f2b705" stroke-width="4" stroke-dasharray="14 12"/><path d="M4 56 C 220 58, 420 54, 600 24" fill="none" stroke="#0062e6" stroke-width="12" stroke-linecap="round"/></svg>
''' + podium_rows([('P1', 'Lucas Pinheiro', '18:47,262', 'g'), ('P2', 'Kleber Neves', '+20,760', 's'), ('P3', 'Eduardo Gonsalez', '+22,956', 'b')], 640) + '''
<div style="position:absolute;left:72px;right:72px;bottom:150px;display:flex;justify-content:space-between;align-items:baseline;border-top:3px solid #0062e6;padding-top:26px;font:500 32px/1.3 Inter,sans-serif;color:#c9cdd3"><span>Volta mais rápida<br>Lucas Santacroce</span><b class="imp tab" style="font-size:72px;line-height:1;color:#fff">1:00,787</b></div>
<div class="foot" style="bottom:64px"><span>@inimigosdotracado</span><span>28 PILOTOS · 17 VOLTAS</span></div>''')

nums = [('4.639', 'voltas completadas'), ('173', 'pilotos diferentes'), ('55', 'voltaram para mais'), ('25,4', 'pilotos por prova'), ('32', 'no maior grid'), ('3', 'kartódromos')]
cells = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px;border-top:4px solid {"#f2b705" if i == 0 else "#0062e6"};padding-top:20px"><span class="imp tab" style="font-size:{140 if i == 0 else 110}px;line-height:.9">{n}</span><span class="mut" style="font:500 30px/1.2 Inter,sans-serif">{t}</span></div>' for i, (n, t) in enumerate(nums))
piece(L, '09-numeros-da-temporada', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:30px;box-sizing:border-box">
<span class="eb">DEZ/2025 A OUT/2026 · 13 PROVAS</span>
<span class="imp" style="font-size:130px;line-height:.88">A temporada<br>em números</span>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:36px 40px;margin-top:10px">{cells}</div>
</div>''' + foot())

# ---------------- IDEIAS EXTRAS ----------------
nomes = ''.join(f'<span class="nm" style="font-size:44px;line-height:1.15">{r["piloto"]}</span>' for r in estreantes13)
piece(E, 'E01-estreantes-prova-13', 1080, 1350, f'''
<div class="chk" style="position:absolute;left:-80px;right:-80px;top:70px;height:90px;transform:rotate(-12deg);opacity:.9"></div>
<div style="position:absolute;inset:0;padding:290px 72px 64px;display:flex;flex-direction:column;gap:22px;box-sizing:border-box">
<span class="eb">PROVA 13 · 04/10/2026 · GRANJA VIANA</span>
<span class="imp" style="font-size:150px;line-height:.88">Primeira vez<br>no grid</span>
<span class="mut" style="font:500 34px/1.35 Inter,sans-serif">{len(estreantes13)} pilotos estrearam com a gente. Bem-vindos, voltem sempre.</span>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 40px;border-top:4px solid #0062e6;padding-top:26px">{nomes}</div>
</div>''' + foot())

est = [('Gabriel Gianussi', 'Prova 2 · 10/01/2026 · Granja Viana'), ('Kauã Cascapera', 'Prova 4 · 25/02/2026 · Interlagos'), ('Ciro Blanco', 'Prova 6 · 22/03/2026 · Granja Viana')]
er = ''.join(f'<div class="row" style="grid-template-columns:120px 1fr;gap:28px;padding:24px 28px;box-shadow:inset 0 0 0 3px #f2b705;background:#16191f"><span class="pill g" style="font-size:64px;line-height:1;padding:6px 0">P1</span><span style="display:flex;flex-direction:column;gap:6px"><span class="nm" style="font-size:56px;line-height:1">{n}</span><span class="mut" style="font:500 30px/1.2 Inter,sans-serif">{d}</span></span></div>' for n, d in est)
piece(E, 'E02-estreia-com-vitoria', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:26px;box-sizing:border-box">
<span class="eb">CHEGOU E JÁ VENCEU</span>
<span class="imp" style="font-size:150px;line-height:.88">Estreia com<br>vitória</span>
<span class="mut" style="font:500 34px/1.35 Inter,sans-serif">Três pilotos venceram logo na primeira prova com a gente.</span>
<div style="display:flex;flex-direction:column;gap:20px;margin-top:6px">{er}</div>
</div>''' + foot('A PRÓXIMA ESTREIA PODE SER A SUA'))

def escada(titulo, eb, nome, pontos, sub, legenda):
    W, H, x0, x1, y0, y1 = 936, 420, 70, 866, 40, 380
    n = len(pontos); mx = max(p for _, p in pontos)
    xs = [x0 + i * (x1 - x0) / (n - 1) for i in range(n)]
    ys = [y0 + (p - 1) / (mx - 1) * (y1 - y0) for _, p in pontos]
    path = ' '.join(('M' if i == 0 else 'L') + f'{x:.0f} {y:.0f}' for i, (x, y) in enumerate(zip(xs, ys)))
    dots = ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{16 if p <= 3 else 11}" fill="{"#f2b705" if p == 1 else ("#c9cdd3" if p == 2 else ("#c47a3c" if p == 3 else "#0062e6"))}"/><text x="{x:.0f}" y="{y - 30:.0f}" fill="#fff" font-family="Barlow Condensed" font-style="italic" font-weight="800" font-size="40" text-anchor="middle">P{p}</text><text x="{x:.0f}" y="{H + 10}" fill="#9aa1ac" font-family="Inter" font-weight="600" font-size="24" text-anchor="middle">{lab}</text>' for (lab, p), x, y in zip(pontos, xs, ys))
    svg = f'<svg viewBox="0 -40 {W} {H + 60}" width="{W}" height="{H + 60}"><path d="{path}" fill="none" stroke="#0062e6" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>{dots}</svg>'
    return f'''<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:24px;box-sizing:border-box">
<span class="eb">{eb}</span>
<span class="imp" style="font-size:150px;line-height:.88">{titulo}</span>
<span class="nm" style="font-size:60px;line-height:1">{nome}</span>
<span class="mut" style="font:500 32px/1.35 Inter,sans-serif">{sub}</span>
<div style="margin-top:10px">{svg}</div>
</div>''' + foot(legenda)

piece(E, 'E03-evolucao-kleber-neves', 1080, 1350, escada('De P10<br>a P2', 'EVOLUÇÃO', 'Kleber Neves', [('PROVA 9', 10), ('PROVA 11', 4), ('PROVA 12', 5), ('PROVA 13', 2)], 'Quatro provas com a gente e 8 posições ganhas desde a estreia.', ''))
piece(E, 'E04-escalada-guilherme-gama', 1080, 1350, escada('De P21<br>a P2', 'A ESCALADA', 'Guilherme Gama', [('P1', 21), ('P2', 11), ('P3', 19), ('P4', 11), ('P5', 5), ('P6', 14), ('P8', 4), ('P9', 6), ('P10', 3), ('P11', 2), ('P12', 2), ('P13', 5)], '12 provas, 3 pódios e 3º no campeonato. A primeira vitória está chegando.', 'NO EIXO: NÚMERO DA PROVA'))

donos = [('S1', 'Melqui Brayner', '14,085'), ('S2', 'Willian Cardoso', '24,303'), ('S3', 'Lucas Pinheiro', '21,841')]
dr = ''.join(f'<div class="row" style="grid-template-columns:130px 1fr auto;gap:28px;padding:26px 30px"><span class="imp" style="font-size:80px;line-height:1;color:#4d8dff">{s}</span><span class="nm" style="font-size:54px;line-height:1">{n}</span><span class="imp tab" style="font-size:80px;line-height:1">{t}</span></div>' for s, n, t in donos)
piece(E, 'E05-donos-dos-trechos', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:26px;box-sizing:border-box">
<span class="eb">CIRCUITO 101 · NÚCLEO DO GRUPO</span>
<span class="imp" style="font-size:150px;line-height:.88">Donos dos<br>trechos</span>
<span class="mut" style="font:500 34px/1.35 Inter,sans-serif">O melhor tempo de cada trecho da pista entre os pilotos com 5 ou mais provas.</span>
<div style="display:flex;flex-direction:column;gap:20px">{dr}</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:4px solid #f2b705;padding-top:22px"><span style="font:600 32px/1.3 Inter,sans-serif">Juntando os três</span><span class="imp tab" style="font-size:120px;line-height:.9;color:#f2b705">1:00,229</span></div>
</div>''' + foot('QUEM ROUBA UM TRECHO?'))

piece(E, 'E06-mais-constante', 1080, 1350, track(940, 975) + '''
<div class="eb" style="position:absolute;left:72px;top:96px;font-size:32px">CIRCUITO 101 · NÚCLEO DO GRUPO</div>
<div class="imp" style="position:absolute;left:66px;top:150px;font-size:130px;line-height:.9">O mais<br>constante</div>
<div class="imp tab" style="position:absolute;left:50px;top:420px;font-size:280px;line-height:.9;text-transform:none">±1,012 s</div>
<div style="position:absolute;left:72px;top:1010px;display:flex;flex-direction:column;gap:14px"><span class="nm" style="font-size:64px;line-height:1">Melqui Brayner</span><span class="mut" style="font:500 32px/1.35 Inter,sans-serif">É o quanto as voltas dele variam em média.<br>Quanto menor, mais igual uma volta da outra.</span></div>
''' + foot())

flags = [('#1e8a4c', '', 'Verde', 'pista liberada, pode acelerar'), ('#f2b705', '', 'Amarela', 'perigo à frente: reduza e não ultrapasse'), ('#0062e6', '', 'Azul', 'alguém mais rápido vem aí: facilite a passagem'), ('#c62828', '', 'Vermelha', 'prova parada: reduza e siga para o box'), ('#000', 'border:3px solid #c9cdd3;', 'Preta', 'vá para o box'), ('chk', '', 'Quadriculada', 'fim da prova')]
fl = ''.join(f'<div style="display:grid;grid-template-columns:120px 1fr;gap:28px;align-items:center"><span class="{"chk" if c == "chk" else ""}" style="height:76px;border-radius:8px;{"background-color:#000;background-size:38px 38px;background-position:0 0,19px 19px;" if c == "chk" else "background:" + c + ";"}{extra}"></span><span style="display:flex;flex-direction:column;gap:4px"><span class="nm" style="font-size:50px;line-height:1">{n}</span><span class="mut" style="font:500 30px/1.25 Inter,sans-serif">{d}</span></span></div>' for c, extra, n, d in flags)
piece(E, 'E07-primeira-vez-1-capa', 1080, 1350, '''
<div class="chk" style="position:absolute;left:-80px;right:-80px;top:560px;height:100px;transform:rotate(-12deg);opacity:.9"></div>
<img class="logo" src="@LOGO@" style="position:absolute;left:340px;top:90px;width:400px;height:333px">
<div style="position:absolute;left:72px;right:72px;top:820px;display:flex;flex-direction:column;gap:22px">
<span class="eb">GUIA DO ESTREANTE</span>
<span class="imp" style="font-size:150px;line-height:.88">Primeira vez<br>no kart?</span>
<span class="mut" style="font:500 34px/1.35 Inter,sans-serif">O que você precisa saber antes da sua primeira bateria.</span>
</div>''' + foot('ARRASTA →', False))
piece(E, 'E07-primeira-vez-2-bandeiras', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:26px;box-sizing:border-box">
<span class="eb">GUIA DO ESTREANTE · 1/2</span>
<span class="imp" style="font-size:130px;line-height:.88">As bandeiras</span>
<div style="display:flex;flex-direction:column;gap:22px;margin-top:8px">{fl}</div>
</div>''' + foot('ARRASTA →', False))
dicas = [('Chegue 30 min antes', 'pesagem, macacão e o briefing da pista'), ('Capacete bem justo', 'com balaclava; se balançar, troque o tamanho'), ('Freie em linha reta', 'e só acelere de novo saindo da curva'), ('Olhe para onde quer ir', 'o kart vai para onde seus olhos apontam'), ('Divirta-se primeiro', 'o tempo de volta vem com as baterias')]
dc = ''.join(f'<div class="row" style="grid-template-columns:90px 1fr;gap:24px;padding:22px 26px"><span class="pill" style="background:#0062e6;color:#fff;font-size:52px;line-height:1;padding:8px 0">{i+1}</span><span style="display:flex;flex-direction:column;gap:6px"><span class="nm" style="font-size:48px;line-height:1">{a}</span><span class="mut" style="font:500 28px/1.25 Inter,sans-serif">{b}</span></span></div>' for i, (a, b) in enumerate(dicas))
piece(E, 'E07-primeira-vez-3-dicas', 1080, 1350, f'''
<div style="position:absolute;inset:0;padding:80px 72px 64px;display:flex;flex-direction:column;gap:24px;box-sizing:border-box">
<span class="eb">GUIA DO ESTREANTE · 2/2</span>
<span class="imp" style="font-size:130px;line-height:.88">5 dicas</span>
<div style="display:flex;flex-direction:column;gap:18px;margin-top:6px">{dc}</div>
</div>''' + foot('MARCA QUEM VAI ESTREAR', True))

opc = ''.join(f'<div class="row" style="grid-template-columns:90px 1fr;gap:24px;padding:22px 28px"><span class="pill {c}" style="font-size:48px;line-height:1;padding:6px 0">P{i+1}</span><span style="display:flex;flex-direction:column;gap:4px"><span class="nm" style="font-size:52px;line-height:1">{n}</span><span class="mut" style="font:500 28px/1.2 Inter,sans-serif">{p} pts no campeonato</span></span></div>' for i, (n, p, c) in enumerate([('Lucas Pinheiro', 228, 'g'), ('Lucas Santacroce', 135, 's'), ('Guilherme Gama', 91, 'b'), ('Willian Cardoso', 63, 'n')]))
piece(E, 'E08-story-quem-vence-prova-14', 1080, 1920, f'''
<img class="logo" src="@LOGO@" style="position:absolute;left:72px;top:270px;width:180px;height:150px">
<div style="position:absolute;left:72px;right:72px;top:470px;display:flex;flex-direction:column;gap:22px">
<span class="eb">PALPITE · PROVA 14</span>
<span class="imp" style="font-size:170px;line-height:.88">Quem vence?</span>
<div style="display:flex;flex-direction:column;gap:18px;margin-top:10px">{opc}</div>
<div style="margin-top:24px;height:260px;border:3px dashed #4b515c;border-radius:20px;display:flex;align-items:center;justify-content:center;color:#6b7280;font:600 30px/1.3 Inter,sans-serif;text-align:center">Coloque aqui a figurinha<br>de enquete do Instagram</div>
</div>''')

# ---------------- MODELOS PARA PREENCHER ----------------
piece(M, 'M01-convocacao-post', 1080, 1350, '''
<img class="logo" src="@LOGO@" style="position:absolute;left:340px;top:60px;width:400px;height:333px">
<div class="chk" style="position:absolute;left:-80px;right:-80px;top:430px;height:80px;transform:rotate(-12deg);opacity:.9"></div>
<div class="eb" style="position:absolute;left:72px;top:670px;font-size:34px;letter-spacing:.14em">CONVOCAÇÃO</div>
<div class="imp" style="position:absolute;left:66px;top:715px;font-size:170px;line-height:.88">Prova 14</div>
<div style="position:absolute;left:72px;right:72px;top:890px;display:flex;flex-direction:column;gap:10px">
''' + ''.join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:16px 0;border-bottom:3px solid #0062e6"><span class="mut" style="font:500 36px/1 Inter,sans-serif">{a}</span><b class="imp" style="font-size:64px;line-height:1">{b}</b></div>' for a, b in [('Data', '[dd/mm]'), ('Kartódromo', '[Granja Viana]'), ('Largada', '[hh:mm]')]) + '''
</div>
<div class="foot"><span>@inimigosdotracado</span><span>CONFIRME NO STORY</span></div>''')

piece(M, 'M02-convocacao-story', 1080, 1920, '''
<img class="logo" src="@LOGO@" style="position:absolute;left:360px;top:290px;width:360px;height:300px">
<div class="chk" style="position:absolute;left:-60px;right:-60px;top:650px;height:110px;transform:rotate(-12deg)"></div>
<div class="eb" style="position:absolute;left:72px;top:860px;font-size:36px;letter-spacing:.14em">CONVOCAÇÃO</div>
<div class="imp" style="position:absolute;left:66px;top:910px;font-size:200px;line-height:.88">Prova 14</div>
<div style="position:absolute;left:72px;right:72px;top:1140px;display:flex;flex-direction:column;gap:12px">
''' + ''.join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:20px 0;border-bottom:3px solid #0062e6"><span class="mut" style="font:500 36px/1 Inter,sans-serif">{a}</span><b class="imp" style="font-size:64px;line-height:1">{b}</b></div>' for a, b in [('Data', '[dd/mm]'), ('Kartódromo', '[Granja Viana]'), ('Largada', '[hh:mm]')]) + '''
</div>''')

slots = ''.join('<div class="row" style="grid-template-columns:1fr auto;gap:24px;padding:22px 28px"><span class="nm" style="font-size:50px;line-height:1">[Nome da pilota]</span><span class="mut" style="font:600 30px/1 Inter,sans-serif">[N] provas</span></div>' for _ in range(4))
piece(M, 'M03-elas-no-grid', 1080, 1350, f'''
<div class="chk" style="position:absolute;right:-120px;top:-60px;width:560px;height:220px;transform:rotate(-12deg);opacity:.9"></div>
<div style="position:absolute;inset:0;padding:240px 72px 64px;display:flex;flex-direction:column;gap:24px;box-sizing:border-box">
<span class="eb">ELAS NO GRID</span>
<span class="imp" style="font-size:150px;line-height:.88">Lugar delas<br>é na pista</span>
<span class="mut" style="font:500 34px/1.35 Inter,sans-serif">[N] pilotas já aceleraram com a gente. Bora encher o grid.</span>
<div style="display:flex;flex-direction:column;gap:16px;border-top:4px solid #0062e6;padding-top:24px">{slots}</div>
</div>''' + foot('MARQUE UMA AMIGA PRA ESTREAR'))

json.dump([{k: v for k, v in p.items() if k != 'html'} for p in pieces], open(os.path.join(outdir, 'pieces.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for p in pieces:
    open(os.path.join(outdir, p['name'] + '.html'), 'w', encoding='utf-8').write(p['html'])
print(len(pieces), 'peças; estreantes P13:', [r['piloto'] for r in estreantes13])

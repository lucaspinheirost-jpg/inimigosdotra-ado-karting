"""Aplicações da logo: foto de perfil, papéis de parede, capas de destaque e banner."""
import os, sys, json, pathlib
root, outdir = sys.argv[1:3]
LOGO = pathlib.Path(root, 'Logo', 'Logo Kart - fundo transparente.png').resolve().as_uri()
os.makedirs(outdir, exist_ok=True)
HEAD = '''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&family=Inter:wght@500;600&display=swap">
<style>
body{margin:0;background:#000}
.c{position:relative;overflow:hidden;background:#000;color:#fff;font-family:Inter,sans-serif}
.chk{background-image:linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%),linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%)}
.imp{font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-style:italic;font-weight:800;text-transform:uppercase}
img{position:absolute;object-fit:contain;image-rendering:auto}
</style></head><body>'''
pieces = []
def piece(folder, name, w, h, body):
    pieces.append({'folder': folder, 'name': name, 'w': w, 'h': h,
                   'html': HEAD + f'<div class="c" style="width:{w}px;height:{h}px">' + body.replace('@LOGO@', LOGO) + '</div></body></html>'})

def logo(cx, cy, w):
    h = round(w * 238 / 286)
    return f'<img src="@LOGO@" style="left:{cx - w // 2}px;top:{cy - h // 2}px;width:{w}px;height:{h}px">'

def textura(w, h, size=48, op=.06):
    return f'<div class="chk" style="position:absolute;inset:0;background-size:{size}px {size}px;background-position:0 0,{size//2}px {size//2}px;opacity:{op}"></div>'

def tracado(w, h, y):
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="position:absolute;left:0;top:0">'
            f'<path d="M-20 {y} C {w*.3:.0f} {y-10}, {w*.65:.0f} {y-30}, {w+20} {y-h*.12:.0f}" fill="none" stroke="#f2b705" stroke-width="5" stroke-dasharray="18 14"/>'
            f'<path d="M-20 {y+34} C {w*.33:.0f} {y+44}, {w*.7:.0f} {y+14}, {w+20} {y-h*.06:.0f}" fill="none" stroke="#0062e6" stroke-width="22" stroke-linecap="round"/></svg>')

P, W, I = '01 - Foto de perfil', '02 - Papeis de parede', '03 - Instagram destaques'

# Foto de perfil (grupo do WhatsApp, Instagram, qualquer rede): logo dentro do círculo de corte
piece(P, 'foto-perfil-whatsapp-instagram-1080', 1080, 1080, logo(540, 545, 860))
piece(P, 'foto-perfil-com-anel-azul-1080', 1080, 1080,
      '<div style="position:absolute;left:20px;top:20px;width:1040px;height:1040px;border-radius:50%;box-sizing:border-box;border:18px solid #0062e6"></div>' + logo(540, 545, 780))

# Papel de parede da conversa do WhatsApp: escuro e calmo para as mensagens lerem bem
piece(W, 'whatsapp-papel-de-parede-conversa-1080x2340', 1080, 2340,
      textura(1080, 2340, 54, .05) + logo(540, 1170, 620).replace('style="', 'style="opacity:.35;'))

# Papel de parede do celular (tela de bloqueio e início): espaço livre em cima para o relógio
piece(W, 'celular-papel-de-parede-1080x2340', 1080, 2340,
      textura(1080, 2340, 54, .05) +
      '<div class="chk" style="position:absolute;left:-120px;right:-120px;top:1560px;height:120px;transform:rotate(-12deg);background-size:60px 60px;background-position:0 0,30px 30px;opacity:.9"></div>' +
      logo(540, 1180, 820) +
      tracado(1080, 2340, 1980) +
      '<div class="imp" style="position:absolute;left:0;right:0;top:1820px;text-align:center;font-size:44px;letter-spacing:.06em;color:#c9cdd3">Toda prova vira história</div>')

# Papel de parede de computador / capa horizontal
piece(W, 'computador-papel-de-parede-1920x1080', 1920, 1080,
      textura(1920, 1080, 54, .05) +
      '<div class="chk" style="position:absolute;right:-200px;top:-80px;width:900px;height:200px;transform:rotate(-12deg);background-size:60px 60px;background-position:0 0,30px 30px;opacity:.9"></div>' +
      logo(560, 540, 760) + tracado(1920, 1080, 930) +
      '<div style="position:absolute;left:1020px;top:380px;display:flex;flex-direction:column;gap:18px">'
      '<span style="font:600 30px/1 Inter,sans-serif;letter-spacing:.12em;color:#c9cdd3">KART RENTAL · SÃO PAULO</span>'
      '<span class="imp" style="font-size:150px;line-height:.88">Inimigos<br>do Traçado</span></div>')

# Capas de destaque do Instagram (1080x1920; o Instagram mostra só o círculo central)
for nome, txt, ouro in [('resultados', 'P1', True), ('ranking', 'TOP 10', False), ('proxima-prova', '14', False), ('bastidores', 'PIT', False), ('raio-x', 'S1·S2', False)]:
    fs = 230 if len(txt) <= 3 else 170
    piece(I, f'destaque-{nome}', 1080, 1920,
          '<div style="position:absolute;left:240px;top:660px;width:600px;height:600px;border-radius:50%;background:#000;box-shadow:0 0 0 14px #0062e6;overflow:hidden">'
          '<div class="chk" style="position:absolute;left:-40px;right:-40px;bottom:70px;height:70px;transform:rotate(-12deg);background-size:35px 35px;background-position:0 0,17px 17px;opacity:.9"></div>'
          f'<div class="imp" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:{fs}px;line-height:1;padding-bottom:40px;color:{"#f2b705" if ouro else "#fff"}">{txt}</div></div>')

json.dump([{k: v for k, v in p.items() if k != 'html'} for p in pieces], open(os.path.join(outdir, 'pieces.json'), 'w', encoding='utf-8'), ensure_ascii=False)
for p in pieces:
    open(os.path.join(outdir, p['name'] + '.html'), 'w', encoding='utf-8').write(p['html'])
print(len(pieces), 'peças')

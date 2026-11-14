"""Monta o histórico das 13 provas para a Administração: lista de arquivos a subir e prévia de cada um."""
import csv, glob, os, re, sys, json, html as H
from collections import defaultdict
from pypdf import PdfReader
root, scratch = sys.argv[1:3]
up = os.path.join(scratch, 'seed_upload'); os.makedirs(up, exist_ok=True)

def secs(t):
    p = t.split(':'); return round(sum(float(x) * 60 ** i for i, x in enumerate(reversed(p))), 3)
def volta(s):
    m = int(s // 60)
    return (f"{s:.3f} s" if m == 0 else f"{m}:{s - m * 60:06.3f}").replace('.', ',')
import unicodedata
def key(s): return re.sub(r'[^A-Z]', '', ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper())
def rd(f):
    b = open(f, 'rb').read()
    try: return b.decode('utf-8')
    except UnicodeDecodeError: return b.decode('cp1252')

res = defaultdict(list)
for r in csv.DictReader(open(os.path.join(scratch, 'resultados_inimigos_do_tracado.csv'), encoding='utf-8')): res[int(r['corrida'])].append(r)
laps = defaultdict(list)
for r in csv.DictReader(open(os.path.join(scratch, 'voltas_inimigos_do_tracado.csv'), encoding='utf-8')): laps[int(r['corrida'])].append(r)

def tomada_rows(f):
    if f.endswith('.html'):
        t = re.sub(r'<td([^>]*)/>', r'<td\1></td>', rd(f))
        hdr = [h.strip() for h in re.findall(r'<th[^>]*>(.*?)</th>', t, re.S)]
        iN, iB = hdr.index('Nome'), hdr.index('Melhor Tempo')
        out = []
        for tr in re.findall(r'<tr>(.*?)</tr>', t, re.S):
            c = [H.unescape(re.sub('<[^>]+>', '', x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
            if c and c[0].isdigit() and len(c) > iB and c[iB]:
                out.append((int(c[0]), re.sub(r'^\[\d+\]\s*', '', c[iN]).strip(), secs(c[iB])))
        return out
    t = '\n'.join(pg.extract_text() for pg in PdfReader(f).pages)
    pat = r'(?:^| )(\d{1,2}) (\d{3}) (?:\[\d+\] )?([A-ZÀ-Ü][A-ZÀ-Ü .]+?) RENTAL (?:\d{1,2} )?(\d:\d\d\.\d{3})'
    out = [(int(m.group(1)), m.group(3).strip(), secs(m.group(4))) for m in re.finditer(pat, re.sub(r'\s+', ' ', t))]
    if not out:
        for ln in t.splitlines():
            m = re.match(r'^(\d{1,2})(\d{3})(.+?) ?RENTAL ?(?:\d{1,2})?(\d:\d\d\.\d{3})', ln)
            if m: out.append((int(m.group(1)), m.group(3).strip(), secs(m.group(4))))
    return out

PISTA = {5: 'Circuito 136', 4: '', 7: ''}
OBS = {3: 'Voltas ~30% mais lentas (piso lento)', 12: 'Voltas ~30% mais lentas (piso lento)'}
provas, uploads = [], []
for d in sorted(glob.glob(os.path.join(root, '[0-9][0-9] - *'))):
    if not os.path.isdir(d): continue
    n, data, kart = [x.strip() for x in os.path.basename(d).split(' - ')]
    n = int(n); dd, mm, yy = data.split('-')
    arq = {}
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        if not os.path.isfile(p): continue
        slot = 'corrida' if f.startswith('Prova') else 'tomada' if f.startswith('Tomada') else 'voltas' if f.startswith('Volta') else None
        if not slot: continue
        ext = f.rsplit('.', 1)[1].lower()
        fmt = 'HTML' if ext in ('html', 'htm') else 'PDF' if ext == 'pdf' else 'Foto'
        src = p
        if fmt == 'HTML':
            src = os.path.join(up, f'{n:02d}-{slot}.txt')
            open(src, 'w', encoding='utf-8').write(rd(p))
        else:
            src = os.path.join(up, f'{n:02d}-{slot}.{ext}')
            open(src, 'wb').write(open(p, 'rb').read())
        # prévia
        prev = None
        if slot == 'corrida':
            rs = sorted(res[n], key=lambda r: int(r['pos']))
            b = min(rs, key=lambda r: float(r['melhor_volta_s']))
            prev = f"{len(rs)} pilotos · P1 {rs[0]['piloto']} · melhor volta {volta(float(b['melhor_volta_s']))} ({b['piloto']}) · {rs[0]['voltas']} voltas"
        elif slot == 'voltas':
            ls = laps[n]
            if ls:
                prev = f"{len({r['piloto'] for r in ls})} {'piloto' if len({r['piloto'] for r in ls}) == 1 else 'pilotos'} · {len(ls)} voltas registradas"
                if any(r['s1'] for r in ls): prev += ' · com setores S1, S2 e S3'
            else:
                prev = 'Foto escaneada: o volta a volta não pôde ser lido'
        else:
            try:
                tr = tomada_rows(p)
                if tr:
                    pole = min(tr, key=lambda x: x[0]); best = min(tr, key=lambda x: x[2])
                    canon = sorted({r['piloto'] for rs in res.values() for r in rs}, key=lambda c: -len(key(c)))
                    pk = key(pole[1])
                    nome = next((c for c in canon if key(c) == pk), None) or next((c for c in canon if pk.startswith(key(c))), None) \
                        or ' '.join(w.capitalize() if w.lower() not in ('de', 'da', 'do', 'dos') else w.lower() for w in pole[1].split())
                    prev = f"{len(tr)} pilotos · pole {nome} · melhor volta {volta(best[2])}"
            except Exception as e:
                prev = None
        arq[slot] = {'nome': f, 'formato': fmt, 'tamanho': os.path.getsize(src), 'previa': prev, 'src': src}
        uploads.append(src)
    provas.append({'id': f'p{n:03d}', 'numero': n, 'data': f'{yy}-{mm}-{dd}', 'kartodromo': kart, 'tracado': 'Circuito 101' if kart == 'Granja Viana' and n != 5 else PISTA.get(n, ''),
                   'observacao': OBS.get(n, ''), 'arquivos': {s: arq.get(s) for s in ('corrida', 'tomada', 'voltas')}})
json.dump(provas, open(os.path.join(scratch, 'seed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in provas:
    print(p['numero'], p['data'], p['kartodromo'], p['tracado'], '|', {k: (v['formato'], v['previa']) if v else None for k, v in p['arquivos'].items()})
print('arquivos:', len(uploads))
